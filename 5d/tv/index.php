<?php
declare(strict_types=1);

/**
 * /5d/tv/ — the cube as Jack's mouth.
 * The cube performs the show beat by beat; beats come from /5d/tv/beat.php
 * as a fixed scene vocabulary. Nothing the model writes is executed here.
 *
 * The cube's faces carry pictures Jack has chosen: it opens covered with
 * evidence from his own life register (lore/jack_life.json — his standing
 * canon, real artefacts with sources and licences, served only to the
 * Keeper here), and each fresh beat's recalled artefact claims the next
 * face. His scene vocabulary stays the algorithm: turn chooses the cube's
 * rotation, speed its spin, pulse its breath, palette its grid and glow,
 * mark the sigil on the face most toward you. Between beats the cube keeps
 * turning on his last choices.
 */

require_once dirname(__DIR__, 2) . '/inc/graph.php';
require_once dirname(__DIR__, 2) . '/app/AI/JackPolicy.php';
require_once dirname(__DIR__, 2) . '/app/JackOffice/OfficeAuth.php';

ttg_graph_boot_session();
$viewer = ttg_graph_viewer();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');

/* The show is the Keeper's own screen; everyone else gets the door, not the room. */
if (!OfficeAuth::isKeeper($viewer)) {
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
  <p>Sgrin breifat y Ceidwad yw hon. Mewngofnodwch fel y Ceidwad i wylio’r sioe’n ysgrifennu’i hun.</p>
  <p>This is the Keeper’s own screen. Sign in as the Keeper to watch the show write itself.</p>
  <p><a href="/people/auth/?next=%2F5d%2Ftv%2F">Mewngofnodi · Sign in</a> · <a href="/5d/">Y Penteract · The Penteract</a></p>
</main>
</body>
</html>
<?php
    exit;
}

$csrf = ttg_graph_csrf();

/* The pictures the cube opens with: the first six pictured pieces of evidence
   in Jack's own life register. Real artefacts, sources and licences attached,
   read here on the server — lore/ is denied to the web. */
$seed = [];
$life = json_decode((string) @file_get_contents(dirname(__DIR__, 2) . '/lore/jack_life.json'), true);
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
?>
<!doctype html>
<html lang="cy">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07090a">
<title>Y Siow · The Show — Penteract TV</title>
<style>
:root{
  --bg:#07090a; --ink:#e6dfcc; --dim:#8a907f; --rule:#2a302c;
  --green:#6bf27a; --brass:#d9a441;
  --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font:15px/1.55 var(--serif);overflow:hidden}
#c{position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab}
#c.drag{cursor:grabbing}
#head{position:fixed;left:20px;top:18px;pointer-events:none;max-width:calc(100vw - 120px)}
#head .eye{font:11px/1.5 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--green)}
#head h1{font-weight:normal;font-size:clamp(22px,3vw,32px);line-height:1.05;margin:6px 0 4px;letter-spacing:-.5px}
#lang{position:fixed;right:16px;top:18px;display:flex;gap:6px}
#lang button{font:11px var(--mono);letter-spacing:.1em;color:var(--dim);background:transparent;border:1px solid var(--rule);border-radius:3px;padding:4px 9px;cursor:pointer}
#lang button[aria-pressed=true]{color:#041006;background:var(--green);border-color:var(--green)}
/* Jack's line */
#line{position:fixed;left:50%;transform:translateX(-50%);bottom:52px;width:min(620px,calc(100vw - 32px));text-align:center;pointer-events:none}
#line .cap{font:11px var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--brass);margin-bottom:6px;min-height:14px}
#line .say{font-size:clamp(16px,2.2vw,20px);line-height:1.45;color:var(--ink);margin:0;transition:opacity .6s}
#line .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green);margin-right:7px;vertical-align:2px;opacity:0;transition:opacity .4s}
#line.live .dot{opacity:1}
/* doors */
#doors{position:fixed;left:0;right:0;bottom:0;display:flex;gap:2px;flex-wrap:wrap;justify-content:center;padding:8px 10px;background:rgba(7,9,10,.85);border-top:1px solid var(--rule);backdrop-filter:blur(6px)}
@media (max-width:760px){
  #doors{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;padding:6px 10px}
  #doors a{white-space:nowrap}
  #line{bottom:56px}
}
#doors a{font:11px var(--mono);letter-spacing:.1em;color:var(--dim);text-decoration:none;padding:4px 8px;border-radius:3px}
#doors a:hover{color:var(--green)}
#doors a:focus-visible{outline:2px solid var(--green);outline-offset:2px}
noscript p{padding:20px;text-align:center}
/* the artefact Jack recalls — real evidence, source and licence attached */
#art{position:fixed;right:20px;top:50%;transform:translateY(-50%);width:min(300px,30vw);margin:0;opacity:0;transition:opacity .8s;pointer-events:none}
#art.show{opacity:1}
#art img{width:100%;display:block;border:1px solid var(--rule);border-radius:4px;background:#0e1211}
#art figcaption{font:10px/1.6 var(--mono);color:var(--dim);margin-top:6px}
#art a{color:var(--dim);pointer-events:auto}
@media (max-width:760px){
  #art{top:auto;bottom:120px;right:12px;transform:none;width:36vw}
  #art figcaption{display:none}
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
const TTG_SHOW = <?= json_encode(['csrf' => $csrf, 'beat' => '/5d/tv/beat.php', 'seed' => $seed], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;

const UI={
  cy:{eye:'PENTERACT TV · GENEU Y CIWB', h1:'Y Siow', wait:'Mae’r ciwb yn codi…', preview:'Dyma ragolwg: mae’r ciwb yn troi’n dawel. Nid yw’r Ceidwad wedi agor y linell eto — does dim cost, does dim gweithrediad.', mix:'Three scenes remain in this sitting. Press OPEN THE LINE to continue.', closed:'Y LINELL AR GAU · WEDI CAU', start:'AGOR Y LINELL'},
  en:{eye:'PENTERACT TV · MOUTH OF THE CUBE', h1:'The Show', wait:'The cube is rising…', preview:'This is a preview: the cube turns quietly. The Keeper has not opened the line yet — no spend, no live generation.', mix:'Three scenes remain in this sitting. Press OPEN THE LINE to continue.', closed:'THE LINE IS CLOSED · Y LINELL AR GAU', start:'OPEN THE LINE'}
};
const DOORS=[
  ['/5d/','PENTERACT','PENTERACT'],['/jack/','THE DESK','Y DDESG'],['/radio/','RADIO','RADIO'],
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
  if(!started && !done){ document.getElementById('sayt').textContent=UI[lang].mix; document.getElementById('gol').textContent=UI[lang].start; }
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

/* ---------------- the show ---------------- */
const sayEl=document.getElementById('sayt'), capEl=document.getElementById('cap'), lineEl=document.getElementById('line');
let busy=false, started=false, done=false, fails=0;
const GAP_MS=115000;   /* a fresh beat about every two minutes; the cube performs between them for free */
function closeOut(){ done=true; capEl.textContent=UI[lang].closed; }
async function beat(){
  if(busy||done) return; busy=true;
  try{
    const body=new URLSearchParams({csrf:TTG_SHOW.csrf});
    const r=await fetch(TTG_SHOW.beat,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
    const j=await r.json();
    if(j && j.ok && j.scene && j.preview){
      if(!started){ capEl.textContent='RHAGOLWG · PREVIEW'; sayEl.textContent=UI[lang].preview; }
      else closeOut(); /* the line closed behind the last beat: keep the final scene on screen */
    }
    else if(j && j.ok && j.scene){
      fails=0;
      if(j.fresh){ started=true; document.getElementById('gol').style.display='none'; }
      tgt.pal=j.scene.palette.map(hexRGB);
      tgt.speed=j.scene.speed; tgt.pulse=j.scene.pulse; tgt.turn=j.scene.turn; tgt.mark=j.scene.mark||'';
      capEl.textContent=j.scene.caption||''; sayEl.textContent=j.say||'';
      if(j.card) document.getElementById('card').textContent='DET/TTG/13 · '+j.card.id+'/'+j.card.of+' · '+j.card.title;
      const art=document.getElementById('art');
      if(j.artefact && j.artefact.image){
        claimFace(j.artefact); /* his choice claims the next face of the cube */
        document.getElementById('artimg').src=j.artefact.image;
        document.getElementById('artcap').innerHTML='';
        const c=document.getElementById('artcap');
        c.appendChild(document.createTextNode(j.artefact.caption+' — '+j.artefact.credit+' · '+j.artefact.licence+' '));
        if(j.artefact.source){ const a=document.createElement('a'); a.href=j.artefact.source; a.textContent='source'; a.target='_blank'; a.rel='noopener'; c.appendChild(a); }
        art.classList.add('show');
      } /* no artefact this beat: the last one stays on screen */
      lineEl.classList.toggle('live',!!j.fresh);
      setTimeout(()=>lineEl.classList.remove('live'),5000);
      if(j.fresh && j.voice_url){ vo.src=j.voice_url; const pr=vo.play(); if(pr) pr.catch(()=>{}); }
      if(j.fresh && j.sitting){
        if(j.sitting.beats<j.sitting.of) setTimeout(beat,GAP_MS);
        else closeOut(); /* the approved beats are spent; the last scene holds */
      }
    }
    else if(j && j.text){
      if(!started){ sayEl.textContent=j.text; capEl.textContent=''; }
      else { fails++; if(fails<3) setTimeout(beat,45000); else closeOut(); }
    }
    else if(started){ fails++; if(fails<3) setTimeout(beat,45000); else closeOut(); }
  }catch(e){ if(started && !done){ fails++; if(fails<3) setTimeout(beat,45000); else closeOut(); } }
  busy=false;
}
cv.addEventListener('pointerdown',e=>{ dragging=true; moved=0; lx=e.clientX; ly=e.clientY; cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); });
cv.addEventListener('pointermove',e=>{
  if(dragging){ const dx=e.clientX-lx, dy=e.clientY-ly; lx=e.clientX; ly=e.clientY; moved+=Math.abs(dx)+Math.abs(dy);
    rot3(0,2,dx*.004); rot3(1,2,-dy*.004); gs3(R3); }
});
cv.addEventListener('pointerup',e=>{ dragging=false; cv.classList.remove('drag'); });
cv.addEventListener('wheel',e=>{ e.preventDefault(); rot3(0,1,e.deltaY*.0015); rot3(1,2,e.deltaX*.0015); gs3(R3); },{passive:false});

const driftOK=!matchMedia('(prefers-reduced-motion: reduce)').matches;
applyLang();
document.getElementById('sayt').textContent=UI[lang].mix;
const gol=document.getElementById('gol');
const vo=document.getElementById('vo');
const SILENCE='data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEwAAAAAAAAAAAAEluZm8AAAAPAAAADQAAAfgAbW1tbW1tbXl5eXl5eXl5hoaGhoaGhoaSkpKSkpKSnp6enp6enp6qqqqqqqqqqra2tra2trbDw8PDw8PDw8/Pz8/Pz8/P29vb29vb2+fn5+fn5+fn8/Pz8/Pz8/P/////////AAAAAExhdmM1OC4xMwAAAAAAAAAAAAAAACQDkAAAAAAAAAH4wTrF3gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//MUxAAAAANIAAAAAExBTUUzLjEwMFVV//MUxAsAAANIAAAAAFVVVVVVVVVVVVVV//MUxBYAAANIAAAAAFVVVVVVVVVVVVVV//MUxCEAAANIAAAAAFVVVVVVVVVVVVVV//MUxCwAAANIAAAAAFVVVVVVVVVVVVVV//MUxDcAAANIAAAAAFVVVVVVVVVVVVVV//MUxEIAAANIAAAAAFVVVVVVVVVVVVVV//MUxE0AAANIAAAAAFVVVVVVVVVVVVVV//MUxFgAAANIAAAAAFVVVVVVVVVVVVVV//MUxGMAAANIAAAAAFVVVVVVVVVVVVVV//MUxG4AAANIAAAAAFVVVVVVVVVVVVVV//MUxHkAAANIAAAAAFVVVVVVVVVVVVVV//MUxIQAAANIAAAAAFVVVVVVVVVVVVVV//MUxG4AAANIAAAAAFVVVVVVVVVVVVVV//MUxGMAAANIAAAAAFVVVVVVVVVVVVVV';
gol.textContent=UI[lang].start;
gol.addEventListener('click',()=>{ vo.src=SILENCE; const pr=vo.play(); if(pr) pr.catch(()=>{}); beat(); });
requestAnimationFrame(draw);
</script>
</body>
</html>
