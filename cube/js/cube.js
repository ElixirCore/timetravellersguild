/* =====================================================
   JACK / CUBE
   ===================================================== */

const LEVEL = 3;
const SPACING = 1.05;
const ROTATE_MS = 180;
const OUTER_ONLY = true;
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const cfg = window.TTG_CUBE || {};
const thread = [];

const COLORS = {
  UP:0xffffff,
  DOWN:0xffd500,
  RIGHT:0xcc0000,
  LEFT:0xff7000,
  FRONT:0x009b48,
  BACK:0x0046ad
};

const PLASTIC = 0x0d0d0d;

const FACE_PX=0;
const FACE_NX=1;
const FACE_PY=2;
const FACE_NY=3;
const FACE_PZ=4;
const FACE_NZ=5;

/* =====================================================
   UI
===================================================== */

const speechEl = document.getElementById("speech");
const jackEl = document.getElementById("jack");
const chatLog = document.getElementById("chatLog");
const chatInput = document.getElementById("chatInput");
const chatForm = document.getElementById("chatForm");

const roundBadge = document.getElementById("roundBadge");
const moveBadge = document.getElementById("moveBadge");
const nextBtn = document.getElementById("nextBtn");
const errEl = document.getElementById("err");

let lesson=1;
let puzzleDepth=1;
let gameReady=false;
let gameSolved=false;

(function resumePlay(){
  const saved=cfg.play && cfg.play.cube ? cfg.play.cube : {};
  const n=parseInt(saved.lesson,10);
  if(n>=1 && n<=12){
    lesson=n;
    puzzleDepth=Math.min(12,lesson);
  }
})();

function showErr(msg){
  errEl.style.display="block";
  errEl.textContent=String(msg);
}

window.onerror=(msg,src,line,col)=>{
  showErr(msg+"\n"+src+":"+line+":"+col);
};

function syncViewport(){
  const vv=window.visualViewport;
  if(!vv)return;
  const kb=(window.innerHeight-vv.height)>90;
  document.body.classList.toggle("kb-open",kb);
  document.documentElement.style.setProperty("--vv-top",vv.offsetTop+"px");
  document.documentElement.style.setProperty("--vv-height",vv.height+"px");
  document.documentElement.style.setProperty("--kb",(kb?Math.max(0,window.innerHeight-vv.height-vv.offsetTop):0)+"px");
}

if(window.visualViewport){
  window.visualViewport.addEventListener("resize",syncViewport);
  window.visualViewport.addEventListener("scroll",syncViewport);
}
window.addEventListener("resize",syncViewport);
chatInput.addEventListener("focus",()=>{setTimeout(syncViewport,50);setTimeout(syncViewport,300);});
chatInput.addEventListener("blur",()=>{setTimeout(syncViewport,50);setTimeout(syncViewport,300);});
syncViewport();

/* =====================================================
   JACK VOICE
===================================================== */

let speechTimer=null;

function setJackSpeech(text){
  speechEl.textContent=text;

  jackEl.classList.add("talking");

  clearTimeout(speechTimer);

  speechTimer=setTimeout(()=>{
    jackEl.classList.remove("talking");
  },Math.min(1600,300+text.length*18));
}

function addChat(who,text){
  const row=document.createElement("div");
  row.className="msg "+(who==="MABEL"?"mabel":who==="JACK"?"jack":"user");

  const whoEl=document.createElement("span");
  whoEl.className="who";
  whoEl.textContent=who+":";
  row.appendChild(whoEl);
  row.appendChild(document.createTextNode(" "+text));

  chatLog.appendChild(row);
  chatLog.scrollTop=chatLog.scrollHeight;

  thread.push(who+": "+text);
  if(thread.length>16) thread.splice(0,thread.length-16);
}

function jackSay(text){
  setJackSpeech(text);
  addChat("JACK",text);
}

function savePlay(patch){
  fetch(cfg.playAct || "/play/act",{
    method:"POST",
    headers:{"Content-Type":"application/json",Accept:"application/json"},
    credentials:"same-origin",
    body:JSON.stringify({csrf:cfg.csrf || "",play:patch})
  }).then(res=>res.json()).then(j=>{
    if(j && j.play) cfg.play=j.play;
  }).catch(()=>{});
}

function lessonFocus(){
  return "Lesson "+String(lesson).padStart(2,"0")+" · "+
    (gameSolved ? "restored" : puzzleDepth+(puzzleDepth===1?" twist":" twists"));
}

/* =====================================================
   LOCAL JACK CHAT

   Used when the clerk line is quiet.
===================================================== */

function localJack(input){

  const q=input.toLowerCase();

  if(q.includes("help")){
    return [
      "Restore the cube.",
      "Choose an axis, select an outer slice, then turn it.",
      "I only disturbed it slightly.",
      "For now."
    ].join(" ");
  }

  if(q.includes("why")){
    return "Because filing something incorrectly is easy. Restoring the archive is the education.";
  }

  if(q.includes("time travel")){
    return "Information travels lighter than bodies. Solve the cube and we can discuss heavier luggage.";
  }

  if(q.includes("guild")){
    return "The Time Travellers Guild is a clerical error that became an institution. Your application currently consists of this cube.";
  }

  if(q.includes("cube")){
    return gameSolved
      ? "Yes. You repaired it. I am reluctantly impressed."
      : "It is not decoration. I have misplaced one or more dimensions. Kindly put them back.";
  }

  if(q.includes("jack")){
    return "Jack. Clerk. Department of Excess Time. Presently supervising remedial geometry.";
  }

  if(q.includes("mabel")){
    return window.TTG_MABEL_FOUND
      ? "She was behind the camera. She speaks for herself. I am not the Oracle."
      : "Mabel is quiet. I do not invent her. If she is here, she is behind the lens.";
  }

  if(q.includes("arianrhod") || q.includes("warehouse")){
    return window.TTG_ARIANRHOD_POSTED
      ? "She posted herself. The warehouse is gone. I overheated."
      : "Arianrhod is not on this blotter unless she posts herself.";
  }

  if(q.includes("cryptic")){
    return "Very well. Plainly: solve the cube. Each lesson becomes harder.";
  }

  if(q.includes("hello") || q.includes("hi")){
    return "Good morning. The cube is broken.";
  }

  if(q.includes("fuck")){
    return "Language received. Cube remains unsolved.";
  }

  const nudges=[
    "Interesting. Also: cube.",
    "Filed under DISTRACTION. Please continue restoring geometry.",
    "Noted. Your outstanding administrative task remains luminous and cubic.",
    "I will answer properly after you demonstrate basic dimensional hygiene.",
    "Your correspondence has been received. The cube has not.",
    "Perhaps. Turn something."
  ];

  return nudges[Math.floor(Math.random()*nudges.length)];
}

async function askJack(input){

  if(cfg.csrf){
    try{
      const data=new FormData();
      data.set("csrf",cfg.csrf);
      data.set("q",String(input).slice(0,2000));
      data.set("intent","ask");
      data.set("site","cube");
      data.set("stance","jack");
      data.set("focus",lessonFocus());
      data.set("thread",thread.join("\n").slice(0,1500));

      const res=await fetch(cfg.jack || "/now/jack",{
        method:"POST",
        body:data,
        credentials:"same-origin",
        headers:{Accept:"application/json"}
      });

      const j=await res.json();
      if(j && j.text && !j.unavailable) return j.text;
    }catch(err){
      /* clerk line quiet — local filing clerk */
    }
  }

  return localJack(input);
}

chatForm.addEventListener("submit",async e=>{
  e.preventDefault();

  const text=chatInput.value.trim();
  if(!text)return;

  chatInput.value="";
  addChat("YOU",text);

  try{
    const reply=await askJack(text);
    jackSay(reply);
  }catch(err){
    jackSay("The correspondence department has fallen over.");
  }

  setTimeout(()=>chatInput.focus(),30);
});

if(typeof THREE==="undefined"){
  showErr("The cube renderer did not load.");
}else{

/* =====================================================
   THREE
===================================================== */

const scene=new THREE.Scene();

const camera=new THREE.PerspectiveCamera(
  58,
  innerWidth/innerHeight,
  .1,
  1000
);

function frameCamera(){
  if(innerWidth<720) camera.position.set(7.4,6.4,12.2);
  else camera.position.set(6,5.4,10);
}

frameCamera();

const renderer=new THREE.WebGLRenderer({
  antialias:true,
  alpha:true
});

renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.setClearColor(0xd9cb9e,0);
renderer.domElement.style.touchAction="none";

document.body.appendChild(renderer.domElement);

const hemi=new THREE.HemisphereLight(0xf4ead0,0x6a624c,.9);
scene.add(hemi);

const key=new THREE.DirectionalLight(0xfff6e4,.85);
key.position.set(6,10,8);
scene.add(key);

const rim=new THREE.DirectionalLight(0x1e3a5f,.28);
rim.position.set(-8,5,-8);
scene.add(rim);

const controls=new THREE.OrbitControls(camera,renderer.domElement);

controls.enableDamping=true;
controls.enableKeys=false;
controls.minDistance=6;
controls.maxDistance=16;

/* Mabel lives behind the filming camera. She comes out if discovered. */
const cine=new THREE.Group();
cine.position.set(-8.4,2.6,5.8);
cine.lookAt(0,0.2,0);
(function buildCine(){
  const steel=new THREE.MeshLambertMaterial({color:0x1e3a5f});
  const glass=new THREE.MeshLambertMaterial({color:0x638B94});
  const gold=new THREE.MeshLambertMaterial({color:0xc9a227});
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.28,0.55),steel);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,0.22,8),gold);
  lens.rotation.x=Math.PI/2;
  lens.position.z=-0.36;
  const stand=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.07,2.4,6),steel);
  stand.position.y=-1.3;
  cine.add(body,lens,stand);
})();
scene.add(cine);

const mabel=new THREE.Group();
mabel.name="Mabel";
(function buildMabel(){
  const cyan=new THREE.MeshLambertMaterial({color:0x638B94});
  const ink=new THREE.MeshLambertMaterial({color:0x1a2438});
  const paper=new THREE.MeshLambertMaterial({color:0xf1e4c4});
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,0.32,7),cyan);
  torso.position.y=0.42;
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.11,8,7),paper);
  head.position.y=0.68;
  const hair=new THREE.Mesh(new THREE.SphereGeometry(0.115,8,6),ink);
  hair.position.y=0.73;
  hair.scale.set(1,0.7,0.95);
  const skirt=new THREE.Mesh(new THREE.ConeGeometry(0.2,0.32,7),cyan);
  skirt.position.y=0.2;
  mabel.add(torso,head,hair,skirt);
})();
cine.add(mabel);
mabel.position.set(0,-0.15,0.72);
mabel.rotation.y=Math.PI;

let postedAri=null;
(function postArianrhod(){
  try{
    if(new URLSearchParams(location.search).get("posted")==="arianrhod"){
      sessionStorage.setItem("ttg.arianrhod.posted","1");
    }
  }catch(e){}
  var posted=false;
  try{ posted=sessionStorage.getItem("ttg.arianrhod.posted")==="1"; }catch(e){}
  if(!posted && location.search.indexOf("posted=arianrhod")<0) return;
  if(!window.Arianrhod || !Arianrhod.buildBody) return;
  window.TTG_ARIANRHOD_POSTED=true;
  postedAri=Arianrhod.buildBody(THREE);
  postedAri.root.scale.setScalar(2.2);
  postedAri.root.position.set(0,0,5.15);
  scene.add(postedAri.root);
})();

let mabelFound=false;
let mabelEmerge=0;
let mabelLine=0;
const MABEL_LINES=[
  "I was behind the lens.",
  "I do not write the record. I read the join.",
  "Mother keeps the shed. I keep the cube."
];
const mabelPsychic=document.getElementById("mabelPsychic");

function mabelSay(text){
  if(mabelPsychic){
    mabelPsychic.hidden=false;
    mabelPsychic.textContent="MABEL — "+text;
  }
  addChat("MABEL",text);
}

function discoverMabel(){
  if(mabelFound) return;
  mabelFound=true;
  window.TTG_MABEL_FOUND=true;
  const p=new THREE.Vector3();
  mabel.getWorldPosition(p);
  cine.remove(mabel);
  scene.add(mabel);
  mabel.position.copy(p);
  mabelEmerge=1;
  mabelSay(MABEL_LINES[0]);
}

function mabelTick(dt){
  if(!mabelFound){
    const world=new THREE.Vector3();
    mabel.getWorldPosition(world);
    const to=world.clone().sub(camera.position);
    const dist=to.length();
    if(dist>0.2){
      to.normalize();
      const fwd=new THREE.Vector3();
      camera.getWorldDirection(fwd);
      const facing=fwd.dot(to);
      const cineFwd=new THREE.Vector3();
      cine.getWorldDirection(cineFwd);
      const behindCam=cineFwd.dot(camera.position.clone().sub(cine.position).normalize())< -0.15;
      if(dist<11 && facing>0.78 && behindCam) discoverMabel();
    }
    return;
  }
  if(mabelPsychic && mabelEmerge<=0 && mabelPsychic.hidden===false){
    mabelEmerge-=dt;
    if(mabelEmerge< -6) mabelPsychic.hidden=true;
  }
  if(mabelEmerge>0){
    mabelEmerge=Math.max(0,mabelEmerge-dt*0.28);
    mabel.position.lerp(new THREE.Vector3(3.6,0,4.2),1-Math.pow(0.12,dt));
    mabel.lookAt(camera.position.x,0.5,camera.position.z);
    if(mabelEmerge<0.66 && mabelLine<1){ mabelLine=1; mabelSay(MABEL_LINES[1]); }
    if(mabelEmerge<0.22 && mabelLine<2){ mabelLine=2; mabelSay(MABEL_LINES[2]); }
  }
}

const offset=((LEVEL-1)*SPACING)/2;
const mid=(LEVEL-1)/2;

const cubes=[];

/* =====================================================
   CUBE DATA
===================================================== */

function v3i(x,y,z){
  return [x,y,z];
}

function basisIdentity(){
  return {
    x:v3i(1,0,0),
    y:v3i(0,1,0),
    z:v3i(0,0,1)
  };
}

function basisIsIdentity(b){
  return (
    b.x[0]===1 && b.x[1]===0 && b.x[2]===0 &&
    b.y[0]===0 && b.y[1]===1 && b.y[2]===0 &&
    b.z[0]===0 && b.z[1]===0 && b.z[2]===1
  );
}

function basisToQuaternion(b){

  const bx=new THREE.Vector3(...b.x);
  const by=new THREE.Vector3(...b.y);
  const bz=new THREE.Vector3(...b.z);

  const m=new THREE.Matrix4();
  m.makeBasis(bx,by,bz);

  const q=new THREE.Quaternion();
  q.setFromRotationMatrix(m);

  return q;
}

function rotateDirVector(v,ax,dir){

  const [x,y,z]=v;

  if(ax==="y")
    return dir>0 ? v3i(z,y,-x) : v3i(-z,y,x);

  if(ax==="x")
    return dir>0 ? v3i(x,z,-y) : v3i(x,-z,y);

  return dir>0 ? v3i(y,-x,z) : v3i(-y,x,z);
}

function rotateBasis(b,ax,dir){
  return {
    x:rotateDirVector(b.x,ax,dir),
    y:rotateDirVector(b.y,ax,dir),
    z:rotateDirVector(b.z,ax,dir)
  };
}

function plasticMat(){
  return new THREE.MeshStandardMaterial({
    color:PLASTIC,
    roughness:.92
  });
}

function stickerMat(color){
  return new THREE.MeshStandardMaterial({
    color,
    roughness:.52
  });
}

function localStickers(home){

  const s=[null,null,null,null,null,null];

  if(home.x===LEVEL-1)s[FACE_PX]=COLORS.RIGHT;
  if(home.x===0)s[FACE_NX]=COLORS.LEFT;

  if(home.y===LEVEL-1)s[FACE_PY]=COLORS.UP;
  if(home.y===0)s[FACE_NY]=COLORS.DOWN;

  if(home.z===LEVEL-1)s[FACE_PZ]=COLORS.FRONT;
  if(home.z===0)s[FACE_NZ]=COLORS.BACK;

  return s;
}

function applyMaterials(c){

  c.material=c.userData.stickersLocal.map(
    col=>col===null ? plasticMat() : stickerMat(col)
  );
}

function addEdges(c){

  const geo=new THREE.EdgesGeometry(
    new THREE.BoxGeometry(1.025,1.025,1.025)
  );

  const mat=new THREE.LineBasicMaterial({
    color:0xc9a227,
    transparent:true,
    opacity:.85,
    depthTest:false
  });

  const lines=new THREE.LineSegments(geo,mat);

  lines.visible=false;
  lines.renderOrder=100;

  c.add(lines);

  return lines;
}

let idCounter=0;

for(let x=0;x<LEVEL;x++){
  for(let y=0;y<LEVEL;y++){
    for(let z=0;z<LEVEL;z++){

      const c=new THREE.Mesh(
        new THREE.BoxGeometry(1,1,1),
        []
      );

      c.position.set(
        x*SPACING-offset,
        y*SPACING-offset,
        z*SPACING-offset
      );

      c.userData.id=idCounter++;
      c.userData.idx={x,y,z};
      c.userData.home={x,y,z};
      c.userData.basis=basisIdentity();
      c.userData.stickersLocal=localStickers(c.userData.home);
      c.userData.edges=addEdges(c);

      applyMaterials(c);

      scene.add(c);
      cubes.push(c);
    }
  }
}

/* =====================================================
   GAME STATE
===================================================== */

let axis="y";
let slice=0;

let isRotating=false;
let activeTween=null;

let playerMoves=0;

let scrambleMoves=[];
let lastMove=null;

function isOuterSlice(s){
  return s===0 || s===LEVEL-1;
}

function nextOuterSlice(from,delta){
  return from===0 ? LEVEL-1 : 0;
}

function axisVector(ax){
  if(ax==="x")return new THREE.Vector3(1,0,0);
  if(ax==="y")return new THREE.Vector3(0,1,0);
  return new THREE.Vector3(0,0,1);
}

function rotateIndex(idx,ax,dir){

  let xc=idx.x-mid;
  let yc=idx.y-mid;
  let zc=idx.z-mid;

  let nx=xc;
  let ny=yc;
  let nz=zc;

  if(ax==="y"){

    if(dir>0){
      nx=zc;
      nz=-xc;
    }else{
      nx=-zc;
      nz=xc;
    }

  }else if(ax==="x"){

    if(dir>0){
      ny=zc;
      nz=-yc;
    }else{
      ny=-zc;
      nz=yc;
    }

  }else{

    if(dir>0){
      nx=yc;
      ny=-xc;
    }else{
      nx=-yc;
      ny=xc;
    }
  }

  return {
    x:Math.round(nx+mid),
    y:Math.round(ny+mid),
    z:Math.round(nz+mid)
  };
}

function snapPosition(c){

  const i=c.userData.idx;

  c.position.set(
    i.x*SPACING-offset,
    i.y*SPACING-offset,
    i.z*SPACING-offset
  );
}

function isSolved(){

  for(const c of cubes){

    const i=c.userData.idx;
    const h=c.userData.home;

    if(
      i.x!==h.x ||
      i.y!==h.y ||
      i.z!==h.z
    )return false;

    if(!basisIsIdentity(c.userData.basis))
      return false;
  }

  return true;
}

/* =====================================================
   SELECTED SLICE
===================================================== */

function highlightSelection(){

  cubes.forEach(c=>{

    const i=c.userData.idx;

    const selected=
      axis==="x" ? i.x===slice :
      axis==="y" ? i.y===slice :
                   i.z===slice;

    c.userData.edges.visible=
      gameReady && !gameSolved && selected;
  });
}

function syncAxisButtons(){

  document.getElementById("axisX")
    .classList.toggle("on",axis==="x");

  document.getElementById("axisY")
    .classList.toggle("on",axis==="y");

  document.getElementById("axisZ")
    .classList.toggle("on",axis==="z");
}

/* =====================================================
   ROTATION
===================================================== */

function rotateSlice(ax,s,dir,options={}){

  if(isRotating)return Promise.resolve(false);
  if(OUTER_ONLY && !isOuterSlice(s))
    return Promise.resolve(false);

  isRotating=true;
  controls.enabled=false;

  const group=new THREE.Group();
  scene.add(group);

  const selected=cubes.filter(c=>{

    const i=c.userData.idx;

    return ax==="x"
      ? i.x===s
      : ax==="y"
        ? i.y===s
        : i.z===s;
  });

  selected.forEach(c=>group.attach(c));

  const av=axisVector(ax);
  const start=performance.now();
  const target=dir*Math.PI/2;

  return new Promise(resolve=>{

    activeTween=now=>{

      const t=Math.min(1,(now-start)/ROTATE_MS);
      const eased=t<.5
        ? 2*t*t
        : -1+(4-2*t)*t;

      group.rotation.set(0,0,0);
      group.rotateOnAxis(av,target*eased);

      if(t>=1){

        group.rotation.set(0,0,0);
        group.rotateOnAxis(av,target);

        [...group.children].forEach(c=>{

          scene.attach(c);

          c.userData.idx=
            rotateIndex(c.userData.idx,ax,dir);

          c.userData.basis=
            rotateBasis(c.userData.basis,ax,dir);

          c.quaternion.copy(
            basisToQuaternion(c.userData.basis)
          );

          snapPosition(c);
        });

        scene.remove(group);

        activeTween=null;
        isRotating=false;
        controls.enabled=true;

        if(options.player){

          playerMoves++;

          onPlayerMove({
            axis:ax,
            slice:s,
            dir
          });
        }

        highlightSelection();

        resolve(true);
      }
    };
  });
}

/* =====================================================
   PUZZLES
===================================================== */

function randomMove(previous){

  const axes=["x","y","z"];

  for(let tries=0;tries<30;tries++){

    const m={
      axis:axes[
        Math.floor(Math.random()*axes.length)
      ],
      slice:Math.random()<.5 ? 0 : LEVEL-1,
      dir:Math.random()<.5 ? -1 : 1
    };

    if(!previous)return m;

    const immediateInverse=
      m.axis===previous.axis &&
      m.slice===previous.slice &&
      m.dir===-previous.dir;

    if(!immediateInverse)
      return m;
  }

  return {
    axis:"y",
    slice:0,
    dir:1
  };
}

async function startLesson(){

  gameReady=false;
  gameSolved=false;

  nextBtn.style.display="none";

  playerMoves=0;
  scrambleMoves=[];

  roundBadge.textContent=
    "LESSON "+String(lesson).padStart(2,"0");

  moveBadge.textContent=
    puzzleDepth+
    (puzzleDepth===1 ? " TWIST" : " TWISTS");

  highlightSelection();

  if(lesson===1){

    jackSay(
      "One twist. I broke it. You put it back."
    );

  }else if(lesson===2){

    jackSay(
      "Two errors now. Apparently you require a curriculum."
    );

  }else if(lesson===3){

    jackSay(
      "Three twists. History is becoming less cooperative."
    );

  }else if(lesson===4){

    jackSay(
      "Four. Notice the relationships, not merely the colours."
    );

  }else{

    jackSay(
      puzzleDepth+
      " twists. I have ceased pretending this is accidental."
    );
  }

  await sleep(650);

  let prev=null;

  for(let i=0;i<puzzleDepth;i++){

    const move=randomMove(prev);

    scrambleMoves.push(move);

    await rotateSlice(
      move.axis,
      move.slice,
      move.dir,
      {player:false}
    );

    await sleep(80);

    prev=move;
  }

  gameReady=true;

  axis=scrambleMoves[
    scrambleMoves.length-1
  ].axis;

  slice=scrambleMoves[
    scrambleMoves.length-1
  ].slice;

  syncAxisButtons();
  highlightSelection();

  if(puzzleDepth===1){
    jackSay("There. One clerical error.");
  }else{
    jackSay("Archive damaged. Please restore.");
  }

  chatInput.focus();
}

function sleep(ms){
  return new Promise(r=>setTimeout(r,ms));
}

function onPlayerMove(move){

  if(!gameReady || gameSolved)return;

  lastMove=move;

  if(isSolved()){

    completeLesson();
    return;
  }

  /* occasional Jack pressure */

  if(playerMoves===3 && puzzleDepth===1){

    jackSay(
      "It was one twist. You have now made three. Fascinating."
    );

  }else if(playerMoves===8 && !gameSolved){

    jackSay(
      "Your method has acquired narrative complexity."
    );

  }else if(playerMoves===15 && !gameSolved){

    jackSay(
      "Would you like to solve the cube, or establish a new civilisation inside it?"
    );
  }
}

function completeLesson(){

  if(gameSolved)return;

  gameSolved=true;
  gameReady=false;

  highlightSelection();

  const par=puzzleDepth;

  let response;

  if(playerMoves===par){

    response=[
      "Correct.",
      "Clean restoration.",
      "No excess movement."
    ][Math.floor(Math.random()*3)];

  }else if(playerMoves<=par+3){

    response="Restored. Slightly inefficient. Acceptable.";

  }else{

    response=
      "Solved after "+
      playerMoves+
      " movements. I shall omit several remarks from the permanent record.";
  }

  jackSay(response);

  nextBtn.style.display="block";
  nextBtn.textContent=
    "LESSON "+String(lesson+1).padStart(2,"0")+" →";

  savePlay({
    cube:{
      best:lesson,
      lesson:Math.min(12,lesson+1),
      restores:((cfg.play && cfg.play.cube && cfg.play.cube.restores) || 0)+1,
      lastMoves:playerMoves,
      lastPar:par
    }
  });
}

nextBtn.addEventListener("click",()=>{

  lesson++;

  /*
    Difficulty curve:
    1,2,3,4,5,6...
    cap at 12 for playable teaching mode.
  */

  puzzleDepth=Math.min(12,lesson);

  startLesson();
});

/* =====================================================
   CONTROLS
===================================================== */

function setAxis(a){

  if(isRotating)return;

  axis=a;

  if(!isOuterSlice(slice))
    slice=0;

  syncAxisButtons();
  highlightSelection();
}

document.getElementById("axisX")
  .addEventListener("click",()=>setAxis("x"));

document.getElementById("axisY")
  .addEventListener("click",()=>setAxis("y"));

document.getElementById("axisZ")
  .addEventListener("click",()=>setAxis("z"));

document.getElementById("sliceDown")
  .addEventListener("click",()=>{

    if(isRotating)return;

    slice=nextOuterSlice(slice,-1);
    highlightSelection();
  });

document.getElementById("sliceUp")
  .addEventListener("click",()=>{

    if(isRotating)return;

    slice=nextOuterSlice(slice,1);
    highlightSelection();
  });

document.getElementById("turnCCW")
  .addEventListener("click",()=>{

    if(!gameReady || isRotating)return;

    rotateSlice(
      axis,
      slice,
      -1,
      {player:true}
    );
  });

document.getElementById("turnCW")
  .addEventListener("click",()=>{

    if(!gameReady || isRotating)return;

    rotateSlice(
      axis,
      slice,
      1,
      {player:true}
    );
  });

/* keyboard */

window.addEventListener("keydown",e=>{

  if(document.activeElement===chatInput)
    return;

  const k=e.key.toLowerCase();

  if(k==="x")setAxis("x");
  if(k==="y")setAxis("y");
  if(k==="z")setAxis("z");

  if(e.key==="ArrowUp" ||
     e.key==="ArrowDown"){

    e.preventDefault();

    slice=nextOuterSlice(
      slice,
      e.key==="ArrowUp" ? 1 : -1
    );

    highlightSelection();
  }

  if(e.key==="ArrowLeft"){

    e.preventDefault();

    if(gameReady && !isRotating)
      rotateSlice(
        axis,
        slice,
        -1,
        {player:true}
      );
  }

  if(e.key==="ArrowRight"){

    e.preventDefault();

    if(gameReady && !isRotating)
      rotateSlice(
        axis,
        slice,
        1,
        {player:true}
      );
  }
});

/* =====================================================
   CAMERA / ANIMATION
===================================================== */

let lastNow=0;
function animate(now){

  requestAnimationFrame(animate);

  controls.update();

  if(activeTween)
    activeTween(now);

  const dt=lastNow?Math.min(0.05,(now-lastNow)/1000):0.016;
  lastNow=now;
  mabelTick(dt);
  if(postedAri) postedAri.update(dt,{vx:0,vz:0,pray:false,reduced:reduceMotion});

  /*
    Tiny breathing motion of the whole world.
  */

  if(!reduceMotion){
    scene.rotation.y=
      Math.sin(now*.00014)*.018;
  }

  renderer.render(scene,camera);
}

animate();

window.addEventListener("resize",()=>{

  camera.aspect=
    innerWidth/innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    innerWidth,
    innerHeight
  );

  syncViewport();
});

/* =====================================================
   BOOT
===================================================== */

async function boot(){

  const who=cfg.play && cfg.play.name ? cfg.play.name : "";
  const best=cfg.play && cfg.play.cube ? cfg.play.cube.best : 0;

  if(window.TTG_ARIANRHOD_POSTED){
    jackSay("She posted herself. The warehouse is gone. I overheated.");
  }else if(who && best){
    jackSay("Ah. "+who+". Lesson "+String(lesson).padStart(2,"0")+" remains.");
  }else if(who){
    jackSay("Ah. "+who+". This is the teaching cube. I have slightly broken the geometry so you can learn the turns.");
  }else{
    jackSay("This is the teaching cube. I have slightly broken the geometry so you can learn the turns.");
  }

  await sleep(1400);

  if(lesson>1){
    jackSay("We continue. Outer slices only. One lesson at a time.");
  }else{
    jackSay("Start small. One twist. Restore the cube. Ask me anything while you work.");
  }

  await sleep(800);

  startLesson();
}

boot();

}
