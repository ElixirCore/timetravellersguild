/* Coindrop · Money-box Jack — 3D assembly viewer.
   Units: 1 = 1 mm. x right, y up, z towards the viewer (front panel at +z). */
(function () {
  const CFG = window.COINDROP_CONFIG || { voice: {}, lines: [{ text: "Thank you for the pound.", audio: null }] };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const $ = id => document.getElementById(id);
  const stage = $("stage"), statusText = $("statusText"), led = $("led");

  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.insertBefore(renderer.domElement, stage.firstChild);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 1, 6000);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.minDistance = 160; controls.maxDistance = 1600;
  controls.target.set(0, 125, 0);

  scene.add(new THREE.HemisphereLight(0xe6dfcc, 0x0b120d, .5));
  const key = new THREE.DirectionalLight(0xfff3dc, .95); key.position.set(320, 520, 420); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -300, right: 300, top: 350, bottom: -100, near: 50, far: 1500 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6bf27a, .22); rim.position.set(-400, 200, -300); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.ShadowMaterial({ opacity: .35 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(900, 45, 0x1f3a24, 0x101813); grid.position.y = -.4; scene.add(grid);

  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .7, metalness: .05 }, o));
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };

  const parts = [];
  function part(o) {
    o.obj.position.copy(o.pos);
    o.obj.userData = { id: o.id, home: o.pos.clone(), ex: o.ex };
    o.obj.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    scene.add(o.obj); parts.push(o); return o.obj;
  }

  /* ---------- front panel texture, 4 px per mm ---------- */
  function panelTex() {
    const k = 4, c = document.createElement("canvas"); c.width = 200 * k; c.height = 260 * k; const g = c.getContext("2d");
    g.fillStyle = "#3d4a36"; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 240; i++) { g.strokeStyle = "rgba(230,223,204," + (Math.random() * .045) + ")"; g.lineWidth = 1 + Math.random() * 2; const y = Math.random() * c.height; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(c.width * .3, y + Math.random() * 20 - 10, c.width * .7, y + Math.random() * 20 - 10, c.width, y + Math.random() * 16 - 8); g.stroke(); }
    // vertical slot 4 x 30 mm, centre 44 mm from top
    g.fillStyle = "#000"; g.strokeStyle = "#d9a441"; g.lineWidth = 3; g.fillRect(98 * k, 29 * k, 4 * k, 30 * k); g.strokeRect(98 * k, 29 * k, 4 * k, 30 * k);
    g.fillStyle = "#d9a441"; g.font = (6 * k) + "px Menlo,monospace"; g.textAlign = "left"; g.fillText("£1", 107 * k, 47 * k);
    // engraved title
    g.fillStyle = "rgba(230,223,204,.55)"; g.font = (5 * k) + "px Georgia,serif"; g.textAlign = "center";
    g.fillText("TIME TRAVELLERS GUILD", 100 * k, 16 * k);
    // Jack's face print, 100 x 100 mm, from the 9 x 9 card map
    const MAP = ["ccccccc..", "cccccccc.", "cckccckcc", "cckccckcc", "ccccccccc", "ckccccckc", "cckkkkkcc", "ccccccccc", "ccccccccc"];
    const cell = 100 / 9;
    MAP.forEach((row, r) => row.split("").forEach((ch, col) => {
      if (ch === ".") return;
      g.fillStyle = ch === "c" ? "#e3d5a8" : ch === "k" ? "#1b1d1a" : ch === "w" ? "#fbf6e6" : "#c8203c";
      g.fillRect((50 + col * cell) * k, (78 + r * cell) * k, Math.ceil(cell * k) + 1, Math.ceil(cell * k) + 1);
    }));
    g.fillStyle = "rgba(230,223,204,.6)"; g.font = (4 * k) + "px Menlo,monospace"; g.fillText("JACK · CLERK OF THE GUILD", 100 * k, 186 * k);
    // grilles: 2.5 mm holes, 5 mm hex grid
    [60, 100, 140].forEach(cx => {
      const cy = 222, r = 16; g.fillStyle = "#050606";
      for (let yy = -r; yy <= r; yy += 4.33) { const off = (Math.round((yy + r) / 4.33) % 2) ? 2.5 : 0; for (let xx = -r + off; xx <= r; xx += 5) if (xx * xx + yy * yy <= (r - 1.5) ** 2) { g.beginPath(); g.arc((cx + xx) * k, (cy + yy) * k, 1.25 * k, 0, 7); g.fill(); } }
      g.strokeStyle = "rgba(138,144,127,.7)"; g.lineWidth = 2; g.beginPath(); g.arc(cx * k, cy * k, r * k, 0, 7); g.stroke();
    });
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }

  /* ---------- enclosure ---------- */
  const ply = M(0x34402f, { roughness: .9 });
  const plyEdge = M(0x6d5a40, { roughness: .9 });
  const faceMat = M(0xffffff, { map: panelTex(), roughness: .85 });
  const shellMats = [ply, plyEdge, faceMat];
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x6bf27a, transparent: true, opacity: 0 });
  function shell(id, w, h, d, pos, ex, mats) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mats || [plyEdge, plyEdge, plyEdge, plyEdge, ply, ply]);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    return part({ id, obj: mesh, pos, ex, layer: "shell" });
  }
  const front = shell("front", 200, 260, 6, V(0, 130, 67), V(0, 0, 150), [plyEdge, plyEdge, plyEdge, plyEdge, faceMat, ply]);
  shell("back", 200, 260, 6, V(0, 130, -67), V(0, 0, -150));
  shell("left", 6, 260, 128, V(-97, 130, 0), V(-150, 0, 0));
  shell("right", 6, 260, 128, V(97, 130, 0), V(150, 0, 0));
  shell("top", 188, 6, 128, V(0, 257, 0), V(0, 140, 0));
  shell("floor", 188, 6, 128, V(0, 3, 0), V(0, -30, 0));
  const hatchMat = M(0x2c3628, { roughness: .85 });
  shellMats.push(hatchMat);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(160, 188, 3), hatchMat);
  hatch.add(new THREE.LineSegments(new THREE.EdgesGeometry(hatch.geometry), new THREE.LineBasicMaterial({ color: 0xd9a441 })));
  hatch.add(box(14, 6, 4, M(0xb8bcbc, { metalness: .8, roughness: .3 }), 60, 0, -3));
  part({ id: "hatch", obj: hatch, pos: V(0, 106, -71.5), ex: V(0, 0, -230), layer: "shell" });

  /* ---------- internals ---------- */
  const metal = M(0x5a605c, { metalness: .6, roughness: .4 }), dark = M(0x1c201e, { roughness: .6 });
  const mech = new THREE.Group();
  mech.add(box(120, 120, 3, metal, 0, 0, 62.5));
  mech.add(box(100, 100, 70, dark, 0, 0, 26));
  mech.add(box(5, 32, 4, M(0x000000), 0, 44, 64.5));
  mech.add(box(14, 10, 4, M(0x9a2b23), 38, 40, 64.5));
  mech.add(box(18, 8, 6, M(0xe6dfcc), 30, -30, -12));
  mech.add(box(10, 6, 3, M(0x2b4fd9), -25, 30, -10.5));
  part({ id: "mech", obj: mech, pos: V(0, 172, 0), ex: V(0, 30, 60), layer: "internals" });

  const A = V(0, 116, 20), B = V(0, 70, -30), mid = A.clone().add(B).multiplyScalar(.5), L = A.distanceTo(B);
  const acr = M(0x9fd8c0, { transparent: true, opacity: .35, roughness: .2, depthWrite: false });
  const chute = new THREE.Group();
  chute.add(box(30, 2, L, acr), box(2, 26, L, acr, -15, 13, 0), box(2, 26, L, acr, 15, 13, 0));
  chute.quaternion.setFromUnitVectors(V(0, 0, 1), B.clone().sub(A).normalize());
  part({ id: "chute", obj: chute, pos: mid, ex: V(0, 0, 0), layer: "internals" });

  const cb = new THREE.Group();
  const cbm = M(0x1a2620, { transparent: true, opacity: .6, depthWrite: false });
  cb.add(box(110, 2, 60, cbm, 0, -24, 0), box(2, 50, 60, cbm, -55, 0, 0), box(2, 50, 60, cbm, 55, 0, 0), box(110, 50, 2, cbm, 0, 0, 30), box(110, 50, 2, cbm, 0, 0, -30));
  cb.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(110, 50, 60)), new THREE.LineBasicMaterial({ color: 0xd9a441, transparent: true, opacity: .6 })));
  part({ id: "coinbox", obj: cb, pos: V(0, 31, -34), ex: V(0, -20, -110), layer: "internals" });

  const spk = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(19, 7, 10, 32, 1, true), M(0x2a2a2a, { side: THREE.DoubleSide, roughness: .8 })); cone.rotation.x = Math.PI / 2; cone.position.z = 5; spk.add(cone);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(19.5, 1.4, 8, 40), metal); ring.position.z = 10; spk.add(ring);
  const mag = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 9, 24), M(0x8a907f, { metalness: .7, roughness: .3 })); mag.rotation.x = Math.PI / 2; mag.position.z = -4; spk.add(mag);
  part({ id: "speaker", obj: spk, pos: V(0, 38, 52), ex: V(0, -10, 90), layer: "internals" });

  const esp = new THREE.Group();
  esp.add(box(1.6, 55, 28, M(0x14181a)), box(3, 25, 18, M(0xb8bcbc, { metalness: .8, roughness: .3 }), 2.3, 12, 0), box(4, 6, 9, M(0x8a907f, { metalness: .6 }), 2.8, -25, 0));
  const espLed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 2), M(0x103018, { emissive: 0x000000 })); espLed.position.set(1.6, -14, 8); esp.add(espLed);
  part({ id: "esp32", obj: esp, pos: V(-92, 150, -22), ex: V(-80, 0, 0), layer: "internals" });

  const dfp = new THREE.Group();
  dfp.add(box(1.6, 21, 21, M(0x16302a)), box(2, 12, 14, M(0x8a907f, { metalness: .6 }), -1.8, -3, -4));
  part({ id: "dfplayer", obj: dfp, pos: V(92, 150, -46), ex: V(80, 0, 0), layer: "internals" });

  const pw = new THREE.Group();
  const dc = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 12, 20), M(0x111111)); dc.rotation.x = Math.PI / 2; dc.position.set(-30, 0, 0); pw.add(dc);
  pw.add(box(10, 4, 12, M(0xb8bcbc, { metalness: .8, roughness: .3 }), 30, 0, 0));
  part({ id: "power", obj: pw, pos: V(0, 228, -66), ex: V(0, 40, -180), layer: "internals" });

  /* ---------- part notes ---------- */
  const INFO = {
    front: { n: "01", name: "Front panel", lbl: [0, 132, 0], k: "Enclosure", t: "200 × 260 mm, 6 mm ply or a 3D print. Vertical 4 × 30 mm slot, centred 44 mm from the top, over the mech mouth. Jack's face printed 100 mm square. Grille holes 2.5 mm on a 5 mm hex grid; the speaker sits behind the centre one." },
    mech: { n: "02", name: "CH-926 coin mech", lbl: [0, 62, 0], flag: true, k: "Placeholder size", t: "12 V on red, ground black, COIN white, COUNTER grey (unused, capped). Set NO, speed slow, teach £1 = 1 pulse with real coins. The 120 mm faceplate and 70 mm depth here are placeholders: measure your unit." },
    chute: { n: "03", name: "Coin chute", lbl: [0, 16, 0], k: "Internals", t: "Acrylic U-channel, 30 mm wide, from the mech exit down to the coin box. It keeps the coin path clear of the speaker." },
    coinbox: { n: "04", name: "Coin box", lbl: [0, 28, 0], k: "Internals", t: "110 × 50 × 60 mm, open top. Lifts out through the rear hatch." },
    esp32: { n: "05", name: "ESP32 DevKit", lbl: [0, 32, 0], k: "Controller", t: "WROOM module (on a WROVER, GPIO16/17 belong to PSRAM). GPIO27 reads COIN through 1k–2.2k series, with an external 10k pull-up to 3.3 V. GPIO17 TX2, GPIO16 RX2, GPIO26 BUSY. USB faces the hatch for flashing." },
    dfplayer: { n: "06", name: "DFPlayer Mini", lbl: [0, 16, 0], k: "Audio", t: "microSD, FAT32, tracks 0001.mp3 upward: Jack's lines. RX takes TX2 through 1k. BUSY goes low while a track plays. Card slot faces the hatch." },
    speaker: { n: "07", name: "Speaker 8 Ω", lbl: [0, -26, 0], k: "Audio", t: "40 mm, 8 Ω, 3 W, wired straight to SPK_1 / SPK_2. Never to ground." },
    power: { n: "08", name: "Power inputs", lbl: [0, 12, 0], k: "Rear panel", t: "Left: 12 V 1 A barrel jack, mech only. Right: 5 V USB-C for the ESP32 and DFPlayer VCC. All grounds joined. Mounted above the hatch so it opens freely." },
    hatch: { n: "09", name: "Rear hatch", lbl: [0, 100, 0], k: "Enclosure", t: "160 × 188 mm. Reaches the coin box, SD card and ESP32 USB. Lock it or use captive screws: it guards the money." }
  };
  const ORDER = ["front", "mech", "chute", "coinbox", "esp32", "dfplayer", "speaker", "power", "hatch"];
  const byId = id => parts.find(p => p.id === id);

  /* ---------- wiring ---------- */
  const W = [
    { id: "coin", name: "COIN → GPIO27", note: "1k–2.2k series, 10k to 3.3 V", c: 0xf2efe6, r: 1.1, a: ["mech", [24, -30, -15]], b: ["esp32", [2, -18, -10]], bead: true },
    { id: "v12", name: "12 V → CH-926", note: "red, mech only", c: 0xc23a2e, r: 1.1, a: ["mech", [30, -30, -15]], b: ["power", [-30, -4, 6]] },
    { id: "gnd", name: "Common ground", note: "black, all rails", c: 0x2a2a2a, r: 1.1, a: ["mech", [27, -30, -15]], b: ["power", [-26, -4, 6]], extra: [["power", [27, -3, 6], "esp32", [2, -22, 6]]] },
    { id: "count", name: "COUNTER", note: "grey, unused, capped", c: 0x8a8f8c, r: 1.1, a: ["mech", [33, -30, -15]], b: ["mech", [48, -46, -28]], cap: true },
    { id: "v5", name: "5 V logic supply", note: "ESP32 + DFPlayer", c: 0xe0563f, r: .9, a: ["power", [30, -3, 6]], b: ["esp32", [2, -25, 0]], extra: [["power", [33, -3, 6], "dfplayer", [-1.5, 8, 8]]] },
    { id: "tx", name: "TX2 → DFPlayer RX", note: "1k series", c: 0xd9a441, r: .8, a: ["esp32", [2, 20, 8]], b: ["dfplayer", [-1.5, 6, -8]], bead: true },
    { id: "rx", name: "RX2 ← DFPlayer TX", note: "serial return", c: 0x9fd8c0, r: .8, a: ["esp32", [2, 16, 8]], b: ["dfplayer", [-1.5, 3, -8]] },
    { id: "busy", name: "BUSY → GPIO26", note: "low while playing", c: 0x6bf27a, r: .8, a: ["esp32", [2, 12, 8]], b: ["dfplayer", [-1.5, 0, -8]] },
    { id: "spk", name: "DFPlayer → speaker", note: "SPK_1 / SPK_2", c: 0xb48ad9, r: .8, a: ["dfplayer", [-1.5, -8, 6]], b: ["speaker", [4, 0, -6]], extra: [["dfplayer", [-1.5, -8, 9], "speaker", [-4, 0, -6]]] }
  ];
  const wireGroup = new THREE.Group(); scene.add(wireGroup);
  const wp = (id, v) => byId(id).obj.localToWorld(V(v[0], v[1], v[2]));
  function curve(a, b) {
    const m1 = a.clone().lerp(b, .33), m2 = a.clone().lerp(b, .66);
    m1.x *= .8; m2.x *= .8; m1.z += (-50 - m1.z) * .25; m2.z += (-50 - m2.z) * .25; m1.y -= 6; m2.y -= 6;
    return new THREE.CatmullRomCurve3([a, m1, m2, b]);
  }
  W.forEach(w => {
    w.mat = M(w.c, { roughness: .5, emissive: 0x000000, transparent: true });
    w.runs = [[w.a[0], w.a[1], w.b[0], w.b[1]]].concat(w.extra || []);
    w.meshes = w.runs.map(() => { const m = new THREE.Mesh(new THREE.BufferGeometry(), w.mat); wireGroup.add(m); return m; });
    if (w.bead) { w.beadMesh = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 7, 12), M(0xd9a441, { metalness: .3, transparent: true })); wireGroup.add(w.beadMesh); }
    if (w.cap) { w.capMesh = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 10), M(0xd9a441, { transparent: true })); wireGroup.add(w.capMesh); }
  });
  function buildWires() {
    scene.updateMatrixWorld(true);
    W.forEach(w => w.runs.forEach((r, i) => {
      const a = wp(r[0], r[1]), b = wp(r[2], r[3]), cv = curve(a, b);
      w.meshes[i].geometry.dispose(); w.meshes[i].geometry = new THREE.TubeGeometry(cv, 40, w.r, 6, false);
      if (i === 0) { if (w.beadMesh) { w.beadMesh.position.copy(cv.getPoint(.82)); w.beadMesh.quaternion.setFromUnitVectors(V(0, 1, 0), cv.getTangent(.82)); } if (w.capMesh) w.capMesh.position.copy(b); }
    }));
  }

  /* ---------- explode ---------- */
  let ex = 0, exTween = null;
  function applyExplode() { parts.forEach(p => p.obj.position.copy(p.obj.userData.home).addScaledVector(p.obj.userData.ex, ex)); buildWires(); $("exOut").textContent = Math.round(ex * 100) + "%"; $("explode").value = Math.round(ex * 100); }
  $("explode").addEventListener("input", e => { exTween = null; ex = +e.target.value / 100; applyExplode(); });
  const tweenEx = to => { exTween = { from: ex, to, s: performance.now() }; };
  $("assembleBtn").onclick = () => tweenEx(0);
  $("explodeBtn").onclick = () => tweenEx(1);

  /* ---------- solid / x-ray ---------- */
  let xray = false;
  function applyShade() {
    shellMats.forEach(m => { m.transparent = xray; m.opacity = xray ? (m === faceMat ? .32 : .14) : 1; m.depthWrite = !xray; m.needsUpdate = true; });
    edgeMat.opacity = xray ? .5 : 0;
    $("mSolid").setAttribute("aria-pressed", !xray); $("mXray").setAttribute("aria-pressed", xray);
  }
  $("mSolid").onclick = () => { xray = false; applyShade(); };
  $("mXray").onclick = () => { xray = true; applyShade(); };

  /* ---------- layers ---------- */
  const layerOn = { shell: true, internals: true, wiring: true, labels: window.innerWidth >= 600 };
  if (!layerOn.labels) document.querySelector('[data-layer="labels"]').checked = false;
  function applyLayers() {
    parts.forEach(p => { p.obj.visible = layerOn[p.layer]; });
    wireGroup.visible = layerOn.wiring;
    labels.forEach(l => { if (!layerOn.labels || !byId(l.id).obj.visible) l.el.hidden = true; });
  }
  document.querySelectorAll("[data-layer]").forEach(cb => cb.addEventListener("change", () => { layerOn[cb.dataset.layer] = cb.checked; applyLayers(); }));

  /* ---------- labels ---------- */
  const labels = ORDER.map(id => {
    const el = document.createElement("div"); el.className = "lbl" + (INFO[id].flag ? " flag" : "");
    el.innerHTML = "<b></b><span></span>"; el.querySelector("b").textContent = INFO[id].n; el.querySelector("span").textContent = INFO[id].name;
    stage.appendChild(el); return { id, el };
  });
  const tv = new THREE.Vector3();
  function placeLabels() {
    const w = stage.clientWidth, h = stage.clientHeight;
    labels.forEach(l => {
      const o = byId(l.id).obj;
      if (!layerOn.labels || !o.visible) { l.el.hidden = true; return; }
      o.getWorldPosition(tv); const off = INFO[l.id].lbl; tv.x += off[0]; tv.y += off[1]; tv.z += off[2];
      tv.project(camera);
      if (tv.z > 1) { l.el.hidden = true; return; }
      l.el.hidden = false; l.el.style.left = ((tv.x + 1) / 2 * w) + "px"; l.el.style.top = ((1 - tv.y) / 2 * h) + "px";
    });
    // nudge overlapping labels apart, top to bottom
    const shown = labels.filter(l => !l.el.hidden).map(l => ({ l, x: parseFloat(l.el.style.left), y: parseFloat(l.el.style.top), w: l.el.offsetWidth, h: l.el.offsetHeight + 4 })).sort((a, b) => a.y - b.y);
    for (let i = 0; i < shown.length; i++) for (let j = 0; j < i; j++) {
      const a = shown[j], b = shown[i];
      if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < a.h) { b.y = a.y + a.h; b.l.el.style.top = b.y + "px"; }
    }
  }

  /* ---------- selection, parts list, focus ---------- */
  let selected = null;
  const plist = $("plist");
  ORDER.forEach(id => { const b = document.createElement("button"); b.type = "button"; b.dataset.id = id; b.setAttribute("aria-pressed", "false"); b.innerHTML = "<i></i><span></span>"; b.querySelector("i").textContent = INFO[id].n; b.querySelector("span").textContent = INFO[id].name; b.onclick = () => select(id); plist.appendChild(b); });
  function select(id) {
    selected = id; const I = INFO[id];
    $("dKick").textContent = I.n + " · " + I.k; $("dTitle").textContent = I.name; $("dText").textContent = I.t; $("focusBtn").disabled = false;
    plist.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.id === id));
    labels.forEach(l => l.el.classList.toggle("sel", l.id === id));
    showTab("parts");
  }
  let camTween = null;
  function flyTo(pos, target) { const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; if (reduce) { camera.position.copy(pos); controls.target.copy(target); return; } camTween = { p0: camera.position.clone(), t0: controls.target.clone(), p: pos, t: target, s: performance.now() }; }
  $("focusBtn").onclick = () => {
    if (!selected) return; const o = byId(selected).obj; const t = new THREE.Vector3(); o.getWorldPosition(t);
    const dir = camera.position.clone().sub(controls.target).normalize(); flyTo(t.clone().addScaledVector(dir, 300), t);
  };
  const VIEWS = { iso: [V(430, 330, 560), V(0, 125, 0)], front: [V(0, 140, 760), V(0, 130, 0)], side: [V(760, 150, 0), V(0, 125, 0)], rear: [V(0, 170, -760), V(0, 120, 0)] };
  document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => { document.querySelectorAll("[data-view]").forEach(x => x.setAttribute("aria-pressed", x === b)); flyTo(VIEWS[b.dataset.view][0].clone(), VIEWS[b.dataset.view][1].clone()); });
  camera.position.copy(VIEWS.iso[0]);

  // tap to pick
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera);
    const objs = parts.filter(p => p.obj.visible).map(p => p.obj);
    let hits = ray.intersectObjects(objs, true).filter(h => h.object.isMesh);
    if (!hits.length) return;
    const rootOf = o => { while (o && !(o.userData && o.userData.id)) o = o.parent; return o; };
    if (xray) { const inner = hits.find(h => byId(rootOf(h.object).userData.id).layer !== "shell"); if (inner) hits = [inner]; }
    const id = rootOf(hits[0].object).userData.id;
    select(INFO[id] ? id : (["left", "right", "top", "floor", "back"].includes(id) ? "front" : id));
  });

  /* ---------- wiring list ---------- */
  let isolated = null;
  const wlist = $("wlist");
  W.forEach(w => {
    const b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-pressed", "false");
    b.innerHTML = '<i class="sw"></i><span class="wn"></span><small></small>';
    b.querySelector(".sw").style.background = "#" + w.c.toString(16).padStart(6, "0");
    b.querySelector(".wn").textContent = w.name; b.querySelector("small").textContent = w.note;
    b.onclick = () => { isolated = isolated === w.id ? null : w.id; applyIsolate(); }; w.btn = b; wlist.appendChild(b);
  });
  function applyIsolate() {
    W.forEach(w => {
      const on = !isolated || isolated === w.id;
      w.mat.opacity = on ? 1 : .08; if (w.beadMesh) w.beadMesh.material.opacity = on ? 1 : .08; if (w.capMesh) w.capMesh.material.opacity = on ? 1 : .08;
      w.btn.setAttribute("aria-pressed", isolated === w.id);
    });
    if (isolated && !xray) { xray = true; applyShade(); }
  }

  /* ---------- tabs ---------- */
  const TABS = ["parts", "wiring", "setup", "jack"];
  function showTab(n) { TABS.forEach(t => { const on = t === n; $("t-" + t).setAttribute("aria-selected", on); $("t-" + t).tabIndex = on ? 0 : -1; $("p-" + t).hidden = !on; }); }
  TABS.forEach((t, i) => {
    $("t-" + t).onclick = () => showTab(t);
    $("t-" + t).addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const n = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length]; showTab(n); $("t-" + n).focus(); } });
  });

  /* ---------- build sheet ---------- */
  const sheet = $("sheet");
  $("sheetBtn").onclick = () => { if (sheet.showModal) sheet.showModal(); else sheet.setAttribute("open", ""); };
  $("sheetClose").onclick = () => { if (sheet.close) sheet.close(); else sheet.removeAttribute("open"); };

  /* ---------- Jack and his voice ---------- */
  const jack = window.createJack($("jackStage"), $("jackTicket"));
  let muted = false;
  const muteBtn = $("muteBtn");
  muteBtn.onclick = () => { muted = !muted; muteBtn.setAttribute("aria-pressed", muted); muteBtn.textContent = muted ? "Sound off" : "Sound on"; if (muted && window.speechSynthesis) speechSynthesis.cancel(); };
  const pad = n => String(n).padStart(4, "0");
  const lineList = $("lineList");
  CFG.lines.forEach((ln, i) => {
    const b = document.createElement("button"); b.type = "button"; b.innerHTML = "<i></i><span></span>";
    b.querySelector("i").textContent = pad(i + 1); b.querySelector("span").textContent = ln.text.replace(/\[[a-z-]+\]\s*/g, "");
    b.onclick = () => { if (!busy) speakLine(i); }; lineList.appendChild(b);
  });
  if (CFG.lines.some(l => l.audio)) $("voiceNote").textContent = "Lines with a recording play it; the rest use this device's built-in voice.";

  let voice = null;
  function pickVoice() {
    if (!window.speechSynthesis) return;
    const vs = speechSynthesis.getVoices(), lang = (CFG.voice && CFG.voice.lang) || "en-GB";
    voice = vs.find(v => v.lang === lang && /male|daniel|arthur|george|oliver/i.test(v.name)) || vs.find(v => v.lang === lang) || vs.find(v => v.lang && v.lang.startsWith("en")) || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  let actx = null;
  function playRecording(ln, text) {
    return new Promise(resolve => {
      const a = new Audio(ln.audio); a.preload = "auto";
      let done = false; const finish = () => { if (!done) { done = true; resolve(true); } };
      a.addEventListener("error", () => resolve(false), { once: true });
      a.addEventListener("loadedmetadata", () => {
        a.play().then(() => {
          try {
            actx = actx || new (window.AudioContext || window.webkitAudioContext)();
            const src = actx.createMediaElementSource(a), an = actx.createAnalyser(); an.fftSize = 512;
            src.connect(an); an.connect(actx.destination);
            const buf = new Uint8Array(an.fftSize);
            (function tick() { if (done) return; an.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; } jack.mouth(Math.min(1, Math.sqrt(s / buf.length) * 4)); requestAnimationFrame(tick); })();
          } catch (_) { /* no analyser: mouth falls back to text timing */ }
          const ended = new Promise(r => a.addEventListener("ended", r, { once: true }));
          jack.say(ln.text, { cps: Math.max(6, text.length / Math.max(a.duration || 3, 1)), levelDriven: true, until: ended }).then(finish);
        }).catch(() => resolve(false));
      }, { once: true });
    });
  }
  function speakSynth(ln, text) {
    return new Promise(resolve => {
      if (!window.speechSynthesis || muted) return resolve(false);
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice; u.lang = (voice && voice.lang) || CFG.voice.lang || "en-GB";
      u.rate = CFG.voice.rate || .95; u.pitch = CFG.voice.pitch || .85;
      let started = false, endRes; const ended = new Promise(r => { endRes = r; });
      u.onend = u.onerror = () => endRes();
      u.onstart = () => { started = true; jack.say(ln.text, { cps: 13.5 * (u.rate / .95), until: ended }).then(() => resolve(true)); };
      speechSynthesis.speak(u);
      setTimeout(() => { if (!started) { speechSynthesis.cancel(); resolve(false); } }, 1500);
    });
  }
  async function speakLine(i) {
    const ln = CFG.lines[i % CFG.lines.length], text = ln.text.replace(/\[[a-z-]+\]\s*/g, "");
    busy = true; setBusy(true);
    setStatus("Playing " + pad((i % CFG.lines.length) + 1) + ".mp3 · BUSY low");
    let ok = false;
    if (ln.audio && !muted) ok = await playRecording(ln, text);
    if (!ok) ok = await speakSynth(ln, text);
    if (!ok) await jack.say(ln.text, { cps: 15 });
    busy = false; setBusy(false);
    setStatus("BUSY high · " + boxed.length + " coin" + (boxed.length === 1 ? "" : "s") + " in the box · ready");
  }

  /* ---------- coin run ---------- */
  let busy = false, run = null, lineIdx = 0, pounds = 0;
  const boxed = [];
  const busyWire = W.find(w => w.id === "busy"), coinWire = W.find(w => w.id === "coin");
  function setStatus(t) { statusText.textContent = t; }
  function setBusy(b) { led.classList.toggle("busy", b); busyWire.mat.emissive.setHex(b ? 0x2f7a38 : 0); }
  function makeCoin() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(11.7, 11.7, 2.8, 12), M(0xc9a64a, { metalness: .85, roughness: .3 })));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 2.9, 32), M(0xc4c8c4, { metalness: .85, roughness: .3 })));
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    return g;
  }
  const dropBtn = $("dropBtn");
  dropBtn.onclick = () => {
    if (run) return;
    if (window.speechSynthesis && !muted && !busy) speechSynthesis.cancel(); // unlock speech on this tap
    if (actx && actx.state === "suspended") actx.resume();
    if (ex > .02) tweenEx(0);
    scene.updateMatrixWorld(true);
    const home = p => byId(p).obj.userData.home;
    const toW = (id, v) => { const o = byId(id).obj, save = o.position.clone(); o.position.copy(home(id)); o.updateMatrixWorld(true); const r = o.localToWorld(v); o.position.copy(save); o.updateMatrixWorld(true); return r; };
    const slot = toW("front", V(0, 86, 3));
    const n = boxed.length;
    const land = toW("coinbox", V((Math.random() - .5) * 70, -21.5 + Math.min(n, 14) * 2.9, (Math.random() - .5) * 36));
    const pts = [slot.clone().add(V(0, 30, 110)), slot.clone().add(V(0, 0, 8)), slot.clone().add(V(0, 0, -6)), toW("mech", V(0, 40, 40)), toW("mech", V(0, -56, 20)), toW("chute", V(0, 13, -L / 2)), toW("chute", V(0, 13, L / 2)), land];
    const dur = [700, 250, 300, 550, 350, 280, 700, 350];
    const coin = makeCoin(); coin.rotation.z = Math.PI / 2; coin.position.copy(pts[0]); scene.add(coin);
    run = { coin, pts, dur, seg: 0, s: performance.now() + (ex > .02 ? 600 : 0), pulsed: false };
    dropBtn.setAttribute("aria-busy", "true");
    if (!busy) { jack.state("listening"); jack.eyes("open"); }
    setStatus("Coin in · CH-926 validating");
  };
  function stepRun(now) {
    const r = run; if (now < r.s) return;
    let t = (now - r.s) / r.dur[r.seg];
    if (t >= 1) {
      r.seg++; r.s = now; t = 0;
      if (r.seg === 4 && !r.pulsed) { r.pulsed = true; pulse(); }
      if (r.seg >= r.pts.length - 1) { r.coin.position.copy(r.pts[r.pts.length - 1]); r.coin.rotation.set(0, Math.random() * 3, 0); boxed.push(r.coin); run = null; dropBtn.removeAttribute("aria-busy"); return; }
    }
    r.coin.position.lerpVectors(r.pts[r.seg], r.pts[r.seg + 1], r.seg === 0 ? t * (2 - t) : t);
    if (r.seg >= 5) r.coin.rotateY(.3);
  }
  function pulse() {
    coinWire.mat.emissive.setHex(0xd9a441); espLed.material.emissive.setHex(0x6bf27a);
    setTimeout(() => coinWire.mat.emissive.setHex(0), 140); setTimeout(() => espLed.material.emissive.setHex(0), 400);
    pounds++; $("tally").textContent = "£" + pounds + " received this visit";
    if (busy) { setStatus("1 pulse · £1 counted · BUSY low, so no new line"); jack.gesture("nod"); return; }
    jack.state("idle");
    speakLine(lineIdx++);
  }

  /* ---------- loop ---------- */
  function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(stage); resize();
  function frame(now) {
    if (exTween) { let k = Math.min(1, (now - exTween.s) / 600); k = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; ex = exTween.from + (exTween.to - exTween.from) * k; applyExplode(); if (k >= 1) exTween = null; }
    if (camTween) { let k = Math.min(1, (now - camTween.s) / 700); k = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; camera.position.lerpVectors(camTween.p0, camTween.p, k); controls.target.lerpVectors(camTween.t0, camTween.t, k); if (k >= 1) camTween = null; }
    if (run) stepRun(now);
    if (busy) { const s = 1 + Math.sin(now / 38) * .07; cone.scale.set(s, 1, s); } else cone.scale.set(1, 1, 1);
    controls.update(); renderer.render(scene, camera); placeLabels();
    requestAnimationFrame(frame);
  }
  applyShade(); applyExplode(); applyLayers(); requestAnimationFrame(frame);
  setTimeout(() => { if (!busy && !run) jack.say("Evening. [nod] Drop a pound in the slot.", { cps: 15 }); }, 900);
})();
