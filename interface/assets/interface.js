/* INTERFACE .;. prompt to noise, then bend it.
   DSP stage grows out of the /toby/pads engine (TTG-49): same knobs,
   same limiter for a phone aux into an amp, more dimensions. */
(() => {
  "use strict";

  /* ---------- generation ---------- */
  const promptEl = document.getElementById("prompt");
  if (!promptEl) return; // gate page
  const secSel = document.getElementById("seconds");
  const goBtn = document.getElementById("go");
  const statusEl = document.getElementById("status");
  const quotaEl = document.getElementById("quota");
  const stage = document.getElementById("stage");
  const playBtn = document.getElementById("play");
  const clipnameEl = document.getElementById("clipname");
  const cliplistEl = document.getElementById("cliplist");

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
    statusEl.textContent = t || " ";
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
        say("made it — ~" + j.credits + " credits. " + j.left_today + " left today.");
        await loadClips();
        loadClip(j.id, prompt);
      }
    } catch (e) {
      say("network error", true);
    }
    goBtn.disabled = false;
  });

  async function loadClips() {
    try {
      const r = await fetch("clips.php");
      const j = await r.json();
      quotaEl.textContent = j.used_today + " of " + j.cap + " generations used today";
      cliplistEl.innerHTML = "";
      (j.clips || []).forEach(c => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = (c.mode === "music" ? "♪ " : "✸ ") + c.prompt;
        b.addEventListener("click", () => loadClip(c.id, c.prompt));
        const a = document.createElement("a");
        a.href = "serve.php?f=" + encodeURIComponent(c.id) + "&dl=1";
        a.textContent = "mp3";
        a.className = "dl";
        li.appendChild(b); li.appendChild(a);
        cliplistEl.appendChild(li);
      });
    } catch (e) {}
  }
  loadClips();

  /* ---------- audio graph ----------
     source(loop) -> drive -> lowpass(cut,res) -> tremolo -> dry + echo + hall -> master -> limiter */
  let actx = null, nodes = null, buf = null, src = null, playing = false;

  const K = {   // knob state, all 0..1
    rate: 0.5, cut: 1, res: 0.1, drive: 0,
    wobr: 0.25, wobd: 0, etime: 0.3, space: 0, hall: 0
  };
  const rateHz   = () => 0.25 * Math.pow(8, K.rate);          // .25x .. 2x
  const cutHz    = () => 120 * Math.pow(18000 / 120, K.cut);  // 120 .. 18k
  const resQ     = () => 0.5 + K.res * 11.5;                  // .5 .. 12
  const wobHz    = () => 0.1 * Math.pow(120, K.wobr);         // .1 .. 12 Hz
  const echoSec  = () => 0.05 + K.etime * 0.75;               // 50ms .. 800ms

  function shaperCurve(amount) {
    const n = 1024, curve = new Float32Array(n), k = amount * 50;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = amount <= 0 ? x : (1 + k) * x / (1 + k * Math.abs(x));
    }
    return curve;
  }

  function impulse(seconds, decay) {
    const len = Math.floor(actx.sampleRate * seconds);
    const ir = actx.createBuffer(2, len, actx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return ir;
  }

  function ensureCtx() {
    if (actx) { if (actx.state === "suspended") actx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    actx = new AC();

    const drive = actx.createWaveShaper();
    drive.oversample = "2x";
    const filt = actx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 18000; filt.Q.value = 0.6;
    const trem = actx.createGain(); trem.gain.value = 1;
    const lfo = actx.createOscillator(); lfo.frequency.value = 0;
    const lfoAmt = actx.createGain(); lfoAmt.gain.value = 0;
    lfo.connect(lfoAmt); lfoAmt.connect(trem.gain); lfo.start();

    const dry = actx.createGain(); dry.gain.value = 1;

    const echoSend = actx.createGain(); echoSend.gain.value = 0;
    const delay = actx.createDelay(1.5); delay.delayTime.value = echoSec();
    const fb = actx.createGain(); fb.gain.value = 0;
    const echoTone = actx.createBiquadFilter(); echoTone.type = "lowpass"; echoTone.frequency.value = 2400;
    delay.connect(fb); fb.connect(echoTone); echoTone.connect(delay);
    echoSend.connect(delay);

    const hallSend = actx.createGain(); hallSend.gain.value = 0;
    const conv = actx.createConvolver(); conv.buffer = impulse(2.2, 2.8);
    hallSend.connect(conv);

    const master = actx.createGain(); master.gain.value = 0.9;
    const limiter = actx.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.002; limiter.release.value = 0.18;

    drive.connect(filt); filt.connect(trem);
    trem.connect(dry); dry.connect(master);
    trem.connect(echoSend); delay.connect(master);
    trem.connect(hallSend); conv.connect(master);
    master.connect(limiter); limiter.connect(actx.destination);

    nodes = { drive, filt, trem, lfo, lfoAmt, dry, echoSend, delay, fb, echoTone, hallSend, conv, master };
    applyLive();
  }

  function applyLive() {
    if (!nodes) return;
    const t = actx.currentTime;
    nodes.filt.frequency.setTargetAtTime(cutHz(), t, 0.03);
    nodes.filt.Q.setTargetAtTime(resQ(), t, 0.03);
    nodes.drive.curve = shaperCurve(K.drive);
    nodes.lfo.frequency.setTargetAtTime(K.wobd > 0 ? wobHz() : 0, t, 0.05);
    nodes.lfoAmt.gain.setTargetAtTime(K.wobd * 0.6, t, 0.05);
    nodes.delay.delayTime.setTargetAtTime(echoSec(), t, 0.05);
    nodes.echoSend.gain.setTargetAtTime(K.space * 0.9, t, 0.05);
    nodes.fb.gain.setTargetAtTime(K.space * 0.72, t, 0.05);
    nodes.hallSend.gain.setTargetAtTime(K.hall * 0.85, t, 0.05);
    if (src) { try { src.playbackRate.setTargetAtTime(rateHz(), t, 0.03); } catch (e) {} }
  }

  async function loadClip(id, label) {
    ensureCtx();
    say("loading…");
    try {
      const r = await fetch("serve.php?f=" + encodeURIComponent(id));
      if (!r.ok) throw new Error("http " + r.status);
      const ab = await r.arrayBuffer();
      buf = await actx.decodeAudioData(ab);
      stop();
      stage.hidden = false;
      clipnameEl.textContent = label || "";
      say("loaded. press play, then bend it.");
      play();
    } catch (e) {
      say("could not load that clip", true);
    }
  }

  function play() {
    if (!buf || playing) return;
    ensureCtx();
    src = actx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = rateHz();
    src.connect(nodes.drive);
    src.start();
    playing = true;
    playBtn.innerHTML = "&#9632;";
    playBtn.classList.add("on");
  }
  function stop() {
    if (src) { try { src.stop(); } catch (e) {} try { src.disconnect(); } catch (e) {} src = null; }
    playing = false;
    playBtn.innerHTML = "&#9654;";
    playBtn.classList.remove("on");
  }
  playBtn.addEventListener("click", () => { playing ? stop() : play(); });

  /* ---------- XY pad elements (declared first: knobs reference them) ---------- */
  const xy = document.getElementById("xy");
  const xydot = document.getElementById("xydot");
  function xyFromKnobs() {
    xydot.style.left = (K.cut * 100) + "%";
    xydot.style.top = ((1 - K.rate) * 100) + "%";
  }

  /* ---------- knobs (same interaction as /toby: drag, wheel, arrows) ---------- */
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
  const knobsWrap = document.getElementById("knobs");
  const knobEls = {};
  KDEF.forEach(([key, label, def]) => {
    const w = document.createElement("div");
    w.className = "knobwrap"; w.dataset.knob = key;
    const el = document.createElement("div");
    el.className = "knob"; el.tabIndex = 0;
    el.setAttribute("role", "slider"); el.setAttribute("aria-label", label);
    const lab = document.createElement("span");
    lab.className = "klab"; lab.textContent = label;
    w.appendChild(el); w.appendChild(lab);
    knobsWrap.appendChild(w);
    knobEls[key] = el;
    K[key] = def;

    const draw = () => {
      el.style.setProperty("--ang", (-135 + K[key] * 270) + "deg");
      el.setAttribute("aria-valuenow", String(Math.round(K[key] * 100)));
    };
    const set = v => {
      K[key] = Math.min(1, Math.max(0, v));
      draw(); applyLive(); xyFromKnobs();
    };
    el._set = set;
    set(def);
    let drag = null;
    el.addEventListener("pointerdown", e => {
      e.preventDefault();
      drag = { y: e.clientY, v: K[key], id: e.pointerId };
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
      if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); set(K[key] + step); }
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); set(K[key] - step); }
    });
    el.addEventListener("wheel", e => { e.preventDefault(); set(K[key] - Math.sign(e.deltaY) * 0.06); }, { passive: false });
  });

  /* ---------- XY pad: x = filter, y = pitch (the multidimensional bit) ---------- */
  xyFromKnobs();
  let xyDrag = false;
  function xySet(e) {
    const r = xy.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    knobEls.cut._set(x);
    knobEls.rate._set(1 - y);
  }
  xy.addEventListener("pointerdown", e => {
    e.preventDefault(); xyDrag = true;
    try { xy.setPointerCapture(e.pointerId); } catch (err) {}
    xySet(e);
  });
  xy.addEventListener("pointermove", e => { if (xyDrag) xySet(e); });
  xy.addEventListener("pointerup", () => { xyDrag = false; });
  xy.addEventListener("pointercancel", () => { xyDrag = false; });

  /* iOS: resume on any touch anywhere */
  document.addEventListener("touchend", () => { if (actx && actx.state === "suspended") actx.resume(); }, { passive: true });
})();