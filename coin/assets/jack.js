/* Jack's suit — the 9x9 punchcard puppet from /jack, as a reusable factory.
   createJack(stageEl, ticketEl) returns { say, mouth, gesture, state, eyes, stop }.
   Held frames at 12 fps, like the cube cards. */
(function () {
  const MAP = ["ccccccc..", "cccccccc.", "cckccckcc", "cckccckcc", "ccccccccc", "ckccccckc", "cckkkkkcc", "ccccccccc", "ccccccccc"];
  const C = 10, T = 5;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
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
  const MOUTH = ["5_1", "6_2", "6_3", "6_4", "6_5", "6_6", "5_7"];
  const SMILE = "1111111", SHUT = "0000000", SMALL = "0011100", MID = "0111110";
  const PATS = [MID, SMALL, SMILE, MID, "0010100", SMILE];

  window.createJack = function (stage, ticket) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    stage.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
    camera.position.set(28, 60, 290); camera.lookAt(0, 30, 0); /* a touch wider: arms and legs in frame */
    scene.add(new THREE.HemisphereLight(0xefe7cf, 0x14171a, .6));
    const key = new THREE.DirectionalLight(0xfff1d6, .95); key.position.set(90, 200, 160); scene.add(key);
    const rim = new THREE.DirectionalLight(0xc8203c, .3); rim.position.set(-120, 80, -160); scene.add(rim);

    const front = new THREE.MeshStandardMaterial({ color: 0xe3d5a8, roughness: .85 });
    const shine = new THREE.MeshStandardMaterial({ color: 0xfbf6e6, roughness: .5, emissive: 0x2a2618 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xc9b67e, roughness: .9 });
    const backM = new THREE.MeshStandardMaterial({ color: 0xd8c99a, roughness: .9 });
    const mats = [edge, edge, edge, edge, front, backM];
    const redM = new THREE.MeshStandardMaterial({ color: 0xc8203c, roughness: .6, emissive: 0x000000 });
    /* Guild sigil plate: the supplied sigil photo spans the card's back, one image across all plugs.
       Front (the face), edges and behaviour are unchanged. */
    const sigilTex = new THREE.TextureLoader().load("assets/jack-sigil.jpg");
    sigilTex.encoding = THREE.sRGBEncoding;
    const sigilM = new THREE.MeshStandardMaterial({ map: sigilTex, roughness: .9 });
    const geo = new THREE.BoxGeometry(C, C, T);

    const root = new THREE.Group(); scene.add(root);
    const bottom = new THREE.Group(); root.add(bottom);
    const mid = new THREE.Group(); mid.position.y = 20; bottom.add(mid);
    const top = new THREE.Group(); top.position.y = 30; mid.add(top);
    const bandOf = r => r <= 3 ? [top, 50] : r <= 6 ? [mid, 20] : [bottom, 0];
    const plugs = { eye: {}, mouth: {} };
    MAP.forEach((row, r) => row.split("").forEach((ch, c) => {
      if (ch === ".") return;
      const [band, base] = bandOf(r);
      const x = (c - 4) * C, y = (8 - r) * C + C / 2 - base;
      const g2 = geo.clone(); /* per-plug UVs: the -z faces together compose the sigil */
      const uv2 = g2.attributes.uv, pos2 = g2.attributes.position;
      for (let vi = 20; vi < 24; vi++) uv2.setXY(vi, 1 - (pos2.getX(vi) / C + c + .5) / 9, (pos2.getY(vi) / C + (8 - r) + .5) / 9);
      uv2.needsUpdate = true;
      const m = new THREE.Mesh(g2, ch === "r" ? [edge, edge, edge, edge, redM, sigilM] : ch === "w" ? [edge, edge, edge, edge, shine, sigilM] : [edge, edge, edge, edge, front, sigilM]);
      m.position.set(x, y, 0); band.add(m);
      if (ch === "k") { m.visible = false; if (r >= 5) plugs.mouth[r + "_" + c] = m; else plugs.eye[r + "_" + c] = m; }
    }));
    const cut = new THREE.Shape(); cut.moveTo(0, 0); cut.lineTo(C, 0); cut.lineTo(0, C); cut.lineTo(0, 0);
    [[25, 30], [35, 20]].forEach(([x, y]) => { const w = new THREE.Mesh(new THREE.ExtrudeGeometry(cut, { depth: T, bevelEnabled: false }), [front, edge]); w.position.set(x, y, -T / 2); top.add(w); });

    /* Arms and legs, same punched stock, so he can wave and stamp. Arms hang from the
       middle band (they swing with a bow); legs stand under the card. */
    const limb = (parent, x, y, n) => {
      const g = new THREE.Group(); g.position.set(x, y, 0); parent.add(g);
      for (let i = 0; i < n; i++) { const cube = new THREE.Mesh(geo, mats); cube.position.y = -C / 2 - i * C; g.add(cube); }
      return g;
    };
    const armL = limb(mid, -5.2 * C, 30, 5), armR = limb(mid, 5.2 * C, 30, 5);
    const legL = limb(root, -1.5 * C, 0, 3), legR = limb(root, 1.5 * C, 0, 3);
    armL.rotation.z = .18; armR.rotation.z = -.18;

    let backShown = false;
    let state = "idle", eyesBase = "open", blinkUntil = 0, nextBlink = performance.now() + 2500;
    let gestures = [], speaking = false, mouthPattern = SMILE, levelUntil = 0, level = 0, lastFrame = -1, sayToken = 0, ticketHide = 0;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    function gesture(name) { const g = G[name]; if (!g) return Promise.resolve(); return new Promise(res => gestures.push({ g, s: performance.now(), res })); }
    function pose(now) {
      const p = { y: 0, ry: 0, rz: 0, mx: 0, mz: 0, tx: 0, ty: 0, tz: 0, eyes: eyesBase };
      if (!reduce) { p.rz += Math.sin(now / 950) * .018; p.tx += Math.sin(now / 1300) * .025; }
      if (state === "listening") { p.mx += .07; p.tx += .04; p.ty += .18; }
      if (state === "thinking") { p.tz += .07; p.tx -= .06; }
      gestures = gestures.filter(a => { const k = (now - a.s) / a.g.d; if (k >= 1) { a.res(); return false; } a.g.f(k, p); return true; });
      root.position.y = p.y; root.rotation.set(0, p.ry + (backShown ? Math.PI : 0), p.rz); mid.rotation.set(p.mx, 0, p.mz); top.rotation.set(p.tx, p.ty, p.tz);
      const armSwing = reduce ? 0 : Math.sin(now / 700) * .06 + (speaking ? Math.sin(now / 260) * .2 : 0);
      armL.rotation.z = .18 + armSwing + p.y * .02; armR.rotation.z = -.18 - armSwing - p.y * .02; /* fling up on a hop */
      legL.rotation.x = Math.min(p.y, 20) * .012; legR.rotation.x = Math.min(p.y, 20) * .008;
      let e = 0;
      if (state === "listening") e = .35 + .35 * Math.sin(now / 260);
      else if (state === "thinking") e = Math.random() < .5 ? .9 : .2;
      else if (speaking) e = .3;
      redM.emissive.setRGB(.78 * e, .12 * e, .23 * e);
      if (eyesBase !== "shut" && now > nextBlink) { blinkUntil = now + 130; nextBlink = now + 2600 + Math.random() * 3600; }
      const shut = p.eyes === "shut" || now < blinkUntil, squint = p.eyes === "squint";
      for (const k in plugs.eye) plugs.eye[k].visible = shut || (squint && +k.split("_")[0] === 2);
      let pat = mouthPattern;
      if (now < levelUntil) pat = level < .12 ? SHUT : level < .35 ? SMALL : level < .65 ? MID : SMILE;
      MOUTH.forEach((k, i) => { plugs.mouth[k].visible = pat[i] === "0"; });
    }

    function say(text, opts = {}) {
      const tok = ++sayToken;
      const cps = opts.cps || 15, ms = 1000 / cps, lipFromText = !opts.levelDriven;
      const parts = String(text).split(/\[([a-z-]+)\]/);
      return new Promise(async res => {
        clearTimeout(ticketHide); ticket.textContent = "";
        ticket.hidden = !parts.some((s, i) => !(i % 2) && s.trim()); /* a gesture-only line ([bow]) shows no empty card */
        speaking = true;
        let shown = "";
        for (let i = 0; i < parts.length; i++) {
          if (tok !== sayToken) return res();
          if (i % 2) { gesture(parts[i]); continue; }
          for (const ch of parts[i]) {
            if (tok !== sayToken) return res();
            shown += ch; ticket.textContent = shown.replace(/\s+/g, " ").trim();
            if (lipFromText) {
              if (/[A-Za-z0-9]/.test(ch)) mouthPattern = PATS[Math.floor(Math.random() * PATS.length)];
              else if (/[.,!?;:]/.test(ch)) { mouthPattern = SHUT; await sleep(ch === "," ? ms * 2.5 : ms * 5); continue; }
              else mouthPattern = SMALL;
            }
            await sleep(ms);
          }
        }
        if (opts.until) await opts.until;
        mouthPattern = SMILE; speaking = false;
        ticketHide = setTimeout(() => { ticket.hidden = true; }, 2200);
        res();
      });
    }

    function resize() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(stage); resize();
    (function loop(now) { const f = Math.floor(now / 83); if (f !== lastFrame) { lastFrame = f; pose(now); renderer.render(scene, camera); } requestAnimationFrame(loop); })(performance.now());

    return {
      say, gesture,
      turn() { backShown = !backShown; return backShown; },
      mouth(v) { level = Math.max(0, Math.min(1, +v || 0)); levelUntil = performance.now() + 160; },
      state(s) { if (["idle", "listening", "thinking"].includes(s)) state = s; },
      eyes(v) { if (v === "blink") blinkUntil = performance.now() + 140; else eyesBase = v; },
      stop() { sayToken++; gestures.forEach(g => g.res()); gestures = []; speaking = false; mouthPattern = SMILE; ticket.hidden = true; },
      get speaking() { return speaking; }
    };
  };
})();
