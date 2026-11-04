'use strict';
/* ════════════════════════════════════════════════════════════════════
   THE TIME TRAVELLERS GUILD · GEOCENTRIC CHRONOMETER № 13 (third state)
   Ephemerides: mean orbital elements + principal perturbations (after
   P. Schlyter). Earth-grid turns at true sidereal rate. The Rose of
   Venus is her actual geocentric path over one eight-year cycle.
   ════════════════════════════════════════════════════════════════════ */

const D2R = Math.PI/180, R2D = 180/Math.PI;
const rev = d => (d % 360 + 360) % 360;
const sind = x => Math.sin(x*D2R), cosd = x => Math.cos(x*D2R);
const atan2d = (y,x) => rev(Math.atan2(y,x)*R2D);

/* ── Astronomy ─────────────────────────────────────────────────── */
function kepler(M,e){
  let E = M + e*R2D*sind(M)*(1+e*cosd(M));
  for(let i=0;i<6;i++) E = E - (E - e*R2D*sind(E) - M)/(1 - e*cosd(E));
  return E;
}
function helio(N,i,w,a,e,M){
  const E = kepler(M,e);
  const xv = a*(cosd(E)-e), yv = a*Math.sqrt(1-e*e)*sind(E);
  const v = atan2d(yv,xv), r = Math.hypot(xv,yv);
  const u = v+w;
  return {
    x: r*(cosd(N)*cosd(u) - sind(N)*sind(u)*cosd(i)),
    y: r*(sind(N)*cosd(u) + cosd(N)*sind(u)*cosd(i)), r
  };
}
function sunXY(d){
  const ws = rev(282.9404 + 4.70935e-5*d), es = 0.016709 - 1.151e-9*d,
        Ms = rev(356.0470 + 0.9856002585*d);
  const Es = kepler(Ms,es);
  const xe = cosd(Es)-es, ye = Math.sqrt(1-es*es)*sind(Es);
  const lon = rev(atan2d(ye,xe) + ws), r = Math.hypot(xe,ye);
  return { x:r*cosd(lon), y:r*sind(lon), lon, r, Ms, ws };
}
function venusGeoXY(dateMs){                 // geocentric Venus, AU
  const d = dateMs/86400000 - 10956;
  const s = sunXY(d);
  const h = helio(rev(76.6799+2.4659e-5*d), 3.3946, rev(54.8910+1.38374e-5*d),
                  0.723330, 0.006773-1.302e-9*d, rev(48.0052+1.6021302244*d));
  return { x: h.x+s.x, y: h.y+s.y };
}
function ephemeris(dateMs){
  const d = dateMs/86400000 - 10956;
  const s = sunXY(d);
  const Nm = rev(125.1228 - 0.0529538083*d), wm = rev(318.0634 + 0.1643573223*d),
        Mm = rev(115.3654 + 13.0649929509*d);
  const mp = helio(Nm,5.1454,wm,60.2666,0.0549,Mm);
  let moonLon = atan2d(mp.y,mp.x);
  const Ls = rev(s.Ms+s.ws), Lm = rev(Mm+wm+Nm), Dm = rev(Lm-Ls), F = rev(Lm-Nm);
  moonLon = rev(moonLon
    -1.274*sind(Mm-2*Dm) +0.658*sind(2*Dm) -0.186*sind(s.Ms)
    -0.059*sind(2*Mm-2*Dm) -0.057*sind(Mm-2*Dm+s.Ms) +0.053*sind(Mm+2*Dm)
    +0.046*sind(2*Dm-s.Ms) +0.041*sind(Mm-s.Ms) -0.035*sind(Dm)
    -0.031*sind(Mm+s.Ms) -0.015*sind(2*F-2*Dm) +0.011*sind(Mm-4*Dm));
  const el = {
    mercury:[48.3313+3.24587e-5*d, 7.0047, 29.1241+1.01444e-5*d, 0.387098, 0.205635+5.59e-10*d, 168.6562+4.0923344368*d],
    venus:  [76.6799+2.4659e-5*d, 3.3946, 54.8910+1.38374e-5*d, 0.723330, 0.006773-1.302e-9*d, 48.0052+1.6021302244*d],
    mars:   [49.5574+2.11081e-5*d, 1.8497, 286.5016+2.92961e-5*d, 1.523688, 0.093405+2.516e-9*d, 18.6021+0.5240207766*d],
    jupiter:[100.4542+2.76854e-5*d, 1.3030, 273.8777+1.64505e-5*d, 5.20256, 0.048498+4.469e-9*d, 19.8950+0.0830853001*d],
    saturn: [113.6634+2.3898e-5*d, 2.4886, 339.3939+2.97661e-5*d, 9.55475, 0.055546-9.499e-9*d, 316.9670+0.0334442282*d],
    uranus: [74.0005+1.3978e-5*d, 0.7733+1.9e-8*d, 96.6612+3.0565e-5*d, 19.18171-1.55e-8*d, 0.047318+7.45e-9*d, 142.5905+0.011725806*d],
    neptune:[131.7806+3.0173e-5*d, 1.7700-2.55e-7*d, 272.8461-6.027e-6*d, 30.05826+3.313e-8*d, 0.008606+2.15e-9*d, 260.2471+0.005995147*d]
  };
  const Mj = rev(el.jupiter[5]), Msa = rev(el.saturn[5]), Mu = rev(el.uranus[5]);
  const out = { sun:{lon:s.lon, dist:s.r}, moon:{lon:moonLon, dist:mp.r/23455} };
  for(const k in el){
    const [N,i,w,a,e,M] = el[k];
    const h = helio(rev(N),i,rev(w),a,e,rev(M));
    let lc = 0;
    if(k==='jupiter') lc = -0.332*sind(2*Mj-5*Msa-67.6) -0.056*sind(2*Mj-2*Msa+21)
      +0.042*sind(3*Mj-5*Msa+21) -0.036*sind(Mj-2*Msa) +0.022*cosd(Mj-Msa)
      +0.023*sind(2*Mj-3*Msa+52) -0.016*sind(Mj-5*Msa-69);
    if(k==='saturn') lc = 0.812*sind(2*Mj-5*Msa-67.6) -0.229*cosd(2*Mj-4*Msa-2)
      +0.119*sind(Mj-2*Msa-3) +0.046*sind(2*Mj-6*Msa-69) +0.014*sind(Mj-3*Msa+32);
    if(k==='uranus') lc = 0.040*sind(Msa-2*Mu+6) +0.035*sind(Msa-3*Mu+33) -0.015*sind(Mj-Mu+20);
    if(lc){
      const hl = atan2d(h.y,h.x)+lc, hr = Math.hypot(h.x,h.y);
      h.x = hr*cosd(hl); h.y = hr*sind(hl);
    }
    const gx = h.x + s.x, gy = h.y + s.y;
    out[k] = { lon: atan2d(gy,gx), dist: Math.hypot(gx,gy) };
  }
  { // Pluto: curve-fit after Schlyter, sound for roughly 1900–2100
    const S = rev(50.03 + 0.033459652*d), P = rev(238.95 + 0.003968789*d);
    const lo = rev(238.9508 + 0.00400703*d
      -19.799*sind(P) +19.848*cosd(P) +0.897*sind(2*P) -4.956*cosd(2*P)
      +0.610*sind(3*P) +1.211*cosd(3*P) -0.341*sind(4*P) -0.190*cosd(4*P)
      +0.128*sind(5*P) -0.034*cosd(5*P) -0.038*sind(6*P) +0.031*cosd(6*P)
      +0.020*sind(S-P) -0.010*cosd(S-P));
    const r = 40.72 +6.68*sind(P) +6.90*cosd(P) -1.18*sind(2*P) -0.03*cosd(2*P)
      +0.15*sind(3*P) -0.14*cosd(3*P);
    const gx = r*cosd(lo) + s.x, gy = r*sind(lo) + s.y;
    out.pluto = { lon: atan2d(gy,gx), dist: Math.hypot(gx,gy) };
  }
  return out;
}
const gmst = ms => rev(280.46061837 + 360.98564736629*(ms/86400000 - 10957.5));

const VS = '\uFE0E';   // text-presentation selector: keeps iOS from emojifying glyphs
const SIGNS = [
  ['Aries','♈'],['Taurus','♉'],['Gemini','♊'],['Cancer','♋'],
  ['Leo','♌'],['Virgo','♍'],['Libra','♎'],['Scorpio','♏'],
  ['Sagittarius','♐'],['Capricorn','♑'],['Aquarius','♒'],['Pisces','♓']
];
const signOf = lon => { const l=rev(lon); return { i:Math.floor(l/30), deg:l%30 }; };
const fmtLon = lon => { const l=rev(lon), dg=Math.floor(l), mn=Math.floor((l-dg)*60);
  return `${dg}° ${String(mn).padStart(2,'0')}′`; };

/* ── Scene ─────────────────────────────────────────────────────── */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0906);
scene.fog = new THREE.FogExp2(0x0c0906, 0.0048);

const camera = new THREE.PerspectiveCamera(46, innerWidth/innerHeight, 0.1, 700);
camera.up.set(0,0,1);
let camTheta = -Math.PI/2, camPhi = 0.58, camDist = 27;
let camThetaT = camTheta, camPhiT = camPhi, camDistT = camDist;
const DIST_MAX = 170;
/* ── Focus-orbit camera: one system, any target ──────────────────
   The camera always orbits a focus point — the chronometer's heart
   by default, or any wandering body. Drag orbits, pinch/wheel zooms
   toward the focus; focusing a planet lets you draw right up to it,
   and the camera rides along as the body moves through time.      */
let focusBody = null;
const smoothTarget = new THREE.Vector3(0,0,1.2);
const _fp = new THREE.Vector3();
function focusPoint(out){
  return focusBody
    ? out.set(focusBody.group.position.x, focusBody.group.position.y, focusBody.tier)
    : out.set(0,0,1.2);
}
const minDist = () => focusBody ? Math.max(.55, focusBody.size*2.2) : 5.5;
const clampDist = d => Math.min(DIST_MAX, Math.max(minDist(), d));
function setFocus(b){
  focusBody = b;
  document.body.classList.toggle('pinned', !!b);
  // keep the eye where it stands: recompute spherical coords about the
  // new target so the view glides rather than snaps
  focusPoint(_fp);
  const off = camera.position.clone().sub(_fp);
  camDist = Math.max(off.length(), .01);
  camPhi  = Math.asin(Math.min(1, Math.max(-1, off.z/camDist)));
  camTheta = Math.atan2(off.y, off.x);
  camThetaT = camTheta; camPhiT = b ? camPhi : Math.max(0.3, camPhi);
  camDistT = b ? Math.max(minDist()*1.4, b.size*9) : 27;   // arrival swoop
  const btn = document.getElementById('do-pin');
  if(btn) btn.textContent = b ? 'Withdraw' : 'Draw near';
}
function placeCamera(dt){
  const ease = (reduceMotion || dt===undefined) ? 1 : 1-Math.pow(0.0005,dt);
  smoothTarget.lerp(focusPoint(_fp), ease);
  camera.position.set(
    smoothTarget.x + camDist*Math.cos(camPhi)*Math.cos(camTheta),
    smoothTarget.y + camDist*Math.cos(camPhi)*Math.sin(camTheta),
    smoothTarget.z + camDist*Math.sin(camPhi));
  camera.lookAt(smoothTarget);
}

/* candlelight starfield */
{
  const n = 2400, pos = new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const r = 200+Math.random()*240, t = Math.random()*Math.PI*2, p = Math.acos(2*Math.random()-1);
    pos[i*3]=r*Math.sin(p)*Math.cos(t); pos[i*3+1]=r*Math.sin(p)*Math.sin(t); pos[i*3+2]=r*Math.cos(p);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({
    color:0xd8c49a, size:1, sizeAttenuation:true, transparent:true, opacity:.65})));
}

/* helpers */
function glowSprite(hex, size, alpha=1){
  const c = document.createElement('canvas'); c.width=c.height=128;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(64,64,0,64,64,64);
  const col = '#'+hex.toString(16).padStart(6,'0');
  gr.addColorStop(0, col); gr.addColorStop(.3, col+'99'); gr.addColorStop(1,'transparent');
  x.fillStyle=gr; x.fillRect(0,0,128,128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map:new THREE.CanvasTexture(c), blending:THREE.AdditiveBlending,
    depthWrite:false, transparent:true, opacity:alpha}));
  s.scale.set(size,size,1); return s;
}
function textSprite(txt, {px=48, color='#e9dfc8', font='IM Fell English', scale=1}={}){
  const c = document.createElement('canvas');
  let x = c.getContext('2d');
  x.font = `${px}px '${font}',serif`;
  const w = Math.ceil(x.measureText(txt).width)+24;
  c.width = w; c.height = px*1.7;
  x = c.getContext('2d');
  x.font = `${px}px '${font}',serif`;
  x.fillStyle = color; x.textAlign='center'; x.textBaseline='middle';
  x.shadowColor = color; x.shadowBlur = px*.2;
  x.fillText(txt, w/2, c.height/2);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map:new THREE.CanvasTexture(c), depthWrite:false, transparent:true}));
  s.scale.set(scale*w/px, scale*1.7, 1); return s;
}
function circleLine(r, color, opacity, segs=180){
  const pts = [];
  for(let i=0;i<=segs;i++){ const a=i/segs*Math.PI*2; pts.push(new THREE.Vector3(r*Math.cos(a), r*Math.sin(a), 0)); }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({color, transparent:true, opacity}));
}
function sphericalEdges(geom, R, color, opacity){
  const eg = new THREE.EdgesGeometry(geom);
  const p = eg.attributes.position, pos = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), v = new THREE.Vector3(), w = new THREE.Vector3();
  for(let i=0;i<p.count;i+=2){
    a.fromBufferAttribute(p,i); b.fromBufferAttribute(p,i+1);
    for(let s=0;s<14;s++){
      v.lerpVectors(a,b,s/14).normalize().multiplyScalar(R);
      w.lerpVectors(a,b,(s+1)/14).normalize().multiplyScalar(R);
      pos.push(v.x,v.y,v.z, w.x,w.y,w.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos),3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({color, transparent:true, opacity}));
}

/* ── The heart: tetrahedral Earth grid, raised upon the dial ───── */
const EARTH_R = 1.12, GLOBE_Z = 1.55;
const earthGrid = new THREE.Group();
earthGrid.position.z = GLOBE_Z;
scene.add(earthGrid);
{
  const gridCol = 0x9a8a6c;
  for(let m=0;m<12;m++){
    const mer = circleLine(EARTH_R, gridCol, .14, 90);
    mer.rotation.x = Math.PI/2; mer.rotation.y = m*Math.PI/12;
    earthGrid.add(mer);
  }
  [[0,.32],[19.47,.24],[-19.47,.24],[52,.1],[-52,.1]].forEach(([lat,op])=>{
    const ring = circleLine(EARTH_R*cosd(lat), lat===0?0xc9a45c:gridCol, op, 120);
    ring.position.z = EARTH_R*sind(lat);
    earthGrid.add(ring);
  });
  earthGrid.add(sphericalEdges(new THREE.IcosahedronGeometry(1,0), EARTH_R*1.002, 0x7fae94, .8));
  earthGrid.add(sphericalEdges(new THREE.DodecahedronGeometry(1,0), EARTH_R*1.002, 0x8a7040, .4));
  const tg = new THREE.TetrahedronGeometry(EARTH_R*.98);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1,1,1).normalize(), new THREE.Vector3(0,0,1));
  const tetra = new THREE.LineSegments(new THREE.EdgesGeometry(tg),
    new THREE.LineBasicMaterial({color:0xe6c07a, transparent:true, opacity:.85}));
  tetra.quaternion.copy(q);
  earthGrid.add(tetra);
  earthGrid.add(glowSprite(0xc98a52, 1.1, .8));
}
const earthAura = glowSprite(0x7fae94, 4.8, .22);
earthAura.position.z = GLOBE_Z; scene.add(earthAura);
/* pillar: the globe's mounting, like a brass column */
{
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.045,.09,GLOBE_Z-EARTH_R*.55,10),
    new THREE.MeshBasicMaterial({color:0x8a7040}));
  pillar.rotation.x = Math.PI/2;
  pillar.position.z = (GLOBE_Z-EARTH_R*.55)/2;
  scene.add(pillar);
}

/* ── Hands: rings bearing tetrahedron beads ────────────────────── */
function bead(color, size){
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.TetrahedronGeometry(size),
    new THREE.MeshBasicMaterial({color}));
  g.add(t);
  g.add(glowSprite(color, size*6, .8));
  g.userData.tet = t;
  return g;
}
function hand(ringR, color, beadSize){
  const grp = new THREE.Group();
  grp.add(circleLine(ringR, color, .2));
  const spar = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(0,.55,0), new THREE.Vector3(0,ringR,0)]),
    new THREE.LineBasicMaterial({color, transparent:true, opacity:.9}));
  grp.add(spar);
  const b = bead(color, beadSize); b.position.set(0,ringR,.08);
  grp.add(b);
  grp.userData.bead = b;
  return grp;
}
const clockGrp = new THREE.Group(); clockGrp.position.z = .05; scene.add(clockGrp);
const hourHand   = hand(1.62, 0xc9a45c, .17);
const minuteHand = hand(2.02, 0x7fae94, .13);
const secondHand = hand(2.42, 0xe6c07a, .09);
clockGrp.add(hourHand, minuteHand, secondHand);

/* dial */
{
  const S = 1024, c = document.createElement('canvas'); c.width=c.height=S;
  const x = c.getContext('2d'), cx=S/2;
  x.translate(cx,cx);
  x.strokeStyle='rgba(201,164,92,.85)'; x.lineWidth=2.5;
  x.beginPath(); x.arc(0,0,492,0,Math.PI*2); x.stroke();
  x.beginPath(); x.arc(0,0,404,0,Math.PI*2); x.lineWidth=1; x.strokeStyle='rgba(201,164,92,.3)'; x.stroke();
  for(let i=0;i<60;i++){
    const a = i*6*D2R, maj = i%5===0;
    x.strokeStyle = maj?'rgba(233,223,200,.9)':'rgba(201,164,92,.4)';
    x.lineWidth = maj?4:1.6;
    x.beginPath();
    x.moveTo(Math.sin(a)*(maj?440:460), -Math.cos(a)*(maj?440:460));
    x.lineTo(Math.sin(a)*486, -Math.cos(a)*486);
    x.stroke();
  }
  const numerals=['XII','I','II','III','IIII','V','VI','VII','VIII','IX','X','XI'];
  x.fillStyle='rgba(233,223,200,.92)'; x.textAlign='center'; x.textBaseline='middle';
  x.font="54px 'IM Fell English SC',serif";
  numerals.forEach((nu,i)=>{
    const a=i*30*D2R;
    x.save(); x.translate(Math.sin(a)*356, -Math.cos(a)*356); x.rotate(a); x.fillText(nu,0,0); x.restore();
  });
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const dial = new THREE.Mesh(new THREE.PlaneGeometry(5.6,5.6),
    new THREE.MeshBasicMaterial({map:tex, transparent:true, depthWrite:false}));
  dial.position.z = .02; scene.add(dial);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.8,72),
    new THREE.MeshBasicMaterial({color:0x120d07, transparent:true, opacity:.82}));
  scene.add(disc);
}

/* ── Orrery: tiered bodies on brass stems ──────────────────────── */
const orrery = new THREE.Group(); scene.add(orrery);
const BODIES = [
  { key:'moon',    name:'Luna',    glyph:'☾', color:0xd8d2c4, ring:3.8,  size:.20, tier:.55 },
  { key:'mercury', name:'Mercury', glyph:'☿', color:0xb98d5e, ring:4.65, size:.15, tier:.85 },
  { key:'venus',   name:'Venus',   glyph:'♀', color:0xe3cf9e, ring:5.5,  size:.22, tier:1.15 },
  { key:'sun',     name:'Sol',     glyph:'☉', color:0xd9a441, ring:6.45, size:.62, tier:1.45 },
  { key:'mars',    name:'Mars',    glyph:'♂', color:0xb3573f, ring:7.35, size:.18, tier:1.75 },
  { key:'jupiter', name:'Jupiter', glyph:'♃', color:0xc2a075, ring:8.25, size:.30, tier:2.05 },
  { key:'saturn',  name:'Saturn',  glyph:'♄', color:0xb8ab7d, ring:9.15, size:.26, tier:2.35 },
  { key:'uranus',  name:'Uranus',  glyph:'♅', color:0xa8c4b0, ring:10.0, size:.24, tier:2.6 },
  { key:'neptune', name:'Neptune', glyph:'♆', color:0x8aa8b8, ring:10.85,size:.23, tier:2.85 },
  { key:'pluto',   name:'Pluto',   glyph:'♇', color:0xb59a8a, ring:11.7, size:.12, tier:3.1 },
];
const pickables = [];
BODIES.forEach(b=>{
  orrery.add(circleLine(b.ring, b.color, .13));           // floor ring
  const raised = circleLine(b.ring, b.color, .05); raised.position.z = b.tier;
  orrery.add(raised);                                     // ghost ring at tier
  const grp = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(b.size,24,18),
    new THREE.MeshBasicMaterial({color:b.color}));
  mesh.position.z = b.tier;
  grp.add(mesh);
  const pick = new THREE.Mesh(new THREE.SphereGeometry(Math.max(b.size*2.2,.55),8,6),
    new THREE.MeshBasicMaterial({visible:false}));
  pick.position.z = b.tier;
  pick.userData.body = b; pickables.push(pick);
  grp.add(pick);
  const gl = glowSprite(b.color, b.size*6.5, .9); gl.position.z = b.tier; grp.add(gl);
  // stem down to the floor ring, with a small foot
  const stem = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,b.tier-b.size*.9)]),
    new THREE.LineBasicMaterial({color:b.color, transparent:true, opacity:.5}));
  grp.add(stem);
  const foot = new THREE.Mesh(new THREE.CircleGeometry(.05,10),
    new THREE.MeshBasicMaterial({color:b.color, transparent:true, opacity:.7}));
  foot.position.z = .01; grp.add(foot);
  if(b.key==='saturn'){
    const ring = new THREE.Mesh(new THREE.RingGeometry(b.size*1.5,b.size*2.2,48),
      new THREE.MeshBasicMaterial({color:b.color,side:THREE.DoubleSide,transparent:true,opacity:.5}));
    ring.rotation.x = 1.1; ring.position.z = b.tier; grp.add(ring);
  }
  const lbl = textSprite(b.name, {px:40, color:'#c8b890', scale:.34});
  lbl.position.z = b.tier + b.size + .5; grp.add(lbl);
  const halo = circleLine(b.size*2.6, 0xe6c07a, 0); halo.position.z = b.tier; grp.add(halo);
  b.group = grp; b.halo = halo;
  orrery.add(grp);
});

/* ── The Rose of Venus ─────────────────────────────────────────── */
const ROSE_SCALE = 3.35, ROSE_SPAN = 8*365.25*86400000;
let roseLine = null, roseCenter = null;
function buildRose(centerMs){
  roseCenter = centerMs;
  const N = 1462, pts = new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const t = centerMs - ROSE_SPAN/2 + ROSE_SPAN*i/(N-1);
    const v = venusGeoXY(t);
    pts[i*3] = v.x*ROSE_SCALE; pts[i*3+1] = v.y*ROSE_SCALE; pts[i*3+2] = .04;
  }
  if(roseLine){ roseLine.geometry.dispose(); scene.remove(roseLine); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pts,3));
  roseLine = new THREE.Line(g, new THREE.LineBasicMaterial({
    color:0xb06a52, transparent:true, opacity:.5, blending:THREE.AdditiveBlending}));
  scene.add(roseLine);
  roseLine.visible = roseShown;
}
let roseShown = true;
const roseToggle = document.getElementById('rose-toggle');
roseToggle.addEventListener('click', ()=>{
  roseShown = !roseShown;
  roseToggle.classList.toggle('on', roseShown);
  roseToggle.textContent = roseShown ? 'Shown' : 'Hidden';
  if(roseLine) roseLine.visible = roseShown;
});

/* ── Zodiac: engraved floor ring + standing band ───────────────── */
{
  const S=2048, c=document.createElement('canvas'); c.width=c.height=S;
  const x=c.getContext('2d'), cx=S/2;
  const Rout=1010, Rin=896;
  x.translate(cx,cx);
  x.strokeStyle='rgba(201,164,92,.55)'; x.lineWidth=3;
  x.beginPath(); x.arc(0,0,Rout,0,Math.PI*2); x.stroke();
  x.beginPath(); x.arc(0,0,Rin,0,Math.PI*2); x.stroke();
  for(let dg=0; dg<360; dg+=5){
    const a=dg*D2R, maj=dg%30===0;
    x.strokeStyle = maj?'rgba(201,164,92,.85)':'rgba(201,164,92,.26)';
    x.lineWidth = maj?3:1.5;
    x.beginPath();
    x.moveTo(Math.cos(a)*Rin, -Math.sin(a)*Rin);
    x.lineTo(Math.cos(a)*(maj?Rout:Rin+26), -Math.sin(a)*(maj?Rout:Rin+26));
    x.stroke();
  }
  const tex=new THREE.CanvasTexture(c); tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const R = 13.2;
  const zr = new THREE.Mesh(new THREE.PlaneGeometry(R*2,R*2),
    new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
  zr.position.z = 0; scene.add(zr);
}
{ /* the standing band, an armillary hoop carrying the twelve signs */
  const W=4096, H=256, c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d');
  x.strokeStyle='rgba(201,164,92,.6)'; x.lineWidth=3;
  x.beginPath(); x.moveTo(0,4); x.lineTo(W,4); x.stroke();
  x.beginPath(); x.moveTo(0,H-4); x.lineTo(W,H-4); x.stroke();
  const lonToU = lon => rev(lon+90)/360;
  for(let dg=0; dg<360; dg+=30){
    const u = lonToU(dg)*W;
    x.strokeStyle='rgba(201,164,92,.5)'; x.lineWidth=2;
    x.beginPath(); x.moveTo(u,4); x.lineTo(u,H-4); x.stroke();
  }
  SIGNS.forEach((s,i)=>{
    const u = lonToU(i*30+15)*W;
    x.fillStyle='rgba(201,164,92,.95)'; x.textAlign='center'; x.textBaseline='middle';
    x.font="104px serif"; x.fillText(s[1]+VS, u, H/2-26);
    x.font="34px 'IM Fell English',serif"; x.fillStyle='rgba(233,223,200,.6)';
    x.fillText(s[0], u, H/2+62);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(13.2,13.2,1.7,128,1,true),
    new THREE.MeshBasicMaterial({map:tex, transparent:true, side:THREE.DoubleSide,
      depthWrite:false, opacity:.9}));
  band.rotation.x = Math.PI/2;
  band.position.z = 1.3;
  scene.add(band);
}

/* ── The syzygy thread ─────────────────────────────────────────────
   When Sol and Luna stand within a degree of conjunction or
   opposition, a golden thread is drawn through the Earth along
   their common line — new moon, full moon, and every eclipse
   (a true eclipse further requires the Moon near her node).      */
const syzygy = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(-12.9,0,0), new THREE.Vector3(12.9,0,0)]),
  new THREE.LineBasicMaterial({color:0xe6c07a, transparent:true, opacity:0,
    blending:THREE.AdditiveBlending}));
syzygy.position.z = .06;
scene.add(syzygy);

/* ── Time engine + throttle lever ──────────────────────────────── */
let simTime = Date.now(), speed = 1, live = true;
const lever = document.getElementById('lever');
const LOG_MAX = 7.5;                     // 10^7.5−1 ≈ one year per second
const X1_POS = Math.round(Math.log10(2)/LOG_MAX*1000);   // lever position of ×1
function leverToSpeed(v){
  const t = v/1000;
  if(Math.abs(t) < 0.018) return 0;
  return Math.sign(t)*(Math.pow(10, Math.abs(t)*LOG_MAX)-1);
}
function speedToLever(s){
  if(s===0) return 0;
  return Math.round(Math.sign(s)*Math.log10(Math.abs(s)+1)/LOG_MAX*1000);
}
function fmtRate(s){
  if(s===0) return '· held ·';
  if(live) return 'true time';
  const a = Math.abs(s), sg = s>0?'+':'−';
  if(Math.abs(a-1)<.02) return s>0?'true rate':'−1×  withershins';
  if(a<90) return `${sg}${a.toFixed(1)} s/s`;
  if(a<5400) return `${sg}${(a/60).toFixed(1)} min/s`;
  if(a<129600) return `${sg}${(a/3600).toFixed(1)} h/s`;
  if(a<47336400) return `${sg}${(a/86400).toFixed(1)} d/s`;
  return `${sg}${(a/31557600).toFixed(1)} y/s`;
}
lever.addEventListener('input', ()=>{
  let v = +lever.value;
  if(Math.abs(v - X1_POS) < 16){ v = X1_POS; lever.value = v; }        // detent at ×1
  if(Math.abs(v + X1_POS) < 16){ v = -X1_POS; lever.value = v; }       // detent at −1×
  if(Math.abs(v) < 18){ v = 0; lever.value = 0; }                      // detent at hold
  live = false;
  speed = v===X1_POS ? 1 : v===-X1_POS ? -1 : leverToSpeed(v);
});
document.getElementById('btn-x1').addEventListener('click', ()=>{
  speed = 1; live = false; lever.value = X1_POS;
});
document.getElementById('btn-now').addEventListener('click', ()=>{
  simTime = Date.now(); speed = 1; live = true; lever.value = X1_POS;
});
lever.value = X1_POS;
document.getElementById('jump').addEventListener('change', e=>{
  const t = new Date(e.target.value).getTime();
  if(!isNaN(t)){ simTime = t; speed = 0; live = false; lever.value = 0; }
});

/* ── Cabinet, veil ─────────────────────────────────────────────── */
const cabinet = document.getElementById('cabinet');
const crown = document.getElementById('crown');
crown.addEventListener('click', ()=>{
  const open = cabinet.classList.toggle('open');
  crown.classList.toggle('on', open);
  crown.setAttribute('aria-label', open?'Close the cabinet':'Open the cabinet');
});
const veil = document.getElementById('veil');
veil.addEventListener('click', ()=>{
  const v = document.body.classList.toggle('veiled');
  veil.textContent = v ? '○' : '◉';
  veil.style.opacity = 1; veil.style.pointerEvents = 'auto';
  if(v){ cabinet.classList.remove('open'); crown.classList.remove('on'); }
});
veil.classList.remove('hud');   // the veil itself never hides

/* ── Dossier ───────────────────────────────────────────────────── */
const dossier = document.getElementById('dossier');
let selected = null;
function select(b){
  selected = b;
  BODIES.forEach(o=>{ o.halo.material.opacity = 0; });
  if(!b){ dossier.classList.remove('open'); return; }
  document.getElementById('do-glyph').textContent = b.glyph+VS;
  document.getElementById('do-name').textContent = b.name;
  dossier.classList.add('open');
  const pinBtn = document.getElementById('do-pin');
  if(pinBtn){
    pinBtn.textContent = focusBody===b ? 'Withdraw' : 'Draw near';
  }
}
document.getElementById('do-close').addEventListener('click', ()=>select(null));
document.getElementById('do-pin').addEventListener('click', ()=>{
  if(focusBody && focusBody===selected){
    setFocus(null);
  } else if(selected){
    setFocus(selected);
  }
});
document.getElementById('earthview').addEventListener('click', ()=>{
  setFocus(null);
});

/* ── Input ─────────────────────────────────────────────────────── */
const ray = new THREE.Raycaster();
const ptrNDC = new THREE.Vector2();
const pointers = new Map();
let moved = 0, lastPinch = 0;
stage.addEventListener('pointerdown', e=>{
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(pointers.size===1) moved = 0;
  lastPinch = 0;
  stage.classList.add('dragging');
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', e=>{
  const p = pointers.get(e.pointerId);
  if(!p) return;
  const dx = e.clientX-p.x, dy = e.clientY-p.y;
  p.x = e.clientX; p.y = e.clientY;
  moved += Math.abs(dx)+Math.abs(dy);
  if(pointers.size===1){
    camThetaT -= dx*0.005;
    const phiFloor = focusBody ? -1.35 : 0.04;
    camPhiT = Math.min(1.52, Math.max(phiFloor, camPhiT + dy*0.005));
  } else if(pointers.size===2){
    const pts = [...pointers.values()];
    const dnow = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
    if(lastPinch) camDistT = clampDist(camDistT * lastPinch/dnow);
    lastPinch = dnow;
  }
});
function endPointer(e){
  const wasSingle = pointers.size===1;
  pointers.delete(e.pointerId);
  lastPinch = 0;
  if(pointers.size===0) stage.classList.remove('dragging');
  if(wasSingle && moved < 7){
    ptrNDC.x = (e.clientX/innerWidth)*2-1; ptrNDC.y = -(e.clientY/innerHeight)*2+1;
    ray.setFromCamera(ptrNDC, camera);
    const hit = ray.intersectObjects(pickables)[0];
    select(hit ? hit.object.userData.body : null);
  }
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('wheel', e=>{
  e.preventDefault();
  camDistT = clampDist(camDistT * (1 + Math.sign(e.deltaY)*0.1));
},{passive:false});

/* ── Schumann resonance ────────────────────────────────────────── */
const SCHUMANN = 7.83;
let audio = null, resOn = false;
const resToggle = document.getElementById('res-toggle');
const scope = document.getElementById('res-scope');
const scopeCtx = scope.getContext('2d');
function startResonance(){
  if(!audio){
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const carrier = ctx.createOscillator(); carrier.type='sine'; carrier.frequency.value = 65.41;
    const overtone = ctx.createOscillator(); overtone.type='sine'; overtone.frequency.value = 130.81;
    const ovGain = ctx.createGain(); ovGain.gain.value = .25;
    const am = ctx.createGain(); am.gain.value = .5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = SCHUMANN;
    const lfoDepth = ctx.createGain(); lfoDepth.gain.value = .5;
    lfo.connect(lfoDepth); lfoDepth.connect(am.gain);
    carrier.connect(am); overtone.connect(ovGain); ovGain.connect(am);
    am.connect(master);
    carrier.start(); overtone.start(); lfo.start();
    audio = {ctx, master};
  }
  audio.ctx.resume();
  audio.master.gain.cancelScheduledValues(audio.ctx.currentTime);
  audio.master.gain.linearRampToValueAtTime(.07, audio.ctx.currentTime+1.2);
}
function stopResonance(){
  if(!audio) return;
  audio.master.gain.cancelScheduledValues(audio.ctx.currentTime);
  audio.master.gain.linearRampToValueAtTime(0, audio.ctx.currentTime+.6);
}
resToggle.addEventListener('click', ()=>{
  resOn = !resOn;
  resToggle.classList.toggle('on', resOn);
  resToggle.textContent = resOn ? 'Still' : 'Sound';
  resOn ? startResonance() : stopResonance();
});
function drawScope(now){
  const W = scope.width, H = scope.height, mid = H/2;
  scopeCtx.clearRect(0,0,W,H);
  scopeCtx.strokeStyle = 'rgba(154,138,108,.35)';
  scopeCtx.lineWidth = 1;
  scopeCtx.beginPath(); scopeCtx.moveTo(0,mid); scopeCtx.lineTo(W,mid); scopeCtx.stroke();
  scopeCtx.strokeStyle = resOn ? 'rgba(127,174,148,.95)' : 'rgba(127,174,148,.3)';
  scopeCtx.lineWidth = 2;
  scopeCtx.beginPath();
  for(let px=0; px<=W; px+=3){
    const t = now/1000 - 0.5 + px/W*0.5;
    const env = resOn ? (0.5 + 0.5*Math.sin(2*Math.PI*SCHUMANN*t)) : 0.06;
    const y = mid - Math.sin(2*Math.PI*65.41*t) * env * (mid-5);
    px===0 ? scopeCtx.moveTo(px,y) : scopeCtx.lineTo(px,y);
  }
  scopeCtx.stroke();
}

/* ── Formatting ────────────────────────────────────────────────── */
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const p2 = n => String(n).padStart(2,'0');
function fmtDisplacement(ms){
  const s = Math.abs(ms)/1000, sign = ms>=0?'+':'−';
  const y = Math.floor(s/31557600), d = Math.floor(s%31557600/86400),
        h = Math.floor(s%86400/3600), m = Math.floor(s%3600/60);
  if(y) return `${sign}${y}y ${d}d`;
  if(d) return `${sign}${d}d ${h}h`;
  if(h) return `${sign}${h}h ${m}m`;
  return `${sign}${m}m ${Math.floor(s%60)}s`;
}
const $ = id => document.getElementById(id);

/* ── Main loop ─────────────────────────────────────────────────── */
buildRose(simTime);
let lastReal = performance.now(), uiTick = 0;
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.1,(now-lastReal)/1000); lastReal = now;
  if(live) simTime = Date.now(); else simTime += speed*1000*dt;
  simTime = Math.max(-8.64e15+1, Math.min(8.64e15-1, simTime));

  const ease = reduceMotion ? 1 : 1-Math.pow(0.001,dt);
  camTheta += (camThetaT-camTheta)*ease;
  camPhi   += (camPhiT-camPhi)*ease;
  camDist  += (camDistT-camDist)*ease;

  const dte = new Date(simTime);
  const hh = dte.getHours(), mm = dte.getMinutes(), ss = dte.getSeconds(), msf = dte.getMilliseconds()/1000;
  hourHand.rotation.z   = -((hh%12) + mm/60 + ss/3600) * 30 * D2R;
  minuteHand.rotation.z = -(mm + (ss+msf)/60) * 6 * D2R;
  secondHand.rotation.z = -(ss + msf) * 6 * D2R;
  if(!reduceMotion){
    hourHand.userData.bead.userData.tet.rotation.y += dt*.4;
    minuteHand.userData.bead.userData.tet.rotation.y += dt*.7;
    secondHand.userData.bead.userData.tet.rotation.y += dt*1.2;
  }

  earthGrid.rotation.z = gmst(simTime)*D2R;

  if(resOn && !reduceMotion)
    earthAura.material.opacity = 0.22 + 0.06*Math.sin(2*Math.PI*SCHUMANN*now/1000);
  else earthAura.material.opacity = 0.22;

  const eph = ephemeris(simTime);
  BODIES.forEach(b=>{
    const lon = eph[b.key].lon * D2R;
    b.group.position.set(b.ring*Math.cos(lon), b.ring*Math.sin(lon), 0);
    if(selected===b) b.halo.material.opacity = .5 + .4*Math.sin(now/320);
  });

  // syzygy: light the thread as Sol and Luna close on conjunction/opposition
  {
    const el = rev(eph.moon.lon - eph.sun.lon);
    const sep = Math.min(el, 360-el, Math.abs(el-180));   // deg from syzygy
    syzygy.material.opacity = sep < 1.2 ? .5*(1 - sep/1.2) : 0;
    if(sep < 1.2) syzygy.rotation.z = eph.sun.lon * D2R;
  }

  placeCamera(dt);

  if(roseShown && Math.abs(simTime - roseCenter) > ROSE_SPAN/4) buildRose(simTime);

  if(now - uiTick > 84){
    uiTick = now;
    if(cabinet.classList.contains('open')){
      drawScope(now);
      $('cab-date').textContent = `${DAYS[dte.getDay()]}, ${dte.getDate()} ${MONTHS[dte.getMonth()]} ${dte.getFullYear()}`;
      $('cab-time').textContent = `${p2(hh)}:${p2(mm)}:${p2(ss)}`;
      $('cab-jd').textContent = 'JD ' + (simTime/86400000 + 2440587.5).toFixed(4);
    }
    $('th-rate').textContent = fmtRate(speed);
    const disp = simTime - Date.now();
    $('th-disp').textContent = Math.abs(disp) > 2000 ? '◈ '+fmtDisplacement(disp) : '';

    if(selected){
      const e = eph[selected.key], sg = signOf(e.lon);
      $('do-sign').textContent = `${Math.floor(sg.deg)}° ${SIGNS[sg.i][0]} ${SIGNS[sg.i][1]}${VS}`;
      $('do-lon').textContent = fmtLon(e.lon);
      const e2 = ephemeris(simTime + 21600000);
      let dl = rev(e2[selected.key].lon - e.lon); if(dl>180) dl-=360;
      const motionEl = $('do-motion');
      motionEl.textContent = dl>=0 ? 'DIRECT →' : '← RETROGRADE';
      motionEl.classList.toggle('retro', dl<0);
      const xr = $('do-extra-row'), er = $('do-elong-row');
      if(selected.key==='moon'){
        const elong = rev(e.lon - eph.sun.lon);
        const illum = Math.round((1-cosd(elong))/2*100);
        const phase = elong<22.5?'New':elong<67.5?'Waxing Crescent':elong<112.5?'First Quarter'
          :elong<157.5?'Waxing Gibbous':elong<202.5?'Full':elong<247.5?'Waning Gibbous'
          :elong<292.5?'Last Quarter':elong<337.5?'Waning Crescent':'New';
        xr.style.display='flex'; $('do-extra-k').textContent='PHASE';
        $('do-extra-v').textContent = `${phase} · ${illum}%`;
        er.style.display='flex';
        const sep = Math.min(elong, 360-elong);
        const near = Math.min(sep, Math.abs(elong-180));
        $('do-elong-v').textContent = fmtLon(elong) + (near<1.2?'  ◈ SYZYGY':'');
      } else if(selected.key!=='sun'){
        er.style.display='none';
        xr.style.display='flex'; $('do-extra-k').textContent='DISTANCE';
        $('do-extra-v').textContent = e.dist.toFixed(3)+' AU';
      } else { xr.style.display='none'; er.style.display='none'; }
    }
  }
  renderer.render(scene, camera);
}
placeCamera();
requestAnimationFrame(frame);

addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
