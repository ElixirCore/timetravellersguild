/* The sephirot other than Tiferet. Each builder puts its controls onto its
   station; the controls are the instrument, and the lines drawn inside a
   station are its real signal path. */
import {
  state, save, zone, PEDAL_DEFS, TIME_STEPS, FIELD_PADS,
} from '../state.js';
import {
  C, THREE, ringGeo, circleGeo, mat, mesh, bar, textMesh, setText, setGlyph, hueColor,
} from './gl.js';
import { Knob, Button, pct } from './widgets.js';
import { glyphURL } from './glyphs.js';
import { ensureAudio, applyLevels, applyPedal, audioNow, levelOf, nodes } from '../audio/engine.js';
import {
  MAX_SEC, startSampling, stopSampling, isSampling, samplingSeconds,
  listSamples, sampleBlob, deleteSample, onSamples,
} from '../audio/samples.js';
import { nextInput, currentInput, inputCount, inputLevel, onInputChange, kindOf } from '../audio/input.js';
import {
  slots, live, stopAll, saveMix, exportMix, isExporting, getMixes, loadMix, removeMix,
  onTracks,
} from '../audio/tracks.js';
import {
  pressRec, pressStop, applyLoopFx, resyncLoopFx, resyncLoopOneX, looperStatus, speedToRate,
} from '../audio/looper.js';
import {
  armFieldListen, cancelFieldListen, fieldCaptureMode, peekInputLevel,
  setFieldCaptureCallbacks, setFieldAuto, thresholdLevel,
} from '../audio/field-capture.js';
import {
  auditionFieldPad, hasFieldPad, removeFieldPad, fieldPadHitAt,
} from '../audio/field-voice.js';

const TAU = Math.PI * 2;
export const PAD_HUES = [12, 36, 72, 120, 168, 210, 258, 300];

/* ═════════ KETER · the sound comes in: the sampler ═════════ */
export function buildKeter(st, app) {
  const cy = 0.35;
  let busy = false; // asking for the input
  /* the input level, round the REC button */
  const meterR = 1.2;
  mesh(ringGeo(meterR, meterR + 0.09, 0, TAU, 72), mat(C.line, 1), st.g, 1).position.y = cy;
  const meterMat = mat(C.ink, 0.8);
  const meter = mesh(ringGeo(meterR, meterR + 0.09, Math.PI / 2, 1e-4, 4), meterMat, st.g, 2);
  meter.position.y = cy;
  /* the take so far, of MAX_SEC, round the station */
  const timeR = 2.72;
  mesh(ringGeo(timeR, timeR + 0.05, 0, TAU, 96), mat(C.line, 1), st.g, 1);
  const timeMat = mat(C.bad, 0.9);
  const timeRing = mesh(ringGeo(timeR, timeR + 0.05, Math.PI / 2, 1e-4, 4), timeMat, st.g, 2);

  const rec = st.add(new Button(st.g, {
    x: 0, y: cy, r: 0.78, glyph: 'rec', color: C.bad,
    onTap: async () => {
      if (isSampling()) { stopSampling(); return; }
      if (busy) return;
      busy = true;
      app.say('mic…');
      const ok = await startSampling((take) => {
        if (!take) { app.say('nothing came in', true); return; }
        app.addClip(take.id, take.name, take.silent ? 'kept, but the input was silent: try the next input' : '');
      });
      busy = false;
      if (!ok) app.say('no input - allow the mic, or plug one in', true);
      else app.say(`recording ${currentInput()?.label || ''}`.trim());
    },
  }));

  const input = st.add(new Button(st.g, {
    x: 0, y: -1.85, r: 0.5, glyph: 'mic',
    onTap: async () => {
      if (isSampling()) return;
      try {
        await ensureAudio().resume();
        const dev = await nextInput();
        app.say(inputCount() > 1 ? `${dev?.label || 'input'} (${inputCount()} inputs)` : `${dev?.label || 'input'} - the only input`);
      } catch {
        app.say('no input - allow the mic, or plug one in', true);
      }
    },
  }));
  onInputChange((dev) => setGlyph(input.label, kindOf(dev)));

  const secLabel = textMesh(st.g, '', 0.28, C.dim);
  secLabel.position.set(0, -0.98, 0);

  let shown = 0;
  let t = 0;
  st.onUpdate((dt) => {
    t += dt;
    const lvl = inputLevel();
    shown += (lvl - shown) * Math.min(1, dt * 14);
    meter.geometry = ringGeo(meterR, meterR + 0.09, Math.PI / 2 - shown * TAU, Math.max(1e-4, Math.round(shown * 120) / 120 * TAU), 48);
    const on = isSampling();
    meterMat.color.set(on ? C.bad : C.ink);
    const f = on ? samplingSeconds() / MAX_SEC : 0;
    timeRing.geometry = ringGeo(timeR, timeR + 0.05, Math.PI / 2 - f * TAU, Math.max(1e-4, Math.round(f * 240) / 240 * TAU), 96);
    rec.setLit(on && Math.sin(t * 6) > -0.4, C.bad);
    setText(secLabel, on ? `${Math.floor(samplingSeconds())}s` : '');
  });

  return { recording: () => isSampling() };
}

/* ═════════ CHOKMAH · the sample library ═════════ */
export function buildChokmah(st, app) {
  const wrap = document.getElementById('library');
  const listEl = document.getElementById('cliplist');
  st.overlay(wrap, [-2.3, -2.3, 2.3, 2.3]);
  let samples = [];

  /* one bead per sample on the rim, so the overview shows the library's size */
  const beads = new THREE.Group();
  st.g.add(beads);
  function drawBeads() {
    beads.clear();
    const n = samples.length;
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 - (i / Math.max(n, 24)) * TAU;
      const m = mesh(circleGeo(0.07, 10), mat(samples[i].kind === 'aux' ? C.hot : C.ink, 0.7), beads, 2);
      m.position.set(Math.cos(a) * 2.85, Math.sin(a) * 2.85, 0);
    }
  }

  function iconButton(glyph, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dl';
    b.title = title;
    b.setAttribute('aria-label', title);
    const img = document.createElement('img');
    img.alt = '';
    img.src = glyphURL(glyph);
    b.appendChild(img);
    b.addEventListener('click', onClick);
    return b;
  }

  /* tap a sample to add it, ↓ for the wav, ✕ twice deletes it */
  function render() {
    listEl.innerHTML = '';
    samples.forEach((s) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'clip';
      b.textContent = `${s.name} · ${s.seconds.toFixed(1)}s`;
      b.addEventListener('click', () => app.addClip(s.id, s.name));
      const dl = iconButton('download', 'download wav', async () => {
        const blob = await sampleBlob(s.id);
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `sample-${s.name.replace(/[^\w]+/g, '-')}.wav`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      });
      let armed = null;
      const del = iconButton('remove', 'delete (tap twice)', () => {
        if (!armed) {
          del.classList.add('armed');
          armed = setTimeout(() => { del.classList.remove('armed'); armed = null; }, 2500);
          return;
        }
        clearTimeout(armed);
        deleteSample(s.id);
        app.say(`deleted ${s.name}`);
      });
      li.append(b, dl, del);
      listEl.appendChild(li);
    });
    if (!samples.length) {
      const li = document.createElement('li');
      li.className = 'hiddenrow';
      const img = document.createElement('img');
      img.alt = 'record at the crown';
      img.src = glyphURL('rec', '#7a8468');
      img.style.width = img.style.height = '2rem';
      li.appendChild(img);
      listEl.appendChild(li);
    }
  }

  async function load() {
    try {
      samples = await listSamples();
    } catch {
      samples = [];
      app.say('no storage for samples in this browser', true);
    }
    render();
    drawBeads();
  }
  onSamples(load);

  return { load };
}

/* ═════════ BINAH · FIELD TAP ═════════ */
export function buildBinah(st, app) {
  const pads = [];
  for (let k = 0; k < FIELD_PADS; k++) {
    const a = Math.PI / 2 - (k * TAU) / FIELD_PADS;
    pads.push(st.add(new Button(st.g, {
      x: Math.cos(a) * 2.4, y: Math.sin(a) * 2.4, r: 0.42, text: String(k + 1),
      onTap: () => {
        state.field.activePad = k;
        save();
        if (hasFieldPad(k)) auditionFieldPad(k);
      },
    })));
  }
  const meterR = 1.55;
  mesh(ringGeo(meterR, meterR + 0.09, 0, TAU, 72), mat(C.line, 1), st.g, 1);
  const meterMat = mat(C.ink, 0.8);
  const meter = mesh(ringGeo(meterR, meterR + 0.09, Math.PI / 2, 1e-4, 4), meterMat, st.g, 2);
  const gateTick = mesh(circleGeo(0.06, 10), mat(C.hot, 1), st.g, 3);
  { // v5's meter: the gate sits at 45% of the sweep
    const a = Math.PI / 2 - 0.45 * TAU;
    gateTick.position.set(Math.cos(a) * (meterR + 0.2), Math.sin(a) * (meterR + 0.2), 0);
  }

  const rec = st.add(new Button(st.g, {
    x: -0.6, y: 0.5, r: 0.42, glyph: 'rec', color: C.bad,
    onTap: async () => {
      if (fieldCaptureMode() !== 'idle') { cancelFieldListen(); return; }
      app.say('mic…');
      const ok = await armFieldListen(state.field.activePad);
      if (!ok) app.say('no mic', true);
    },
  }));
  const auto = st.add(new Button(st.g, {
    x: 0.6, y: 0.5, r: 0.42, glyph: 'auto',
    onTap: () => {
      state.field.auto = !state.field.auto;
      setFieldAuto(state.field.auto);
      save();
    },
  }));
  setFieldAuto(state.field.auto);
  st.add(new Knob(st.g, {
    x: -0.6, y: -0.45, r: 0.4, glyph: 'gate',
    get: () => state.field.threshold / 100,
    set: (v) => { state.field.threshold = v * 100; save(); },
  }));
  st.add(new Knob(st.g, {
    x: 0.6, y: -0.45, r: 0.4, glyph: 'vol',
    get: () => state.field.level / 100,
    set: (v) => { state.field.level = v * 100; applyLevels(); save(); },
  }));
  st.add(new Button(st.g, {
    x: 0, y: -1.2, r: 0.3, glyph: 'clear',
    onTap: async () => {
      cancelFieldListen();
      await removeFieldPad(state.field.activePad);
      app.say('cleared');
    },
  }));

  setFieldCaptureCallbacks((text) => app.say(text.toLowerCase(), text === 'NO MIC' || text === 'TOO QUIET'), () => {});

  let shown = 0;
  st.onUpdate((dt) => {
    const now = audioNow();
    pads.forEach((b, k) => {
      const has = hasFieldPad(k);
      const flash = now - fieldPadHitAt(k) < 0.12;
      b.setLit(has, hueColor(PAD_HUES[k], 0.55, flash ? 0.75 : 0.45));
      b.setRing(k === state.field.activePad ? C.hot : C.dim, 1);
    });
    const listening = fieldCaptureMode() !== 'idle';
    rec.setLit(listening, C.bad);
    auto.setLit(state.field.auto, C.hot);
    const lvl = peekInputLevel();
    const gate = thresholdLevel();
    const target = listening ? Math.min(1, (lvl / gate) * 0.45) : 0;
    shown += (target - shown) * Math.min(1, dt * 18);
    meter.geometry = ringGeo(meterR, meterR + 0.09, Math.PI / 2 - shown * TAU, Math.max(1e-4, Math.round(shown * 120) / 120 * TAU), 48);
    meterMat.color.set(lvl >= gate && listening ? C.hot : C.ink);
  });
}

/* ═════════ pedals: GEVURAH (DIRT, WAH) · CHESED (CHORUS, PHASER) · NETZACH (ECHO) · HOD (VERB) ═════════ */
function pedalFmt(def, key) {
  if (def.id === 'delay' && key === 'time') return (v) => TIME_STEPS[zone(v * 100, TIME_STEPS.length)];
  if (def.id === 'reverb' && key === 'size') return (v) => ['S', 'M', 'L'][zone(v * 100, 3)];
  return pct;
}

function pedalKnob(st, def, p, x, y, r) {
  return st.add(new Knob(st.g, {
    x, y, r, glyph: p.glyph, color: def.accent,
    detents: def.id === 'delay' && p.key === 'time' ? 4 : (def.id === 'reverb' && p.key === 'size' ? 3 : 0),
    get: () => state.pedals[def.id][p.key] / 100,
    set: (v) => { state.pedals[def.id][p.key] = v * 100; applyPedal(def.id); save(); },
    fmt: pedalFmt(def, p.key),
  }));
}

function stomp(st, def, x, y, r) {
  const b = st.add(new Button(st.g, {
    x, y, r, glyph: def.glyph, color: def.accent,
    onTap: () => {
      const cfg = state.pedals[def.id];
      cfg.on = !cfg.on;
      applyPedal(def.id);
      save();
    },
  }));
  return b;
}

/* two pedals side by side, signal running down the first and into the second */
export function buildPedalPair(st, ids) {
  const defs = ids.map((id) => PEDAL_DEFS.find((d) => d.id === id));
  const parts = defs.map((def, i) => {
    const x = i ? 1.25 : -1.25;
    const lineMat = mat(def.accent, 0.2);
    bar(st.g, x, 2.25, x, -2.35, 0.07, lineMat, 0);
    const knobs = def.params.map((p, j) => pedalKnob(st, def, p, x, 1.6 - j * 1.02, 0.42));
    const sw = stomp(st, def, x, -1.75, 0.55);
    return { def, lineMat, knobs, sw };
  });
  /* first pedal's output runs back up the middle into the second's input */
  const joinMat = mat(C.dim, 0.4);
  bar(st.g, -1.25, -2.35, 0, -2.35, 0.05, joinMat, 0);
  bar(st.g, 0, -2.35, 0, 2.25, 0.05, joinMat, 0);
  bar(st.g, 0, 2.25, 1.25, 2.25, 0.05, joinMat, 0);
  st.onUpdate(() => {
    for (const { def, lineMat, knobs, sw } of parts) {
      const on = state.pedals[def.id].on;
      const lv = on ? levelOf(nodes.meters?.pedals[def.id]) : 0;
      lineMat.opacity = on ? 0.35 + lv * 0.6 : 0.12;
      sw.setLit(on, def.accent);
      knobs.forEach((k) => k.render());
    }
  });
}

/* one pedal: three knobs round its footswitch */
export function buildPedalSingle(st, id) {
  const def = PEDAL_DEFS.find((d) => d.id === id);
  const lineMat = mat(def.accent, 0.2);
  mesh(ringGeo(1.4, 1.46, 0, TAU, 72), lineMat, st.g, 0);
  const angles = [150, 30, 270].map((d) => (d * Math.PI) / 180);
  const knobs = def.params.map((p, j) => pedalKnob(st, def, p, Math.cos(angles[j]) * 1.45, Math.sin(angles[j]) * 1.45, 0.5));
  const sw = stomp(st, def, 0, 0, 0.62);
  st.onUpdate(() => {
    const on = state.pedals[def.id].on;
    const lv = on ? levelOf(nodes.meters?.pedals[def.id]) : 0;
    lineMat.opacity = on ? 0.3 + lv * 0.65 : 0.12;
    sw.setLit(on, def.accent);
    knobs.forEach((k) => k.render());
  });
}

/* ═════════ YESOD · LOOPSMITH ═════════ */
export function buildYesod(st) {
  const ringR = 1.25;
  mesh(ringGeo(ringR, ringR + 0.1, 0, TAU, 72), mat(C.line, 1), st.g, 1);
  const runMat = mat(C.hot, 0.9);
  const run = mesh(ringGeo(ringR, ringR + 0.1, Math.PI / 2, 1e-4, 4), runMat, st.g, 2);
  const head = mesh(circleGeo(0.12, 12), mat(C.ink, 1), st.g, 3);
  let pressing = false;

  const recBtn = st.add(new Button(st.g, {
    x: -0.5, y: 0, r: 0.45, glyph: 'recdub', color: C.bad,
    onTap: async () => {
      if (pressing) return; // the recorder is still answering the last press
      pressing = true;
      try { ensureAudio(); await pressRec(); } finally { pressing = false; }
    },
  }));
  const stopBtn = st.add(new Button(st.g, {
    x: 0.5, y: 0, r: 0.45, glyph: 'stopclr', onTap: () => pressStop(),
  }));
  const d = 2.15 / Math.SQRT2;
  st.add(new Knob(st.g, {
    x: -d * 1.0, y: d, r: 0.45, glyph: 'vol',
    get: () => state.looper.level / 100,
    set: (v) => { state.looper.level = v * 100; applyLevels(); save(); },
  }));
  const speed = st.add(new Knob(st.g, {
    x: d, y: d, r: 0.45, glyph: 'loopspeed',
    get: () => state.looper.speed / 100,
    set: (v) => { state.looper.speed = v * 100; ensureAudio(); applyLoopFx(); save(); },
    fmt: (v) => `${(0.25 * (16 ** v)).toFixed(2)}×`,
  }));
  st.add(new Button(st.g, {
    x: 2.45, y: 0.15, r: 0.32, glyph: 'onex',
    onTap: () => { ensureAudio(); resyncLoopOneX(); speed.render(); save(); },
  }));
  st.add(new Knob(st.g, {
    x: d, y: -d, r: 0.45, glyph: 'glitch',
    get: () => state.looper.glitch / 100,
    set: (v) => { state.looper.glitch = v * 100; ensureAudio(); resyncLoopFx(); save(); },
  }));
  st.add(new Knob(st.g, {
    x: -d, y: -d, r: 0.45, glyph: 'crush',
    get: () => state.looper.crush / 100,
    set: (v) => { state.looper.crush = v * 100; ensureAudio(); applyLoopFx(); save(); },
  }));

  let t = 0;
  st.onUpdate((dt) => {
    t += dt;
    const s = looperStatus();
    const blink = Math.sin(t * 9) > 0;
    const color = { EMPTY: C.dim, ARMED: C.hot, REC: C.bad, LOOPING: C.hot, DUB: C.bad, STOPPED: C.dim }[s.st] ?? C.dim;
    runMat.color.set(color);
    const showPos = s.st === 'REC' || s.st === 'LOOPING' || s.st === 'DUB';
    const f = showPos ? s.pos : (s.st === 'STOPPED' ? 1 : 0);
    run.geometry = ringGeo(ringR, ringR + 0.1, Math.PI / 2 - f * TAU, Math.max(1e-4, Math.round(f * 160) / 160 * TAU), 64);
    runMat.opacity = s.st === 'ARMED' ? (blink ? 0.9 : 0.2) : 0.9;
    const a = Math.PI / 2 - f * TAU;
    head.position.set(Math.cos(a) * (ringR + 0.05), Math.sin(a) * (ringR + 0.05), 0);
    head.visible = showPos;
    recBtn.setLit(s.st === 'ARMED' ? blink : (s.st === 'REC' || s.st === 'DUB'), C.bad);
    stopBtn.setLit(s.st === 'LOOPING' || s.st === 'STOPPED', C.hot);
    speed.render();
  });
}

/* ═════════ MALKUTH · out ═════════ */
export function buildMalkuth(st, app) {
  st.add(new Button(st.g, { x: -1.35, y: 0.85, r: 0.55, glyph: 'stopall', onTap: () => stopAll() }));
  st.add(new Button(st.g, { x: 0, y: 0.85, r: 0.55, glyph: 'save', onTap: () => saveMix() }));
  const exp = st.add(new Button(st.g, { x: 1.35, y: 0.85, r: 0.55, glyph: 'export', onTap: () => exportMix() }));

  const outR = 2.5;
  mesh(ringGeo(outR, outR + 0.05, 0, TAU, 96), mat(C.line, 1), st.g, 1);
  const outMat = mat(C.ink, 0.8);
  const out = mesh(ringGeo(outR, outR + 0.05, Math.PI / 2, 1e-4, 4), outMat, st.g, 2);

  /* kept mixes: tap loads, hold removes (as /interface2's pills) */
  const beadGroup = new THREE.Group();
  st.g.add(beadGroup);
  let beads = [];
  let sig = '';
  function drawBeads() {
    const mixes = getMixes();
    const s = mixes.map((m) => m.name).join('|');
    if (s === sig) return;
    sig = s;
    beads.forEach((b) => { st.controls.splice(st.controls.indexOf(b), 1); });
    beadGroup.clear();
    beads = mixes.slice(0, 18).map((m, i) => {
      const row = Math.floor(i / 6);
      const inRow = Math.min(6, mixes.length - row * 6);
      const col = i % 6;
      return st.add(new Button(beadGroup, {
        x: (col - (inRow - 1) / 2) * 0.78, y: -0.4 - row * 0.74, r: 0.32, text: String(i + 1),
        onTap: () => loadMix(m),
        onHold: () => removeMix(i),
      }));
    });
  }
  drawBeads();
  onTracks(drawBeads);

  let shown = 0;
  let t = 0;
  st.onUpdate((dt) => {
    t += dt;
    const lv = levelOf(nodes.meters?.out);
    shown += (lv - shown) * Math.min(1, dt * 14);
    out.geometry = ringGeo(outR, outR + 0.05, Math.PI / 2 - shown * TAU, Math.max(1e-4, Math.round(shown * 160) / 160 * TAU), 64);
    exp.setLit(isExporting() && Math.sin(t * 6) > 0, C.hot);
  });
}
