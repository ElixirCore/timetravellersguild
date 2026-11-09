/* TTG-49 — 7 voices x 7 digits. Web Audio: pitch / filter / echo knobs, live. */
(() => {
  "use strict";

  const VOICES = [
    { key: "r0", name: "leda whisper", color: "#e0586c" },
    { key: "r1", name: "leda shout",   color: "#f07c5a" },
    { key: "r2", name: "gacrux",       color: "#f5a35c" },
    { key: "r3", name: "algenib",      color: "#9a5bd6" },
    { key: "r4", name: "zephyr",       color: "#5b8ef0" },
    { key: "r5", name: "orus",         color: "#4ec9b0" },
    { key: "r6", name: "charon",       color: "#c4508f" },
  ];
  const DIGITS = [
    { w: "zero",  g: "\u2205" },
    { w: "one",   g: "\u2022" },
    { w: "two",   g: "\u2194" },
    { w: "three", g: "\u25B3" },
    { w: "four",  g: "\u29D6" },
    { w: "five",  g: "\u25C7" },
    { w: "six",   g: "\u26D3" },
  ];
  const FILE = {
  "00": "3-pad-00.mp3",
  "01": "4-pad-01.mp3",
  "02": "5-pad-02.mp3",
  "03": "6-pad-03.mp3",
  "04": "7-pad-04.mp3",
  "05": "8-pad-05.mp3",
  "06": "9-pad-06.mp3",
  "10": "10-pad-10.mp3",
  "11": "11-pad-11.mp3",
  "12": "12-pad-12.mp3",
  "13": "19-pad-13.mp3",
  "14": "20-pad-14.mp3",
  "15": "21-pad-15.mp3",
  "16": "22-pad-16.mp3",
  "20": "23-pad-20.mp3",
  "21": "24-pad-21.mp3",
  "22": "25-pad-22.mp3",
  "23": "26-pad-23.mp3",
  "24": "27-pad-24.mp3",
  "25": "28-pad-25.mp3",
  "26": "29-pad-26.mp3",
  "30": "30-pad-30.mp3",
  "31": "31-pad-31.mp3",
  "32": "32-pad-32.mp3",
  "33": "33-pad-33.mp3",
  "34": "34-pad-34.mp3",
  "35": "35-pad-35.mp3",
  "36": "36-pad-36.mp3",
  "40": "37-pad-40.mp3",
  "41": "38-pad-41.mp3",
  "42": "39-pad-42.mp3",
  "43": "40-pad-43.mp3",
  "44": "41-pad-44.mp3",
  "45": "42-pad-45.mp3",
  "46": "43-pad-46.mp3",
  "50": "44-pad-50.mp3",
  "51": "45-pad-51.mp3",
  "52": "46-pad-52.mp3",
  "53": "47-pad-53.mp3",
  "54": "48-pad-54.mp3",
  "55": "49-pad-55.mp3",
  "56": "50-pad-56.mp3",
  "60": "51-pad-60.mp3",
  "61": "52-pad-61.mp3",
  "62": "53-pad-62.mp3",
  "63": "54-pad-63.mp3",
  "64": "55-pad-64.mp3",
  "65": "56-pad-65.mp3",
  "66": "57-pad-66.mp3"
};
  const SRC = (r, c) => `/toby/pads/m/${FILE[`${r}${c}`]}`;

  const grid = document.getElementById("grid");
  const gridhead = document.getElementById("gridhead");
  const rowlabels = document.getElementById("rowlabels");
  const lamp = document.getElementById("lamp");

  /* ----- column headers + row labels + pads ----- */
  DIGITS.forEach(d => {
    const s = document.createElement("span");
    s.innerHTML = `${d.g}<b>${d.w}</b>`;
    gridhead.appendChild(s);
  });
  VOICES.forEach(v => {
    const s = document.createElement("span");
    s.textContent = v.name;
    rowlabels.appendChild(s);
  });

  const pads = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const b = document.createElement("button");
      b.className = "pad";
      b.type = "button";
      b.style.setProperty("--rc", VOICES[r].color);
      b.setAttribute("aria-label", `${VOICES[r].name} ${DIGITS[c].w}`);
      b.innerHTML = `<span class="g">${DIGITS[c].g}</span>`;
      b.dataset.r = r; b.dataset.c = c;
      grid.appendChild(b);
      pads.push(b);
    }
  }

  /* ----- audio graph ----- */
  let actx = null, master = null, filterNode = null, delaySend = null, delayNode = null, fbNode = null;
  const buffers = new Map();      // "rc" -> AudioBuffer | Promise
  const liveSources = new Set();  // playing BufferSources (for live pitch)
  let fallbackAudio = null;       // no Web Audio: one <audio> at a time

  const knob = { pitch: 0.5, filter: 1, space: 0 };
  const pitchRate = () => 0.5 * Math.pow(4, knob.pitch);       // .5 .. 2, centre 1
  const filterHz = () => 220 * Math.pow(4096 / 220, knob.filter); // 220 .. 4096 exponential-ish, max open

  function ensureCtx() {
    if (actx) { if (actx.state === "suspended") actx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    actx = new AC();
    master = actx.createGain(); master.gain.value = 0.9;
    // limiter: keeps stacked pads clean out of a phone aux into an amp
    const limiter = actx.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.002; limiter.release.value = 0.18;
    limiter.connect(actx.destination);
    filterNode = actx.createBiquadFilter();
    filterNode.type = "lowpass"; filterNode.frequency.value = 18000; filterNode.Q.value = 0.6;
    // echo send: input -> delaySend -> delay -> fb loop -> master
    delaySend = actx.createGain(); delaySend.gain.value = 0;
    delayNode = actx.createDelay(1); delayNode.delayTime.value = 0.29;
    fbNode = actx.createGain(); fbNode.gain.value = 0;
    const echoTone = actx.createBiquadFilter(); echoTone.type = "lowpass"; echoTone.frequency.value = 2400;
    delayNode.connect(fbNode); fbNode.connect(echoTone); echoTone.connect(delayNode);
    delayNode.connect(master);
    delaySend.connect(delayNode);
    filterNode.connect(master);
    master.connect(limiter);
    lamp.classList.add("live");
    preload();
    return true;
  }

  function loadBuffer(key, url) {
    if (buffers.has(key)) return buffers.get(key);
    const p = fetch(url)
      .then(r => { if (!r.ok) throw new Error("http " + r.status); return r.arrayBuffer(); })
      .then(ab => actx.decodeAudioData(ab))
      .then(buf => { buffers.set(key, buf); return buf; })
      .catch(err => { buffers.delete(key); throw err; });
    buffers.set(key, p);
    return p;
  }

  function preload() {  // background-fill every sample once the ctx exists
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      loadBuffer(`${r}${c}`, SRC(r, c)).catch(() => {});
    }
  }

  function applyLive() {
    if (!actx) return;
    filterNode.frequency.setTargetAtTime(filterHz(), actx.currentTime, 0.03);
    delaySend.gain.setTargetAtTime(knob.space * 0.8, actx.currentTime, 0.05);
    fbNode.gain.setTargetAtTime(knob.space * 0.72, actx.currentTime, 0.05);
    const rate = pitchRate();
    liveSources.forEach(s => { try { s.playbackRate.setTargetAtTime(rate, actx.currentTime, 0.03); } catch (e) {} });
  }

  function hit(pad) {
    const r = pad.dataset.r, c = pad.dataset.c, key = r + c;
    pad.classList.add("hit");
    setTimeout(() => pad.classList.remove("hit"), 90);
    if (!ensureCtx()) {            // ancient browser: plain <audio>
      if (fallbackAudio) { fallbackAudio.pause(); }
      fallbackAudio = new Audio(SRC(r, c));
      fallbackAudio.play().catch(() => {});
      pad.classList.add("on");
      fallbackAudio.onended = () => pad.classList.remove("on");
      return;
    }
    const glow = on => pad.classList.toggle("on", on);
    const bufP = loadBuffer(key, SRC(+r, +c));
    Promise.resolve(bufP).then(buf => {
      const src = actx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = pitchRate();
      const g = actx.createGain(); g.gain.value = 1;
      src.connect(g);
      g.connect(filterNode);
      g.connect(delaySend);
      liveSources.add(src);
      glow(true);
      src.onended = () => { liveSources.delete(src); glow(false); };
      src.start();
    }).catch(() => {});
  }

  pads.forEach(p => {
    p.addEventListener("pointerdown", e => { e.preventDefault(); hit(p); });
  });

  /* ----- knobs (same interaction as /toby: drag, wheel, arrows) ----- */
  const KDEF = {
    pitch:  { el: null, def: 0.5 },
    filter: { el: null, def: 1 },
    space:  { el: null, def: 0 },
  };
  document.querySelectorAll(".knobwrap").forEach(w => {
    const kind = w.dataset.knob;
    const el = w.querySelector(".knob");
    KDEF[kind].el = el;
    const draw = () => {
      el.style.setProperty("--ang", (-135 + knob[kind] * 270) + "deg");
      el.setAttribute("aria-valuenow", String(Math.round(knob[kind] * 100)));
    };
    const set = v => {
      knob[kind] = Math.min(1, Math.max(0, v));
      draw();
      applyLive();
    };
    set(KDEF[kind].def);
    let drag = null;
    el.addEventListener("pointerdown", e => {
      e.preventDefault();
      drag = { y: e.clientY, v: knob[kind], id: e.pointerId };
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
      if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); set(knob[kind] + step); }
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); set(knob[kind] - step); }
    });
    el.addEventListener("wheel", e => { e.preventDefault(); set(knob[kind] - Math.sign(e.deltaY) * 0.06); }, { passive: false });
  });

  /* iOS: resume on any touch anywhere, just in case the first gesture was a knob */
  document.addEventListener("touchend", () => { if (actx && actx.state === "suspended") actx.resume(); }, { passive: true });
})();