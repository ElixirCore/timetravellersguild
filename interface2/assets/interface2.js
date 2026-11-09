/* INTERFACE2 .;. many noises, one machine.
   Multitrack: each clip becomes a layer with its own DSP chain,
   volume, mute/solo. Mix renders to a wav in-browser.
   DSP engine grows out of /toby/pads and /interface v1. */
(() => {
  "use strict";

  const promptEl = document.getElementById("prompt");
  if (!promptEl) return; // gate page
  const secSel = document.getElementById("seconds");
  const goBtn = document.getElementById("go");
  const statusEl = document.getElementById("status");
  const quotaEl = document.getElementById("quota");
  const tracksEl = document.getElementById("tracks");
  const emptyHint = document.getElementById("emptyhint");
  const cliplistEl = document.getElementById("cliplist");
  const mixesEl = document.getElementById("mixes");
  const MAXTRACKS = 8;

  /* ---------- generation (same deal as v1, same server caps) ---------- */
  const DURS = { music: [15, 30, 45, 60], sfx: [3, 5, 8, 12] };
  let mode = "music";

  function fillDurs() {
    secSel.innerHTML = "";
    DURS[mode].forEach(s => {
      const o = document.createElement("option");
      o.value = s; o.textContent = s + "s";
      secSel.appendChild(o);
    });
  }
  fillDurs();

  document.getElementById("mode-music").addEventListener("click", () => {
    mode = "music";
    document.getElementById("mode-music").classList.add("on");
    document.getElementById("mode-sfx").classList.remove("on");
    fillDurs();
  });
  document.getElementById("mode-sfx").addEventListener("click", () => {
    mode = "sfx";
    document.getElementById("mode-sfx").classList.add("on");
    document.getElementById("mode-music").classList.remove("on");
    fillDurs();
  });

  function say(t, bad) {
    statusEl.textContent = t || " ";
    statusEl.classList.toggle("bad", !!bad);
  }

  goBtn.addEventListener("click", async () => {
    const prompt = promptEl.value.trim();
    if (!prompt) { say("give it words first", true); return; }
    goBtn.disabled = true;
    say("making " + secSel.value + "s of " + mode + "… this takes up to a minute");
    try {
      const r = await fetch("generate.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, prompt, seconds: +secSel.value })
      });
      const j = await r.json();
      if (!j.ok) { say(j.error || ("failed " + r.status), true); }
      else {
        say("made it - ~" + j.credits + " credits. " + j.left_today + " left today.");
        await loadClips();
        addTrack(j.id, prompt);
      }
    } catch (e) {
      say("network error", true);
    }
    goBtn.disabled = false;
  });

  /* hiding a noise only removes it from this menu (this browser). The mp3 stays in the
     shared library, tracks already using it keep playing, saved mixes still load it. */
  const HIDKEY = "ttg_if2_hidden";
  let showHidden = false;
  function getHidden() {
    try { return JSON.parse(localStorage.getItem(HIDKEY)) || []; } catch (e) { return []; }
  }
  function setHidden(list) { localStorage.setItem(HIDKEY, JSON.stringify(list)); }
  let lastClips = [];

  async function loadClips() {
    try {
      const r = await fetch("clips.php");
      const j = await r.json();
      quotaEl.textContent = j.used_today + " of " + j.cap + " generations used today";
      lastClips = j.clips || [];
      renderClips();
    } catch (e) {}
  }

  function renderClips() {
    try {
      const hidden = getHidden();
      cliplistEl.innerHTML = "";
      const nHidden = lastClips.filter(c => hidden.indexOf(c.id) >= 0).length;
      lastClips.forEach(c => {
        const isHid = hidden.indexOf(c.id) >= 0;
        if (isHid && !showHidden) return;
        const li = document.createElement("li");
        if (isHid) li.style.opacity = "0.5";
        const b = document.createElement("button");
        b.type = "button";
        const plus = document.createElement("span");
        plus.className = "plus"; plus.textContent = "+";
        b.appendChild(plus);
        b.appendChild(document.createTextNode((c.mode === "music" ? "♪ " : "✸ ") + c.prompt));
        b.addEventListener("click", () => addTrack(c.id, c.prompt));
        const a = document.createElement("a");
        a.href = "serve.php?f=" + encodeURIComponent(c.id) + "&dl=1";
        a.textContent = "↓";
        a.className = "dl";
        a.title = "download mp3";
        const hb = document.createElement("button");
        hb.type = "button"; hb.className = "dl";
        hb.textContent = isHid ? "↺" : "✕";
        hb.title = isHid ? "put back in the menu" : "hide from the menu (keeps playing, stays saved)";
        hb.setAttribute("aria-label", hb.title);
        hb.addEventListener("click", () => {
          const h = getHidden();
          const i = h.indexOf(c.id);
          if (i >= 0) h.splice(i, 1); else h.push(c.id);
          setHidden(h);
          renderClips();
        });
        li.appendChild(b); li.appendChild(a); li.appendChild(hb);
        cliplistEl.appendChild(li);
      });
      if (nHidden || showHidden) {
        const li = document.createElement("li");
        const tb = document.createElement("button");
        tb.type = "button"; tb.className = "dl";
        tb.style.width = "auto"; tb.style.padding = "0 .8rem";
        tb.textContent = showHidden ? "hide the hidden again" : nHidden + " hidden · show";
        tb.addEventListener("click", () => { showHidden = !showHidden; renderClips(); });
        li.appendChild(tb);
        cliplistEl.appendChild(li);
      }
    } catch (e) {}
  }
  loadClips();

  /* ---------- shared audio ---------- */
  let actx = null, master = null, limiter = null;
  function ensureCtx() {
    if (actx) { if (actx.state === "suspended") actx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    actx = new AC();
    master = actx.createGain(); master.gain.value = 0.9;
    limiter = actx.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.002; limiter.release.value = 0.18;
    master.connect(limiter); limiter.connect(actx.destination);
  }
  document.addEventListener("touchend", () => { if (actx && actx.state === "suspended") actx.resume(); }, { passive: true });

  /* ---------- DSP helpers (same shapes as v1) ---------- */
  const rateHz  = K => 0.25 * Math.pow(8, K.rate);
  const cutHz   = K => 120 * Math.pow(18000 / 120, K.cut);
  const resQ    = K => 0.5 + K.res * 11.5;
  const wobHz   = K => 0.1 * Math.pow(120, K.wobr);
  const echoSec = K => 0.05 + K.etime * 0.75;

  function shaperCurve(amount) {
    const n = 1024, curve = new Float32Array(n), k = amount * 50;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = amount <= 0 ? x : (1 + k) * x / (1 + k * Math.abs(x));
    }
    return curve;
  }

  function impulse(ctx, seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return ir;
  }

  /* one chain per track: src -> drive -> filt -> trem -> dry/echo/hall -> vol -> mutesolo -> master */
  function buildChain(ctx, dest) {
    const drive = ctx.createWaveShaper(); drive.oversample = "2x";
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 18000; filt.Q.value = 0.6;
    const trem = ctx.createGain(); trem.gain.value = 1;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0;
    lfo.connect(lfoAmt); lfoAmt.connect(trem.gain); lfo.start();

    const dry = ctx.createGain(); dry.gain.value = 1;
    const echoSend = ctx.createGain(); echoSend.gain.value = 0;
    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.28;
    const fb = ctx.createGain(); fb.gain.value = 0;
    const echoTone = ctx.createBiquadFilter(); echoTone.type = "lowpass"; echoTone.frequency.value = 2400;
    delay.connect(fb); fb.connect(echoTone); echoTone.connect(delay);
    echoSend.connect(delay);
    const hallSend = ctx.createGain(); hallSend.gain.value = 0;
    const conv = ctx.createConvolver(); conv.buffer = impulse(ctx, 2.2, 2.8);
    hallSend.connect(conv);

    const vol = ctx.createGain(); vol.gain.value = 0.8;
    const ms = ctx.createGain(); ms.gain.value = 1;

    drive.connect(filt); filt.connect(trem);
    trem.connect(dry); dry.connect(vol);
    trem.connect(echoSend); delay.connect(vol);
    trem.connect(hallSend); conv.connect(vol);
    vol.connect(ms); ms.connect(dest);

    return { drive, filt, trem, lfo, lfoAmt, dry, echoSend, delay, fb, echoTone, hallSend, conv, vol, ms, input: drive };
  }

  function applyLive(t) {
    if (!t.nodes || !actx) return;
    const K = t.K, n = t.nodes, tm = actx.currentTime;
    n.filt.frequency.setTargetAtTime(cutHz(K), tm, 0.03);
    n.filt.Q.setTargetAtTime(resQ(K), tm, 0.03);
    n.drive.curve = shaperCurve(K.drive);
    n.lfo.frequency.setTargetAtTime(K.wobd > 0 ? wobHz(K) : 0, tm, 0.05);
    n.lfoAmt.gain.setTargetAtTime(K.wobd * 0.6, tm, 0.05);
    n.delay.delayTime.setTargetAtTime(echoSec(K), tm, 0.05);
    n.echoSend.gain.setTargetAtTime(K.space * 0.9, tm, 0.05);
    n.fb.gain.setTargetAtTime(K.space * 0.72, tm, 0.05);
    n.hallSend.gain.setTargetAtTime(K.hall * 0.85, tm, 0.05);
    n.vol.gain.setTargetAtTime(t.vol * t.vol * 1.2, tm, 0.03); // gentle square law
    if (t.src) { try { t.src.playbackRate.setTargetAtTime(rateHz(K), tm, 0.03); } catch (e) {} }
  }

  /* ---------- tracks ---------- */
  const tracks = [];

  const KDEF = [
    ["rate",  "pitch",  0.5],
    ["cut",   "filter", 1],
    ["res",   "reson",  0.1],
    ["drive", "drive",  0],
    ["wobr",  "wobrate",0.25],
    ["wobd",  "wobble", 0],
    ["etime", "echoLen",0.3],
    ["space", "echo",   0],
    ["hall",  "hall",   0]
  ];

  /* round knob widget; get/set 0..1 */
  function makeKnob(label, def, small, onSet) {
    const w = document.createElement("div");
    w.className = "knobwrap";
    const el = document.createElement("div");
    el.className = "knob" + (small ? " small" : "");
    el.tabIndex = 0;
    el.setAttribute("role", "slider"); el.setAttribute("aria-label", label);
    const lab = document.createElement("span");
    lab.className = "klab"; lab.textContent = label;
    w.appendChild(el); w.appendChild(lab);
    let v = def;
    const draw = () => {
      el.style.setProperty("--ang", (-135 + v * 270) + "deg");
      el.setAttribute("aria-valuenow", String(Math.round(v * 100)));
    };
    const set = nv => {
      v = Math.min(1, Math.max(0, nv));
      draw(); onSet(v);
    };
    draw(); onSet(v);
    let drag = null;
    el.addEventListener("pointerdown", e => {
      e.preventDefault();
      drag = { y: e.clientY, v: v, id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });
    el.addEventListener("pointermove", e => {
      if (!drag || e.pointerId !== drag.id) return;
      set(drag.v + (drag.y - e.clientY) / 140);
    });
    const end = () => { drag = null; };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("keydown", e => {
      const step = e.shiftKey ? 0.02 : 0.08;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); set(v + step); }
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); set(v - step); }
    });
    el.addEventListener("wheel", e => { e.preventDefault(); set(v - Math.sign(e.deltaY) * 0.06); }, { passive: false });
    return { wrap: w, set, get: () => v };
  }

  function audible(t) {
    const anySolo = tracks.some(x => x.solo);
    return anySolo ? t.solo : !t.mute;
  }
  function applyMuteSolo() {
    const tm = actx ? actx.currentTime : 0;
    tracks.forEach(t => {
      if (t.nodes) t.nodes.ms.gain.setTargetAtTime(audible(t) ? 1 : 0, tm, 0.02);
      t.els.mute.classList.toggle("on", t.mute);
      t.els.solo.classList.toggle("on", t.solo);
    });
  }

  async function addTrack(id, label, saved) {
    if (tracks.length >= MAXTRACKS) { say("eight tracks is plenty", true); return; }
    ensureCtx();
    say("loading " + (label || "clip") + "…");
    let buf;
    try {
      const r = await fetch("serve.php?f=" + encodeURIComponent(id));
      if (!r.ok) throw new Error("http " + r.status);
      const ab = await r.arrayBuffer();
      buf = await actx.decodeAudioData(ab);
    } catch (e) {
      say("could not load that clip", true);
      return;
    }

    const t = {
      id, label: label || id, buf,
      K: { rate: 0.5, cut: 1, res: 0.1, drive: 0, wobr: 0.25, wobd: 0, etime: 0.3, space: 0, hall: 0 },
      vol: 0.8, mute: false, solo: false, playing: false, src: null,
      ls: 0, le: 1, /* loop start/end as 0..1 of the clip; the clip itself is never cut */
      nodes: null, els: {}
    };
    if (saved) {
      Object.assign(t.K, saved.K || {});
      t.vol = saved.vol != null ? saved.vol : 0.8;
      t.mute = !!saved.mute; t.solo = !!saved.solo;
      if (typeof saved.ls === "number" && typeof saved.le === "number" && saved.le - saved.ls > 0) {
        t.ls = Math.min(1, Math.max(0, saved.ls)); t.le = Math.min(1, Math.max(0, saved.le));
      }
    }
    t.nodes = buildChain(actx, master);

    /* --- ui --- */
    const root = document.createElement("div");
    root.className = "track";
    const row = document.createElement("div");
    row.className = "trow";

    const play = document.createElement("button");
    play.type = "button"; play.className = "tplay"; play.innerHTML = "&#9654;";
    play.setAttribute("aria-label", "play or stop " + t.label);

    const mid = document.createElement("div");
    mid.className = "tmid";
    const name = document.createElement("span");
    name.className = "tname"; name.textContent = t.label;
    mid.appendChild(name);

    const btnrow = document.createElement("div");
    btnrow.className = "tknobs-row";

    const volKnob = makeKnob("vol", t.vol, true, v => { t.vol = v; applyLive(t); });
    t.volKnob = volKnob;

    const mkOrb = (cls, txt, aria) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "orb tbtn " + cls; b.textContent = txt;
      b.setAttribute("aria-label", aria + " " + t.label);
      return b;
    };
    const mute = mkOrb("tmute", "mute", "mute");
    const solo = mkOrb("tsolo", "solo", "solo");
    const bend = mkOrb("tbend", "bend", "show sound controls for");
    const kill = mkOrb("tkill", "×", "remove");

    btnrow.appendChild(volKnob.wrap);
    btnrow.appendChild(mute); btnrow.appendChild(solo);
    btnrow.appendChild(bend); btnrow.appendChild(kill);
    mid.appendChild(btnrow);

    row.appendChild(play); row.appendChild(mid);
    root.appendChild(row);

    /* dsp panel */
    const dsp = document.createElement("div");
    dsp.className = "tdsp"; dsp.hidden = true;
    const xywrap = document.createElement("div");
    xywrap.className = "xywrap";
    const xy = document.createElement("div");
    xy.className = "xy"; xy.tabIndex = 0;
    xy.setAttribute("role", "slider"); xy.setAttribute("aria-label", "filter and pitch dish");
    const xydot = document.createElement("div");
    xydot.className = "xydot";
    xy.appendChild(xydot);
    const xylab = document.createElement("p");
    xylab.className = "xylabel";
    xylab.textContent = "x filter · y pitch";
    xywrap.appendChild(xy); xywrap.appendChild(xylab);
    const knobsWrap = document.createElement("div");
    knobsWrap.className = "knobs";
    const knobEls = {};
    KDEF.forEach(([key, label2, def]) => {
      const k = makeKnob(label2, t.K[key], false, v => {
        t.K[key] = v; applyLive(t); xyFromKnobs();
      });
      knobEls[key] = k;
      knobsWrap.appendChild(k.wrap);
    });
    /* loop points: drag the two handles to choose which part of the clip repeats */
    const loopBox = document.createElement("div");
    loopBox.className = "loopbox";
    const loopStrip = document.createElement("div");
    loopStrip.className = "loopstrip"; loopStrip.tabIndex = 0;
    loopStrip.setAttribute("aria-label", "loop start and end for " + t.label);
    const wave = document.createElement("canvas");
    wave.className = "loopwave"; wave.width = 600; wave.height = 56;
    const loopShade = document.createElement("div"); loopShade.className = "loopshade";
    const hStart = document.createElement("div"); hStart.className = "loophandle start";
    const hEnd = document.createElement("div"); hEnd.className = "loophandle end";
    loopStrip.appendChild(wave); loopStrip.appendChild(loopShade);
    loopStrip.appendChild(hStart); loopStrip.appendChild(hEnd);
    const loopLab = document.createElement("p");
    loopLab.className = "looplabel";
    const loopReset = document.createElement("button");
    loopReset.type = "button"; loopReset.className = "orb tbtn looprst"; loopReset.textContent = "whole clip";
    loopBox.appendChild(loopStrip); loopBox.appendChild(loopLab); loopBox.appendChild(loopReset);
    dsp.appendChild(loopBox);

    (function drawWave() {
      const c = wave.getContext("2d"), W = wave.width, H = wave.height;
      const d = t.buf.getChannelData(0), step = Math.max(1, Math.floor(d.length / W));
      c.clearRect(0, 0, W, H);
      c.fillStyle = "rgba(255,255,255,.45)";
      for (let x = 0; x < W; x++) {
        let mx = 0;
        for (let i = x * step, e = Math.min(d.length, i + step); i < e; i += Math.max(1, step >> 4)) {
          const a = Math.abs(d[i]); if (a > mx) mx = a;
        }
        const h = Math.max(1, mx * H);
        c.fillRect(x, (H - h) / 2, 1, h);
      }
    })();

    const MINLOOP = 0.02; /* seconds */
    function loopApply() {
      const dur = t.buf.duration;
      hStart.style.left = (t.ls * 100) + "%";
      hEnd.style.left = (t.le * 100) + "%";
      loopShade.style.left = (t.ls * 100) + "%";
      loopShade.style.width = ((t.le - t.ls) * 100) + "%";
      loopLab.textContent = "loop " + (t.ls * dur).toFixed(2) + "s to " + (t.le * dur).toFixed(2) + "s";
      loopReset.hidden = !(t.ls > 0 || t.le < 1);
      if (t.src) {
        try {
          t.src.loopStart = t.ls * dur;
          t.src.loopEnd = t.le * dur;
        } catch (e) {}
      }
    }
    t.loopApply = loopApply;
    function loopFrom(e, which) {
      const r = loopStrip.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const gap = MINLOOP / t.buf.duration;
      if (which === "start") t.ls = Math.min(f, t.le - gap);
      else t.le = Math.max(f, t.ls + gap);
      t.ls = Math.max(0, t.ls); t.le = Math.min(1, t.le);
      loopApply();
    }
    let loopDrag = null;
    loopStrip.addEventListener("pointerdown", e => {
      e.preventDefault();
      const r = loopStrip.getBoundingClientRect();
      const f = (e.clientX - r.left) / r.width;
      loopDrag = Math.abs(f - t.ls) <= Math.abs(f - t.le) ? "start" : "end";
      try { loopStrip.setPointerCapture(e.pointerId); } catch (err) {}
      loopFrom(e, loopDrag);
    });
    loopStrip.addEventListener("pointermove", e => { if (loopDrag) loopFrom(e, loopDrag); });
    const loopEndDrag = () => { loopDrag = null; };
    loopStrip.addEventListener("pointerup", loopEndDrag);
    loopStrip.addEventListener("pointercancel", loopEndDrag);
    loopReset.addEventListener("click", () => { t.ls = 0; t.le = 1; loopApply(); });
    loopApply();

    dsp.appendChild(knobsWrap);

    dsp.appendChild(xywrap);
    root.appendChild(dsp);

    function xyFromKnobs() {
      xydot.style.left = (t.K.cut * 100) + "%";
      xydot.style.top = ((1 - t.K.rate) * 100) + "%";
    }
    xyFromKnobs();
    let xyDrag = false;
    function xySet(e) {
      const r = xy.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      knobEls.cut.set(x);
      knobEls.rate.set(1 - y);
    }
    xy.addEventListener("pointerdown", e => {
      e.preventDefault(); xyDrag = true;
      try { xy.setPointerCapture(e.pointerId); } catch (err) {}
      xySet(e);
    });
    xy.addEventListener("pointermove", e => { if (xyDrag) xySet(e); });
    xy.addEventListener("pointerup", () => { xyDrag = false; });
    xy.addEventListener("pointercancel", () => { xyDrag = false; });

    bend.addEventListener("click", () => {
      dsp.hidden = !dsp.hidden;
      bend.classList.toggle("on", !dsp.hidden);
    });
    mute.addEventListener("click", () => { t.mute = !t.mute; applyMuteSolo(); });
    solo.addEventListener("click", () => { t.solo = !t.solo; applyMuteSolo(); });
    kill.addEventListener("click", () => {
      stopTrack(t);
      try { t.nodes.ms.disconnect(); } catch (e) {}
      tracks.splice(tracks.indexOf(t), 1);
      root.remove();
      applyMuteSolo();
      emptyHint.style.display = tracks.length ? "none" : "";
    });

    function playTrack() {
      if (t.playing) return;
      ensureCtx();
      t.src = actx.createBufferSource();
      t.src.buffer = t.buf;
      t.src.loop = true;
      t.src.loopStart = t.ls * t.buf.duration;
      t.src.loopEnd = t.le * t.buf.duration;
      t.src.playbackRate.value = rateHz(t.K);
      t.src.connect(t.nodes.input);
      t.src.start(0, t.src.loopStart);
      t.playing = true;
      play.innerHTML = "&#9632;";
      play.classList.add("on");
    }
    function stopTrack(tt) {
      if (tt.src) { try { tt.src.stop(); } catch (e) {} try { tt.src.disconnect(); } catch (e) {} tt.src = null; }
      tt.playing = false;
      play.innerHTML = "&#9654;";
      play.classList.remove("on");
    }
    t.stopTrack = () => stopTrack(t);
    play.addEventListener("click", () => { t.playing ? stopTrack(t) : playTrack(); });

    t.els = { root, play, mute, solo };
    tracks.push(t);
    tracksEl.appendChild(root);
    emptyHint.style.display = "none";
    applyLive(t);
    applyMuteSolo();
    say("");
    playTrack(); // adding a noise starts it, like v1
  }

  document.getElementById("stopall").addEventListener("click", () => {
    tracks.forEach(t => t.stopTrack && t.stopTrack());
  });

  /* ---------- keep the mix, in-browser ---------- */
  const MIXKEY = "ttg_if2_mixes";
  function getMixes() {
    try { return JSON.parse(localStorage.getItem(MIXKEY)) || []; } catch (e) { return []; }
  }
  function renderMixes() {
    const mixes = getMixes();
    mixesEl.innerHTML = "";
    mixes.forEach((m, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "mixpill"; b.textContent = m.name;
      b.title = "load this mix (long press removes it)";
      let press = null;
      b.addEventListener("pointerdown", () => {
        press = setTimeout(() => {
          const ms = getMixes(); ms.splice(i, 1);
          localStorage.setItem(MIXKEY, JSON.stringify(ms));
          renderMixes();
        }, 900);
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev =>
        b.addEventListener(ev, () => { if (press) { clearTimeout(press); press = null; } }));
      b.addEventListener("click", () => loadMix(m));
      mixesEl.appendChild(b);
    });
  }
  renderMixes();

  document.getElementById("savemix").addEventListener("click", () => {
    if (!tracks.length) { say("nothing to keep yet", true); return; }
    const mixes = getMixes();
    const name = "mix " + (mixes.length + 1) + " · " + new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    mixes.push({
      name,
      tracks: tracks.map(t => ({ id: t.id, label: t.label, vol: t.vol, mute: t.mute, solo: t.solo, ls: t.ls, le: t.le, K: Object.assign({}, t.K) }))
    });
    localStorage.setItem(MIXKEY, JSON.stringify(mixes));
    renderMixes();
    say("kept as " + name);
  });

  async function loadMix(m) {
    tracks.slice().forEach(t => { t.els.root.querySelector(".tkill").click(); });
    for (const s of m.tracks) {
      await addTrack(s.id, s.label, s);
    }
    say(m.name + " loaded");
  }

  /* ---------- render the mix to a wav ---------- */
  function wavEncode(abuf) {
    const nCh = abuf.numberOfChannels, sr = abuf.sampleRate, len = abuf.length;
    const bytes = 44 + len * nCh * 2;
    const out = new DataView(new ArrayBuffer(bytes));
    const wstr = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    wstr(0, "RIFF"); out.setUint32(4, bytes - 8, true); wstr(8, "WAVE");
    wstr(12, "fmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
    out.setUint16(22, nCh, true); out.setUint32(24, sr, true);
    out.setUint32(28, sr * nCh * 2, true); out.setUint16(32, nCh * 2, true);
    out.setUint16(34, 16, true); wstr(36, "data"); out.setUint32(40, len * nCh * 2, true);
    let off = 44;
    const chans = [];
    for (let c = 0; c < nCh; c++) chans.push(abuf.getChannelData(c));
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < nCh; c++) {
        let s = Math.max(-1, Math.min(1, chans[c][i]));
        out.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        off += 2;
      }
    }
    return out.buffer;
  }

  document.getElementById("dlmix").addEventListener("click", async () => {
    const renderable = tracks.filter(t => t.buf && audible(t));
    if (!renderable.length) { say("nothing audible to render", true); return; }
    const btn = document.getElementById("dlmix");
    btn.disabled = true;
    say("rendering the mix…");
    try {
      let dur = 0;
      renderable.forEach(t => { dur = Math.max(dur, t.buf.duration * (t.le - t.ls) / rateHz(t.K)); });
      dur = Math.min(180, Math.max(2, dur));
      const sr = 44100;
      const OfflineAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const octx = new OfflineAC(2, Math.ceil(sr * dur), sr);
      const omaster = octx.createGain(); omaster.gain.value = 0.9;
      const olim = octx.createDynamicsCompressor();
      olim.threshold.value = -8; olim.knee.value = 0; olim.ratio.value = 20;
      olim.attack.value = 0.002; olim.release.value = 0.18;
      omaster.connect(olim); olim.connect(octx.destination);
      renderable.forEach(t => {
        const n = buildChain(octx, omaster);
        const K = t.K, tm = 0;
        n.filt.frequency.setValueAtTime(cutHz(K), tm);
        n.filt.Q.setValueAtTime(resQ(K), tm);
        n.drive.curve = shaperCurve(K.drive);
        n.lfo.frequency.setValueAtTime(K.wobd > 0 ? wobHz(K) : 0, tm);
        n.lfoAmt.gain.setValueAtTime(K.wobd * 0.6, tm);
        n.delay.delayTime.setValueAtTime(echoSec(K), tm);
        n.echoSend.gain.setValueAtTime(K.space * 0.9, tm);
        n.fb.gain.setValueAtTime(K.space * 0.72, tm);
        n.hallSend.gain.setValueAtTime(K.hall * 0.85, tm);
        n.vol.gain.setValueAtTime(t.vol * t.vol * 1.2, tm);
        n.ms.gain.setValueAtTime(1, tm);
        const s = octx.createBufferSource();
        s.buffer = t.buf; s.loop = true;
        s.loopStart = t.ls * t.buf.duration; s.loopEnd = t.le * t.buf.duration;
        s.playbackRate.setValueAtTime(rateHz(K), tm);
        s.connect(n.input);
        s.start(0, s.loopStart); s.stop(dur);
      });
      const rendered = await octx.startRendering();
      const blob = new Blob([wavEncode(rendered)], { type: "audio/wav" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "interface-mix-" + new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-") + ".wav";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      say("mix kept - " + Math.round(dur) + "s wav");
    } catch (e) {
      say("render failed: " + (e.message || e), true);
    }
    btn.disabled = false;
  });
})();