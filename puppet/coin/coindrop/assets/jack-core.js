/* Jack core — the one definition of Jack, shared by /coindrop and /puppet.
   Face: 9 x 9 punchcard, clipped corner, tall eyes, smile, red third eye.
   Palette from timetravellersguild.com: card #d9cb9e, ink #111214, red #c8203c.
   Exposes window.JackCore = { COLORS, CSS, MAP, buildFace, makeSpeaker, createJack, voice, stripTags }
   and window.createJack for older pages. Needs three.js r128 loaded first. */
(function () {
  const COLORS = { card: 0xd9cb9e, cardEdge: 0xbba977, cardBack: 0xcbbb8a, ink: 0x111214, red: 0xc8203c, brass: 0xc9a64a };
  const CSS = { card: "#d9cb9e", ink: "#111214", red: "#c8203c" };
  // c card · k punched hole · r red third eye · . clipped corner
  const MAP = ["ccccccc..", "ccccrccc.", "cckccckcc", "cckccckcc", "ccccccccc", "ckccccckc", "cckkkkkcc", "ccccccccc", "ccccccccc"];
  const MOUTH = ["5_1", "6_2", "6_3", "6_4", "6_5", "6_6", "5_7"];
  const SMILE = "1111111", SHUT = "0000000", SMALL = "0011100", MID = "0111110";
  const PATS = [MID, SMALL, SMILE, MID, "0010100", SMILE];
  const C = 10, T = 5;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const stripTags = s => String(s).replace(/\[[a-z-]+\]\s*/g, "");

  /* ---------- the face: a 90 x 90 card, pivot at its bottom centre ---------- */
  function buildFace() {
    const front = new THREE.MeshStandardMaterial({ color: COLORS.card, roughness: .85 });
    const edge = new THREE.MeshStandardMaterial({ color: COLORS.cardEdge, roughness: .9 });
    const back = new THREE.MeshStandardMaterial({ color: COLORS.cardBack, roughness: .9 });
    const redM = new THREE.MeshStandardMaterial({ color: COLORS.red, roughness: .5, emissive: 0x000000 });
    const mats = [edge, edge, edge, edge, front, back];
    const redMats = [edge, edge, edge, edge, redM, redM];
    const geo = new THREE.BoxGeometry(C, C, T);
    const root = new THREE.Group();
    const bottom = new THREE.Group(); root.add(bottom);
    const mid = new THREE.Group(); mid.position.y = 20; bottom.add(mid);
    const top = new THREE.Group(); top.position.y = 30; mid.add(top);
    const bandOf = r => r <= 3 ? [top, 50] : r <= 6 ? [mid, 20] : [bottom, 0];
    const plugs = { eye: {}, mouth: {} };
    let third = null;
    MAP.forEach((row, r) => row.split("").forEach((ch, c) => {
      if (ch === ".") return;
      const [band, base] = bandOf(r);
      const m = new THREE.Mesh(geo, ch === "r" ? redMats : mats);
      m.position.set((c - 4) * C, (8 - r) * C + C / 2 - base, 0); m.castShadow = true; band.add(m);
      if (ch === "r") third = m;
      if (ch === "k") { m.visible = false; (r >= 5 ? plugs.mouth : plugs.eye)[r + "_" + c] = m; }
    }));
    const cut = new THREE.Shape(); cut.moveTo(0, 0); cut.lineTo(C, 0); cut.lineTo(0, C); cut.lineTo(0, 0);
    [[25, 30], [35, 20]].forEach(([x, y]) => { const w = new THREE.Mesh(new THREE.ExtrudeGeometry(cut, { depth: T, bevelEnabled: false }), [front, edge]); w.position.set(x, y, -T / 2); top.add(w); });

    let eyesBase = "open", blinkUntil = 0, nextBlink = performance.now() + 2500;
    let thirdUntil = 0, nextThird = performance.now() + 1800;
    let mouthPattern = SMILE, level = 0, levelUntil = 0;
    const face = {
      root, bottom, mid, top, materials: { front, edge, back, redM },
      setMouth(p) { mouthPattern = p; },
      mouth(v) { level = Math.max(0, Math.min(1, +v || 0)); levelUntil = performance.now() + 160; },
      eyes(v) { if (v === "blink") blinkUntil = performance.now() + 140; else eyesBase = v; },
      get eyesBase() { return eyesBase; },
      // state: idle | listening | thinking | speaking ; eyesOverride for gestures like "unsure"
      update(now, state, eyesOverride) {
        let e = .18;
        if (state === "listening") e = .35 + .35 * Math.sin(now / 260);
        else if (state === "thinking") e = Math.random() < .5 ? .9 : .2;
        else if (state === "speaking") e = .45;
        redM.emissive.setRGB(.78 * e, .12 * e, .23 * e);
        if (now > nextThird) { thirdUntil = now + 170; nextThird = now + 3400 + Math.random() * 4200; }
        if (third) third.material = now < thirdUntil ? mats : redMats;
        const eyes = eyesOverride || eyesBase;
        if (eyesBase !== "shut" && now > nextBlink) { blinkUntil = now + 130; nextBlink = now + 2600 + Math.random() * 3600; }
        const shut = eyes === "shut" || now < blinkUntil, squint = eyes === "squint";
        for (const k in plugs.eye) plugs.eye[k].visible = shut || (squint && +k.split("_")[0] === 2);
        let pat = mouthPattern;
        if (now < levelUntil) pat = level < .12 ? SHUT : level < .35 ? SMALL : level < .65 ? MID : SMILE;
        MOUTH.forEach((k, i) => { plugs.mouth[k].visible = pat[i] === "0"; });
      }
    };
    return face;
  }

  /* ---------- speech ticket + lip timing ---------- */
  function makeSpeaker(face, ticket) {
    let token = 0, hide = 0, speaking = false;
    function say(text, opts = {}) {
      const tok = ++token, ms = 1000 / (opts.cps || 15), fromText = !opts.levelDriven;
      const parts = String(text).split(/\[([a-z-]+)\]/);
      return new Promise(async res => {
        clearTimeout(hide); ticket.textContent = ""; ticket.hidden = false; speaking = true;
        let shown = "";
        for (let i = 0; i < parts.length; i++) {
          if (tok !== token) return res();
          if (i % 2) { if (opts.onGesture) opts.onGesture(parts[i]); continue; }
          for (const ch of parts[i]) {
            if (tok !== token) return res();
            shown += ch; ticket.textContent = shown.replace(/\s+/g, " ").trim();
            if (fromText) {
              if (/[A-Za-z0-9]/.test(ch)) face.setMouth(PATS[Math.floor(Math.random() * PATS.length)]);
              else if (/[.,!?;:]/.test(ch)) { face.setMouth(SHUT); await sleep(ch === "," ? ms * 2.5 : ms * 5); continue; }
              else face.setMouth(SMALL);
            }
            await sleep(ms);
          }
        }
        if (opts.until) await opts.until;
        face.setMouth(SMILE); speaking = false;
        hide = setTimeout(() => { ticket.hidden = true; }, opts.hold || 2200);
        res();
      });
    }
    return { say, stop() { token++; speaking = false; face.setMouth(SMILE); ticket.hidden = true; }, get speaking() { return speaking; } };
  }

  /* ---------- device voice (speechSynthesis), shared settings ---------- */
  const voice = {
    pick(lang) {
      if (!window.speechSynthesis) return null;
      const vs = speechSynthesis.getVoices();
      return vs.find(v => v.lang === lang && /male|daniel|arthur|george|oliver/i.test(v.name)) || vs.find(v => v.lang === lang) || vs.find(v => v.lang && v.lang.startsWith("en")) || null;
    },
    // resolves to a Promise for the end of speech, or null if the device can't speak within 1.5 s
    speak(text, cfg = {}) {
      return new Promise(resolve => {
        if (!window.speechSynthesis) return resolve(null);
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(stripTags(text)), v = voice.pick(cfg.lang || "en-GB");
        if (v) u.voice = v; u.lang = (v && v.lang) || cfg.lang || "en-GB"; u.rate = cfg.rate || .95; u.pitch = cfg.pitch || .85;
        let started = false, endRes; const ended = new Promise(r => { endRes = r; });
        u.onend = u.onerror = () => endRes();
        u.onstart = () => { started = true; resolve(ended); };
        speechSynthesis.speak(u);
        setTimeout(() => { if (!started) { speechSynthesis.cancel(); resolve(null); } }, 1500);
      });
    }
  };
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};

  /* ---------- inset head puppet (used by /coindrop) ---------- */
  const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const bump = k => Math.sin(Math.PI * Math.min(Math.max(k, 0), 1));
  const holdShape = (k, a = .25, b = .75) => k < a ? ease(k / a) : k > b ? ease((1 - k) / (1 - b)) : 1;
  const G = {
    hop: { d: 620, f: (k, p) => { if (k < .18) p.mx -= .12 * bump(k / .18); else { const j = (k - .18) / .82; p.y += 26 * bump(j); p.mx += .06 * bump(j); } } },
    nod: { d: 800, f: (k, p) => { p.tx += .28 * Math.sin(k * Math.PI * 2) * bump(k); } },
    shake: { d: 900, f: (k, p) => { p.ty += .4 * Math.sin(k * Math.PI * 4) * bump(k); } },
    bow: { d: 1400, f: (k, p) => { const h = holdShape(k, .3, .65); p.mx += .38 * h; p.tx += .3 * h; } },
    "lean-left": { d: 1100, f: (k, p) => { const h = holdShape(k); p.rz += .16 * h; p.mz += .1 * h; } },
    "lean-right": { d: 1100, f: (k, p) => { const h = holdShape(k); p.rz -= .16 * h; p.mz -= .1 * h; } },
    flip: { d: 1000, f: (k, p) => { p.ry += Math.PI * 2 * ease(k); p.y += 10 * bump(k); } },
    unsure: { d: 1600, f: (k, p) => { const h = holdShape(k, .2, .8); p.tz += .2 * h; p.ty -= .12 * h; p.eyes = "squint"; } }
  };
  function createJack(stage, ticket) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    stage.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 2000); camera.position.set(28, 70, 230); camera.lookAt(0, 44, 0);
    scene.add(new THREE.HemisphereLight(0xefe7cf, 0x14171a, .6));
    const key = new THREE.DirectionalLight(0xfff1d6, .95); key.position.set(90, 200, 160); scene.add(key);
    const rim = new THREE.DirectionalLight(COLORS.red, .3); rim.position.set(-120, 80, -160); scene.add(rim);
    const face = buildFace(); scene.add(face.root);
    const speaker = makeSpeaker(face, ticket);
    let state = "idle", gestures = [], lastFrame = -1;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function gesture(name) { const g = G[name]; if (!g) return Promise.resolve(); return new Promise(res => gestures.push({ g, s: performance.now(), res })); }
    function pose(now) {
      const p = { y: 0, ry: 0, rz: 0, mx: 0, mz: 0, tx: 0, ty: 0, tz: 0, eyes: null };
      if (!reduce) { p.rz += Math.sin(now / 950) * .018; p.tx += Math.sin(now / 1300) * .025; }
      if (state === "listening") { p.mx += .07; p.tx += .04; p.ty += .18; }
      if (state === "thinking") { p.tz += .07; p.tx -= .06; }
      gestures = gestures.filter(a => { const k = (now - a.s) / a.g.d; if (k >= 1) { a.res(); return false; } a.g.f(k, p); return true; });
      face.root.position.y = p.y; face.root.rotation.set(0, p.ry, p.rz); face.mid.rotation.set(p.mx, 0, p.mz); face.top.rotation.set(p.tx, p.ty, p.tz);
      face.update(now, speaker.speaking ? "speaking" : state, p.eyes);
    }
    function resize() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(stage); resize();
    (function loop(now) { const f = Math.floor(now / 83); if (f !== lastFrame) { lastFrame = f; pose(now); renderer.render(scene, camera); } requestAnimationFrame(loop); })(performance.now());
    return {
      say: (t, o = {}) => speaker.say(t, Object.assign({ onGesture: gesture }, o)),
      gesture, mouth: v => face.mouth(v), eyes: v => face.eyes(v),
      state(s) { if (["idle", "listening", "thinking"].includes(s)) state = s; },
      stop() { speaker.stop(); gestures.forEach(g => g.res()); gestures = []; },
      get speaking() { return speaker.speaking; }
    };
  }

  window.JackCore = { COLORS, CSS, MAP, SMILE, SHUT, SMALL, MID, buildFace, makeSpeaker, createJack, voice, stripTags };
  window.createJack = createJack;
})();
