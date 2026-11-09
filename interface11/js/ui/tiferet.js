/* TIFERET · the heart: the /interface2 mixer inside a tesseract.
   Eight cells, eight tracks (the small cubes on the rim choose one).
   v9: round the cube, the chosen track's melody is a stack of discs of
   petals (discs.js) with a spinner that turns at the tempo; round those, its
   chain of knobs in signal order (pitch > drive > filter > reson > wobble
   rate > wobble > echo length > echo > hall > volume), and small controls
   on the rim. The sample itself is the thin ring at the middle, with its
   loop points. An empty cell is a record button: it takes one trip round the
   steps from the input, on the beat, and sequences it. */
import { C, THREE, ringGeo, circleGeo, mat, mesh, bar, hueColor, setGlyph } from './gl.js';
import { Control, Knob, Button, hud, hz, pct } from './widgets.js';
import { buildTesseract } from './tesseract.js';
import { MAX_TRACKS, state, save } from '../state.js';
import {
  slots, live, applyLive, toggleTrack, removeTrack, applyMuteSolo, setLoopPoint, resetLoop,
  advancePos, rateHz, cutHz, resQ, wobHz, echoSec, onTracks, noteActive,
} from '../audio/tracks.js';
import { levelOf, ensureAudio } from '../audio/engine.js';
import { PAD_HUES } from './stations.js';
import { buildDiscs, buildRim, rim, viewPattern } from './discs.js';
import { initInstrument } from '../audio/instrument.js';
import {
  seqToggle, seqPlaying, seqPosition, seqStart, seqStartTime, seqNextCycleStart, cellDur,
} from '../audio/seq.js';
import { SEQ_CELLS } from '../seqmodel.js';
import { scaleNotes, newCell, hasSteps, GATES } from '../pattern.js';
import { designSound, PRESETS } from '../audio/sounddesign.js';
import { prepareQuantised, startQuantised, cancelQuantised } from '../audio/samples.js';
import { scheduleClicks } from '../audio/click.js';

const TAU = Math.PI * 2;
const WAVE_IN = 0.48;
const WAVE_OUT = 0.8;
const fracToAngle = (f) => Math.PI / 2 - f * TAU;
const angleToFrac = (a) => ((((Math.PI / 2 - a) / TAU) % 1) + 1) % 1;

export const TRACK_COLORS = PAD_HUES.map((h) => hueColor(h, 0.62, 0.58));

const CHAIN = [
  ['rate', 'pitch', (K) => `${rateHz(K).toFixed(2)}×`],
  ['drive', 'bolt', (K) => pct(K.drive)],
  ['cut', 'cut', (K) => hz(cutHz(K))],
  ['res', 'res', (K) => `Q${resQ(K).toFixed(1)}`],
  ['wobr', 'wobr', (K) => `${wobHz(K).toFixed(1)}Hz`],
  ['wobd', 'wobd', (K) => pct(K.wobd)],
  ['etime', 'etime', (K) => `${Math.round(echoSec(K) * 1000)}ms`],
  ['space', 'echo', (K) => pct(K.space)],
  ['hall', 'hall', (K) => pct(K.hall)],
  ['vol', 'vol', null],
];

/* a polar waveform per clip, drawn once */
const waveTex = new WeakMap();
function waveTexture(buf) {
  if (waveTex.has(buf)) return waveTex.get(buf);
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const d = buf.getChannelData(0);
  const N = 200;
  const step = Math.max(1, Math.floor(d.length / N));
  const r0 = (WAVE_IN / WAVE_OUT) * (S / 2);
  const r1 = S / 2 - 2;
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.lineWidth = 3;
  c.lineCap = 'round';
  let peak = 0.0001;
  const bins = [];
  for (let b = 0; b < N; b++) {
    let mx = 0;
    for (let i = b * step, e = Math.min(d.length, i + step); i < e; i += Math.max(1, step >> 5)) {
      const a = Math.abs(d[i]); if (a > mx) mx = a;
    }
    bins.push(mx);
    peak = Math.max(peak, mx);
  }
  bins.forEach((mx, b) => {
    const a = fracToAngle((b + 0.5) / N);
    const h = Math.max(0.03, mx / peak);
    const ra = r0;
    const rb = r0 + (r1 - r0) * h;
    c.beginPath();
    c.moveTo(S / 2 + Math.cos(a) * ra, S / 2 - Math.sin(a) * ra);
    c.lineTo(S / 2 + Math.cos(a) * rb, S / 2 - Math.sin(a) * rb);
    c.stroke();
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  waveTex.set(buf, tex);
  return tex;
}

class WaveRing extends Control {
  constructor(parent, getTrack) {
    super(parent, 0, 0, WAVE_OUT);
    this.getTrack = getTrack;
  }

  hit(lx, ly) {
    const d = Math.hypot(lx, ly);
    return this.isLive() && d >= 0.42 && d <= WAVE_OUT + 0.22;
  }

  pick(lx, ly) {
    const t = this.getTrack();
    let f = angleToFrac(Math.atan2(ly, lx));
    const last = this.which === 'start' ? t.ls : t.le;
    if (Math.abs(f - last) > 0.5) f = last > 0.5 ? 1 : 0; // no jump across the top
    setLoopPoint(t, this.which, f);
    hud.readout('whole', `${(t.ls * t.buf.duration).toFixed(2)}–${(t.le * t.buf.duration).toFixed(2)}s`);
  }

  down(p) {
    const t = this.getTrack();
    const f = angleToFrac(Math.atan2(p.ly, p.lx));
    const dist = (a, b) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
    this.which = dist(f, t.ls) <= dist(f, t.le) ? 'start' : 'end';
    if (t.ls === 0 && t.le === 1) this.which = f < 0.5 ? 'start' : 'end'; // both handles sit at the top
    this.pick(p.lx, p.ly);
  }

  move(p) { this.pick(p.lx, p.ly); }

  up() { hud.endReadout(); }
}

export function buildTiferet(st, app) {
  let focus = 0;
  const cur = () => slots[focus];

  const tessGroup = new THREE.Group();
  tessGroup.position.z = -0.6;
  st.g.add(tessGroup);
  const tess = buildTesseract(tessGroup, 2.45);

  /* the eight cells, chosen from small cubes on the lower rim */
  const markers = [];
  for (let k = 0; k < MAX_TRACKS; k++) {
    markers.push(st.add(new Button(st.g, {
      ...rim(180 + (k - 3.5) * 9), r: 0.22, glyph: 'cube',
      onTap: () => setFocus(k),
    })));
  }

  const tg = new THREE.Group(); // everything that needs a sample
  st.g.add(tg);

  /* the melody discs: the frame (pulse, spinner) always; the petals with a sample */
  const api = {
    cur, focus: () => focus, say: (t, b) => app.say(t, b), armed: false,
    pos: () => seqPosition(),
    view: () => viewPattern(),
    notes: () => scaleNotes(state.play.scale, state.play.oct),
  };
  state.seq.chain.fill(-1); // v11 has no song disc: the pattern buttons are the structure
  const discs = buildDiscs(st, st.g, api);

  /* the sample, as the thin ring at the middle, with its loop points */
  const waveMat = mat(C.ink, 0.5);
  const wave = mesh(new THREE.PlaneGeometry(WAVE_OUT * 2, WAVE_OUT * 2), waveMat, tg, 1);
  const loopMat = mat(C.hot, 0.22);
  const loopArc = mesh(ringGeo(WAVE_IN, WAVE_OUT, 0, TAU, 4), loopMat, tg, 2);
  const handleMat = mat(C.hot, 1);
  const hStart = mesh(circleGeo(0.07, 12), handleMat, tg, 4);
  const hEnd = mesh(circleGeo(0.07, 12), handleMat, tg, 4);
  const playhead = bar(tg, 0, 0, 0, 1, 0.035, mat(C.ink, 0.95), 4);
  st.add(new WaveRing(tg, cur));

  /* the middle: start / stop the spinner */
  const go = st.add(new Button(tg, { x: 0, y: 0, r: 0.36, glyph: 'play', onTap: () => seqToggle() }));

  /* the tone chain, round the discs */
  const KR = 3.05;
  const A0 = (200 * Math.PI) / 180;
  const A1 = (-20 * Math.PI) / 180;
  mesh(ringGeo(KR - 0.02, KR + 0.02, A1, A0 - A1, 96), mat(C.dim, 0.35), tg, 0);
  const knobs = CHAIN.map(([key, glyph, fmt], k) => {
    const a = A0 - ((A0 - A1) * k) / (CHAIN.length - 1);
    return st.add(new Knob(tg, {
      x: Math.cos(a) * KR, y: Math.sin(a) * KR, r: 0.3, glyph,
      get: () => (live(cur()) ? (key === 'vol' ? cur().vol : cur().K[key]) : 0),
      set: (v) => {
        const t = cur();
        if (!live(t)) return;
        if (key === 'vol') t.vol = v; else t.K[key] = v;
        applyLive(t);
      },
      fmt: fmt ? () => fmt(cur().K) : null,
    }));
  });

  /* rim, track-bound: mute, solo, remove, a free loop, whole clip */
  const mute = st.add(new Button(tg, {
    ...rim(-72), r: 0.23, glyph: 'mute', color: C.bad,
    onTap: () => { const t = cur(); if (live(t)) { t.mute = !t.mute; applyMuteSolo(); } },
  }));
  const solo = st.add(new Button(tg, {
    ...rim(-94), r: 0.23, glyph: 'solo',
    onTap: () => { const t = cur(); if (live(t)) { t.solo = !t.solo; applyMuteSolo(); } },
  }));
  st.add(new Button(tg, { ...rim(-116), r: 0.23, glyph: 'remove', onTap: () => removeTrack(focus) }));
  const whole = st.add(new Button(tg, {
    ...rim(-134), r: 0.23, glyph: 'whole',
    onTap: () => { const t = cur(); if (live(t)) resetLoop(t); },
  }));
  const loopBtn = st.add(new Button(tg, {
    ...rim(134), r: 0.23, glyph: 'loop',
    onTap: () => toggleTrack(cur()),
  }));

  /* rim, shared: scale, octave, tempo, bars, hold, note recording, midi */
  const rimCtl = buildRim(st, st.g, api);

  /* ---- an empty cell: sound design. Pick a sound on the ring (or type words),
     tap the spark, and a sub-second sample is made and laid out as a melody ---- */
  const empty = new THREE.Group();
  st.g.add(empty);
  let presetIx = 0;
  let making = false;
  const sdBox = document.getElementById('sd');
  const sdText = document.getElementById('sdtext');
  st.overlay(sdBox, [-2.0, -2.95, 2.0, -2.4]);
  const sparkBtn = st.add(new Button(empty, {
    x: 0, y: 0, r: 0.55, glyph: 'spark',
    onTap: () => make(presetIx),
  }));
  sparkBtn.setRing(C.hot, 0.95);
  const TAGS = ['gl', 'sb', 'be', 'zp', 'wk', 'oh', '8b', 'dr'];
  const beads = PRESETS.map((pr, k) => {
    const a = ((k + 0.5) / PRESETS.length) * TAU;
    return st.add(new Button(empty, {
      x: Math.sin(a) * 1.75, y: Math.cos(a) * 1.75, r: 0.27, text: TAGS[k],
      onTap: () => { presetIx = k; sdText.value = ''; make(k); },
    }));
  });
  mesh(ringGeo(1.73, 1.77, 0, TAU, 96), mat(C.dim, 0.3), empty, 0);
  st.add(new Button(empty, { x: -0.55, y: -1.0, r: 0.26, glyph: 'rec', color: C.bad, onTap: () => takeOne() }));
  st.add(new Button(empty, { x: 0.55, y: -1.0, r: 0.26, glyph: 'library', onTap: () => app.fly('chokmah') }));
  const arcMat = mat(C.bad, 0.9);
  const arc = mesh(ringGeo(0.6, 0.66, Math.PI / 2, 1e-4, 4), arcMat, empty, 3);
  let take = null; // { t0, len }: a mic take in progress

  sdText.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); sdText.blur(); make(presetIx); }
  });

  async function make(ix) {
    if (making || live(cur())) return;
    const words = sdText.value.trim();
    const pr = PRESETS[ix];
    making = true;
    ensureAudio(); // inside the tap, so the phone lets the sound out
    app.say(words ? 'making your sound…' : `making: ${pr.name}…`);
    try {
      const { rec, how, why } = await designSound(words
        ? { words, secs: 0.6, synth: pr.synth }
        : { words: pr.words, secs: pr.secs, synth: pr.synth, preset: pr.name });
      const i = await app.addClip(rec.id, rec.name, '', true);
      if (i >= 0) {
        if (how === 'elevenlabs') app.say('made by ElevenLabs: drag the petals to play it');
        else app.say(`built-in synth (${why}): drag the petals to play it`, true);
      }
    } catch (e) {
      app.say(`could not make a sound: ${e.message}`, true);
    } finally { making = false; }
  }

  /* a sample just loaded by sound design or the library: lay out a first
     melody and set it going, so a new sound is never silent */
  function seed(i) {
    const t = slots[i];
    if (!live(t) || hasSteps(t.seq)) return;
    if (t.playing) toggleTrack(t);
    t.seq.hold = false;
    const long = t.buf.duration > 2;
    t.seq.gate = long ? 3 : GATES.length - 1;
    const notes = scaleNotes(state.play.scale, state.play.oct);
    const plan = long ? [[0, 0]] : [[0, 0], [3, 2], [6, 4], [8, 3], [10, 5], [12, 4], [14, 2]];
    const pat = t.seq.pats[state.seq.pattern];
    plan.forEach(([step, k]) => { pat[step] = { ...newCell(), on: true, n: notes[Math.min(k, notes.length - 1)], g: t.seq.gate }; });
    save();
    if (!seqPlaying()) seqStart();
  }

  async function takeOne() {
    if (take) { cancelQuantised(); take = null; app.say('take cancelled'); return; }
    ensureAudio();
    app.say('mic…');
    const ok = await prepareQuantised();
    if (!ok) { app.say('no input - allow the mic, or plug one in', true); return; }
    if (take) return;
    const was = seqPlaying();
    if (!was) await seqStart();
    const t0 = was ? seqNextCycleStart() : seqStartTime();
    const len = SEQ_CELLS * cellDur();
    const beat = 60 / state.seq.bpm;
    take = { t0, len };
    scheduleClicks(t0, t0 + len, beat, 4);
    app.say('the take starts on beat 1 and lasts one round: play or sing');
    startQuantised(t0, len, async (rec) => {
      take = null;
      const i = await app.addClip(rec.id, rec.name, rec.silent ? 'kept, but the input was silent' : '');
      const t = slots[i];
      if (live(t)) { // lay it on the first step so it plays in time as the spinner passes
        t.seq.hold = false;
        t.seq.pats[state.seq.pattern][0] = { ...newCell(), on: true, n: 0 };
        app.say('in the loop: drag the petals to play it as a melody');
      }
    });
  }

  initInstrument({
    target: () => focus,
    active: () => app.focused() === 'tiferet',
    say: (t, b) => app.say(t, b),
    transport: () => seqToggle(),
  });

  const caption = document.getElementById('caption');
  st.overlay(caption, [-3.6, -4.65, 3.6, -4.05]);

  function setFocus(k) {
    focus = k;
    tess.setFocus(k);
    refresh();
  }

  function refresh() {
    const t = cur();
    const has = live(t);
    tg.visible = has;
    discs.petals.visible = has;
    empty.visible = !has;
    sdBox.classList.toggle('off', has);
    caption.textContent = '';
    if (t) { const sp = document.createElement('span'); sp.textContent = t.label; caption.appendChild(sp); }
    if (has) {
      wave.material.map = waveTexture(t.buf);
      wave.material.needsUpdate = true;
      knobs.forEach((kn) => { kn.lastV = null; kn.setColor(TRACK_COLORS[focus]); kn.render(); });
    }
  }
  onTracks(refresh);

  let time = 0;
  let arcKey = '';
  const levels = new Array(MAX_TRACKS).fill(0);
  st.onUpdate((dt) => {
    time += dt;
    slots.forEach((t, k) => {
      advancePos(t, dt);
      const lv = live(t) ? levelOf(t.meter) : 0;
      levels[k] += (lv - levels[k]) * Math.min(1, dt * 10);
      const m = markers[k];
      const loading = t && t.loading;
      m.setLit(live(t) && (t.playing || noteActive(t)), TRACK_COLORS[k]);
      m.setRing(k === focus ? C.hot : (live(t) || loading ? TRACK_COLORS[k] : C.dim), loading ? 0.4 + 0.6 * (Math.sin(time * 8) > 0) : 1);
    });
    tess.update(dt, focus, (k) => ({ color: live(slots[k]) && (slots[k].playing || noteActive(slots[k])) ? TRACK_COLORS[k] : null, level: levels[k] }));

    const t = cur();
    const color = TRACK_COLORS[focus];
    const pos = seqPosition();
    discs.update(t, color, pos, time);
    rimCtl.update(t, color, time);

    if (!live(t)) {
      /* the take so far, round the spark (only a mic take draws it) */
      let f = 0;
      if (take) {
        const now = ensureAudio().currentTime;
        f = Math.max(0, Math.min(1, (now - take.t0) / take.len));
        arcMat.opacity = now < take.t0 ? 0.35 + 0.4 * (Math.sin(time * 14) > 0) : 0.95;
      } else arcMat.opacity = 0;
      const key = String(Math.round(f * 240));
      if (key !== arcKey) {
        arcKey = key;
        arc.geometry = ringGeo(0.6, 0.66, Math.PI / 2 - f * TAU, Math.max(1e-4, (Math.round(f * 240) / 240) * TAU), Math.max(4, Math.ceil(f * 96)));
      }
      sparkBtn.setLit(making && Math.sin(time * 9) > -0.3, C.hot);
      beads.forEach((b, k) => b.setRing(k === presetIx ? C.hot : C.dim, 1));
      return;
    }
    const a0 = fracToAngle(t.le);
    const q = (v) => Math.round(v * 720) / 720; // bounds the geometry cache while dragging
    loopArc.geometry = ringGeo(WAVE_IN, WAVE_OUT, fracToAngle(q(t.le)), Math.max(1e-4, (q(t.le) - q(t.ls)) * TAU), Math.max(4, Math.ceil((t.le - t.ls) * 96)));
    loopMat.color.copy(color);
    const as = fracToAngle(t.ls);
    hStart.position.set(Math.cos(as) * (WAVE_OUT + 0.14), Math.sin(as) * (WAVE_OUT + 0.14), 0);
    hEnd.position.set(Math.cos(a0) * (WAVE_OUT + 0.14), Math.sin(a0) * (WAVE_OUT + 0.14), 0);
    const ap = fracToAngle(t.pos);
    playhead.visible = t.playing;
    if (t.playing) {
      playhead.position.set(Math.cos(ap) * (WAVE_IN + WAVE_OUT) / 2, Math.sin(ap) * (WAVE_IN + WAVE_OUT) / 2, 0);
      playhead.scale.set(WAVE_OUT - WAVE_IN + 0.06, 0.035, 1);
      playhead.rotation.z = ap;
    }
    waveMat.opacity = t.playing || noteActive(t) ? 0.55 + levels[focus] * 0.4 : 0.35;
    const running = seqPlaying();
    go.setLit(running, color);
    setGlyph(go.label, running ? 'stop' : 'play');
    loopBtn.setLit(t.playing, color);
    const soloed = slots.some((x) => live(x) && x.solo);
    mute.setLit(t.mute, C.bad);
    solo.setLit(t.solo, C.hot);
    mute.setRing(soloed && !t.solo ? C.bad : C.dim, soloed && !t.solo ? 0.6 : 1);
    whole.g.visible = t.ls > 0 || t.le < 1;
    knobs.forEach((kn) => kn.render());
  });

  setFocus(0);
  return { setFocus, focus: () => focus, seed };
}
