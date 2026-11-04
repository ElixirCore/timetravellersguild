<?php
/* The Guild Workbench - the Time Machine working archive.
   Behind the passport: signed-in citizens only; everyone else is sent to the office.
   Each citizen's archive is kept by the office, server-side, under their citizen
   number alone, and served only to their own signed-in session. That is the only
   real privacy boundary between travellers sharing one browser: anything kept in
   the browser itself is readable by every traveller on it.
   Legacy browser-local data (from before the passport) is left exactly where it
   is, untouched; a traveller who owns it can carry it in with Export/Import.
   Original Workbench source preserved whole; serve-time changes: archive load/save
   goes to the office, the seal token is embedded, wording matches where the
   archive lives, and the mobile stylesheet keeps the page inside the viewport. */

session_name('TTGPASS');
session_set_cookie_params(['path'=>'/passport/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
session_start();

if(empty($_SESSION['citizen'])){
  header('Location: ./', true, 303);
  exit;
}

define('REG_DIR', (is_writable(dirname(__DIR__,3)) || is_dir(dirname(__DIR__,3).'/ttg-passport')) ? dirname(__DIR__,3).'/ttg-passport' : __DIR__.'/registry');

$cid=preg_replace('/[^a-f0-9]/','',(string)($_SESSION['citizen']['id']??''));
$wbfile=REG_DIR.'/workbench-'.$cid.'.json';
if(empty($_SESSION['csrf'])) $_SESSION['csrf']=bin2hex(random_bytes(32));

if(($_GET['a']??'')==='load'){
  header('Content-Type: application/json');
  header('Cache-Control: no-store');
  if(is_file($wbfile)) readfile($wbfile); else echo 'null';
  exit;
}
if(($_POST['a']??'')==='save' && $_SERVER['REQUEST_METHOD']==='POST'){
  header('Content-Type: text/plain');
  if(!hash_equals($_SESSION['csrf'],(string)($_SERVER['HTTP_X_TTG_SEAL']??''))){ http_response_code(403); echo 'seal'; exit; }
  $body=(string)($_POST['json']??'');
  if(strlen($body)>7340032){ http_response_code(413); echo 'too large'; exit; }
  $d=json_decode($body,true);
  if(!is_array($d) || !isset($d['entries'],$d['materials'],$d['milestones'],$d['questions'],$d['tiers'],$d['checks'])){ http_response_code(400); echo 'shape'; exit; }
  if(!is_dir(REG_DIR)) mkdir(REG_DIR,0700,true);
  file_put_contents($wbfile,json_encode($d),LOCK_EX); chmod($wbfile,0600);
  echo 'kept'; exit;
}
if(($_POST['a']??'')==='agent' && $_SERVER['REQUEST_METHOD']==='POST'){
  header('Content-Type: application/json');
  header('Cache-Control: no-store');
  if(!hash_equals($_SESSION['csrf'],(string)($_SERVER['HTTP_X_TTG_SEAL']??''))){ http_response_code(403); echo json_encode(['error'=>'seal']); exit; }
  $type=preg_replace('/[^a-z]/','',(string)($_POST['type']??'entry'));
  $title=trim((string)($_POST['title']??''));
  $ctx=substr(trim((string)($_POST['ctx']??'')),0,600);
  if(!$title){ http_response_code(400); echo json_encode(['error'=>'title']); exit; }
  /* read OpenAI key from ttg-private/.env */
  $key='';
  foreach([dirname(__DIR__,4).'/ttg-private/.env',dirname(__DIR__,3).'/../ttg-private/.env'] as $p){
    if(is_file($p)){ $e=file_get_contents($p); if(preg_match('/OPENAI_API_KEY[=:\s]+([^\s#]+)/',$e,$m)){ $key=trim($m[1]); break; } }
  }
  if(!$key){ http_response_code(503); echo json_encode(['error'=>'no key']); exit; }
  $typeLabel=['entry'=>'build log entry','material'=>'material or technique record','milestone'=>'milestone record','question'=>'open question'];
  $label=$typeLabel[$type]??'record';
  $statuses=['entry'=>'Verified construction|Unfinished work|Proposal|Reported — needs evidence','material'=>'Verified construction|Unfinished work|Proposal|Reported — needs evidence','milestone'=>'Verified construction|Unfinished work|Proposal|Reported — needs evidence','question'=>'Open|Under review|Answered'][$type]??'Proposal';
  $sys='You are a production archivist helping document the Time Travellers Guild\'s physical Time Machine build — a prop under construction in a living room, being documented toward a Kickstarter campaign. Write specific, grounded, practical archive records. Be concise and direct. Use only the statuses listed.';
  $user='Write a '.$label.' for: "'.$title.'".'.($ctx?' Existing archive titles for context: '.$ctx.'.':'').' Return JSON with keys: notes (1-3 sentences, specific and grounded), status (one of: '.$statuses.')'.($type==='entry'?', caption (a short reusable Kickstarter caption)':'').'.';
  $payload=json_encode(['model'=>'gpt-4o-mini','messages'=>[['role'=>'system','content'=>$sys],['role'=>'user','content'=>$user]],'response_format'=>['type'=>'json_object'],'max_tokens'=>350,'temperature'=>0.6]);
  $ctx2=stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\nAuthorization: Bearer $key\r\n",'content'=>$payload,'timeout'=>18,'ignore_errors'=>true]]);
  $raw=@file_get_contents('https://api.openai.com/v1/chat/completions',false,$ctx2);
  if($raw===false){ http_response_code(502); echo json_encode(['error'=>'upstream']); exit; }
  $resp=json_decode($raw,true);
  $content=$resp['choices'][0]['message']['content']??null;
  if($content===null){ http_response_code(502); echo json_encode(['error'=>'parse','raw'=>substr($raw,0,200)]); exit; }
  /* content is already a JSON string from json_object mode */
  echo $content;
  exit;
}

$seal_safe=$_SESSION['csrf'];
$html=<<<'WBHTML'
<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Time Machine — Guild Workbench</title><style>
:root{--ink:#203d35;--paper:#f4f1e7;--line:#d4d8c9;--green:#d5e7ad}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.6 system-ui}button,input,textarea,select{font:inherit}button,a{cursor:pointer}button{border:1px solid var(--line);border-radius:5px;background:transparent;color:var(--ink);padding:9px 15px}button:hover{background:var(--green)}.shell{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:100vh}aside,main{min-width:0}aside{padding:32px 23px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:24px}.seal{font:46px Georgia;border:1px solid var(--ink);border-radius:50%;width:72px;height:72px;text-align:center}.brand{font:24px Georgia;line-height:1.2}small,.eyebrow{font:11px/1.5 monospace;letter-spacing:1.5px;text-transform:uppercase}nav{display:grid;gap:6px}nav button{text-align:left;border:0}nav button.active{background:var(--green)}.asidefoot{margin-top:auto;font-size:12px}main{padding:32px 5vw 70px;max-width:1500px}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:20px}.badge{font:11px monospace;border:1px solid var(--line);padding:5px 9px;border-radius:20px}.hero{display:grid;grid-template-columns:1fr 190px;gap:30px;align-items:center;margin:38px 0}h1{font:clamp(38px,5vw,68px)/1.05 Georgia;margin:12px 0 20px;font-weight:normal;letter-spacing:-2px}h2{font:29px Georgia;font-weight:normal}h3{margin:0 0 10px;font:22px Georgia}p{max-width:680px}.orb{width:170px;height:170px;border:1px solid #809579;border-radius:50%;position:relative;display:grid;place-items:center;font:48px Georgia;background:repeating-radial-gradient(circle,transparent 0 17px,#b8c5ad 18px,transparent 19px)}.orb:after{content:'XIII';background:var(--paper);padding:10px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.card,.panel{border:1px solid var(--line);padding:22px;border-radius:7px;background:#faf8f0}.card strong{display:block;font:38px Georgia;margin:8px 0}.grid{display:grid;grid-template-columns:1.6fr 1fr;gap:22px;margin-top:28px}.row{padding:18px 0;border-bottom:1px solid var(--line)}.row:last-child{border:0}.muted{color:#65736a}.pill{font:11px monospace;background:#e7e9dc;padding:4px 7px;border-radius:3px;display:inline-block}.verified{background:#d8e9be}.proposed{background:#f0dfb7}a{color:inherit;text-underline-offset:4px}label{display:grid;gap:5px;margin:14px 0;font-size:13px}input,textarea,select{width:100%;padding:10px;border:1px solid #b9c3b3;background:#fffef8;border-radius:4px;color:var(--ink)}textarea{min-height:100px}dialog{border:1px solid var(--line);border-radius:9px;max-width:650px;width:94%;max-height:90vh;overflow-y:auto;background:var(--paper);color:var(--ink)}dialog::backdrop{background:#15332899}.actions{display:flex;gap:8px;flex-wrap:wrap}.primary{background:var(--ink);color:var(--paper)}.entryphotos{display:flex;gap:10px;flex-wrap:wrap}.entryphotos img{width:130px;height:110px;object-fit:cover;border-radius:4px}.tiers{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.check{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line);padding:15px 0}.check input{width:18px}.toast{position:fixed;bottom:20px;right:20px;background:var(--ink);color:white;padding:12px 20px;border-radius:5px;display:none;z-index:9}
#q-wrap{position:relative}#q{width:100%;padding:7px 10px;border:1px solid var(--line);border-radius:4px;background:#fffef8;color:var(--ink);font:12px system-ui}#q-results{position:absolute;left:0;right:0;top:100%;background:#fffef8;border:1px solid var(--line);border-top:0;border-radius:0 0 4px 4px;z-index:8;display:none;max-height:260px;overflow-y:auto}.qr{padding:7px 10px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--line);line-height:1.3}.qr:last-child{border:0}.qr:hover,.qr:focus{background:var(--green);outline:0}.qr small{display:block;color:#65736a;font-size:10px}
.agent-btn{font:11px/1 monospace;letter-spacing:.08em;padding:5px 9px;border-radius:3px;background:#e7f0dc;border-color:#9db88a;margin-top:4px;display:inline-block}.agent-btn:hover{background:#d5e7ad}.agent-thinking{color:#65736a;font-size:12px;margin:4px 0}
@media(max-width:850px){.shell{grid-template-columns:minmax(0,1fr)}aside{padding:18px;border-right:0;border-bottom:1px solid var(--line)}.seal,.asidefoot{display:none}.brand{font-size:20px}nav{display:flex;overflow:auto;gap:3px}nav button{white-space:nowrap}main{padding:22px}.hero{grid-template-columns:1fr}.orb{display:none}.cards{grid-template-columns:repeat(2,1fr)}.grid,.tiers{grid-template-columns:1fr}.top{gap:10px;flex-wrap:wrap}}
</style><div class="shell"><aside><div class="seal">⌁</div><div class="brand">Time Travellers<br>Guild</div><small>Time Machine / Working archive</small><div id="q-wrap"><input type="search" id="q" placeholder="Search archive…" autocomplete="off" oninput="searchAll(this.value)" onkeydown="qKey(event)"><div id="q-results" role="listbox"></div></div><nav id="nav"></nav><div class="asidefoot">DEPARTMENT OF EXCESS TIME<br><br>Pending, not canon.<br><br>Working data is kept by the office for you alone, behind your passport. Export a backup to carry it elsewhere.</div></aside><main><div class="top"><small>Godden Interactive / Production desk</small><span class="badge">PRIVATE DRAFT · UNPUBLISHED</span><button id="export">Export backup ↓</button><button id="import">Import backup</button><input type="file" id="backup" accept="application/json" hidden></div><div id="view"></div></main></div><dialog id="editor"></dialog><div class="toast" role="status" id="toast"></div><script>
const SEAL='SEALPLACEHOLDER';const sections=['Chronicle','Overview','Build log','Materials & techniques','Milestones','Documentation checklist','Tier copy','Open questions','Context & links'];const statuses=['Verified construction','Unfinished work','Proposal','Reported — needs evidence'];const initial={entries:[{title:'Day 0 — The decision to build',date:'2026-10-22',status:'Verified construction',notes:'The Time Machine will be built in the living room. No plans exist yet. The form is a K6 telephone kiosk — the Guild\'s red box, the booth seen in /box. The decision was made quickly. The build begins.',source:'Direct observation — TG',caption:'Verified build record · 22 Oct 2026 — Day 0. The decision to build the Time Machine was made and the living room selected as the studio.',photos:[]},{title:'Day 1 — Room cleared, first materials assessed',date:'2026-10-23',status:'Reported — needs evidence',notes:'The living room was partially cleared to create a working space. First assessment of available timber and hardware. No purchase record confirmed. Build dimensions being worked out from the standard K6 kiosk — approximately 2.1m tall, 0.95m square footprint — scaled for the room.',source:'Reported from memory — no photographs confirmed for Day 1',caption:'Reported work — evidence pending · 23 Oct 2026 — Day 1. Room cleared and dimensions assessed against standard K6 kiosk proportions.',photos:[]},{title:'Day 2 — Frame begun, first photographs taken',date:'2026-10-24',status:'Verified construction',notes:'Photographs taken on 24 October 2026 show construction underway. The base frame and first vertical members are in evidence. Timber is PAR softwood. The build is proceeding in the living room. These are the earliest verified photographs in the record. Original images stored locally — not yet attached here.',source:'Photographs, 24 Oct 2026 — stored locally, not yet attached',caption:'Verified build record · 24 Oct 2026 — Day 2. Base frame and vertical members photographed. First confirmed evidence of the Time Machine under construction.',photos:[]},{title:'Chronometer XIII — instrument identified for the booth interior',date:'',status:'Proposal',notes:'The orrery — Chronometer XIII — is designated as the Time Machine\'s primary instrument. It exists as a digital/software object at timetravellersguild.com/box and in the fulldome projection at /cultvr. A physical representation needs to be built or sourced for the booth interior. The lamp at the crown should echo the pulsing lamp in /box. This is unresolved.',source:'Cross-reference: timetravellersguild.com/now/tree node instrument-13',caption:'',photos:[]}],materials:[{title:'PAR softwood — structural frame',status:'Verified construction',notes:'45×45mm PAR (planed all round) softwood for the structural frame. Standard off-the-shelf from a builders\' merchant. Quantity not precisely costed — estimate 12–16 linear metres for a full K6-proportioned box. Cost unknown, pending receipt.'},{title:'MDF sheet — panel faces',status:'Proposal',notes:'12mm MDF for the flat panel faces. The K6 has a characteristic grid of recessed panels on each elevation. MDF machines cleanly but requires sealing and priming before paint. Approximate sheet requirement: 4–6 sheets of 2440×1220mm. No purchase confirmed.'},{title:'Post Office red — BS 538',status:'Proposal',notes:'The K6 kiosk red is BS 538 (Post Office red). Available as exterior gloss. Some builders use satin for interior performance builds. The choice between authentic exterior finish and practical indoor performance finish is unresolved. Brand and quantity TBC.'},{title:'GPO 700-series telephone handset',status:'Proposal',notes:'A period or period-style GPO 700-series telephone handset for the interior. These are available second-hand. Whether the handset will be functional (wired to anything) or decorative is not decided. The Guild\'s /box has the phone as a prop — this should match or exceed that in quality.'},{title:'Crown lantern fitting',status:'Proposal',notes:'The K6 is topped with a lantern housing. For the Time Machine this is Instrument XIII\'s lamp — the light at the crown that pulses in /box. Whether this will be a practical LED fitting (controllable brightness, possibly live during performance) or a decorative crown is unresolved. No supplier identified.'},{title:'Glazing bars and window frames',status:'Proposal',notes:'The K6 has eight windows per side elevation and two on the door — characteristic small-pane glazing. For the build: routed MDF bars with acrylic or polycarbonate sheet, not glass. Sheet thickness TBC. The arched top window is a distinguishing detail requiring a curved route or CNC cut.'},{title:'Applied lettering — crown panels',status:'Proposal',notes:'The K6 carries the word TELEPHONE cast into the crown panels. For the Guild\'s Time Machine this may read differently: CHRONOMETER (references Instrument XIII), STATION·XIII (the Guild\'s place node), or TELEPHONE (authentic). No decision taken. Options: vinyl cut, 3D-printed and painted, CNC-routed MDF. No supplier approached.'}],milestones:[{title:'Living room studio established',status:'Verified construction',notes:'The room has been cleared and set up as a workspace. Evidence: Day 2 photographs show build in progress, confirming the studio was operational by 24 October 2026. First confirmed milestone.'},{title:'Base frame and vertical members assembled',status:'Reported — needs evidence',notes:'Reported from Day 2 photographs. The structural base frame and at least some vertical members are visible in evidence. Full frame completion — all four corners, top rail, door frame — has not been confirmed in these records. Photographs not yet attached.'},{title:'Full structural frame complete',status:'Proposal',notes:'All eight vertical corners, four base rails, four top rails, door frame and crown base assembled and squared. This is the milestone at which the box first stands on its own. No evidence of completion exists in this archive.'},{title:'Panels fitted — all elevations',status:'Proposal',notes:'MDF panel faces fitted to all four elevations. The characteristic K6 panel grid visible. This milestone confirms the box has its skin and reads as a solid enclosure. No evidence of completion in this archive.'},{title:'Primed and painted — Post Office red',status:'Proposal',notes:'All surfaces primed and finished in BS 538 Post Office red. This is the milestone at which the box first reads as a K6 from a distance. No evidence of completion in this archive.'},{title:'Dressed and detailed — lantern, glazing, signage',status:'Proposal',notes:'Crown lantern fitted, window glazing in place, applied lettering fitted. This is the milestone at which the box is photographable as a finished object against a neutral background. No evidence of completion in this archive.'},{title:'Performance-ready — first showing',status:'Proposal',notes:'The box stands, is painted, dressed, and can be entered. Interior dressed. This milestone gates the Kickstarter campaign photography and any early-access supporter events. No evidence of completion in this archive.'},{title:'Kickstarter documentation complete',status:'Proposal',notes:'All campaign photographs taken, captions written, tier copy confirmed, funding target set, launch date agreed. The campaign is ready to go live. This milestone closes the pre-production phase. No evidence of completion in this archive.'}],questions:[{title:'What is the funding target and costed minimum build?',status:'Open',notes:'Unknown. Budget and campaign dates remain to be decided. A costed materials list would establish a floor. Labour is likely voluntary. Contingency unknown.'},{title:'What can each supporter tier promise?',status:'Open',notes:'Confirm prices, capacity, delivery, credits and participation arrangements before use. The current tier copy is draft invitation text only — it makes no specific promises and cannot be used as campaign copy until these are confirmed.'},{title:'Which photographs establish each construction milestone?',status:'Open',notes:'Attach original photographs and notes; distinguish capture date from entry date. Day 2 photographs (24 Oct 2026) are the earliest evidence on record. They have not been imported here.'},{title:'What is the performance or activation plan for the finished machine?',status:'Open',notes:'Is the Time Machine a prop for a performance, a walk-in exhibit, a photographic backdrop, or all three? The activation plan determines what finished means and who needs to be in the room.'},{title:'Who will document the build in video?',status:'Open',notes:'The Kickstarter campaign will need video content. Whether this is self-shot, commissioned or crowd-sourced is not decided. The build is happening now — documentation that cannot be re-shot needs to happen during construction.'},{title:'Does the crown lantern work electrically, and how does it connect to Chronometer XIII?',status:'Open',notes:'In /box the lamp pulses with the orrery. For the physical machine: is the lantern a practical light? Can it be controlled live during performance? Is it connected to any software? No decision taken.'},{title:'What does the box say instead of TELEPHONE?',status:'Under review',notes:'Options so far: TELEPHONE (authentic K6), CHRONOMETER (references Instrument XIII), STATION·XIII (the Guild\'s place node), or no lettering. The choice shapes how the machine reads to someone who does not know the Guild.'}],tiers:[{name:'Goodwill',price:'',capacity:'',delivery:'',copy:'Help the Time Travellers Guild document the making of its Time Machine. Your support contributes to a living record of an impossible object being built in an ordinary living room.',terms:'Draft invitation only. Benefits and commitments await agreement.'},{name:'Producer',price:'',capacity:'',delivery:'',copy:'Support the making and documentation of the Time Machine. Producers are credited in the finished documentation archive and receive a printed record of the build when it is complete.',terms:'Draft invitation only. Credit format and delivery date to be confirmed.'},{name:'Executive Producer',price:'',capacity:'',delivery:'',copy:'Help support the wider ambition of the Time Machine build — the documentation, the dome projection, the ongoing Guild work. Executive Producers are invited to a private showing before any public launch.',terms:'Draft invitation only. Showing date and format to be confirmed.'},{name:'Volunteer',price:'',capacity:'',delivery:'',copy:'Offer time and practical help to the build. Volunteers work alongside the maker, contribute to the construction record, and are credited as contributors to the Time Machine.',terms:'Draft invitation only. Dates, tasks and health-and-safety arrangements to be confirmed.'},{name:'Actor',price:'',capacity:'',delivery:'',copy:'Express interest in performing within the Time Travellers Guild. Actors are invited to audition for roles in activations and performances connected to the Time Machine once it is complete.',terms:'Draft invitation only. No performance date, casting process or payment terms have been set.'},{name:'Craftsperson',price:'',capacity:'',delivery:'',copy:'Bring a making skill to the Time Machine. Craftspeople contribute their practice — carpentry, painting, electrical, textile, metalwork — to specific stages of the build, with full credit.',terms:'Draft invitation only. Specific tasks, dates and arrangements to be confirmed before any commitment.'},{name:'Witch',price:'',capacity:'',delivery:'',copy:'Bring your particular practice to the Time Travellers Guild. Witches are invited to contribute something less easily named — ritual, care, presence, knowing — to the work of the Guild and the making of the Machine.',terms:'Draft invitation only. This tier is a holding form for a real contribution that has not yet found its proper shape.'}],checks:[['Attach original build photographs (Day 2, 24 Oct 2026 — not yet imported)',false],['Record capture dates and source notes for all photographs',false],['Verify completed construction against photographic evidence',false],['Record materials, quantities and costs (receipts)',false],['Confirm permissions for people appearing in photographs',false],['Draft and review reusable captions for all verified records',false],['Cost the build target and contingency',false],['Confirm tier prices, capacity and delivery for all 7 tiers',false],['Review Jack character attribution and IP wording',false],['Review all campaign copy before publication',false]]};let data=structuredClone(initial),loaded=false;let page='Overview',filter='All';const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));async function save(){if(!loaded){notify('Your archive could not be fetched from the office; changes made now are not being kept. Reload the page to try again.');return false}try{let r=await fetch('workbench.php?a=save',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-TTG-Seal':SEAL},body:'a=save&json='+encodeURIComponent(JSON.stringify(data))});if(r.ok)return true;notify(r.status===413?'The archive grew larger than the office can keep in one visit (about 7 MB). Export a backup, then use smaller photographs.':'The office could not keep that change just now ('+r.status+'). Export a backup to be safe.')}catch{notify('The office could not be reached. Export a backup to be safe.')}return false}function notify(t,dur=4000){$('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(notify._t);notify._t=setTimeout(()=>$('#toast').style.display='none',dur)}function tag(s){return '<span class="pill '+(s===statuses[0]?'verified':s===statuses[2]?'proposed':'')+'">'+esc(s)+'</span>'}function header(title,sub,action=''){return '<div class="hero"><div><small>THE TIME MACHINE / '+esc(page)+'</small><h1>'+title+'</h1><p class="muted">'+sub+'</p>'+action+'</div><div class="orb"></div></div>'}function button(label,fn){return '<button onclick="'+fn+'">'+label+'</button>'}

/* ── search ── */
const TYPE_LABEL={entries:'Build log',materials:'Materials',milestones:'Milestones',questions:'Questions'};
const TYPE_NAV={entries:'Build log',materials:'Materials & techniques',milestones:'Milestones',questions:'Open questions'};
function searchAll(q){
  let res=$('#q-results');
  q=q.trim();
  if(!q){res.style.display='none';return}
  let hits=[];
  Object.keys(TYPE_LABEL).forEach(t=>{
    data[t].forEach((e,i)=>{
      let hay=(e.title+' '+(e.notes||'')+' '+(e.caption||'')).toLowerCase();
      if(hay.includes(q.toLowerCase()))
        hits.push({t,i,label:e.title,sub:TYPE_LABEL[t]+(e.status?' · '+e.status:'')});
    });
  });
  if(!hits.length){res.innerHTML='<div class="qr muted">No matches</div>';res.style.display='block';return}
  res.innerHTML=hits.slice(0,10).map((h,idx)=>'<div class="qr" tabindex="0" data-idx="'+idx+'" onkeydown="qrKey(event,\''+h.t+'\','+h.i+')" onclick="goResult(\''+h.t+'\','+h.i+')">'+esc(h.label)+'<small>'+esc(h.sub)+'</small></div>').join('');
  res.style.display='block';
}
function goResult(type,i){
  $('#q').value='';$('#q-results').style.display='none';
  page=TYPE_NAV[type]; render();
  setTimeout(()=>{let els=document.querySelectorAll('.panel[data-rec]');let el=[...els].find(e=>e.dataset.rec===type+':'+i);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.outline='2px solid #809579';setTimeout(()=>el.style.outline='',1800)}},120);
}
function qKey(e){if(e.key==='Escape'){$('#q-results').style.display='none'}else if(e.key==='ArrowDown'){let f=$('#q-results .qr');if(f)f.focus()}}
function qrKey(e,t,i){if(e.key==='Enter'||e.key===' '){e.preventDefault();goResult(t,i)}else if(e.key==='ArrowDown'){let n=e.target.nextSibling;if(n&&n.classList.contains('qr'))n.focus()}else if(e.key==='ArrowUp'){let p=e.target.previousSibling;if(p&&p.classList.contains('qr'))p.focus();else $('#q').focus()}else if(e.key==='Escape'){$('#q-results').style.display='none';$('#q').focus()}}
document.addEventListener('click',e=>{if(!e.target.closest('#q-wrap'))$('#q-results').style.display='none'});

/* ── agent draft ── */
async function agentDraft(type){
  let f=$('#form');
  if(!f){notify('Open an edit form first');return}
  let titleEl=f.elements.namedItem('title');
  let title=titleEl?.value?.trim();
  if(!title){notify('Enter a title first — the agent drafts from it');return}
  let ctx=data[type]?.map(e=>e.title).filter(Boolean).join(', ')||'';
  let btn=$('#agent-btn');
  if(btn){btn.textContent='Drafting…';btn.disabled=true}
  notify('Asking the agent…',8000);
  try{
    let r=await fetch('workbench.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-TTG-Seal':SEAL},body:'a=agent&type='+encodeURIComponent(type)+'&title='+encodeURIComponent(title)+'&ctx='+encodeURIComponent(ctx.slice(0,500))});
    if(!r.ok){notify('Agent error ('+r.status+')');if(btn){btn.textContent='✦ Draft from title';btn.disabled=false}return}
    let d=JSON.parse(await r.text());
    if(d.error){notify('Agent: '+d.error);if(btn){btn.textContent='✦ Draft from title';btn.disabled=false}return}
    let notesEl=f.elements.namedItem('notes');
    if(d.notes&&notesEl)notesEl.value=d.notes;
    if(d.status&&f.status){[...f.status.options].forEach(o=>{if(o.value===d.status)o.selected=true})}
    let capEl=f.elements.namedItem('caption');
    if(d.caption&&capEl)capEl.value=d.caption;
    notify('Drafted — review before saving');
  }catch(e){notify('Agent did not respond. Try again.');console.error(e)}
  if(btn){btn.textContent='✦ Draft from title';btn.disabled=false}
}

/* ── auto-seed: if server returned null (no archive yet), populate from initial and save ── */
async function seedIfEmpty(serverWasNull){
  if(!serverWasNull) return;
  data=structuredClone(initial);
  loaded=true;
  await save();
  render();
}

/* ── chronicle: assembles build narrative from data ── */
function buildChronicle(){
  let events=[];
  sorted().forEach(e=>{
    let past=e.status===statuses[0]||e.status===statuses[3];
    events.push({date:e.date||null,title:e.title,body:e.notes,status:e.status,type:'entry',past});
  });
  data.milestones.forEach((m,i)=>{
    let reached=m.status===statuses[0];
    events.push({date:null,title:m.title,body:m.notes,status:m.status,type:'milestone',reached,order:i});
  });
  /* sort: dated entries first by date, then undated by type */
  events.sort((a,b)=>{
    if(a.date&&b.date) return a.date.localeCompare(b.date);
    if(a.date) return -1; if(b.date) return 1;
    if(a.type==='milestone'&&b.type!=='milestone') return 1;
    if(b.type==='milestone'&&a.type!=='milestone') return -1;
    return 0;
  });
  return events;
}
function chronicleFmt(date){
  if(!date) return null;
  try{let d=new Date(date+'T12:00:00Z');return d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}catch{return date}
}
const STATUS_GLYPH={[statuses[0]]:'◆',[statuses[1]]:'◇',[statuses[2]]:'○',[statuses[3]]:'◈','Open':'○','Under review':'◇','Answered':'◆','reached':'◆','pending':'○'};

function render(){ $('#nav').innerHTML=sections.map(s=>'<button class="'+(s===page?'active':'')+'" onclick="go(\''+s+'\')">'+s+'</button>').join('');let h='';if(page==='Chronicle'){
  let evs=buildChronicle();
  let verified=data.entries.filter(e=>e.status===statuses[0]).length;
  let mileDone=data.milestones.filter(m=>m.status===statuses[0]).length;
  h='<div class="hero"><div><small>THE TIME MACHINE / CHRONICLE</small><h1>A machine in progress.</h1><p class="muted">The build record assembled as a continuous account. Each entry is a moment; each milestone a threshold. What is verified is marked. What remains is listed plainly.</p></div><div class="orb"></div></div>';
  h+='<div class="cards" style="margin-bottom:28px">'+[[verified,'Verified records'],[data.entries.filter(e=>e.status===statuses[1]).length,'Unfinished work'],[mileDone,'Milestones reached'],[data.milestones.length-mileDone,'Milestones ahead']].map(([n,t])=>'<div class="card"><small>'+t+'</small><strong>'+String(n).padStart(2,'0')+'</strong></div>').join('')+'</div>';
  if(!evs.length){h+='<div class="panel">No records yet. The chronicle writes itself from entries and milestones. Add a build log entry to begin.</div>'}
  else{
    h+='<div style="max-width:720px">';
    evs.forEach(ev=>{
      let g=ev.type==='milestone'?(ev.reached?STATUS_GLYPH.reached:STATUS_GLYPH.pending):STATUS_GLYPH[ev.status]||'○';
      let dim=ev.type==='milestone'&&!ev.reached||ev.status===statuses[2]||ev.status==='Open';
      let ds=ev.date?'<small style="display:block;margin-bottom:4px;letter-spacing:.08em">'+chronicleFmt(ev.date)+'</small>':'';
      let typeLabel=ev.type==='milestone'?'MILESTONE':'';
      h+='<div class="row" style="display:grid;grid-template-columns:28px 1fr;gap:12px;opacity:'+(dim?'.55':'1')+'">'
        +'<div style="font-size:18px;padding-top:2px;color:'+(ev.type=\'milestone\'?'#809579':'#203d35')+'">'+g+'</div>'
        +'<div>'+ds+(typeLabel?'<small style="letter-spacing:.12em;color:#65736a">'+typeLabel+' · </small>':'')+'<small style="letter-spacing:.08em;color:#65736a">'+esc(ev.status)+'</small><h3 style="margin:4px 0 6px;font:600 16px system-ui">'+esc(ev.title)+'</h3><p style="white-space:pre-wrap;margin:0;max-width:600px">'+esc(ev.body)+'</p></div></div>';
    });
    h+='</div>';
    /* open questions as a coda */
    let open=data.questions.filter(q=>q.status!=='Answered');
    if(open.length){
      h+='<div style="max-width:720px;margin-top:32px"><h2 style="font:600 14px/1 Orbitron,sans-serif;letter-spacing:.12em;color:#65736a;margin:0 0 16px">OPEN — '+open.length+' unresolved question'+(open.length>1?'s':'')+'</h2>';
      open.forEach(q=>{h+='<div class="row"><h3 style="margin:0 0 4px">'+esc(q.title)+'</h3><p class="muted" style="margin:0;font-size:13px">'+esc(q.notes)+'</p></div>'});
      h+='</div>';
    }
  }
  h+=button('+ Log a build entry',"go('Build log');setTimeout(()=>edit('entries'),80)");
}else if(page==='Overview'){h=header('A machine in the making.','A working record for the Time Travellers Guild Kickstarter. Keep the evidence close, the chronology intact, and the possibilities open.',button('+ Log a build entry',"edit('entries')"));h+='<div class="cards">'+[[data.entries.length,'Build entries'],[data.entries.filter(e=>e.status===statuses[0]).length,'Verified records'],[data.entries.filter(e=>e.status===statuses[1]).length,'Unfinished records'],[data.questions.length,'Open questions']].map(([n,t])=>'<div class="card"><small>'+t+'</small><strong>'+String(n).padStart(2,'0')+'</strong></div>').join('')+'</div><div class="grid"><section class="panel"><small>01 / Latest evidence</small><h2>The build record</h2>'+(data.entries.length?sorted().slice(-3).reverse().map(e=>entry(e)).join(''):'<p>No construction has been verified in this hub yet.</p><p class="muted">Earlier conversations report a living-room build and Day 2 photographs on 24 October 2026. Original images and detailed notes have not been imported or assessed here.</p>')+'</section><section class="panel"><small>02 / Campaign state</small><h2>Preparation</h2><div class="row">Funding target <span class="pill">Unknown</span></div><div class="row">Launch date <span class="pill">Unconfirmed</span></div><div class="row">Supporter tiers <span class="pill">7 draft tiers</span></div><div class="row">Checklist '+data.checks.filter(x=>x[1]).length+' / '+data.checks.length+' complete</div><p class="muted">Counts describe records in this hub, not physical build completion.</p></section></div>'}
else if(page==='Build log'){h=header('Record what happened.','Date each observation. Attach photographs and source notes. A proposal becomes verified only when you explicitly assess its evidence.',button('+ New entry',"edit('entries')"));h+='<label>Show status<select onchange="filter=this.value;render()">'+['All',...statuses].map(s=>'<option '+(s===filter?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select></label>';h+=sorted().filter(e=>filter==='All'||e.status===filter).map((e,_,arr)=>{let i=data.entries.indexOf(e);return '<section class="panel" style="margin:15px 0" data-rec="entries:'+i+'">'+entry(e)+button('Edit entry',"edit('entries',"+i+")")+'</section>'}).join('')||'<div class="panel">No entries in this view. Add your first photograph or note.</div>'}
else if(page==='Tier copy'){h=header('Seven ways to take part.','Editable draft invitations. Prices, rewards, limits and delivery are unknown until agreed. These names do not establish ownership or financial returns.');h+='<div class="tiers">'+data.tiers.map((t,i)=>'<article class="panel"><small>0'+(i+1)+' / Draft tier</small><h2>'+t.name+'</h2><p>'+esc(t.copy)+'</p><p class="muted">Price: '+esc(t.price||'Unknown')+' · Capacity: '+esc(t.capacity||'Unconfirmed')+'<br>Delivery: '+esc(t.delivery||'Unconfirmed')+'</p><p>'+esc(t.terms)+'</p>'+button('Edit tier',"tier("+i+")")+button('Copy draft',"copyTier("+i+")")+'</article>').join('')+'</div>'}
else if(page==='Documentation checklist'){h=header('Make the record usable.','Track the documentation needed before the campaign is ready. Completion here is a manual editorial decision.');h+='<section class="panel">'+data.checks.map((c,i)=>'<label class="check"><input type="checkbox" '+(c[1]?'checked':'')+' onchange="data.checks['+i+'][1]=this.checked;save().then(ok=>{if(!ok)data.checks['+i+'][1]=!this.checked;render()})">'+esc(c[0])+'</label>').join('')+'</section>'}
else if(page==='Context & links'){h=header('The field around the machine.','Project context and character attribution, kept beside the build record.');h+='<div class="grid"><section class="panel"><h2>Time Travellers Guild</h2><p>The Time Machine is being made in Toby Godden\'s living room and documented toward a Kickstarter campaign. The Guild\'s wider world provides the context for the build.</p><div class="row"><a href="https://ffilm.org" target="_blank" rel="noopener">Ffilm.org ↗</a><p class="muted">Toby\'s wider film, sound and browser-based artistic practice.</p></div><div class="row"><a href="https://timetravellersguild.com/bws" target="_blank" rel="noopener">Guild / bws ↗</a></div><div class="row"><a href="https://timetravellersguild.com/box" target="_blank" rel="noopener">Guild / box ↗</a></div></section><section class="panel"><small>Character / IP</small><h2>Jack</h2><p>Jack is an independent IP character by Godden Interactive.</p><p class="muted">Keep character attribution distinct from physical build records and supporter tier promises. Permissions and final campaign wording remain to be reviewed.</p><hr><p>"The machine does not predict. It measures relation."</p><small>Pending, not canon.</small></section></div>'}
else{let type=page==='Materials & techniques'?'materials':page==='Milestones'?'milestones':'questions';h=header(page==='Materials & techniques'?'What it is made of.':page==='Milestones'?'Mark the turning points.':'Leave room for the unknown.',type==='materials'?'Record quantities, costs, sources and methods. Preserve estimates as estimates.':type==='milestones'?'Separate reached milestones from intended ones, with dates and evidence.':'Keep unresolved decisions visible until there is an answer.',button('+ Add record',"edit('"+type+"')"));h+=data[type].map((e,i)=>'<article class="panel" style="margin:15px 0" data-rec="'+type+':'+i+'"><h3>'+esc(e.title)+'</h3>'+tag(e.status||'Open')+'<p style="white-space:pre-wrap">'+esc(e.notes)+'</p>'+button('Edit',"edit('"+type+"',"+i+")")+'</article>').join('')||'<section class="panel">No records yet. Unknowns are welcome here.</section>'}$('#view').innerHTML=h}function go(s){page=s;render()}function sorted(){return [...data.entries].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'))}function entry(e){return '<div class="row"><small>'+esc(e.date||'Date unknown')+'</small><h3>'+esc(e.title)+'</h3>'+tag(e.status)+'<p style="white-space:pre-wrap">'+esc(e.notes)+'</p><p class="muted">Evidence / source: '+esc(e.source||'Not supplied')+'</p><div class="entryphotos">'+(e.photos||[]).map(p=>'<a href="'+p.src+'" target="_blank"><img src="'+p.src+'" alt="'+esc(p.name)+'"></a>').join('')+'</div>'+(e.caption?'<p><small>Draft caption</small><br>'+esc(e.caption)+'</p>':'')+'</div>'}function field(name,label,value,type='text'){return '<label>'+label+(type==='textarea'?'<textarea name="'+name+'">'+esc(value)+'</textarea>':'<input type="'+type+'" name="'+name+'" value="'+esc(value)+'">')+'</label>'}function modal(h){$('#editor').innerHTML=h;$('#editor').showModal()}function closeModal(){$('#editor').close()}

function edit(type,i){
  let e=data[type][i]||{};
  let agentTypes={entries:'entry',materials:'material',milestones:'milestone',questions:'question'};
  let atype=agentTypes[type]||type;
  modal('<form id="form"><small>Working archive / '+type+'</small><h2>'+(i===undefined?'New record':'Edit record')+'</h2>'+field('title','Title',e.title||'')+'<button type="button" id="agent-btn" class="agent-btn" onclick="agentDraft(\''+type+'\')">✦ Draft from title</button>'+(type==='entries'?field('date','Event / photograph date (leave blank if unknown)',e.date||'','date'):'')+'<label>Status<select name="status">'+(type==='questions'?['Open','Under review','Answered']:statuses).map(s=>'<option '+(s===e.status?'selected':'')+'>'+s+'</option>').join('')+'</select></label>'+field('notes',type==='materials'?'Material, quantity, cost, supplier, technique and uncertainty':'Notes / what the evidence shows',e.notes||'','textarea')+(type==='entries'?field('source','Source / evidence reference',e.source||'')+field('caption','Reusable Kickstarter caption — draft',e.caption||'','textarea')+'<button type="button" onclick="draftCaption()">Draft caption from this record</button><label>Add photographs (kept behind your passport)<input name="photos" type="file" multiple accept="image/*"></label><p class="muted">Existing photographs: '+(e.photos||[]).length+'. Added photos append to these.</p>':'')+'<div class="actions"><button class="primary">Save record</button><button type="button" onclick="closeModal()">Cancel</button>'+(i!==undefined?'<button type="button" onclick="removeRecord(\''+type+'\','+i+')">Delete</button>':'')+'</div></form>');$('#form').onsubmit=async ev=>{ev.preventDefault();let f=new FormData(ev.target),n={...e,title:f.get('title'),status:f.get('status'),notes:f.get('notes')};if(!n.title.trim()){notify('Add a title.');return}if(type==='entries'){n.date=f.get('date');n.source=f.get('source');n.caption=f.get('caption');n.photos=[...(e.photos||[])];for(let file of ev.target.photos.files){if(file.size>4*1024*1024){notify('Use photographs smaller than 4 MB.');return}n.photos.push({name:file.name,src:await new Promise((r,j)=>{let rd=new FileReader;rd.onload=()=>r(rd.result);rd.onerror=j;rd.readAsDataURL(file)})})}}let old=structuredClone(data);if(i===undefined)data[type].push(n);else data[type][i]=n;if(await save()){closeModal();render();notify('Record saved')}else data=old}}

function draftCaption(){let f=$('#form'),prefix=f.status.value===statuses[0]?'Verified build record':f.status.value===statuses[1]?'Work in progress':f.status.value===statuses[2]?'Proposed work':'Reported work — evidence pending';f.caption.value=prefix+' · '+(f.date.value||'Date unconfirmed')+' — '+f.elements.namedItem('title').value+'. '+f.notes.value}async function removeRecord(t,i){if(confirm('Delete this record from your archive?')){let old=structuredClone(data);data[t].splice(i,1);if(await save()){closeModal();render()}else data=old}}function tier(i){let t=data.tiers[i];modal('<form id="tierform"><small>Draft tier</small><h2>'+t.name+'</h2>'+field('copy','Invitation / reward copy',t.copy,'textarea')+field('price','Pledge price (unknown until set)',t.price)+field('capacity','Capacity / limits',t.capacity)+field('delivery','Delivery / participation timing',t.delivery)+field('terms','Terms / unresolved commitments',t.terms,'textarea')+'<button class="primary">Save tier</button> <button type="button" onclick="closeModal()">Cancel</button></form>');$('#tierform').onsubmit=async ev=>{ev.preventDefault();let old=structuredClone(data);Object.assign(t,Object.fromEntries(new FormData(ev.target)));if(await save()){closeModal();render()}else data=old}}async function copyTier(i){let t=data.tiers[i];try{await navigator.clipboard.writeText(t.name+' — DRAFT\n'+t.copy+'\nPrice: '+(t.price||'Unknown')+'\nCapacity: '+(t.capacity||'Unconfirmed')+'\nDelivery: '+(t.delivery||'Unconfirmed')+'\n'+t.terms);notify('Draft copied')}catch{notify('Clipboard unavailable. Select the tier text to copy.')}}$('#export').onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({schema:1,exported:new Date().toISOString(),data},null,2)],{type:'application/json'}));a.download='ttg-workbench-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};$('#import').onclick=()=>$('#backup').click();$('#backup').onchange=async ev=>{try{let v=JSON.parse(await ev.target.files[0].text());if(v.schema!==1||!Object.keys(initial).every(k=>Array.isArray(v.data[k])))throw Error();if(confirm('Replace your archive with this backup?')){let old=data;data=v.data;if(await save()){render();notify('Backup imported')}else data=old}}catch{notify('Could not import: choose a valid workbench backup.')}ev.target.value=''};fetch('workbench.php?a=load').then(r=>{if(!r.ok)throw new Error('load');return r.json()}).then(v=>{if(v===null)loaded=true;else if(v&&typeof v==='object'&&Object.keys(initial).every(k=>Array.isArray(v[k]))){data=v;loaded=true}else throw new Error('shape');render()}).catch(()=>{render();notify('The office could not fetch your archive. What the office keeps is safe; changes made now will not be kept. Reload the page to try again.')});
</script></html>

WBHTML;
$n=0;
$html=str_replace("SEALPLACEHOLDER",$seal_safe,$html,$n);
if($n!==1){ http_response_code(500); header('Content-Type: text/plain'); echo 'The workbench is miswired; the office has been told nothing.'; exit; }
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
echo $html;
exit;
?>
