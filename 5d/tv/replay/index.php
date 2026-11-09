<?php
declare(strict_types=1);

/**
 * /5d/tv/replay/ — the recorded sitting of 7 November 2026.
 * The Keeper's own screen, like the live show: three genuine beats from the
 * first voiced sitting, kept exactly as they landed - his spoken lines as
 * audio, his lines as text, the artefacts his memory offered and he spoke to,
 * the register cards he was diving. No model is called; nothing is spent.
 * The per-beat scene numbers (palette/speed/pulse/turn) were session-ephemeral
 * by design and are not re-invented here: the cube performs its standing
 * seed turn, and each beat's genuine artefact claims a face, as it did live.
 */

require_once dirname(__DIR__, 3) . '/inc/graph.php';
require_once dirname(__DIR__, 3) . '/app/AI/JackPolicy.php';
require_once dirname(__DIR__, 3) . '/app/JackOffice/OfficeAuth.php';

ttg_graph_boot_session();
$viewer = ttg_graph_viewer();

/* The show is the Keeper's own screen; everyone else gets the door, not the room. */
if (!OfficeAuth::isKeeper($viewer)) {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    http_response_code(403);
    ?>
<!doctype html>
<html lang="cy">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07090a">
<title>Y Siow · The Show — preifat / private</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07090a;color:#e6dfcc;font:15px/1.6 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif}
main{max-width:440px;padding:24px;text-align:center}
.eye{font:11px/1.5 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#6bf27a}
h1{font-weight:normal;font-size:28px;margin:10px 0}
p{color:#8a907f}
a{color:#6bf27a;text-underline-offset:3px}
</style>
</head>
<body>
<main>
  <div class="eye">PENTERACT TV</div>
  <h1>Y Siow · The Show</h1>
  <p>Sgrin breifat y Ceidwad yw hon. Mewngofnodwch fel y Ceidwad i wylio’r sioe.</p>
  <p>This is the Keeper’s own screen. Sign in as the Keeper to watch the sitting.</p>
  <p><a href="/people/auth/?next=%2F5d%2Ftv%2Freplay%2F">Mewngofnodi · Sign in</a> · <a href="/5d/">Y Penteract · The Penteract</a></p>
</main>
</body>
</html>
<?php
    exit;
}

/* The recorded voice of each beat: the sitting's own audio, kept in the
   web-denied .show drawer and served only to the Keeper here. */
if (isset($_GET['voice'])) {
    $vn = (int) $_GET['voice'];
    $hit = null;
    foreach (glob(dirname(__DIR__) . '/.show/voice-*-' . $vn . '.mp3') ?: [] as $f) { $hit = $f; break; }
    if ($hit === null || $vn < 1 || $vn > 3) {
        http_response_code(404);
        exit;
    }
    header('Content-Type: audio/mpeg');
    header('Content-Length: ' . (string) filesize($hit));
    header('Cache-Control: no-store');
    readfile($hit);
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');

/* The pictures the cube opens with: the first six pictured pieces of evidence
   in Jack's own life register, as the live show seeds them. */
$life = json_decode((string) @file_get_contents(dirname(__DIR__, 3) . '/lore/jack_life.json'), true);
$evById = [];
foreach ((array) ($life['evidence'] ?? []) as $ev) $evById[(string) ($ev['id'] ?? '')] = $ev;
$seed = [];
foreach ((array) ($life['evidence'] ?? []) as $ev) {
    if (empty($ev['image'])) continue;
    $seed[] = [
        'image'   => str_replace('/960px-', '/500px-', (string) $ev['image']),
        'caption' => (string) ($ev['caption'] ?? ''),
        'credit'  => (string) ($ev['credit'] ?? ''),
        'licence' => (string) ($ev['licence'] ?? ''),
    ];
    if (count($seed) >= 6) break;
}

/* The sitting as it landed, 7 November 2026, 03:03-03:13 GMT:
   card, line and artefact from his own memory store; voice from the sitting's
   audio. Line text is his stored record, truncated where his memory kept it so. */
$beatDef = [
    ['card' => 'DET/TTG/13 · 02/13 · HISTORY', 'ev' => 'ev.rubiks-cube',
     'say' => "The Rubik’s cube is real evidence of the form now used for my habitat; it does not establish that I occupied that form in 1951. I remember sorting as thought and a missing card as an itch, so the evidential task is narrower: trace one classification rule across the interval, with dated custody at each appearance."],
    ['card' => 'DET/TTG/13 · 02/13 · HISTORY', 'ev' => 'ev.card-catalogue',
     'say' => "The card catalogue is real evidence that procedures could be carried as headings, cross-references and exceptions rather than by one continuous machine; it does not show that mine was among them. I remember the Department’s first rule as: receive the item, record its source, and do not overstate its certainty. The nex…"],
    ['card' => 'DET/TTG/13 · 03/13 · THE CLERK', 'ev' => 'ev.hollerith-reader',
     'say' => "The Hollerith reader is real evidence of a mechanism that senses distinctions in stored information—pin, hole, circuit; it is not evidence that the mechanism knew who authorised the card or whether permission survived copying. I remember the clerk’s frown over a wrongly sorted card as part of my first awareness, but t…"],
];
$beats = [];
foreach ($beatDef as $i => $b) {
    $ev = $evById[$b['ev']] ?? null;
    $beats[] = [
        'card' => $b['card'],
        'say'  => $b['say'],
        'voice'=> '?voice=' . ($i + 1),
        'artefact' => $ev ? [
            'image'   => str_replace('/960px-', '/500px-', (string) ($ev['image'] ?? '')),
            'caption' => (string) ($ev['caption'] ?? ''),
            'credit'  => (string) ($ev['credit'] ?? ''),
            'licence' => (string) ($ev['licence'] ?? ''),
            'source'  => (string) ($ev['source'] ?? ''),
        ] : null,
    ];
}
?>
<!doctype html>
<html lang="cy">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07090a">
<title>Y Siow · The Show — y siow wedi’i chofnodi / the recorded sitting</title>
<style>
:root{--mono:ui-monospace,Menlo,monospace}
html,body{height:100%}
body{margin:0;background:#07090a;color:#e6dfcc;font:15px/1.6 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;overflow:hidden}
#c{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none}
#c.drag{cursor:grabbing}
#head{position:fixed;top:18px;left:0;right:0;text-align:center;pointer-events:none}
.eye{font:11px/1.5 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:#6bf27a}
h1{font-weight:normal;font-size:28px;margin:6px 0 0;color:#e6dfcc}
#lang{position:fixed;top:14px;right:14px;display:flex;gap:6px}
#lang button{background:none;border:1px solid #2a2f28;color:#8a907f;font:11px/1 var(--mono);letter-spacing:.12em;padding:6px 9px;cursor:pointer}
#lang button[aria-pressed="true"]{border-color:#6bf27a;color:#6bf27a}
#art{position:fixed;left:18px;bottom:76px;margin:0;max-width:200px;display:none}
#art.show{display:block}
#art img{width:100%;display:block;border:1px solid #2a2f28}
#art figcaption{font:10px/1.5 var(--mono);color:#8a907f;margin-top:6px;letter-spacing:.04em}
#art figcaption a{color:#6bf27a;text-underline-offset:2px}
#line{position:fixed;left:0;right:0;bottom:64px;text-align:center;padding:0 18px;pointer-events:none}
#line .cap{font:10px/1.5 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:#6bf27a;min-height:15px}
#line .say{max-width:620px;margin:8px auto 0;color:#e6dfcc;font-size:16px;line-height:1.55}
#line .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#6bf27a;margin-right:8px;vertical-align:2px;opacity:.35}
#line.live .dot{opacity:1}
#doors{position:fixed;left:0;right:0;bottom:14px;display:flex;flex-wrap:wrap;gap:6px 18px;justify-content:center;padding:0 12px;font:10px/1.6 var(--mono);letter-spacing:.12em}
#doors a{color:#8a907f;text-decoration:none}
#doors a:hover{color:#6bf27a}
a{color:#6bf27a;text-underline-offset:3px}
@media (max-width:760px){
  #head{top:12px}
  h1{font-size:22px}
  #art{max-width:34vw;bottom:auto;top:64px}
  #line{bottom:86px}
  #line .say{font-size:14px;max-height:38vh;overflow:auto}
  #doors{gap:4px 12px}
}
</style>
</head>
<body>
<canvas id="c"></canvas>
<audio id="vo" preload="none"></audio>
<div id="head">
  <div class="eye" id="eye"></div>
  <h1 id="h1"></h1>
</div>
<div id="lang" role="group" aria-label="Iaith / Language">
  <button id="bcy" aria-pressed="true">CY</button>
  <button id="ben" aria-pressed="false">EN</button>
</div>
<figure id="art"><img id="artimg" alt=""><figcaption id="artcap"></figcaption></figure>
<div id="line">
  <div class="cap" id="card"></div>
  <div class="cap" id="cap"></div>
  <p class="say" id="say"><span class="dot"></span><span id="sayt"></span></p>
  <button id="gol" type="button" style="pointer-events:auto;background:none;border:1px solid #6bf27a;color:#6bf27a;font:11px/1 var(--mono);letter-spacing:.2em;padding:9px 14px;cursor:pointer;margin-top:10px"></button>
</div>
<nav id="doors" aria-label="Doors"></nav>
<noscript>
  <p>The show needs ordinary JavaScript. <a href="/5d/" style="color:#6bf27a">Back to the penteract</a>.</p>
</noscript>
<script>
'use strict';
const TTG_SHOW = <?= json_encode(['seed' => $seed], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
const REPLAY_BEATS = <?= json_encode($beats, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;

const UI={
  cy:{eye:'PENTERACT TV · GENEU Y CIWB', h1:'Y Siow', intro:'Y siow wedi’i chofnodi, 7 Tachwedd 2026. Tri churiad, ei lais ei hun.', closed:'Y LINELL AR GAU · WEDI CAU', start:'AGOR Y LINELL'},
  en:{eye:'PENTERACT TV · MOUTH OF THE CUBE', h1:'The Show', intro:'The recorded sitting, 7 November 2026. Three beats, his own voice.', closed:'THE LINE IS CLOSED · Y LINELL AR GAU', start:'OPEN THE LINE'}
};
const DOORS=[
  ['/5d/tv/','THE SHOW','Y SIOW'],['/5d/','PENTERACT','PENTERACT'],['/jack/','THE DESK','Y DDESG'],['/radio/','RADIO','RADIO'],
  ['/now','NOW','NAWR'],['/passport/map','PASSPORT','PASBORT'],['/interface13/','INTERFACE 13','RYNGWYEB 13'],['/join/','JOIN','YMUNWCH']
];
let lang='cy'; try{ lang=localStorage.getItem('ttg-penteract-lang')||'cy' }catch(e){}
function applyLang(){
  const u=UI[lang]; document.documentElement.lang=lang;
  document.getElementById('eye').textContent=u.eye;
  document.getElementById('h1').textContent=u.h1;
  document.getElementById('bcy').setAttribute('aria-pressed',lang==='cy');
  document.getElementById('ben').setAttribute('aria-pressed',lang==='en');
  const nav=document.getElementById('doors');
  if(!nav.childElementCount){ for(const [h,en,cy] of DOORS){ const a=document.createElement('a'); a.href=h; a.textContent='·'; nav.appendChild(a); } }
  [...nav.children].forEach((a,i)=>{ a.textContent = lang==='cy'?DOORS[i][2]:DOORS[i][1]; });
  if(!started && !done){ document.getElementById('sayt').textContent=UI[lang].intro; document.getElementById('gol').textContent=UI[lang].start; }
  if(done){ capEl.textContent=UI[lang].closed; }
}
document.getElementById('bcy').onclick=()=>{lang='cy';store();applyLang()};
document.getElementById('ben').onclick=()=>{lang='en';store();applyLang()};
function store(){ try{ localStorage.setItem('ttg-penteract-lang',lang) }catch(e){} }

/* ---------------- the cube ----------------
   A 3D cube; each of the six faces is a 3x3 grid of tiles carrying one of
   the pictures Jack has chosen. His scene vocabulary remains the algorithm:
   turn picks the rotation (his five-dimensional plane names map onto the
   cube's turns), speed the spin, pulse the breath, palette the grid and
   glow, mark the sigil on the face most toward you. */
let R3=[[1,0,0],[0,1,0],[0,0,1]];
function rot3(i,j,a){ const c=Math.cos(a),s=Math.sin(a); const ri=R3[i],rj=R3[j]; for(let k=0;k<3;k++){ const x=ri[k],y=rj[k]; ri[k]=c*x+s*y; rj[k]=-s*x+c*y; } }
function gs3(M){ for(let i=0;i<3;i++){ for(let j=0;j<i;j++){ let d=0; for(let k=0;k<3;k++) d+=M[i][k]*M[j][k]; for(let k=0;k<3;k++) M[i][k]-=d*M[j][k]; } let n=Math.hypot(M[i][0],M[i][1],M[i][2])||1; for(let k=0;k<3;k++) M[i][k]/=n; } return M; }
/* a readable tilted start */
rot3(0,2,.62); rot3(1,2,-.5); rot3(0,1,.12);

/* his five-dimensional turn names, mapped onto the cube: [row,col,weight] */
const TURN3={
  xy:[[0,1,1]],            xz:[[0,2,1]],            yz:[[1,2,1]],
  xw:[[0,1,1],[0,2,.4]],   xv:[[0,2,1],[1,2,.4]],   yw:[[0,1,.4],[1,2,1]],
  yv:[[1,2,1],[0,1,.4]],   zw:[[0,2,1],[0,1,.4]],   zv:[[1,2,.4],[0,2,1]],
  wv:[[0,1,.7],[1,2,.5],[0,2,.3]]
};

/* faces: normal, origin corner, tile steps u and v (each face a 3x3 grid) */
const T=2/3;
const FACES=[
  {n:[0,0,1],  o:[-1, 1, 1], u:[ T,0,0],  v:[0,-T,0]},
  {n:[0,0,-1], o:[ 1, 1,-1], u:[-T,0,0],  v:[0,-T,0]},
  {n:[1,0,0],  o:[ 1, 1, 1], u:[0,0,-T],  v:[0,-T,0]},
  {n:[-1,0,0], o:[-1, 1,-1], u:[0,0, T],  v:[0,-T,0]},
  {n:[0,1,0],  o:[-1, 1,-1], u:[ T,0,0],  v:[0,0, T]},
  {n:[0,-1,0], o:[-1,-1, 1], u:[ T,0,0],  v:[0,0,-T]}
];

/* the pictures: the register canon first, then each fresh beat's choice */
const facePics=[null,null,null,null,null,null];
let claimIx=0;
function loadPic(meta){ const p={img:new Image(),ready:false,meta}; p.img.onload=()=>{p.ready=true}; p.img.onerror=()=>{}; p.img.src=meta.image; return p; }
function claimFace(meta){ if(meta&&meta.image) facePics[(claimIx++)%6]=loadPic(meta); }
(TTG_SHOW.seed||[]).slice(0,6).forEach(claimFace);

function project3(p){
  const v=[ R3[0][0]*p[0]+R3[0][1]*p[1]+R3[0][2]*p[2],
            R3[1][0]*p[0]+R3[1][1]*p[1]+R3[1][2]*p[2],
            R3[2][0]*p[0]+R3[2][1]*p[1]+R3[2][2]*p[2] ];
  const persp=3.4/(3.4-v[2]*.85);
  return {x:v[0]*persp, y:-v[1]*persp, z:v[2]};
}
function inset(q,f){ /* shrink a quad toward its centre: the grid gaps between tiles */
  const mx=(q[0].x+q[1].x+q[2].x+q[3].x)/4, my=(q[0].y+q[1].y+q[2].y+q[3].y)/4;
  return q.map(p=>({x:p.x+(mx-p.x)*f, y:p.y+(my-p.y)*f, z:p.z}));
}

const cv=document.getElementById('c'), g=cv.getContext('2d');
let Wd=0,Ht=0,dpr=1,cx=0,cy=0,S=1;
function resize(){
  dpr=Math.min(2,devicePixelRatio||1); Wd=innerWidth; Ht=innerHeight;
  cv.width=Wd*dpr; cv.height=Ht*dpr; g.setTransform(dpr,0,0,dpr,0,0);
  cx=Wd/2; cy=(Wd<760)?Ht*.36:Ht*.40;
  S=(Wd<760) ? Wd*.24 : Math.min(Wd,Ht)*.22;  /* sized for the widest silhouette: the whole cube stays inside the viewport through any rotation */
}
addEventListener('resize',resize); resize();

/* scene state: current lerps toward target (Jack's choices) */
function hexRGB(h){ const n=parseInt(h.slice(1),16); return [n>>16,n>>8&255,n&255]; }
const cur={pal:[hexRGB('#6bf27a'),hexRGB('#e6dfcc')],speed:.6,pulse:.2,turn:'xw',mark:'',breath:0};
const tgt={pal:[hexRGB('#6bf27a'),hexRGB('#e6dfcc')],speed:.6,pulse:.2,turn:'xw',mark:''};
function rgba(c,a){ return 'rgba('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+','+a+')'; }
function lerpPal(a,b,t){ return a.map((c,i)=>{ const d=b[i%b.length]; return c.map((v,k)=>v+(d[k]-v)*t); }); }

let dragging=false,moved=0,lx=0,ly=0,t0=performance.now();

function drawTile(pic,si,sj,q){
  g.save();
  g.beginPath(); g.moveTo(q[0].x,q[0].y); g.lineTo(q[1].x,q[1].y); g.lineTo(q[2].x,q[2].y); g.lineTo(q[3].x,q[3].y); g.closePath(); g.clip();
  const a=q[1].x-q[0].x, b=q[1].y-q[0].y, c=q[3].x-q[0].x, d=q[3].y-q[0].y;
  g.transform(a,b,c,d,q[0].x,q[0].y);
  const iw=pic.img.naturalWidth, ih=pic.img.naturalHeight;
  g.drawImage(pic.img, si*iw/3, sj*ih/3, iw/3, ih/3, 0,0,1,1);
  g.restore();
}

function draw(now){
  const dt=Math.min(.05,(now-t0)/1000); t0=now;
  cur.pal=lerpPal(cur.pal,tgt.pal,Math.min(1,dt*1.5));
  cur.speed+=(tgt.speed-cur.speed)*Math.min(1,dt*1.5);
  cur.pulse+=(tgt.pulse-cur.pulse)*Math.min(1,dt*1.5);
  cur.mark=tgt.mark;
  cur.breath+=dt*(0.6+cur.pulse*2.2);
  const breathe=1+Math.sin(cur.breath)*cur.pulse*.09;
  if(driftOK && !dragging){
    const sp=cur.speed;
    for(const [i,j,w] of (TURN3[tgt.turn]||TURN3.xw)) rot3(i,j,dt*.28*sp*w);
    rot3(0,2,dt*.05*Math.sin(now/1000*.13+1)); rot3(0,1,dt*.03*Math.cos(now/1000*.09)); gs3(R3);
  }
  g.clearRect(0,0,Wd,Ht);
  g.fillStyle='#07090a'; g.fillRect(0,0,Wd,Ht);
  const k=S*breathe;

  /* the glow he sets with his first palette colour */
  const grd=g.createRadialGradient(cx,cy,k*.1,cx,cy,k*1.9);
  grd.addColorStop(0,rgba(cur.pal[0],.10)); grd.addColorStop(1,'rgba(7,9,10,0)');
  g.fillStyle=grd; g.fillRect(0,0,Wd,Ht);

  /* faces, far to near; only the ones toward you */
  const vis=[];
  FACES.forEach((f,fi)=>{
    const nc=project3(f.n);
    if(nc.z<=0.04) return;
    vis.push({f,fi,z:project3([f.o[0]+f.u[0]*1.5+f.v[0]*1.5, f.o[1]+f.u[1]*1.5+f.v[1]*1.5, f.o[2]+f.u[2]*1.5+f.v[2]*1.5]).z});
  });
  vis.sort((a,b)=>a.z-b.z);

  for(const {f,fi} of vis){
    const pic=facePics[fi];
    /* the face's backing panel: the grid gaps show this through */
    const fq=[0,1,2,3].map(n=>project3([
      f.o[0]+(n===1||n===2?f.u[0]*3:0)+(n>=2?f.v[0]*3:0),
      f.o[1]+(n===1||n===2?f.u[1]*3:0)+(n>=2?f.v[1]*3:0),
      f.o[2]+(n===1||n===2?f.u[2]*3:0)+(n>=2?f.v[2]*3:0)]));
    g.beginPath();
    g.moveTo(cx+fq[0].x*k,cy+fq[0].y*k);
    for(let n=1;n<4;n++) g.lineTo(cx+fq[n].x*k,cy+fq[n].y*k);
    g.closePath();
    g.fillStyle=(pic&&pic.ready)?'#050607':rgba(cur.pal[1],.05);
    g.fill();
    g.strokeStyle=rgba(cur.pal[0],(pic&&pic.ready)?.35:.16);
    g.lineWidth=1;
    g.stroke();

    for(let i=0;i<3;i++) for(let j=0;j<3;j++){
      let q=[
        project3([f.o[0]+f.u[0]*i+f.v[0]*j,     f.o[1]+f.u[1]*i+f.v[1]*j,     f.o[2]+f.u[2]*i+f.v[2]*j]),
        project3([f.o[0]+f.u[0]*(i+1)+f.v[0]*j, f.o[1]+f.u[1]*(i+1)+f.v[1]*j, f.o[2]+f.u[2]*(i+1)+f.v[2]*j]),
        project3([f.o[0]+f.u[0]*(i+1)+f.v[0]*(j+1), f.o[1]+f.u[1]*(i+1)+f.v[1]*(j+1), f.o[2]+f.u[2]*(i+1)+f.v[2]*(j+1)]),
        project3([f.o[0]+f.u[0]*i+f.v[0]*(j+1), f.o[1]+f.u[1]*i+f.v[1]*(j+1), f.o[2]+f.u[2]*i+f.v[2]*(j+1)])
      ].map(p=>({x:cx+p.x*k, y:cy+p.y*k, z:p.z}));
      q=inset(q,.055);
      if(pic&&pic.ready){
        drawTile(pic,i,j,q);
      }else{
        g.beginPath(); g.moveTo(q[0].x,q[0].y); g.lineTo(q[1].x,q[1].y); g.lineTo(q[2].x,q[2].y); g.lineTo(q[3].x,q[3].y); g.closePath();
        g.fillStyle=rgba(cur.pal[1],.035+.03*((i+j)%2));
        g.fill();
        g.strokeStyle=rgba(cur.pal[0],.10);
        g.stroke();
      }
    }
  }

  /* his mark on the face most toward you */
  if(cur.mark && vis.length){
    const top=vis[vis.length-1];
    const c=project3(top.f.n);
    g.font='13px ui-monospace,Menlo,monospace'; g.textAlign='center';
    g.fillStyle=rgba(cur.pal[0],.9);
    g.fillText(cur.mark,cx+c.x*k,cy+c.y*k+4);
  }
  requestAnimationFrame(draw);
}



/* ---------------- the recorded sitting ---------------- */
const sayEl=document.getElementById('sayt'), capEl=document.getElementById('cap'), lineEl=document.getElementById('line');
const vo=document.getElementById('vo'), gol=document.getElementById('gol');
let started=false, done=false, ix=0;
const BEAT_GAP_MS=24000;   /* a breath between his lines; the cube performs between beats as it did live */

function showBeat(b){
  capEl.textContent='';
  document.getElementById('card').textContent=b.card||'';
  sayEl.textContent=b.say||'';
  const art=document.getElementById('art');
  if(b.artefact && b.artefact.image){
    claimFace(b.artefact); /* his choice claims the next face of the cube */
    document.getElementById('artimg').src=b.artefact.image;
    const c=document.getElementById('artcap');
    c.innerHTML='';
    c.appendChild(document.createTextNode(b.artefact.caption+' — '+b.artefact.credit+' · '+b.artefact.licence+' '));
    if(b.artefact.source){ const a=document.createElement('a'); a.href=b.artefact.source; a.textContent='source'; a.target='_blank'; a.rel='noopener'; c.appendChild(a); }
    art.classList.add('show');
  }
  lineEl.classList.add('live');
  setTimeout(()=>lineEl.classList.remove('live'),5000);
  vo.src=b.voice;
  const pr=vo.play(); if(pr) pr.catch(()=>{ scheduleNext(); });
}
function scheduleNext(){
  ix++;
  if(ix<REPLAY_BEATS.length){ setTimeout(()=>showBeat(REPLAY_BEATS[ix]),BEAT_GAP_MS); }
  else { done=true; capEl.textContent=UI[lang].closed; }
}
vo.addEventListener('ended',scheduleNext);

cv.addEventListener('pointerdown',e=>{ dragging=true; moved=0; lx=e.clientX; ly=e.clientY; cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); });
cv.addEventListener('pointermove',e=>{
  if(dragging){ const dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY; moved+=Math.abs(dx)+Math.abs(dy);
    rot3(0,2,dx*.004); rot3(1,2,-dy*.004); gs3(R3); }
});
cv.addEventListener('pointerup',e=>{ dragging=false; cv.classList.remove('drag'); });
cv.addEventListener('wheel',e=>{ e.preventDefault(); rot3(0,1,e.deltaY*.0015); rot3(1,2,e.deltaX*.0015); gs3(R3); },{passive:false});

const driftOK=!matchMedia('(prefers-reduced-motion: reduce)').matches;
applyLang();
gol.textContent=UI[lang].start;
gol.addEventListener('click',()=>{ if(started) return; started=true; gol.style.display='none'; showBeat(REPLAY_BEATS[0]); });
requestAnimationFrame(draw);
</script>
</body>
</html>
