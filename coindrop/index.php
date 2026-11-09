<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>
<title>Money-box Jack 3D</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Libre+Caslon+Text:ital@0;1&display=swap">
<style>
/* Layout: one column workbench — header, 3D stage, control rail, then parts + checks in two columns on wide screens.
   Single dark theme on purpose: it matches the Coindrop build sheet. */
:root{
  --bg:#07090a; --well:#0d100f; --rule:#1d2620;
  --green:#6bf27a; --amber:#d9a441; --cream:#e6dfcc; --mute:#8a907f;
  --mono:"IBM Plex Mono",Menlo,Consolas,monospace;
  --serif:"Libre Caslon Text","Iowan Old Style",Palatino,Georgia,serif;
  color-scheme:dark;
}
html,body{background:var(--bg);color:var(--cream)}
body{font-family:var(--mono);font-size:13px;line-height:1.55}
.wrap{max-width:1100px;margin:0 auto;padding-block:20px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:18px}
.eyebrow{color:var(--green);font-size:11px;letter-spacing:.24em;text-transform:uppercase}
h1{font-family:var(--serif);font-weight:400;font-size:clamp(22px,4vw,32px);line-height:1.15;margin:4px 0 6px;text-wrap:balance}
.warn{color:var(--mute);font-size:12px;max-width:70ch;margin:0}
.warn b{color:var(--amber);font-weight:500}
.frame{border:1px solid var(--green);position:relative;background:var(--well)}
#stage{position:relative;width:100%;aspect-ratio:4/3;max-height:72vh;touch-action:none;overflow:hidden;cursor:grab}
@media (min-width:800px){#stage{aspect-ratio:16/9}}
#stage canvas{display:block;width:100%;height:100%}
.lbl{position:absolute;left:0;top:0;pointer-events:none;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--cream);background:rgba(7,9,10,.78);border:1px solid var(--rule);padding:1px 5px;white-space:nowrap;transform:translate(-50%,-130%)}
.lbl.flag{color:var(--amber);border-color:rgba(217,164,65,.5)}
#status{position:absolute;left:10px;bottom:10px;right:10px;font-size:11px;color:var(--green);pointer-events:none;text-shadow:0 0 6px #000}
.rail{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;border-top:1px solid var(--green);padding:10px}
.grp{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.grp>span{color:var(--mute);font-size:11px;letter-spacing:.12em;text-transform:uppercase}
button{font:inherit;font-size:12px;color:var(--cream);background:transparent;border:1px solid #2f3a32;padding:5px 10px;cursor:pointer}
button:hover{border-color:var(--mute)}
button[aria-pressed="true"]{border-color:var(--green);color:var(--green)}
button.drop{border-color:var(--amber);color:var(--amber)}
button:focus-visible,input:focus-visible{outline:2px solid var(--green);outline-offset:2px}
input[type=range]{accent-color:var(--amber);width:130px}
#info{border:1px solid var(--rule);padding:12px 14px;min-height:64px}
#info h2{font-family:var(--serif);font-weight:400;font-size:18px;margin:0 0 4px}
#info p{margin:0;color:var(--mute);max-width:75ch}

.foot{color:var(--green);font-size:10px;letter-spacing:.2em;border-top:1px solid var(--rule);padding-top:10px}
</style>

<div class="wrap">
  <header>
    <div class="eyebrow">Timetravellers Guild · Coindrop</div>
    <h1>Money-box Jack, 3D reference build</h1>
    <p class="warn"><b>Reference design, unbuilt.</b> Drag to orbit, pinch or scroll to zoom, tap a part for notes. The CH-926 size here is a placeholder; measure your actual unit before cutting anything.</p>
  </header>

  <div class="frame">
    <div id="stage"><audio id="voice" src="/coindrop/jack-reward.m4a" preload="auto"></audio><div id="status">Ready. A £1 coin pays Jack's voice module.</div></div>
    <div class="rail">
      <div class="grp"><span>View</span>
        <button id="v-iso" aria-pressed="true">Iso</button><button id="v-front">Front</button><button id="v-back">Back</button><button id="v-side">Side</button>
      </div>
      <div class="grp"><span>Shell</span><button id="shell">Ghost</button></div>
      <div class="grp"><label for="explode"><span style="color:var(--mute);font-size:11px;letter-spacing:.12em;text-transform:uppercase">Explode</span></label><input id="explode" type="range" min="0" max="1" step="0.01" value="0"></div>
      <div class="grp"><button id="labels" aria-pressed="true">Labels</button><button id="coin" class="drop">Drop £1</button></div>
    </div>
  </div>

  <div id="info"><h2>Tap any part</h2><p>Each part carries its wiring and fit notes. Wires are colour-coded: red 12 V and 5 V, black ground, white COIN, grey COUNTER (capped), amber TX, cream RX, green BUSY.</p></div>

  <div class="foot">COINDROP · REFERENCE DESIGN, UNBUILT · <a href="/coindrop/blueprint.svg" style="color:var(--green)">FULL WIRING SHEET</a> · MEASURE YOUR CH-926, COIN PULLS UP TO 3.3 V NEVER 12 V</div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script>
(function(){
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const stage=document.getElementById('stage'), statusEl=document.getElementById('status');
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
stage.insertBefore(renderer.domElement,statusEl);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x07090a);
const camera=new THREE.PerspectiveCamera(34,1,1,6000);
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=.08; controls.target.set(0,125,0);
controls.minDistance=180; controls.maxDistance=1600;

scene.add(new THREE.HemisphereLight(0xe6dfcc,0x0b120d,.55));
const key=new THREE.DirectionalLight(0xfff3dc,.9); key.position.set(300,500,400); scene.add(key);
const rim=new THREE.DirectionalLight(0x6bf27a,.25); rim.position.set(-400,200,-300); scene.add(rim);
const grid=new THREE.GridHelper(700,35,0x1f3a24,0x101813); grid.position.y=-.5; scene.add(grid);

const M=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.7,metalness:.05},o));
const parts=[]; const shellParts=[];
function part(name,obj,pos,ex,info,label,flag){
  obj.position.copy(pos);
  obj.userData={name,info,home:pos.clone(),ex:ex,label,flag};
  scene.add(obj); parts.push(obj); return obj;
}
function box(w,h,d,mat,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);return m;}

/* ---------- front panel texture (4 px per mm) ---------- */
function panelTex(){
  const k=4,c=document.createElement('canvas');c.width=200*k;c.height=260*k;const g=c.getContext('2d');
  g.fillStyle='#3a3026';g.fillRect(0,0,c.width,c.height);
  for(let i=0;i<220;i++){g.strokeStyle='rgba(230,223,204,'+(Math.random()*.05)+')';g.lineWidth=1+Math.random()*2;const y=Math.random()*c.height;g.beginPath();g.moveTo(0,y);g.bezierCurveTo(c.width*.3,y+Math.random()*20-10,c.width*.7,y+Math.random()*20-10,c.width,y+Math.random()*16-8);g.stroke();}
  // slot: 4 x 30 mm vertical, centre 44 mm from top
  g.fillStyle='#000';g.strokeStyle='#d9a441';g.lineWidth=3;
  const sx=100*k-2*k,sy=29*k;g.beginPath();g.roundRect?g.roundRect(sx,sy,4*k,30*k,2*k):g.rect(sx,sy,4*k,30*k);g.fill();g.stroke();
  g.fillStyle='#d9a441';g.font=(5*k)+'px "IBM Plex Mono",monospace';g.textAlign='left';g.fillText('£1',108*k,47*k);
  // cube face print
  g.setLineDash([3*k,3*k]);g.strokeStyle='#8a907f';g.lineWidth=2;g.strokeRect(50*k,80*k,100*k,100*k);g.setLineDash([]);
  g.fillStyle='#8a907f';g.font=(4*k)+'px "IBM Plex Mono",monospace';g.textAlign='center';g.fillText('CUBE FACE PRINT',100*k,132*k);
  // grilles: 2.5 mm holes on 5 mm hex grid
  g.fillStyle='#050606';
  [60,100,140].forEach(cx=>{const cy=220,r=16;for(let yy=-r;yy<=r;yy+=4.33){const off=(Math.round((yy+r)/4.33)%2)?2.5:0;for(let xx=-r+off;xx<=r;xx+=5){if(xx*xx+yy*yy<=(r-1.5)**2){g.beginPath();g.arc((cx+xx)*k,(cy+yy)*k,1.25*k,0,7);g.fill();}}}
    g.strokeStyle='rgba(138,144,127,.6)';g.lineWidth=2;g.beginPath();g.arc(cx*k,cy*k,r*k,0,7);g.stroke();});
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;
}

/* ---------- shell ---------- */
const ply=M(0x2e261d,{roughness:.9});
const edgeMat=new THREE.LineBasicMaterial({color:0x6bf27a,transparent:true,opacity:.55});
function shell(name,geo,mats,pos,ex,info,label){
  const mesh=new THREE.Mesh(geo,mats);const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),edgeMat);mesh.add(e);
  part(name,mesh,pos,ex,info,label);shellParts.push(mesh);return mesh;
}
const faceMat=M(0xffffff,{map:panelTex(),roughness:.85});
const front=shell('Front panel',new THREE.BoxGeometry(200,260,6),[ply,ply,ply,ply,faceMat,ply],V(0,130,67),V(0,0,150),
  '200 × 260 mm, 6 mm ply or a 3D print. Vertical 4 × 30 mm slot centred 44 mm from the top, over the mech mouth. Grille holes 2.5 mm on a 5 mm hex grid; the speaker sits behind the centre circle.','Front panel');
const back=shell('Back panel',new THREE.BoxGeometry(200,260,6),ply,V(0,130,-67),V(0,0,-150),'Carries the rear hatch, the 12 V barrel jack and the 5 V USB-C input.',null);
shell('Left wall',new THREE.BoxGeometry(6,260,128),ply,V(-97,130,0),V(-150,0,0),'Side wall. ESP32 mounts on the inside face.',null);
shell('Right wall',new THREE.BoxGeometry(6,260,128),ply,V(97,130,0),V(150,0,0),'Side wall. DFPlayer mounts on the inside face, SD slot towards the rear.',null);
shell('Top',new THREE.BoxGeometry(188,6,128),ply,V(0,257,0),V(0,140,0),'Lid.',null);
shell('Floor',new THREE.BoxGeometry(188,6,128),ply,V(0,3,0),V(0,-40,0),'Floor. Coin box sits at the rear.',null);
const hatch=new THREE.Mesh(new THREE.BoxGeometry(160,188,3),M(0x3a3026,{roughness:.85}));
hatch.add(new THREE.LineSegments(new THREE.EdgesGeometry(hatch.geometry),new THREE.LineBasicMaterial({color:0xd9a441})));
part('Rear service hatch',hatch,V(0,106,-71.5),V(0,0,-230),'160 × 188 mm, spans y 12–200 mm. Reaches the coin box, the DFPlayer SD slot and the ESP32 USB port. Use a lock or captive screws: it guards the money.','Rear hatch');
shellParts.push(hatch);

/* ---------- CH-926 (placeholder size) ---------- */
const metal=M(0x5a605c,{metalness:.6,roughness:.4}), dark=M(0x1c201e,{roughness:.6});
const mech=new THREE.Group();
mech.add(box(120,120,3,metal,0,0,62.5));
mech.add(box(100,100,70,dark,0,0,26));
mech.add(box(5,32,4,M(0x000000),0,44,64.5));           // mouth
mech.add(box(14,10,4,M(0x9a2b23),38,40,64.5));         // reject button
mech.add(box(18,8,6,M(0xe6dfcc),30,-30,-12));          // rear connector
mech.add(box(10,6,3,M(0x2b4fd9),-25,30,-10.5));        // DIP switches (placeholder)
part('CH-926 coin mech',mech,V(0,172,0),V(0,30,60),
  'Placeholder dimensions (120 mm faceplate, 70 mm deep): measure yours. 12 V on red, GND black, COIN white, COUNTER grey (capped). Set NO, slow, teach £1 = 1 pulse with real coins. Accepted coins exit the bottom into the chute.','CH-926 · size TBC',true);

/* ---------- chute ---------- */
const A=V(0,116,20),B=V(0,70,-30),mid=A.clone().add(B).multiplyScalar(.5),L=A.distanceTo(B);
const acr=M(0x9fd8c0,{transparent:true,opacity:.35,roughness:.2,depthWrite:false});
const chute=new THREE.Group();
chute.add(box(30,2,L,acr,0,0,0));chute.add(box(2,26,L,acr,-15,13,0));chute.add(box(2,26,L,acr,15,13,0));
chute.quaternion.setFromUnitVectors(V(0,0,1),B.clone().sub(A).normalize());
part('Coin chute',chute,mid,V(0,0,0),'Acrylic U-channel, 30 mm wide, from the mech exit down to the coin box. Not on the 2D sheet; it routes coins away from the speaker.','Chute');

/* ---------- coin box ---------- */
const cb=new THREE.Group();
const cbm=M(0x1a2620,{transparent:true,opacity:.55,depthWrite:false});
cb.add(box(110,2,60,cbm,0,-24,0));cb.add(box(2,50,60,cbm,-55,0,0));cb.add(box(2,50,60,cbm,55,0,0));cb.add(box(110,50,2,cbm,0,0,30));cb.add(box(110,50,2,cbm,0,0,-30));
cb.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(110,50,60)),new THREE.LineBasicMaterial({color:0xd9a441,transparent:true,opacity:.6})));
part('Coin box',cb,V(0,31,-34),V(0,-30,-110),'110 × 50 × 60 mm, open top, lifts out through the rear hatch.','Coin box');

/* ---------- speaker ---------- */
const spk=new THREE.Group();
const cone=new THREE.Mesh(new THREE.CylinderGeometry(19,7,10,32,1,true),M(0x2a2a2a,{side:THREE.DoubleSide,roughness:.8}));cone.rotation.x=Math.PI/2;cone.position.z=5;spk.add(cone);
const ring=new THREE.Mesh(new THREE.TorusGeometry(19.5,1.4,8,40),metal);ring.position.z=10;spk.add(ring);
const mag=new THREE.Mesh(new THREE.CylinderGeometry(10,10,9,24),M(0x8a907f,{metalness:.7,roughness:.3}));mag.rotation.x=Math.PI/2;mag.position.z=-4;spk.add(mag);
part('Speaker',spk,V(0,40,52),V(0,-20,90),'40 mm, 8 Ω, 3 W. Wired straight to DFPlayer SPK_1 / SPK_2, never to ground. Faces the centre grille.','Speaker 8 Ω');

/* ---------- ESP32 on left wall ---------- */
const esp=new THREE.Group();
esp.add(box(1.6,55,28,M(0x14181a),0,0,0));
esp.add(box(3,25,18,M(0xb8bcbc,{metalness:.8,roughness:.3}),2.3,12,0));
esp.add(box(4,6,9,M(0x8a907f,{metalness:.6}),2.8,-25,0));
const led=new THREE.Mesh(new THREE.BoxGeometry(1.5,2,2),M(0x103018,{emissive:0x000000}));led.position.set(1.6,-14,8);esp.add(led);
part('ESP32 DevKit',esp,V(-92,150,-22),V(-80,0,0),'WROOM module. GPIO27 = COIN in, with external 10k pull-up to 3.3 V and 1k–2.2k series. GPIO17 TX2, GPIO16 RX2, GPIO26 BUSY. USB faces down towards the hatch for flashing.','ESP32');

/* ---------- DFPlayer on right wall ---------- */
const dfp=new THREE.Group();
dfp.add(box(1.6,21,21,M(0x16302a),0,0,0));
dfp.add(box(2,12,14,M(0x8a907f,{metalness:.6}),-1.8,-3,-4));
part('DFPlayer Mini',dfp,V(92,150,-46),V(80,0,0),'microSD FAT32, tracks 0001.mp3 upward: Jack\'s lines. RX takes ESP32 TX2 through 1k. BUSY goes low while playing. Card slot faces the rear hatch.','DFPlayer');

/* ---------- power inputs ---------- */
const pw=new THREE.Group();
const dc=new THREE.Mesh(new THREE.CylinderGeometry(5.5,5.5,12,20),M(0x111111));dc.rotation.x=Math.PI/2;dc.position.set(-30,0,0);pw.add(dc);
pw.add(box(10,4,12,M(0xb8bcbc,{metalness:.8,roughness:.3}),30,0,0));
part('Power inputs',pw,V(0,228,-66),V(0,40,-180),'Left: 12 V 1 A barrel jack, mech only. Right: 5 V USB-C for ESP32 and DFPlayer VCC. Join all grounds. Sit above the hatch so it opens freely.','12 V · 5 V in');

/* ---------- wires ---------- */
const W=[
 {a:[mech,[30,-30,-15]],b:[pw,[-30,-4,6]],c:0xc23a2e,r:1.1},            // 12V red
 {a:[mech,[27,-30,-15]],b:[pw,[-26,-4,6]],c:0x111111,r:1.1},            // GND black
 {a:[mech,[24,-30,-15]],b:[esp,[2,-18,-10]],c:0xf2efe6,r:1.1,bead:true},// COIN white
 {a:[mech,[33,-30,-15]],b:[mech,[48,-46,-28]],c:0x8a8f8c,r:1.1,cap:true},// COUNTER grey capped
 {a:[pw,[30,-3,6]],b:[esp,[2,-25,0]],c:0xc23a2e,r:.9},                  // 5V to ESP32
 {a:[pw,[33,-3,6]],b:[dfp,[-1.5,8,8]],c:0xc23a2e,r:.9},                 // 5V to DFP
 {a:[pw,[27,-3,6]],b:[esp,[2,-22,6]],c:0x111111,r:.9},                  // GND
 {a:[esp,[2,20,8]],b:[dfp,[-1.5,6,-8]],c:0xd9a441,r:.8,bead:true},      // TX2
 {a:[esp,[2,16,8]],b:[dfp,[-1.5,3,-8]],c:0xe6dfcc,r:.8},                // RX2
 {a:[esp,[2,12,8]],b:[dfp,[-1.5,0,-8]],c:0x6bf27a,r:.8},                // BUSY
 {a:[dfp,[-1.5,-8,6]],b:[spk,[4,0,-6]],c:0xe6dfcc,r:.8},                // SPK1
 {a:[dfp,[-1.5,-8,9]],b:[spk,[-4,0,-6]],c:0x5b6157,r:.8},               // SPK2
];
const wp=(o,v)=>o.localToWorld(V(v[0],v[1],v[2]));
function buildWires(){
  scene.updateMatrixWorld(true);
  W.forEach(w=>{
    const a=wp(w.a[0],w.a[1]),b=wp(w.b[0],w.b[1]);
    const m1=a.clone().lerp(b,.33),m2=a.clone().lerp(b,.66);
    m1.x*=.8;m2.x*=.8;m1.z+=(-50-m1.z)*.25;m2.z+=(-50-m2.z)*.25;m1.y-=6;m2.y-=6;
    const curve=new THREE.CatmullRomCurve3([a,m1,m2,b]);w.curve=curve;
    const geo=new THREE.TubeGeometry(curve,40,w.r,6,false);
    if(w.mesh){w.mesh.geometry.dispose();w.mesh.geometry=geo;}
    else{w.mat=M(w.c,{roughness:.5,emissive:0x000000});w.mesh=new THREE.Mesh(geo,w.mat);scene.add(w.mesh);
      if(w.bead){w.beadMesh=new THREE.Mesh(new THREE.CylinderGeometry(2,2,7,12),M(0xd9a441,{metalness:.3}));scene.add(w.beadMesh);}
      if(w.cap){w.capMesh=new THREE.Mesh(new THREE.SphereGeometry(2.6,12,10),M(0xd9a441));scene.add(w.capMesh);}}
    if(w.beadMesh){const p=curve.getPoint(.82),t=curve.getTangent(.82);w.beadMesh.position.copy(p);w.beadMesh.quaternion.setFromUnitVectors(V(0,1,0),t);}
    if(w.capMesh)w.capMesh.position.copy(b);
  });
}

/* ---------- explode / shell / labels ---------- */
let ex=0;
function applyExplode(){parts.forEach(p=>p.position.copy(p.userData.home).addScaledVector(p.userData.ex,ex));buildWires();}
const exEl=document.getElementById('explode');
exEl.addEventListener('input',()=>{ex=+exEl.value;applyExplode();});

const modes=['Ghost','Solid','Hidden'];let mode=0;
function applyShell(){
  const m=modes[mode];document.getElementById('shell').textContent=m;
  shellParts.forEach(s=>{
    s.visible=m!=='Hidden';
    const mats=Array.isArray(s.material)?s.material:[s.material];
    mats.forEach(mt=>{mt.transparent=m==='Ghost';mt.opacity=m==='Ghost'?(mt===faceMat?.5:.16):1;mt.depthWrite=m!=='Ghost';mt.needsUpdate=true;});
  });
}
document.getElementById('shell').onclick=()=>{mode=(mode+1)%3;applyShell();};

const labels=[];
parts.forEach(p=>{if(!p.userData.label)return;const d=document.createElement('div');d.className='lbl'+(p.userData.flag?' flag':'');d.textContent=p.userData.label;stage.appendChild(d);labels.push({p,d});});
let showLabels=true;
const lb=document.getElementById('labels');
lb.onclick=()=>{showLabels=!showLabels;lb.setAttribute('aria-pressed',showLabels);labels.forEach(l=>l.d.hidden=!showLabels);};
const tmp=new THREE.Vector3();
function placeLabels(){
  if(!showLabels)return;const w=stage.clientWidth,h=stage.clientHeight;
  labels.forEach(({p,d})=>{
    if(!p.visible){d.hidden=true;return;}
    p.getWorldPosition(tmp);if(p===front)tmp.y+=130;if(p===mech)tmp.y+=60;if(p===spk)tmp.y-=8;
    tmp.project(camera);
    if(tmp.z>1){d.hidden=true;return;}d.hidden=false;
    d.style.left=((tmp.x+1)/2*w)+'px';d.style.top=((1-tmp.y)/2*h)+'px';
  });
}

/* ---------- views ---------- */
const views={iso:[V(430,330,560),V(0,125,0)],front:[V(0,140,820),V(0,130,0)],back:[V(0,160,-820),V(0,120,0)],side:[V(820,150,0),V(0,125,0)]};
let tween=null;
function goView(k){
  document.querySelectorAll('[id^="v-"]').forEach(b=>b.setAttribute('aria-pressed',b.id==='v-'+k));
  const [p,t]=views[k];
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){camera.position.copy(p);controls.target.copy(t);return;}
  tween={p0:camera.position.clone(),t0:controls.target.clone(),p,t,s:performance.now()};
}
['iso','front','back','side'].forEach(k=>document.getElementById('v-'+k).onclick=()=>goView(k));
camera.position.copy(views.iso[0]);

/* ---------- picking ---------- */
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();let down=null;
const info=document.getElementById('info');
renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointerup',e=>{
  if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;
  const r=renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects(parts.filter(p=>p.visible),true).filter(h=>h.object.type==='Mesh');
  if(!hits.length)return;
  // prefer an internal part if the shell is ghosted
  let hit=hits.find(h=>!shellParts.includes(root(h.object)))||hits[0];
  if(modes[mode]==='Solid')hit=hits[0];
  const p=root(hit.object);
  info.innerHTML='<h2></h2><p></p>';info.querySelector('h2').textContent=p.userData.name;info.querySelector('p').textContent=p.userData.info;
});
function root(o){while(o&&!(o.userData&&o.userData.name))o=o.parent;return o;}

/* ---------- coin run ---------- */
function makeCoin(){
  const g=new THREE.Group();
  const outer=new THREE.Mesh(new THREE.CylinderGeometry(11.7,11.7,2.8,12),M(0xc9a64a,{metalness:.85,roughness:.3}));
  const inner=new THREE.Mesh(new THREE.CylinderGeometry(7.5,7.5,2.9,32),M(0xc4c8c4,{metalness:.85,roughness:.3}));
  g.add(outer,inner);return g;
}
const boxed=[];let run=null,playingUntil=0,lineNo=0;
function setStatus(t){statusEl.textContent=t;}
const voice=document.getElementById('voice');
let paidCoin=null;
async function postJSON(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.json().catch(()=>({ok:false})); }
const params=new URLSearchParams(location.search);
const sid=params.get('session_id');
if(params.get('cancelled'))setStatus('Payment cancelled. The slot is patient.');
if(sid){setStatus('Checking the payment with the Guild ledger…');
  postJSON('/coindrop/coin.php',{action:'status',session_id:sid}).then(r=>{
    if(r.ok){paidCoin={coin:r.coin,token:r.token,session_id:sid,spent:r.spent};
      if(r.spent){setStatus('Coin '+r.coin+' is in the box. Jack remembers - tap to hear him again.');document.getElementById('coin').textContent='Hear Jack again';}
      else{setStatus('Coin paid: £1 · '+r.coin+'. Drop it.');document.getElementById('coin').textContent='Drop the coin';}
    }else setStatus('No paid coin found for that session.');
  }).catch(()=>setStatus('The ledger is unreachable. Try again shortly.'));}
function startRun(){
  scene.updateMatrixWorld(true);
  const slot=front.localToWorld(V(0,86,3));
  const chA=chute.localToWorld(V(0,13,-L/2)),chB=chute.localToWorld(V(0,13,L/2));
  const n=boxed.length;
  const land=cb.localToWorld(V((Math.random()-.5)*70,-21.5+Math.min(n,14)*2.9,(Math.random()-.5)*36));
  const pts=[slot.clone().add(V(0,30,110)),slot.clone().add(V(0,0,8)),slot.clone().add(V(0,0,-6)),mech.localToWorld(V(0,40,40)),mech.localToWorld(V(0,-56,20)),chA,chB,land];
  const dur=[700,250,300,550,350,280,700,350];
  const coin=makeCoin();coin.rotation.z=Math.PI/2;coin.position.copy(pts[0]);scene.add(coin);
  run={coin,pts,dur,seg:0,s:performance.now(),pulsed:false};
  setStatus('Coin in. CH-926 validating…');
}
document.getElementById('coin').onclick=async()=>{
  if(run)return;
  if(paidCoin&&paidCoin.spent){
    voice.currentTime=0;voice.play().catch(()=>setStatus('Tap again to hear Jack.'));
    playingUntil=performance.now()+((isFinite(voice.duration)&&voice.duration>0?voice.duration:31)*1000);
    setStatus('Jack speaks his blessing again. The coin stays in the box.');
    return;
  }
  if(paidCoin&&!paidCoin.spent){
    setStatus('Registering the drop…');
    let r;try{r=await postJSON('/coindrop/coin.php',{action:'drop',session_id:paidCoin.session_id,token:paidCoin.token});}catch(e){setStatus('The ledger is unreachable. The coin stays yours.');return;}
    if(!r.ok){setStatus(r.reason==='already_spent'?'That coin is already in the box.':'The ledger refused the coin.');return;}
    paidCoin.spent=true;document.getElementById('coin').textContent='Hear Jack again';
    startRun();
  }else{
    setStatus('Opening the till…');
    try{const r=await postJSON('/coindrop/pay.php',{});if(r.url){location.href=r.url;}
      else setStatus(r&&r.error==='paused'?'The till is not open yet - the box is still in rehearsal.':'The till is closed for a moment. Try again shortly.');}
    catch(e){setStatus('The till is not open yet - the box is still in rehearsal.');}
  }
};
function stepRun(now){
  const r=run;let t=(now-r.s)/r.dur[r.seg];
  if(t>=1){r.seg++;r.s=now;t=0;
    if(r.seg===4&&!r.pulsed){r.pulsed=true;pulse();}
    if(r.seg>=r.pts.length-1){r.coin.position.copy(r.pts[r.pts.length-1]);r.coin.rotation.set(0,Math.random()*3,0);boxed.push(r.coin);run=null;return;}
  }
  const a=r.pts[r.seg],b=r.pts[r.seg+1];
  r.coin.position.lerpVectors(a,b,r.seg===0?t*(2-t):t);
  if(r.seg>=5)r.coin.rotateY(.3);
}
const white=W[2];
function pulse(){
  white.mat.emissive.setHex(0xd9a441);led.material.emissive.setHex(0x6bf27a);
  setTimeout(()=>{white.mat.emissive.setHex(0);},140);setTimeout(()=>led.material.emissive.setHex(0),400);
  const now=performance.now();
  if(now<playingUntil){setStatus('1 pulse on COIN. BUSY is low, so the line keeps playing and this coin gets no new line.');return;}
  lineNo++;
  voice.currentTime=0;voice.play().catch(()=>{});
  const voiceMs=(isFinite(voice.duration)&&voice.duration>0?voice.duration:31)*1000;
  playingUntil=now+voiceMs;
  W[9].mat.emissive.setHex(0x2f7a38);
  setStatus('1 pulse on COIN → ESP32 counts £1 → DFPlayer plays '+String(lineNo).padStart(4,'0')+'.mp3. Jack speaks. BUSY low.');
  setTimeout(()=>{W[9].mat.emissive.setHex(0);if(!run)setStatus('BUSY high. Coins in box: '+boxed.length+'. Ready.');},voiceMs);
}

/* ---------- loop ---------- */
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stage);resize();
function frame(now){
  if(tween){let k=Math.min(1,(now-tween.s)/700);k=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    camera.position.lerpVectors(tween.p0,tween.p,k);controls.target.lerpVectors(tween.t0,tween.t,k);if(k>=1)tween=null;}
  if(run)stepRun(now);
  if(now<playingUntil){const s=1+Math.sin(now/38)*.06;cone.scale.set(s,1,s);}else cone.scale.set(1,1,1);
  controls.update();renderer.render(scene,camera);placeLabels();
  requestAnimationFrame(frame);
}
applyShell();applyExplode();requestAnimationFrame(frame);
})();
</script>

</body></html>