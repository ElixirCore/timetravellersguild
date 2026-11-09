/* Jack / Field — Jack's card-stock body, the field, and the mind that runs him.
   Units ≈ mm. y up. Jack faces +z when heading = 0. */
(function () {
  const CFG = window.PUPPET_CONFIG || {};
  const CORE = window.JackCore, COL = CORE.COLORS;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const bump = k => Math.sin(Math.PI * Math.min(Math.max(k, 0), 1));
  const hold = (k, a = .25, b = .75) => k < a ? ease(k / a) : k > b ? ease((1 - k) / (1 - b)) : 1;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ================= scene ================= */
  const stage = $("stage"), ticket = $("ticket");
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.insertBefore(renderer.domElement, stage.firstChild);
  const scene = new THREE.Scene();
  const skyCanvas=document.createElement("canvas");skyCanvas.width=4;skyCanvas.height=256;
  const skyTexture=new THREE.CanvasTexture(skyCanvas);scene.background=skyTexture;
  scene.fog = new THREE.Fog(0x2a2b23, 1100, 3000);
  const camera = new THREE.PerspectiveCamera(38, 1, 5, 9000);
  camera.position.set(120, 330, 760);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 170, 0); controls.enableDamping = true; controls.dampingFactor = .08;
  controls.minDistance = 260; controls.maxDistance = 2200; controls.maxPolarAngle = Math.PI * .47;

  const hemi=new THREE.HemisphereLight(0xb9bca8, 0x1b2016, .62);scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xfff0d0, .95); moon.position.set(500, 900, 420); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -800, right: 800, top: 800, bottom: -800, near: 100, far: 2600 });
  moon.shadow.bias = -.0006; scene.add(moon);

  // ground: flat where Jack works, rolling beyond
  const groundGeo = new THREE.PlaneGeometry(6000, 6000, 120, 120); groundGeo.rotateX(-Math.PI / 2);
  { const p = groundGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); const t = Math.min(1, Math.max(0, (r - 1000) / 900)); p.setY(i, t * t * (Math.sin(x * .0021) * 90 + Math.cos(z * .0017) * 120 + 60)); } groundGeo.computeVertexNormals(); }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x2a331f, roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);

  // obstacles (circles on the ground) for walking around things
  const obstacles = [];

  /* Solar position derived from SunCalc 1.9.0, (c) 2011-2015 Vladimir Agafonkin, BSD-2-Clause.
     https://github.com/mourner/suncalc . Angles here are radians, azimuth south through west.
     Copyright and licence retained below. */
  function solarPosition(date, lat, lng) {
    const rad=Math.PI/180, d=date.valueOf()/86400000-.5+2440588-2451545;
    const M=rad*(357.5291+.98560028*d);
    const L=M+rad*(1.9148*Math.sin(M)+.02*Math.sin(2*M)+.0003*Math.sin(3*M))+rad*102.9372+Math.PI;
    const e=rad*23.4397, dec=Math.asin(Math.sin(L)*Math.sin(e));
    const ra=Math.atan2(Math.sin(L)*Math.cos(e),Math.cos(L));
    const H=rad*(280.16+360.9856235*d)+rad*lng-ra, phi=rad*lat;
    return {azimuth:Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi)),
      altitude:Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H))};
  }
  const solarButton=document.createElement("button"), skyStatus=document.createElement("div");
  solarButton.type="button";solarButton.textContent="Use my sun";
  solarButton.title="Use your device location for the sun. Coordinates stay on this page and are not sent to Jack or saved.";
  document.querySelector(".toggles").appendChild(solarButton);
  skyStatus.className="sky-status";skyStatus.textContent="Clock sky · location off";stage.appendChild(skyStatus);
  let solarFix=null, solarWatch=null;
  const sunDisc=new THREE.Mesh(new THREE.SphereGeometry(26,16,12),new THREE.MeshBasicMaterial({color:0xffd6a6,fog:false,depthWrite:false}));
  scene.add(sunDisc);
  /* Current exchange; the TimePod dials others. Sky tints blend into updateSolar. */
  const planet = { key: "earth", skyTint: null, rings: null, fire: null };
  function updateSolar() {
    const date=new Date(), fresh=solarFix && Date.now()-solarFix.time<15*60000;
    let alt,az;
    if(fresh){const p=solarPosition(date,solarFix.lat,solarFix.lng);alt=p.altitude;az=p.azimuth+Math.PI;}
    else {const hour=date.getHours()+date.getMinutes()/60;alt=Math.sin((hour-6)/24*Math.PI*2)*Math.PI/3;az=(hour-6)/12*Math.PI;}
    const deg=alt*180/Math.PI, day=Math.max(0,Math.min(1,(deg+6)/18)), dusk=Math.max(0,1-Math.abs(deg+1)/11);
    const top=new THREE.Color(0x090e20).lerp(new THREE.Color(0x5396c4),day);
    const horizon=new THREE.Color(0x151b32).lerp(new THREE.Color(0xb8d5dc),day).lerp(new THREE.Color(0xef8fb0),dusk*.86);
    const bottom=new THREE.Color(0x141a21).lerp(new THREE.Color(0xa9b5ab),day).lerp(new THREE.Color(0x9e627f),dusk*.5);
    if (planet.skyTint) { top.lerp(planet.skyTint.top, .72); horizon.lerp(planet.skyTint.horizon, .78); bottom.lerp(planet.skyTint.bottom, .78); }
    const g=skyCanvas.getContext("2d"),gradient=g.createLinearGradient(0,0,0,256);
    gradient.addColorStop(0,"#"+top.getHexString());gradient.addColorStop(.63,"#"+horizon.getHexString());gradient.addColorStop(1,"#"+bottom.getHexString());
    g.fillStyle=gradient;g.fillRect(0,0,4,256);skyTexture.needsUpdate=true;
    scene.fog.color.copy(horizon).lerp(bottom,.45);
    const dir=new THREE.Vector3(Math.sin(az)*Math.cos(alt),Math.sin(alt),-Math.cos(az)*Math.cos(alt));
    moon.position.copy(dir).multiplyScalar(1200);moon.intensity=Math.max(0,Math.sin(alt))*.95;
    moon.color.setHex(dusk>.25?0xffb5a3:0xfff1dc);
    hemi.intensity=.2+day*.6;hemi.color.copy(top).lerp(new THREE.Color(0xe7d8da),.35);
    sunDisc.position.copy(dir).multiplyScalar(1900);sunDisc.visible=deg>-.8;sunDisc.material.color.setHex(dusk>.25?0xffbaa5:0xfff1c6);
    const phase=deg<-12?"Night":deg<6?"Dawn / dusk":"Day";
    skyStatus.textContent=(fresh?"Local sun · ":"Clock sky · ")+phase+(fresh?" · N = field north":" · location off");
    if(solarFix&&!fresh)skyStatus.textContent="Location stale · clock sky";
  }
  solarButton.onclick=()=>{
    if(solarWatch!==null){navigator.geolocation.clearWatch(solarWatch);solarWatch=null;solarFix=null;solarButton.textContent="Use my sun";updateSolar();return;}
    if(!navigator.geolocation){skyStatus.textContent="Location unavailable · clock sky";return;}
    skyStatus.textContent="Location stays on this page · waiting for permission";
    solarWatch=navigator.geolocation.watchPosition(p=>{
      solarFix={lat:p.coords.latitude,lng:p.coords.longitude,time:p.timestamp};
      solarButton.textContent="Stop location";updateSolar();
    },()=>{if(solarWatch!==null)navigator.geolocation.clearWatch(solarWatch);solarWatch=null;solarFix=null;solarButton.textContent="Use my sun";updateSolar();skyStatus.textContent="Location not available · clock sky";},
    {enableHighAccuracy:false,maximumAge:60000,timeout:15000});
  };
  updateSolar();setInterval(updateSolar,30000);

  /* ================= textures ================= */
  function punchTex(w, h, seed, opts = {}) {
    const k = 3, c = document.createElement("canvas"); c.width = w * k; c.height = h * k; const g = c.getContext("2d");
    g.fillStyle = CORE.CSS.card; g.fillRect(0, 0, c.width, c.height);
    let s = seed; const R = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const cols = Math.max(4, Math.floor(w / 5)), rows = Math.max(3, Math.floor(h / 9));
    const cw = c.width / cols, rh = c.height / rows;
    g.fillStyle = "rgba(17,18,20,.16)"; g.font = Math.max(7, rh * .45) + "px Menlo,monospace"; g.textAlign = "center";
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) g.fillText(String(r % 10), (q + .5) * cw, (r + .7) * rh);
    g.fillStyle = CORE.CSS.ink;
    for (let q = 0; q < cols; q++) { const n = R() < .7 ? 1 : 2; for (let i = 0; i < n; i++) { const r = Math.floor(R() * rows); g.fillRect((q + .3) * cw, (r + .18) * rh, cw * .4, rh * .62); } }
    if (opts.clip) { g.fillStyle = opts.clipColor || "#111214"; g.beginPath(); g.moveTo(c.width - c.width * .12, 0); g.lineTo(c.width, 0); g.lineTo(c.width, c.width * .12); g.fill(); }
    if (opts.label) { g.fillStyle = "rgba(17,18,20,.55)"; g.font = "bold " + (rh * .55) + "px Menlo,monospace"; g.textAlign = "left"; g.fillText(opts.label, cw * .4, c.height - rh * .3); }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  const edgeM = new THREE.MeshStandardMaterial({ color: COL.cardEdge, roughness: .9 });
  const backM = new THREE.MeshStandardMaterial({ color: COL.cardBack, roughness: .9 });
  const cardM = new THREE.MeshStandardMaterial({ color: COL.card, roughness: .85 });
  const brassM = new THREE.MeshStandardMaterial({ color: COL.brass, metalness: .8, roughness: .35 });
  function slat(w, h, d, seed, opts) {
    const front = new THREE.MeshStandardMaterial({ map: punchTex(w, h, seed, opts), roughness: .85 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [edgeM, edgeM, edgeM, edgeM, front, backM]);
    m.castShadow = true; m.receiveShadow = true; return m;
  }
  function pin(x, y, z) { const p = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 3, 16), brassM); p.rotation.z = Math.PI / 2; p.position.set(x, y, z); p.castShadow = true; return p; }

  /* ================= Jack's body: a robot of punched card stock ================= */
  const J = { pos: V(0, 0, 60), heading: 0, phase: 0, walk: 0, speed: 0 };
  J.root = new THREE.Group(); J.root.scale.set(1.18, .86, 1.05); scene.add(J.root);
  J.hips = new THREE.Group(); J.hips.position.y = 150; J.root.add(J.hips);
  { const pelvis = slat(72, 22, 42, 7); J.hips.add(pelvis); }
  J.torso = new THREE.Group(); J.torso.position.y = 8; J.hips.add(J.torso);
  { const t = slat(88, 112, 50, 11, { clip: true, label: "D.X.T." }); /* One side only: the supplied metal/sigil photograph on the torso back. */
    const sigil = new THREE.TextureLoader().load("/coin/assets/jack-sigil.jpg"); sigil.encoding = THREE.sRGBEncoding;
    t.material[5] = new THREE.MeshStandardMaterial({map:sigil,roughness:.85});
    t.material[0] = t.material[1] = new THREE.MeshStandardMaterial({color:0x315f8f,roughness:.7});
    t.position.y = 58; t.rotation.z = .025; J.torso.add(t); // slightly broken geometry
    const neck = new THREE.Mesh(new THREE.BoxGeometry(18, 14, 18), cardM); neck.position.y = 120; neck.castShadow = true; J.torso.add(neck); }
  J.head = new THREE.Group(); J.head.position.y = 126; J.torso.add(J.head);
  // the head box's front is ink, so the face card's punched holes read dark
  { const inkM = new THREE.MeshStandardMaterial({ color: COL.ink, roughness: .95 });
    const hb = new THREE.Mesh(new THREE.BoxGeometry(80, 80, 32), [edgeM, edgeM, edgeM, edgeM, inkM, backM]); hb.position.set(0, 44, -19); hb.rotation.z = -.02; hb.castShadow = true; J.head.add(hb); }
  J.face = CORE.buildFace(); J.head.add(J.face.root);
  J.speaker = CORE.makeSpeaker(J.face, ticket);
  if (window.JackDeepgram) window.JackDeepgram.onLevel = v => J.face.mouth(v);
  function arm(side) {
    const s = side === "L" ? -1 : 1;
    const sh = new THREE.Group(); sh.position.set(s * 60, 100, 0); J.torso.add(sh);
    const up = slat(22, 64, 13, side === "L" ? 21 : 23); up.material[4].color.setHex(COL.red); up.position.y = -32; if (side === "L") up.rotation.y = .07; sh.add(up);
    sh.add(pin(s * 10, 0, 0));
    const el = new THREE.Group(); el.position.y = -64; sh.add(el);
    el.add(pin(s * 9, 0, 0));
    const lo = slat(20, 58, 12, side === "L" ? 31 : 33); lo.material[4].color.setHex(0x487dad); lo.position.y = -29; el.add(lo);
    const hand = new THREE.Group(); hand.position.y = -58; el.add(hand);
    const hm = new THREE.Mesh(new THREE.BoxGeometry(22, 20, 16), [edgeM, edgeM, edgeM, edgeM, cardM, backM]); hm.position.y = -10; hm.castShadow = true; hand.add(hm);
    const grip = new THREE.Object3D(); grip.position.set(0, -22, 6); hand.add(grip);
    return { sh, el, hand, grip };
  }
  function leg(side) {
    const s = side === "L" ? -1 : 1;
    const hp = new THREE.Group(); hp.position.set(s * 21, -6, 0); J.hips.add(hp);
    hp.add(pin(s * 13, 0, 0));
    const th = slat(22, 70, 14, side === "L" ? 41 : 43); th.position.y = -35; hp.add(th);
    const kn = new THREE.Group(); kn.position.y = -70; hp.add(kn);
    kn.add(pin(s * 12, 0, 0));
    const sn = slat(20, 64, 13, side === "L" ? 51 : 53); sn.position.y = -32; kn.add(sn);
    const an = new THREE.Group(); an.position.y = -64; kn.add(an);
    const ft = new THREE.Mesh(new THREE.BoxGeometry(26, 8, 44), [edgeM, edgeM, cardM, edgeM, edgeM, edgeM]); ft.position.set(0, -6, 9); ft.castShadow = true; an.add(ft);
    return { hp, kn, an };
  }
  J.L = arm("L"); J.R = arm("R"); J.LL = leg("L"); J.LR = leg("R");
  J.root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });

  /* ================= the field's furniture ================= */
  function faceOrigin(g, x, z) { g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); }
  const fwd = g => V(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));

  // money box — the Coindrop box, with Jack's face printed on
  const box = new THREE.Group(); faceOrigin(box, -330, -40); scene.add(box);
  const boxFaceTex = (() => {
    const k = 3, c = document.createElement("canvas"); c.width = 200 * k; c.height = 260 * k; const g = c.getContext("2d");
    g.fillStyle = "#3d4a36"; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#000"; g.fillRect(98 * k, 29 * k, 4 * k, 30 * k); g.strokeStyle = "#d9a441"; g.lineWidth = 3; g.strokeRect(98 * k, 29 * k, 4 * k, 30 * k);
    g.fillStyle = "rgba(217,203,158,.6)"; g.font = (5 * k) + "px Georgia,serif"; g.textAlign = "center"; g.fillText("TIME TRAVELLERS GUILD", 100 * k, 16 * k);
    const cell = 100 / 9;
    CORE.MAP.forEach((row, r) => row.split("").forEach((ch, q) => { if (ch === ".") return; g.fillStyle = ch === "c" ? CORE.CSS.card : ch === "k" ? CORE.CSS.ink : CORE.CSS.red; g.fillRect((50 + q * cell) * k, (78 + r * cell) * k, Math.ceil(cell * k) + 1, Math.ceil(cell * k) + 1); }));
    g.fillStyle = "rgba(217,203,158,.7)"; g.font = (6 * k) + "px Menlo,monospace"; g.fillText("COINDROP · £1", 100 * k, 200 * k);
    return new THREE.CanvasTexture(c);
  })();
  const plyM = new THREE.MeshStandardMaterial({ color: 0x34402f, roughness: .9 });
  const boxFaceM = new THREE.MeshStandardMaterial({ map: boxFaceTex, roughness: .85, emissive: 0x000000 });
  { const m = new THREE.Mesh(new THREE.BoxGeometry(200, 260, 140), [plyM, plyM, plyM, plyM, boxFaceM, plyM]); m.position.y = 130; m.castShadow = true; m.receiveShadow = true; box.add(m); }
  const boxSlot = new THREE.Object3D(); boxSlot.position.set(0, 216, 72); box.add(boxSlot);
  obstacles.push({ c: box.position, r: 150, g: box });

  // TimePod — a red booth on the Guild's network
  const pod = new THREE.Group(); faceOrigin(pod, 380, -300); scene.add(pod);
  const podRed = new THREE.MeshStandardMaterial({ color: COL.red, roughness: .55 });
  const podGlass = (() => {
    const c = document.createElement("canvas"); c.width = 192; c.height = 320; const g = c.getContext("2d");
    g.fillStyle = "#c8203c"; g.fillRect(0, 0, 192, 320);
    for (let r = 0; r < 7; r++) for (let q = 0; q < 3; q++) { const x = 18 + q * 54, y = 16 + r * 42; g.fillStyle = "#1c2226"; g.fillRect(x, y, 48, 36); g.fillStyle = "rgba(217,203,158,.12)"; g.fillRect(x + 4, y + 4, 12, 28); }
    return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: .4, emissive: 0x000000 });
  })();
  const signM = (() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 48; const g = c.getContext("2d");
    g.fillStyle = "#111214"; g.fillRect(0, 0, 256, 48); g.fillStyle = CORE.CSS.card; g.font = "bold 28px Menlo,monospace"; g.textAlign = "center"; g.fillText("TIMEPOD", 128, 34);
    return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), emissive: 0x2a2618, emissiveMap: null, roughness: .6 });
  })();
  { const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; pod.add(m); return m; };
    add(new THREE.BoxGeometry(190, 14, 190), podRed, 0, 7, 0);
    [[-82, -82], [82, -82], [-82, 82], [82, 82]].forEach(([x, z]) => add(new THREE.BoxGeometry(18, 400, 18), podRed, x, 214, z));
    [[0, -84, 0], [-84, 0, Math.PI / 2], [84, 0, -Math.PI / 2]].forEach(([x, z, ry]) => add(new THREE.BoxGeometry(150, 320, 4), [podRed, podRed, podRed, podRed, podGlass, podGlass], x, 190, z, ry));
    [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(ry => { const s = add(new THREE.BoxGeometry(150, 30, 6), [podRed, podRed, podRed, podRed, signM, podRed], Math.sin(ry) * 92, 380, Math.cos(ry) * 92, ry); });
    add(new THREE.BoxGeometry(200, 14, 200), podRed, 0, 420, 0); add(new THREE.BoxGeometry(170, 16, 170), podRed, 0, 434, 0);
  }
  const podLamp = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 16, 16), new THREE.MeshStandardMaterial({ color: 0xf2e6c4, emissive: 0x332a18 })); podLamp.position.y = 450; pod.add(podLamp);
  const door = new THREE.Group(); door.position.set(-75, 0, 86); pod.add(door);
  { const d = new THREE.Mesh(new THREE.BoxGeometry(150, 320, 4), [podRed, podRed, podRed, podRed, podGlass, podGlass]); d.position.set(75, 190, 0); d.castShadow = true; door.add(d);
    const h = new THREE.Mesh(new THREE.BoxGeometry(6, 26, 8), brassM); h.position.set(138, 180, 5); door.add(h); }
  const podLight = new THREE.PointLight(0xffe2b0, 0, 700, 2); podLight.position.set(0, 300, 0); pod.add(podLight);
  obstacles.push({ c: pod.position, r: 150, g: pod });

  // desk + hopper — where loose cards get filed
  const desk = new THREE.Group(); faceOrigin(desk, 60, -430); scene.add(desk);
  const woodM = new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: .8 });
  { const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; desk.add(m); return m; };
    add(new THREE.BoxGeometry(190, 10, 90), woodM, 0, 150, 0);
    [[-85, -38], [85, -38], [-85, 38], [85, 38]].forEach(([x, z]) => add(new THREE.BoxGeometry(8, 145, 8), woodM, x, 72, z));
    const hop = new THREE.Mesh(new THREE.CylinderGeometry(42, 16, 60, 4, 1, true), new THREE.MeshStandardMaterial({ color: 0x6b6f66, metalness: .5, roughness: .5, side: THREE.DoubleSide })); hop.rotation.y = Math.PI / 4; hop.position.set(-45, 190, 0); hop.castShadow = true; desk.add(hop);
    add(new THREE.BoxGeometry(70, 6, 50), woodM, 45, 158, 0);
  }
  const hopperMouth = new THREE.Object3D(); hopperMouth.position.set(-45, 222, 0); desk.add(hopperMouth);
  const tray = new THREE.Group(); tray.position.set(45, 161, 0); desk.add(tray);
  obstacles.push({ c: desk.position, r: 140, g: desk });

  // grass: card-thin blades that sway
  const grassU = { uTime: { value: 0 } };
  const grassMesh = (function grass() {
    const N = 7000, geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-2.2, 0, 0, 2.2, 0, 0, 0, 26, 0], 3)); geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = grassU.uTime;
      sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\nfloat hh = position.y / 26.0;\nvec4 ip = instanceMatrix * vec4(0.,0.,0.,1.);\ntransformed.x += sin(uTime*1.7 + ip.x*.013 + ip.z*.009) * hh*hh*5.0;\ntransformed.z += cos(uTime*1.3 + ip.z*.011) * hh*hh*3.0;");
    };
    const im = new THREE.InstancedMesh(geo, mat, N), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    let n = 0;
    while (n < N) {
      const r = Math.sqrt(Math.random()) * 1050, a = Math.random() * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (obstacles.some(o => Math.hypot(x - o.c.x, z - o.c.z) < o.r - 30)) continue;
      q.setFromAxisAngle(V(0, 1, 0), Math.random() * Math.PI); const sc = rnd(.6, 1.6); s.set(sc, sc * rnd(.7, 1.4), sc); p.set(x, 0, z);
      m.compose(p, q, s); im.setMatrixAt(n, m); col.setHSL(rnd(.2, .27), rnd(.25, .4), rnd(.22, .36)); im.setColorAt(n, col); n++;
    }
    im.instanceMatrix.needsUpdate = true; scene.add(im); return im;
  })();
  // stars
  { const pts = []; for (let i = 0; i < 500; i++) { const a = Math.random() * Math.PI * 2, e = rnd(.12, 1.4), r = 4200; pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: COL.card, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: .7 }))); }

  /* ================= exchanges: the TimePod dials other worlds (CHRONOS /box) ================= */
  const PLANETS = Array.isArray(CFG.planets) && CFG.planets.length ? CFG.planets : [{ key: "earth", name: "Earth", era: "Geocentric Present", ground: { color: 0x2a331f, grass: true } }];
  function groundTexture(g) {
    const S = 256, c = document.createElement("canvas"); c.width = c.height = S;
    const x = c.getContext("2d");
    const hex = n => "#" + n.toString(16).padStart(6, "0");
    x.fillStyle = hex(g.color); x.fillRect(0, 0, S, S);
    const acc = hex(g.accent ?? 0x000000);
    let s = 1234 + S; const R = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    if (g.tex === "regolith") {
      for (let i = 0; i < 900; i++) { x.fillStyle = R() < .5 ? acc : hex(g.color); x.globalAlpha = .12 + R() * .25; const r = 1 + R() * 4; x.fillRect(R() * S, R() * S, r, r); }
      x.globalAlpha = .35;
      for (let i = 0; i < 7; i++) { const cx = R() * S, cy = R() * S, r = 6 + R() * 20; x.strokeStyle = acc; x.lineWidth = 1.5 + R() * 2; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); }
      x.globalAlpha = 1;
    } else if (g.tex === "sand") {
      for (let i = 0; i < 26; i++) { x.strokeStyle = acc; x.globalAlpha = .1 + R() * .22; x.lineWidth = 2 + R() * 6; x.beginPath(); const y = R() * S; x.moveTo(0, y); for (let px = 0; px <= S; px += 32) x.lineTo(px, y + Math.sin(px * .05 + i) * 8); x.stroke(); }
      x.globalAlpha = 1;
      for (let i = 0; i < 500; i++) { x.fillStyle = acc; x.globalAlpha = .06 + R() * .18; x.fillRect(R() * S, R() * S, 1.5 + R() * 2.5, 1.5 + R() * 2.5); }
      x.globalAlpha = 1;
    } else if (g.tex === "fire") {
      for (let i = 0; i < 40; i++) { x.strokeStyle = R() < .6 ? "#ff8c1a" : "#ffd23f"; x.globalAlpha = .35 + R() * .5; x.lineWidth = .8 + R() * 2.4; x.beginPath(); let px = R() * S, py = R() * S; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (R() - .5) * 46; py += (R() - .5) * 46; x.lineTo(px, py); } x.stroke(); }
      x.globalAlpha = 1;
    } else if (g.tex === "bands") {
      for (let y = 0; y < S; y += 8) { const h = 5 + R() * 10; x.fillStyle = R() < .5 ? acc : hex(g.color); x.globalAlpha = .25 + R() * .45; x.fillRect(0, y + (R() - .5) * 6, S, h); }
      x.globalAlpha = 1;
    } else if (g.tex === "ice") {
      for (let i = 0; i < 30; i++) { x.strokeStyle = acc; x.globalAlpha = .15 + R() * .3; x.lineWidth = .7 + R() * 1.4; x.beginPath(); let px = R() * S, py = R() * S; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (R() - .5) * 60; py += (R() - .5) * 60; x.lineTo(px, py); } x.stroke(); }
      x.globalAlpha = 1;
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(28, 28); t.anisotropy = 4; return t;
  }
  function ringTexture(hexColor) {
    const S = 512, c = document.createElement("canvas"); c.width = c.height = S;
    const x = c.getContext("2d"), col = "#" + hexColor.toString(16).padStart(6, "0");
    let s = 77; const R = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let r = 118; r < 250; r += 2 + R() * 6) {
      const dark = R() < .22;
      x.strokeStyle = dark ? "#10100e" : col;
      x.globalAlpha = dark ? .25 + R() * .4 : .3 + R() * .6;
      x.lineWidth = 1 + R() * (dark ? 8 : 5);
      x.beginPath(); x.arc(S / 2, S / 2, r, 0, Math.PI * 2); x.stroke();
    }
    x.globalAlpha = .85; x.strokeStyle = "#0c0c0a"; x.lineWidth = 7;
    x.beginPath(); x.arc(S / 2, S / 2, 152, 0, Math.PI * 2); x.stroke();
    return new THREE.CanvasTexture(c);
  }
  function makeRings(spec) {
    const geo = new THREE.RingGeometry(spec.inner ?? 2400, spec.outer ?? 5000, 180, 1);
    const mat = new THREE.MeshBasicMaterial({ map: ringTexture(spec.color ?? 0xe8d9ac), transparent: true, opacity: spec.opacity ?? .5, side: THREE.DoubleSide, fog: false, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2 + (spec.tilt ?? 0.12); m.position.y = spec.y ?? 200; m.renderOrder = 2;
    return m;
  }
  function applyPlanet(key) {
    const spec = PLANETS.find(p => p.key === key); if (!spec) return;
    const g = spec.ground || {};
    planet.key = spec.key; planet.fire = null;
    ground.material.color.setHex(g.color ?? 0x2a331f);
    if (ground.material.map) { ground.material.map.dispose(); ground.material.map = null; }
    if (ground.material.emissiveMap) { ground.material.emissiveMap.dispose(); ground.material.emissiveMap = null; }
    ground.material.emissive.setHex(0x000000); ground.material.emissiveIntensity = 1;
    if (g.tex) { const t = groundTexture(g); ground.material.map = t; if (g.tex === "fire") { ground.material.emissive.setHex(g.emissive ?? 0xff5a1f); ground.material.emissiveMap = t; planet.fire = true; } }
    ground.material.needsUpdate = true;
    grassMesh.visible = !!g.grass;
    planet.skyTint = spec.sky ? { top: new THREE.Color(spec.sky[0]), horizon: new THREE.Color(spec.sky[1]), bottom: new THREE.Color(spec.sky[2]) } : null;
    updateSolar();
    if (planet.rings) { scene.remove(planet.rings); planet.rings.geometry.dispose(); if (planet.rings.material.map) planet.rings.material.map.dispose(); planet.rings.material.dispose(); planet.rings = null; }
    if (spec.rings) { planet.rings = makeRings(spec.rings); scene.add(planet.rings); }
    const dialBtn = $("dialBtn"), locLine = $("locLine");
    if (dialBtn) dialBtn.textContent = "Dial · " + spec.name;
    if (locLine) locLine.textContent = (spec.name + " · " + spec.era).toUpperCase();
  }
  function tickPlanet(now) {
    if (planet.rings) planet.rings.rotation.z = now * .00002;
    if (planet.fire) ground.material.emissiveIntensity = .85 + .3 * Math.sin(now / 340) + .12 * Math.sin(now / 87);
  }
  async function travelTo(key, t) {
    const spec = PLANETS.find(p => p.key === key); if (!spec || planet.key === key) return;
    setGoal("Dialling " + spec.name, "Walking to the pod"); think("Dialling " + spec.name + ".");
    await walkTo(frontOf(pod, 175), 10); guard(t); await face(pod.position);
    mind.locked = true;
    try {
      setStep("Stepping in");
      await tween(600, k => { door.rotation.y = -1.35 * ease(k); });
      await walkTo(V(pod.position.x, 0, pod.position.z), 12, obstacles.find(o => o.g === pod));
      await tween(250, k => { door.rotation.y = -1.35 * (1 - ease(k)); });
      J.root.visible = false; setStep("On the network");
      let swapped = false;
      await tween(2000, k => { const f = Math.sin(k * Math.PI * 9) * .5 + .5; podLight.intensity = 2.4 * f * bump(k); podLamp.material.emissive.setRGB(.9 * f, .75 * f, .5 * f); podGlass.emissive.setRGB(.5 * f * bump(k), .4 * f * bump(k), .25 * f * bump(k)); if (!swapped && k > .45) { swapped = true; applyPlanet(key); } });
      if (!swapped) applyPlanet(key);
      J.heading += Math.PI; J.root.visible = true;
      await tween(500, k => { door.rotation.y = -1.35 * ease(k); });
      await walkTo(frontOf(pod, 175), 10, obstacles.find(o => o.g === pod));
      await tween(500, k => { door.rotation.y = -1.35 * (1 - ease(k)); });
      mind.curious = 8;
      setGoal("Standing by", "");
      logLine("Arrived: " + spec.name + " · " + spec.era + ".");
      if (spec.line) await say(spec.line);
    } finally {
      podLight.intensity = 0; podLamp.material.emissive.setHex(0x332a18); podGlass.emissive.setHex(0);
      J.root.visible = true; mind.locked = false;
    }
  }
  function dialNext() {
    if (mind.locked) return;
    const i = Math.max(0, PLANETS.findIndex(p => p.key === planet.key));
    const next = PLANETS[(i + 1) % PLANETS.length];
    interrupt("Dialling the TimePod.");
    inbox.unshift({ type: "cmd", cmd: { travel: next.key } });
  }


  /* ================= things in the world ================= */
  const world = { coins: [], cards: [], filedCoins: 0, filedCards: 0, wind: V(1, 0, .3).normalize(), windAngle: .3 };
  const coinGeoO = new THREE.CylinderGeometry(11.7, 11.7, 2.8, 12), coinGeoI = new THREE.CylinderGeometry(7.5, 7.5, 2.9, 24);
  const goldM = new THREE.MeshStandardMaterial({ color: 0xc9a64a, metalness: .85, roughness: .3, emissive: 0x2a1f05 }), silverM = new THREE.MeshStandardMaterial({ color: 0xc4c8c4, metalness: .85, roughness: .3 });
  function dropCoin(x, z) {
    const g = new THREE.Group(); g.add(new THREE.Mesh(coinGeoO, goldM), new THREE.Mesh(coinGeoI, silverM)); g.traverse(o => o.castShadow = true);
    g.position.set(x, 520, z); scene.add(g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(20, 24, 32), new THREE.MeshBasicMaterial({ color: 0xd9a441, transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 1.5, z); scene.add(ring);
    const coin = { obj: g, ring, x, z, vy: 0, landed: false, claimed: false, gone: false, spin: rnd(6, 10) };
    world.coins.push(coin); log("A pound dropped in the field.");
    return coin;
  }
  const cardGeo = new THREE.BoxGeometry(62, .8, 28);
  function spawnCard() {
    const a = Math.atan2(world.wind.z, world.wind.x) + Math.PI + rnd(-.6, .6), r = rnd(700, 900);
    const m = new THREE.Mesh(cardGeo, [edgeM, edgeM, new THREE.MeshStandardMaterial({ map: punchTex(62, 28, Math.floor(rnd(1, 999)), { clip: true }), roughness: .85 }), backM, edgeM, edgeM]);
    m.castShadow = true; m.position.set(Math.cos(a) * r, rnd(260, 420), Math.sin(a) * r); scene.add(m);
    const c = { obj: m, landed: false, claimed: false, gone: false, t: rnd(0, 10), life: 0 }; world.cards.push(c); return c;
  }
  function updateWorld(dt, now) {
    world.windAngle += dt * .02; world.wind.set(Math.cos(world.windAngle), 0, Math.sin(world.windAngle));
    world.coins.forEach(c => {
      if (c.gone) return;
      if (!c.landed) { c.vy -= 900 * dt; c.obj.position.y += c.vy * dt; c.obj.rotation.x += c.spin * dt; c.obj.rotation.z += c.spin * .7 * dt;
        if (c.obj.position.y <= 1.4) { if (c.vy < -260) { c.vy = -c.vy * .28; c.obj.position.y = 1.4; } else { c.landed = true; c.obj.position.y = 1.4; c.obj.rotation.set(0, Math.random() * 3, 0); onCoinLanded(c); } } }
      if (c.landed && !c.claimed) c.ring.material.opacity = .35 + .3 * Math.sin(now / 300); else if (c.ring) c.ring.material.opacity = 0;
    });
    world.cards.forEach(c => {
      if (c.gone || c.claimed || c.landed) return;
      c.t += dt; const o = c.obj;
      o.position.addScaledVector(world.wind, 55 * dt); o.position.x += Math.sin(c.t * 2.1) * 20 * dt; o.position.z += Math.cos(c.t * 1.7) * 20 * dt;
      o.position.y -= 38 * dt; o.rotation.x = Math.sin(c.t * 3.1) * .9; o.rotation.z = Math.cos(c.t * 2.3) * .7; o.rotation.y += dt * .8;
      const r = Math.hypot(o.position.x, o.position.z);
      if (r > 980) { o.position.x *= 980 / r; o.position.z *= 980 / r; }
      for (const ob of obstacles) { const d = Math.hypot(o.position.x - ob.c.x, o.position.z - ob.c.z); if (d < ob.r - 20) { const k = (ob.r - 20) / d; o.position.x = ob.c.x + (o.position.x - ob.c.x) * k; o.position.z = ob.c.z + (o.position.z - ob.c.z) * k; } }
      if (o.position.y <= 1) { o.position.y = 1; o.rotation.set(0, Math.random() * 3, 0); c.landed = true; log("A loose card settled in the grass."); }
    });
    world.coins = world.coins.filter(c => !c.gone || c.obj.parent);
    world.cards = world.cards.filter(c => !c.gone || c.obj.parent);
  }

  /* ================= movement ================= */
  let moveReq = null;   // { target, stop, ignore, res }
  let faceReq = null;   // { angle, res }
  function updateMovement(dt) {
    let moving = false;
    if (moveReq) {
      const dx = moveReq.target.x - J.pos.x, dz = moveReq.target.z - J.pos.z, dist = Math.hypot(dx, dz);
      if (dist <= moveReq.stop) { const r = moveReq.res; moveReq = null; r(); }
      else {
        let vx = dx / dist, vz = dz / dist;
        for (const ob of obstacles) {
          if (ob === moveReq.ignore) continue;
          const ox = J.pos.x - ob.c.x, oz = J.pos.z - ob.c.z, od = Math.hypot(ox, oz), reach = ob.r + 70;
          if (od < reach) { const w = (reach - od) / 70; vx += ox / od * w * 1.4; vz += oz / od * w * 1.4; vx += -oz / od * w * .6 * Math.sign(vx * -oz + vz * ox || 1); vz += ox / od * w * .6 * Math.sign(vx * -oz + vz * ox || 1); }
        }
        const want = Math.atan2(vx, vz), d = angDiff(J.heading, want);
        J.heading += Math.max(-3.2 * dt, Math.min(3.2 * dt, d));
        J.speed = 78 * Math.max(.15, Math.cos(d)) * Math.min(1, dist / 40 + .35);
        J.pos.x += Math.sin(J.heading) * J.speed * dt; J.pos.z += Math.cos(J.heading) * J.speed * dt;
        J.phase += J.speed * dt / 70 * Math.PI; moving = true;
      }
    } else if (faceReq) {
      const d = angDiff(J.heading, faceReq.angle);
      if (Math.abs(d) < .06) { J.heading = faceReq.angle; const r = faceReq.res; faceReq = null; r(); }
      else { J.heading += Math.max(-2.8 * dt, Math.min(2.8 * dt, d)); J.phase += dt * 4; moving = true; }
    }
    J.walk += ((moving ? 1 : 0) - J.walk) * Math.min(1, dt * 6);
    const r = Math.hypot(J.pos.x, J.pos.z); if (r > 1000) { J.pos.x *= 1000 / r; J.pos.z *= 1000 / r; }
  }

  /* ================= poses ================= */
  let action = null;    // body action { name, s, d, res, mid, midDone }
  let gest = null;      // overlay gesture { name, s, d }
  let lookAt = null;    // Vector3 the head tracks
  let faceState = "idle";
  const ACT = {
    pickup: (k, P) => { const c = hold(k, .35, .7); P.crouch = c; P.tx += .55 * c; P.shRx -= .55 * c; P.elR -= .25 * c; P.hx += .35 * c; },
    deposit: (k, P) => { const c = hold(k, .3, .75); P.shRx -= 1.45 * c; P.elR -= .2 * c; P.tx += .06 * c; P.hx -= .1 * c; },
    file: (k, P) => { const c = hold(k, .3, .75); P.shRx -= 1.15 * c; P.elR -= .55 * c; P.tx += .18 * c; P.hx += .15 * c; },
    look: (k, P) => { P.hy += Math.sin(k * Math.PI * 2) * .75 * bump(k); P.hx -= .1 * bump(k); },
    sky: (k, P) => { const c = hold(k, .2, .8); P.hx -= .55 * c; P.tx -= .08 * c; },
    rest: (k, P) => { P.tx += .03 * Math.sin(k * Math.PI * 3); P.shLz -= .05; P.shRz += .05; }
  };
  const GEST = {
    wave: { d: 1700, f: (k, P) => { const c = hold(k, .2, .8); P.shRz += 2.5 * c; P.elRz = Math.sin(k * Math.PI * 7) * .55 * c; P.hz -= .08 * c; } },
    nod: { d: 800, f: (k, P) => { P.hx += .3 * Math.sin(k * Math.PI * 2) * bump(k); } },
    bow: { d: 1400, f: (k, P) => { const c = hold(k, .3, .65); P.tx += .45 * c; P.hx += .25 * c; } },
    unsure: { d: 1600, f: (k, P) => { const c = hold(k, .2, .8); P.hz += .22 * c; P.hy -= .15 * c; P.eyes = "squint"; P.shLz -= .35 * c; P.shRz += .35 * c; } },
    hop: { d: 620, f: (k, P) => { if (k < .2) P.crouch = .25 * bump(k / .2); else P.lift = 30 * bump((k - .2) / .8); } },
    shake: { d: 900, f: (k, P) => { P.hy += .4 * Math.sin(k * Math.PI * 4) * bump(k); } }
  };
  function gesture(name) { if (GEST[name]) gest = { name, s: performance.now(), d: GEST[name].d }; }
  const tmpV = new THREE.Vector3();
  function applyPose(now) {
    const P = { hipL: 0, hipR: 0, knL: 0, knR: 0, shLx: 0, shRx: 0, shLz: -.07, shRz: .07, elL: -.18, elR: -.18, elRz: 0, tx: 0, tz: 0, hx: 0, hy: 0, hz: 0, crouch: 0, lift: 0, bob: 0, eyes: null };
    const w = J.walk, f = J.phase;
    if (!reduce) { P.tx += Math.sin(now / 1100) * .015; P.shLz -= Math.sin(now / 1100) * .02; P.shRz += Math.sin(now / 1100) * .02; }
    P.hipL = -Math.sin(f) * .42 * w; P.hipR = Math.sin(f) * .42 * w;
    P.knL = Math.max(0, Math.cos(f)) * .8 * w; P.knR = Math.max(0, -Math.cos(f)) * .8 * w;
    P.shLx = Math.sin(f) * .38 * w; P.shRx = -Math.sin(f) * .38 * w; P.elL -= .15 * w; P.elR -= .15 * w;
    P.bob = -Math.abs(Math.cos(f)) * 4 * w; P.tz += Math.sin(f) * .035 * w; P.tx += .05 * w;
    if (action && ACT[action.name]) ACT[action.name](Math.min(1, (now - action.s) / action.d), P);
    if (gest) { const k = (now - gest.s) / gest.d; if (k >= 1) gest = null; else GEST[gest.name].f(k, P); }
    if (faceState === "thinking") { P.hz += .07; P.hx -= .08; }
    if (lookAt && !action) {
      J.root.updateMatrixWorld(true); tmpV.copy(lookAt); J.root.worldToLocal(tmpV);
      const yaw = Math.atan2(tmpV.x, tmpV.z), pitch = -Math.atan2(tmpV.y - 320, Math.hypot(tmpV.x, tmpV.z));
      P.hy += Math.max(-.9, Math.min(.9, yaw)); P.hx += Math.max(-.4, Math.min(.35, pitch));
    }
    // legs: crouch bends hips and knees; feet stay flat
    const c = P.crouch;
    J.hips.position.y = 150 - 38 * c + P.bob + P.lift;
    const hL = P.hipL - .8 * c, hR = P.hipR - .8 * c, kL = P.knL + 1.5 * c, kR = P.knR + 1.5 * c;
    J.LL.hp.rotation.x = hL; J.LR.hp.rotation.x = hR; J.LL.kn.rotation.x = kL; J.LR.kn.rotation.x = kR;
    J.LL.an.rotation.x = -(hL + kL) * (1 - .4 * w); J.LR.an.rotation.x = -(hR + kR) * (1 - .4 * w);
    J.torso.rotation.set(P.tx + .35 * c, 0, P.tz);
    J.L.sh.rotation.set(P.shLx, 0, P.shLz); J.R.sh.rotation.set(P.shRx, 0, P.shRz);
    J.L.el.rotation.set(P.elL, 0, 0); J.R.el.rotation.set(P.elR, 0, P.elRz);
    J.head.rotation.set(P.hx, P.hy, P.hz);
    J.root.position.set(J.pos.x, 0, J.pos.z); J.root.rotation.y = J.heading;
    J.face.update(now, J.speaker.speaking ? "speaking" : faceState, P.eyes);
  }

  /* ================= speech ================= */
  let soundOn = !!CFG.soundOnByDefault;
  let audioContext = null, rewardAudio = null, rewardBuffer = null, rewardLoading = null;
  let rewardGain = null, rewardPending = false, rewardBusy = false;
  const retrySound = document.createElement("button");
  retrySound.type = "button"; retrySound.textContent = "Play recorded blessing"; retrySound.hidden = true;
  retrySound.style.cssText = "position:absolute;left:16px;right:16px;bottom:130px;z-index:5;padding:12px;background:#aab0b8;color:#111214;border:2px solid #487dad;font:inherit;cursor:pointer";
  stage.appendChild(retrySound);
  function loadReward() {
    if (!audioContext) return Promise.reject(new Error("Audio unavailable"));
    if (rewardBuffer) return Promise.resolve(rewardBuffer);
    if (!rewardLoading) rewardLoading = fetch("/coin/audio.mp3").then(r => {
      if (!r.ok) throw new Error("Recording unavailable"); return r.arrayBuffer();
    }).then(bytes => new Promise((resolve,reject) => audioContext.decodeAudioData(bytes,resolve,reject)))
      .then(buffer => rewardBuffer = buffer).catch(e => { rewardLoading = null; throw e; });
    return rewardLoading;
  }
  function unlockAudio() {
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      // This function runs directly inside pointer/click handlers. Unlock the context now,
      // not after Jack's walk and deposit have consumed the gesture permission window.
      if (audioContext.state !== "running") audioContext.resume().catch(() => {});
      const silent = audioContext.createBufferSource();
      silent.buffer = audioContext.createBuffer(1,1,audioContext.sampleRate);
      silent.connect(audioContext.destination); silent.start(0);
      loadReward().catch(() => {});
    } catch (_) {}
  }
  function offerRewardRetry() {
    rewardPending = true; retrySound.hidden = false;
    log("Recording ready. Tap Play recorded blessing in the field to hear it.");
  }
  retrySound.addEventListener("click", () => {
    soundOn = true; const btn = $("soundBtn"); btn.textContent = "Sound on"; btn.setAttribute("aria-pressed","true");
    unlockAudio(); blessing();
  });
  async function blessing() {
    if (rewardBusy) return;
    if (!soundOn) { rewardPending = true; retrySound.hidden = false;
      await J.speaker.say("The recorded blessing is ready. Tap Play recorded blessing to hear it. [bow]", {onGesture:gesture}); return; }
    rewardBusy = true;
    let source = null, analyser = null, finished = false;
    try {
      if (!audioContext) { offerRewardRetry(); return; }
      await Promise.race([audioContext.resume(), new Promise((_,reject)=>setTimeout(()=>reject(new Error("Audio resume timeout")),4000))]);
      const buffer = await loadReward();
      if (audioContext.state !== "running") { offerRewardRetry(); return; }
      source = audioContext.createBufferSource(); source.buffer = buffer;
      analyser = audioContext.createAnalyser(); analyser.fftSize = 512;
      rewardGain = audioContext.createGain(); rewardGain.gain.value = soundOn ? 1 : 0;
      source.connect(analyser); analyser.connect(rewardGain); rewardGain.connect(audioContext.destination);
      rewardAudio = source;
      const ended = new Promise(resolve => { source.onended = () => { finished=true; resolve(); }; });
      speechPing("jack-speech-start");
      source.start(); rewardPending=false; retrySound.hidden=true;
      logLine("The clerk's recorded blessing.", "said");
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => { if (finished) return; analyser.getByteTimeDomainData(buf); let sum=0;
        for (const v of buf) sum += Math.pow((v-128)/128,2);
        J.face.mouth(Math.min(1,Math.sqrt(sum/buf.length)*4)); requestAnimationFrame(tick); }; tick();
      await J.speaker.say("[bow]", {levelDriven:true,until:ended,onGesture:gesture});
    } catch (e) { log("Recording paused (" + (e.name || "audio") + ")."); offerRewardRetry(); }
    finally { finished=true; if(source)source.disconnect(); if(analyser)analyser.disconnect();
      if(rewardGain)rewardGain.disconnect(); rewardAudio=null; rewardGain=null; rewardBusy=false; speechPing("jack-speech-end"); }
  }
  function speechPing(name) { try { window.dispatchEvent(new CustomEvent(name)); } catch (_) {} }
  async function say(text, opts = {}) {
    ticket.classList.remove("thought");
    logLine(CORE.stripTags(text).trim(), "said");
    let ended = null;
    /* Tell the field microphone Jack is talking, then when he is done, so it
       never hears his own voice as the visitor's. */
    speechPing("jack-speech-start");
    try {
      if (soundOn && window.JackDeepgram && CFG.deepgram && await window.JackDeepgram.say(text, J.speaker, gesture, unlockAudio, () => audioContext, () => soundOn)) return;
      if (soundOn) ended = await CORE.voice.speak(text, CFG.voice);
      if (ended) await J.speaker.say(text, { cps: 13.5, until: ended, onGesture: gesture });
      else await J.speaker.say(text, { cps: 15, onGesture: gesture });
    } finally {
      speechPing("jack-speech-end");
    }
  }
  function think(text) { if (J.speaker.speaking && !ticket.classList.contains("thought")) return; ticket.classList.add("thought"); J.speaker.say(text, { cps: 40, hold: 1600 }); }

  /* ================= the mind ================= */
  const mind = { goal: "Standing by", step: "", curious: 35, social: 55, locked: false };
  const inbox = [];                  // visitor messages, clicks and suit commands
  let tok = 0;
  const ABORT = { abort: true };
  const guard = t => { if (t !== tok) throw ABORT; };
  function walkTo(pos, stop = 8, ignore = null) { return new Promise(res => { faceReq = null; moveReq = { target: pos.clone(), stop, ignore, res }; }); }
  function face(pos) { return new Promise(res => { moveReq = null; faceReq = { angle: Math.atan2(pos.x - J.pos.x, pos.z - J.pos.z), res }; }); }
  function act(name, d, mid) { return new Promise(res => { action = { name, s: performance.now(), d, res, mid, midDone: false }; }); }
  function stopBody() { if (moveReq) { const r = moveReq.res; moveReq = null; r(); } if (faceReq) { const r = faceReq.res; faceReq = null; r(); } }
  function setGoal(g, step = "") { mind.goal = g; mind.step = step; renderMind(); }
  function setStep(s) { mind.step = s; renderMind(); }
  function interrupt(reason) { if (mind.locked) return; tok++; stopBody(); log(reason); }

  function frontOf(g, d) { return g.position.clone().addScaledVector(fwd(g), d); }
  function cameraGround() { return V(camera.position.x, 0, camera.position.z); }
  let thanksIdx = 0;

  const GOALS = {
    async coin(t) {
      const coin = nearest(world.coins.filter(c => c.landed && !c.claimed && !c.gone));
      if (!coin) return; coin.claimed = true;
      setGoal("Fetching a pound", "Walking to the coin"); think("A pound. [nod] Fetching it.");
      lookAt = coin.obj.position;
      try { await walkTo(V(coin.obj.position.x, 0, coin.obj.position.z), 30); guard(t); } catch (e) { coin.claimed = false; throw e; }
      lookAt = null; await face(coin.obj.position);
      mind.locked = true; setStep("Picking it up");
      await act("pickup", 1100, () => { J.R.grip.add(coin.obj); coin.obj.position.set(0, 0, 0); coin.obj.rotation.set(Math.PI / 2, 0, 0); coin.ring.visible = false; });
      mind.locked = false; guard(t);
      setStep("Carrying it to the money box");
      await walkTo(frontOf(box, 150), 10); guard(t);
      await face(box.position); mind.locked = true; setStep("Filing it");
      await act("deposit", 1300, () => { coin.obj.parent.remove(coin.obj); coin.gone = true; scene.remove(coin.ring); boxFaceM.emissive.setHex(0x3a3018); setTimeout(() => boxFaceM.emissive.setHex(0), 600); });
      world.filedCoins++; renderMind(); mind.locked = false;
      lookAt = camera.position;
      await blessing();
      lookAt = null; mind.social = Math.max(0, mind.social - 30);
    },
    async tidy(t) {
      const card = nearest(world.cards.filter(c => c.landed && !c.claimed && !c.gone));
      if (!card) return; card.claimed = true;
      setGoal("Tidying the records", "Fetching a stray card"); think("Stray card. Filing it.");
      try { await walkTo(V(card.obj.position.x, 0, card.obj.position.z), 30); guard(t); } catch (e) { card.claimed = false; throw e; }
      await face(card.obj.position);
      mind.locked = true; setStep("Picking it up");
      await act("pickup", 1100, () => { J.R.grip.add(card.obj); card.obj.position.set(0, 0, 4); card.obj.rotation.set(Math.PI / 2, 0, 0); });
      mind.locked = false; guard(t);
      setStep("Taking it to the hopper");
      await walkTo(frontOf(desk, 120).add(V(0, 0, 0)), 10); guard(t);
      await face(hopperMouth.getWorldPosition(V(0, 0, 0)));
      mind.locked = true; setStep("Feeding it in");
      await act("file", 1200, () => {
        card.obj.parent.remove(card.obj); card.gone = true;
        const s = new THREE.Mesh(new THREE.BoxGeometry(56, 1.2, 25), [edgeM, edgeM, cardM, backM, edgeM, edgeM]);
        s.position.set(rnd(-2, 2), 1 + (world.filedCards % 30) * 1.3, rnd(-2, 2)); s.rotation.y = rnd(-.08, .08); s.castShadow = true; tray.add(s);
      });
      world.filedCards++; renderMind(); mind.locked = false;
      think("Filed. [nod]"); gesture("nod");
    },
    async pod(t) {
      setGoal("Checking the TimePod", "Walking to the pod"); think("Checking the TimePod.");
      await walkTo(frontOf(pod, 175), 10); guard(t); await face(pod.position);
      mind.locked = true; setStep("Stepping in");
      await tween(600, k => { door.rotation.y = -1.35 * ease(k); });
      await walkTo(V(pod.position.x, 0, pod.position.z), 12, obstacles.find(o => o.g === pod));
      await tween(250, k => { door.rotation.y = -1.35 * (1 - ease(k)); });
      J.root.visible = false; setStep("On the network");
      const t0 = performance.now();
      await tween(1600, k => { const f = Math.sin(k * Math.PI * 9) * .5 + .5; podLight.intensity = 2.4 * f * bump(k); podLamp.material.emissive.setRGB(.9 * f, .75 * f, .5 * f); podGlass.emissive.setRGB(.5 * f * bump(k), .4 * f * bump(k), .25 * f * bump(k)); });
      podLight.intensity = 0; podLamp.material.emissive.setHex(0x332a18); podGlass.emissive.setHex(0);
      J.heading += Math.PI; J.root.visible = true;
      await tween(500, k => { door.rotation.y = -1.35 * ease(k); });
      await walkTo(frontOf(pod, 175), 10, obstacles.find(o => o.g === pod));
      await tween(500, k => { door.rotation.y = -1.35 * (1 - ease(k)); });
      mind.locked = false; mind.curious = 8;
      think("TimePod network: connected.");
    },
    async wander(t) {
      setGoal("Walking the field", "Picking a spot");
      let p; for (let i = 0; i < 20; i++) { const a = Math.random() * Math.PI * 2, r = rnd(80, 620); p = V(Math.cos(a) * r, 0, Math.sin(a) * r); if (!obstacles.some(o => p.distanceTo(V(o.c.x, 0, o.c.z)) < o.r + 40)) break; }
      setStep("Walking"); await walkTo(p, 12); guard(t);
      setStep("Looking around"); await act("look", 2600); guard(t);
      if (Math.random() < .4) { setStep("Looking at the sky"); faceState = "thinking"; await act("sky", 2400); faceState = "idle"; }
      mind.curious = Math.max(0, mind.curious - 40);
    },
    async greet(t) {
      setGoal("Saying hello", "Turning to you");
      await face(cameraGround()); guard(t); lookAt = camera.position;
      gesture("wave"); await say(pick(CFG.musings && Math.random() < .5 ? CFG.musings : (CFG.hello || ["Hello."])));
      lookAt = null; mind.social = 0;
    },
    async rest(t) { setGoal("Standing by", "Resting"); await act("rest", rnd(2200, 3600)); }
  };

  async function handleInbox(t) {
    const m = inbox.shift();
    if (m.type === "hello") {
      setGoal("Saying hello", "Turning to you"); await face(cameraGround()); lookAt = camera.position;
      gesture("wave"); await say(pick(CFG.hello || ["Hello."])); lookAt = null; mind.social = 0; return;
    }
    if (m.type === "talk") {
      setGoal("Answering you", "Listening"); faceState = "listening";
      await face(cameraGround()); lookAt = camera.position;
      faceState = "thinking"; setStep("Thinking");
      const reply = await answer(m.text);
      faceState = "idle"; setStep("Answering");
      if (reply.gesture) gesture(reply.gesture);
      await say(reply.say || CFG.unknown);
      lookAt = null; mind.social = 0;
      if (reply.goal && GOALS[reply.goal]) inbox.unshift({ type: "cmd", cmd: { goal: reply.goal } });
      return;
    }
    if (m.type === "cmd") {
      const c = m.cmd || {};
      setGoal("Following instructions", "");
      if (Array.isArray(c.walkTo)) { setStep("Walking"); await walkTo(V(+c.walkTo[0] || 0, 0, +c.walkTo[1] || 0), 10); }
      if (c.gesture) gesture(c.gesture);
      if (c.think) think(c.think);
      if (c.say) { lookAt = camera.position; await say(c.say); lookAt = null; }
      if (c.travel) await travelTo(c.travel, t);
      if (c.goal && GOALS[c.goal]) await GOALS[c.goal](t);
      if (m.res) m.res();
    }
  }

  function nearest(list) { let best = null, bd = 1e9; list.forEach(c => { const d = Math.hypot(c.obj.position.x - J.pos.x, c.obj.position.z - J.pos.z); if (d < bd) { bd = d; best = c; } }); return best; }
  function choose() {
    if (world.coins.some(c => c.landed && !c.claimed && !c.gone)) return "coin";
    const loose = world.cards.filter(c => c.landed && !c.claimed && !c.gone).length;
    const opts = [
      ["tidy", loose ? 45 + loose * 12 : 0],
      ["pod", mind.curious > 70 ? mind.curious : 0],
      ["wander", 25 + mind.curious * .4],
      ["greet", mind.social > 70 ? mind.social : 0],
      ["rest", 22]
    ].map(([g, u]) => [g, u * rnd(.8, 1.2)]).sort((a, b) => b[1] - a[1]);
    return opts[0][0];
  }
  async function life() {
    await sleep(900);
    await say(pick(CFG.hello || ["Hello."]));
    for (;;) {
      const t = ++tok;
      try {
        if (inbox.length) await handleInbox(t);
        else { const d = await chooseDecision(); guard(t);
          log((d.model ? "Model chose: " : "Local fallback: ") + d.goal + (d.reason ? ". " + d.reason : "."));
          await GOALS[d.goal](t); }
      } catch (e) { if (e !== ABORT) { console.error(e); await sleep(500); } }
      mind.locked = false; faceState = "idle"; lookAt = null; action = null;
      setGoal(inbox.length ? "Coming" : "Standing by", ""); await sleep(rnd(400, 1100));
    }
  }

  /* The model sees this field, not Jack's private office or another visitor's history. */
  const brainStatus=document.createElement("div");brainStatus.className="brain-status";
  document.querySelector(".field-talk").prepend(brainStatus);
  function setBrainStatus(text){brainStatus.textContent=text;}
  setBrainStatus(CFG.brain?.url?"Coming to the desk":"Away from the desk");
  let nextDecision = 0; const modelPaused = {talk:0, decision:0};
  const conversation = [];
  function worldSnapshot() { return { goal: mind.goal, pounds_filed: world.filedCoins,
    cards_filed: world.filedCards, cards_loose: world.cards.filter(c => c.landed && !c.gone).length,
    coins_on_ground: world.coins.filter(c => c.landed && !c.gone).length,
    curiosity: mind.curious, company: mind.social, tidiness: mind.tidy }; }
  async function callBrain(kind, message) {
    const b = CFG.brain || {};
    if (!b.url || !b.csrf || performance.now()<(modelPaused[kind]||0)) return null;
    const ctl = new AbortController();
    const timeout = setTimeout(() => ctl.abort(), b.timeoutMs || 35000);
    try {
      const r = await fetch(b.url, { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, signal: ctl.signal,
        body: JSON.stringify({kind, message, world:worldSnapshot(), history:conversation, csrf:b.csrf}) });
      if (!r.ok) {
        setBrainStatus("Away from the desk");
        if ([403,429,503].includes(r.status)) { modelPaused[kind]=performance.now()+Math.max(60,Number(r.headers.get("Retry-After"))||60)*1000; setBrainStatus("Away from the desk"); log("Away from the desk for a moment. The field carries on."); }
        return null;
      }
      const j = await r.json();
      if (!j.ok || j.source !== "model") return null;
      if (!GOALS[j.goal]) j.goal = null;
      if (!["wave","nod","bow","unsure"].includes(j.gesture)) j.gesture = null;
      j.say = String(j.say || "").slice(0,600).replace(/\[[^\]]*\]/g, "");
      j.reason = String(j.reason || "").slice(0,240).replace(/\[[^\]]*\]/g, "");
      setBrainStatus("At the desk"); return j;
    } catch (_) { setBrainStatus("Away from the desk"); log("The desk did not answer. The field carries on."); return null; }
    finally { clearTimeout(timeout); }
  }
  async function chooseDecision() {
    if (performance.now() >= nextDecision && !document.hidden) {
      nextDecision = performance.now() + 60000;
      const j = await callBrain("decision", "");
      if (j && j.goal) return {goal:j.goal, reason:j.reason, model:true};
    }
    return {goal:choose(), model:false};
  }
  async function answer(text) {
    const j = await callBrain("talk", text);
    if (j && j.say) {
      conversation.push({speaker:"visitor",text:text.slice(0,400)},{speaker:"Jack",text:j.say.slice(0,400)});
      if(conversation.length>6) conversation.splice(0,conversation.length-6);
      log("Model reply."); return j;
    }
    const q = " " + text.toLowerCase().replace(/[^\w£' ]+/g, " ") + " ";
    const hit = (CFG.answers || []).find(a => a.match.some(m => q.includes(" " + m + " ") || (m.length > 3 && q.includes(m))));
    return { say: hit ? hit.say : (CFG.unknown || "I don't know.") };
  }

  /* ================= visitor input ================= */
  function onCoinLanded(c) { log("The pound landed."); if (!mind.locked && !/pound|Answering/.test(mind.goal)) interrupt("Jack spotted the pound."); }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(V(0, 1, 0), 0); let down = null;
  renderer.domElement.addEventListener("pointerdown", e => { unlockAudio(); down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera);
    if (ray.intersectObject(J.root, true).length) { logLine("You tapped Jack.", "you"); inbox.push({ type: "hello" }); interrupt("Jack noticed you."); return; }
    if (ray.intersectObject(pod, true).length) { logLine("You tapped the TimePod.", "you"); dialNext(); return; }
    const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, p)) return;
    if (Math.hypot(p.x, p.z) > 950 || obstacles.some(o => Math.hypot(p.x - o.c.x, p.z - o.c.z) < o.r - 20)) return;
    if (world.coins.filter(c => !c.gone).length >= 6) { log("Plenty of pounds out already."); return; }
    dropCoin(p.x, p.z); $("hint").hidden = true;
  });
  $("talk").addEventListener("submit", e => {
    e.preventDefault(); const v = $("talkIn").value.trim(); if (!v) return; $("talkIn").value = "";
    logLine(v, "you"); inbox.push({ type: "talk", text: v }); interrupt("Jack turned to listen.");
  });
  const soundBtn = $("soundBtn"), followBtn = $("followBtn"), heldBtn = $("heldBtn");
  const syncSound = () => { soundBtn.setAttribute("aria-pressed", soundOn); soundBtn.textContent = soundOn ? "Sound on" : "Sound off"; };
  soundBtn.onclick = () => { soundOn = !soundOn; if(soundOn) unlockAudio(); if(rewardGain) rewardGain.gain.value = soundOn ? 1 : 0; syncSound(); if (!soundOn && window.speechSynthesis) speechSynthesis.cancel(); }; syncSound();
  let follow = true; followBtn.onclick = () => { follow = !follow; followBtn.setAttribute("aria-pressed", follow); };
  let held = true; heldBtn.onclick = () => { held = !held; heldBtn.setAttribute("aria-pressed", held); heldBtn.textContent = held ? "12 fps" : "Smooth"; };
  const dialBtn = $("dialBtn"); if (dialBtn) dialBtn.onclick = () => { unlockAudio(); dialNext(); };

  /* ---------- the suit API: other code can still drive him ---------- */
  window.JackSuit = {
    do(cmd) { return new Promise(res => { inbox.push({ type: "cmd", cmd, res }); interrupt("Jack received an instruction."); }); },
    say(text) { return this.do({ say: text }); },
    travel(key) { return this.do({ travel: key }); },
    dropCoin(x = rnd(-300, 300), z = rnd(0, 400)) { return dropCoin(x, z); },
    get state() { return { goal: mind.goal, step: mind.step, position: [J.pos.x, J.pos.z], pounds_filed: world.filedCoins, cards_filed: world.filedCards }; }
  };
  window.addEventListener("message", e => { if(e.origin !== location.origin) return; const d = e.data; if (d && d.jack) window.JackSuit.do(d.jack).then(() => { try { e.source && e.source.postMessage({ jackDone: d.id ?? null }, e.origin); } catch (_) {} }); });

  /* ================= UI: mind panel and log ================= */
  const logEl = $("log");
  function logLine(text, cls) {
    const li = document.createElement("li"); if (cls) li.className = cls;
    const tm = document.createElement("time"); tm.textContent = new Date().toTimeString().slice(0, 5);
    const sp = document.createElement("span"); sp.textContent = cls === "said" ? "“" + text + "”" : text;
    li.append(tm, sp); logEl.prepend(li); while (logEl.children.length > 30) logEl.lastChild.remove();
  }
  const log = t => logLine(t);
  function renderMind() {
    $("goal").textContent = mind.goal; $("step").textContent = mind.step || "—"; $("nowLine").textContent = mind.goal.toUpperCase();
    const loose = world.cards.filter(c => c.landed && !c.gone).length;
    $("nTidy").style.width = Math.max(4, 100 - loose * 22) + "%"; $("nCur").style.width = Math.min(100, mind.curious) + "%"; $("nSoc").style.width = Math.min(100, mind.social) + "%";
    $("cCoins").textContent = world.filedCoins; $("cCards").textContent = world.filedCards; $("cLoose").textContent = loose;
  }

  /* ================= tweens + loop ================= */
  const tweens = [];
  function tween(d, f) { return new Promise(res => tweens.push({ s: performance.now(), d, f, res })); }
  function placeTicket() {
    if (ticket.hidden) return;
    J.head.localToWorld(tmpV.set(0, 112, 0)); tmpV.project(camera);
    const w = stage.clientWidth, h = stage.clientHeight;
    if (tmpV.z > 1) { ticket.style.left = "-999px"; return; }
    ticket.style.left = Math.min(Math.max((tmpV.x + 1) / 2 * w, 110), w - 110) + "px";
    const talkTop = document.querySelector(".field-talk").offsetTop;
    const bottom = Math.min(talkTop - 14, Math.max((1 - tmpV.y) / 2 * h - 6, ticket.offsetHeight + 58));
    ticket.style.top = Math.max(ticket.offsetHeight + 6, bottom) + "px";
  }
  function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(stage); resize();
  if (stage.clientWidth < 700) camera.position.set(160, 420, 1200);

  let last = performance.now(), lastFrame = -1, nextCard = performance.now() + 7000, needT = 0;
  const followV = new THREE.Vector3();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    grassU.uTime.value = now / 1000; tickPlanet(now);
    for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i], k = Math.min(1, (now - tw.s) / tw.d); tw.f(k); if (k >= 1) { tweens.splice(i, 1); tw.res(); } }
    if (now > nextCard) { if (world.cards.filter(c => !c.gone).length < 4) spawnCard(); nextCard = now + rnd(18000, 34000); }
    updateWorld(dt, now);
    updateMovement(dt);
    if (action) {
      const k = (now - action.s) / action.d;
      if (!action.midDone && k >= .5) { action.midDone = true; if (action.mid) action.mid(); }
      if (k >= 1) { const r = action.res; action = null; r(); }
    }
    needT += dt; if (needT > 1) { needT = 0; mind.curious = Math.min(100, mind.curious + 1.7); mind.social = Math.min(100, mind.social + 1.1); renderMind(); }
    const f = Math.floor(now / 83);
    if (!held || f !== lastFrame) { lastFrame = f; applyPose(now); }
    if (follow) { followV.set(J.pos.x, 170, J.pos.z); const d = followV.sub(controls.target).multiplyScalar(Math.min(1, dt * 1.6)); controls.target.add(d); camera.position.add(d); }
    controls.update(); renderer.render(scene, camera); placeTicket();
    requestAnimationFrame(frame);
  }
  renderMind(); requestAnimationFrame(frame); life();
})();

/* SunCalc licence:
Copyright (c) 2014, Vladimir Agafonkin
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are
permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice, this list of
      conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright notice, this list
      of conditions and the following disclaimer in the documentation and/or other materials
      provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

*/

