/* TIFERET · the melody (v11, simplified). One ring of sixteen petals round
   the cube. Each petal is a step; its length is its note: drag a tip out for a
   higher note, in for a lower one, right in to switch it off. Tap a bud to
   grow a petal there, tap a petal to take it away. A spinner sweeps the ring
   once per trip round the steps, at the tempo, and the ring pulses on the
   beat. A, B, C, D are four rings for the track (tap to swap, hold to copy
   the one you are looking at into it). Round things only. */
import {
  C, THREE, ringGeo, circleGeo, mat, mesh, hueColor,
} from './gl.js';
import { Control, Knob, Button, hud } from './widgets.js';
import {
  state, save, clamp, BPM_MIN, BPM_MAX,
} from '../state.js';
import { SEQ_CELLS, SEQ_BAR_STOPS } from '../seqmodel.js';
import {
  PATTERN_NAMES, CHAIN_SLOTS, GATES, LEVELS, SCALES, noteName, scaleNotes, nearestIndex, clampNote, patternHasSteps,
} from '../pattern.js';
import { live, playNote } from '../audio/tracks.js';
import { seqPlaying, seqToggle, setBars } from '../audio/seq.js';
import { enableMidi, midiOn, onNote } from '../audio/instrument.js';

const TAU = Math.PI * 2;
export const PAT_COLORS = [40, 150, 210, 290].map((h) => hueColor(h, 0.55, 0.52));
const GATE_NAMES = ['1/8', '1/4', '1/2', '1', '2', 'full'];

export const DISCS = {
  pitch: { r0: 1.22, r1: 2.7, n: 16 },
};
const ORDER = ['pitch'];
const HAND_IN = 1.1;
const HAND_OUT = 2.72;

const cw = (deg) => Math.PI / 2 - (deg * Math.PI) / 180;
const stepAngle = (i, n) => cw(((i + 0.5) * 360) / n);

/* which pattern the ring is showing */
export function viewPattern() {
  return state.seq.pattern;
}

/* ---------- the ring of petals: the touch surface ---------- */
class PetalRing extends Control {
  constructor(parent, api) {
    super(parent, 0, 0, DISCS.pitch.r1);
    this.api = api;
    this.d = null;
    Object.assign(this, DISCS.pitch);
  }

  hit(lx, ly) {
    const d = Math.hypot(lx, ly);
    return this.isLive() && d >= this.r0 - 0.12 && d <= this.r1 + 0.12;
  }

  indexAt(lx, ly) {
    const f = ((((Math.PI / 2 - Math.atan2(ly, lx)) / TAU) % 1) + 1) % 1;
    return Math.min(this.n - 1, Math.floor(f * this.n));
  }

  cell(i) {
    const t = this.api.cur();
    if (!live(t)) return null;
    return t.seq.pats[viewPattern()][i];
  }

  audition(cell) {
    const t = this.api.cur();
    if (live(t)) playNote(t, { n: cell.n, vel: LEVELS[cell.v], dur: 0.3, mono: true });
  }

  down(p) {
    if (!live(this.api.cur())) return;
    this.d = { i: this.indexAt(p.lx, p.ly), drag: false };
  }

  /* the petal tip follows the finger: its radius is the note */
  setFromRadius(r) {
    const { i } = this.d;
    const cell = this.cell(i);
    if (!cell) return;
    const u = (r - this.r0) / (this.r1 - this.r0);
    const notes = this.api.notes();
    if (u < 0.5 / notes.length) { cell.on = false; hud.readout('music', '-'); return; }
    let idx = clamp(Math.round(u * notes.length - 1), 0, notes.length - 1);
    /* a little stickiness: stay on the current note until the finger is well past its edge */
    const here = cell.on ? notes.indexOf(cell.n) : -1;
    if (here >= 0 && idx !== here && Math.abs(u * notes.length - 1 - here) < 0.7) idx = here;
    if (!cell.on || cell.n !== notes[idx]) {
      if (!cell.on) cell.g = this.api.cur().seq.gate;
      cell.on = true;
      cell.n = notes[idx];
      state.play.brush = cell.n;
      this.audition(cell);
    }
    hud.readout('music', noteName(cell.n));
  }

  move(p) {
    if (!this.d || !p.moved) return;
    this.d.drag = true;
    this.setFromRadius(Math.hypot(p.lx, p.ly));
  }

  up(p, tapped) {
    const d = this.d;
    this.d = null;
    hud.endReadout();
    if (!d) return;
    if (d.drag) { save(); return; }
    if (!tapped) return;
    const cell = this.cell(d.i);
    if (!cell) return;
    cell.on = !cell.on;
    if (cell.on) {
      const notes = this.api.notes();
      cell.n = notes[nearestIndex(notes, state.play.brush)];
      cell.g = this.api.cur().seq.gate;
      this.audition(cell);
    }
    save();
  }
}

/* ---------- the ring, the spinner, the pulse ---------- */
export function buildDiscs(st, parent, api) {
  const frame = new THREE.Group(); // always shown: the pulse and the spinner
  const petals = new THREE.Group(); // shown when the track has a sample
  parent.add(frame);
  parent.add(petals);

  const { r0, r1, n } = DISCS.pitch;
  const outlineMats = [];
  const outlines = new THREE.Group();
  frame.add(outlines);
  mesh(ringGeo(r0 - 0.04, r1 + 0.04, 0, TAU, 96), mat(C.panel, 0.72), frame, 0);
  const m1 = mat(C.dim, 0.5);
  const m2 = mat(C.dim, 0.5);
  mesh(ringGeo(r1 + 0.04, r1 + 0.055, 0, TAU, 96), m1, outlines, 1);
  mesh(ringGeo(r0 - 0.055, r0 - 0.04, 0, TAU, 96), m2, outlines, 1);
  outlineMats.push(m1, m2);

  /* the spinner: a hand and the light it leaves */
  const wakeMat = mat(C.hot, 0.0);
  const wake = mesh(ringGeo(HAND_IN, HAND_OUT, 0, 0.5, 24), wakeMat, frame, 2);
  const handMat = mat(C.hot, 0.9);
  const hand = mesh(ringGeo(HAND_IN, HAND_OUT, -0.011, 0.022, 4), handMat, frame, 3);
  const bead = mesh(circleGeo(0.085, 14), handMat, frame, 3);

  /* faint rungs: the radius each note sits at, so a petal has something to land on */
  const guides = new THREE.Group();
  petals.add(guides);
  const guideMat = mat(C.dim, 0.26);
  const guideRoot = mat(C.ink, 0.5);
  let guideKey = '';
  function updateGuides(notes) {
    const key = notes.join(',');
    if (key === guideKey) return;
    guideKey = key;
    while (guides.children.length) { const c = guides.children[0]; guides.remove(c); c.geometry.dispose(); }
    notes.forEach((nn, k) => {
      const r = r0 + ((k + 1) / notes.length) * (r1 - r0);
      mesh(ringGeo(r - 0.0045, r + 0.0045, 0, TAU, 72), ((nn % 12) + 12) % 12 === 0 ? guideRoot : guideMat, guides, 0);
    });
  }

  const pool = Array.from({ length: n }, () => {
    const m = mat(C.hot, 0.8);
    const p = mesh(circleGeo(1, 28), m, petals, 2);
    p.visible = false;
    return { p, m };
  });

  /* a petal (or, at u = 0, a bud) on step i */
  function place(item, i, u, color, opacity, wBoost = 1) {
    const a = stepAngle(i, n);
    const w = 0.15 * wBoost;
    const tip = Math.max(r0 + 2.2 * w, r0 + u * (r1 - r0));
    const semi = (tip - r0) / 2;
    const rc = r0 + semi;
    item.p.visible = true;
    item.p.position.set(Math.cos(a) * rc, Math.sin(a) * rc, 0);
    item.p.rotation.z = a;
    item.p.scale.set(semi, Math.min(w, semi), 1);
    item.m.color.copy(color);
    item.m.opacity = opacity;
  }

  const budColor = new THREE.Color(C.dim);
  const beatColor = new THREE.Color(C.ink);

  function update(t, color, pos, now) {
    const playing = seqPlaying();
    const has = live(t);
    const roundPos = playing && pos ? pos.round : 0;
    const beatsPerCycle = state.seq.bars * 4;
    const phase = playing && pos ? (roundPos * beatsPerCycle) % 1 : ((now * state.seq.bpm) / 60) % 1;
    const pulse = Math.exp(-5 * phase);

    outlines.scale.setScalar(1 + 0.012 * pulse);
    for (const m of outlineMats) m.opacity = 0.35 + 0.55 * pulse;

    const ang = cw(roundPos * 360);
    hand.rotation.z = ang;
    wake.rotation.z = ang;
    bead.position.set(Math.cos(ang) * HAND_OUT, Math.sin(ang) * HAND_OUT, 0);
    handMat.opacity = playing ? 0.95 : 0.3 + 0.3 * pulse;
    wakeMat.opacity = playing ? 0.14 : 0;
    bead.scale.setScalar(1 + (playing ? 0.5 * pulse : 0));

    const cells = has ? t.seq.pats[viewPattern()] : null;
    const notes = api.notes();
    updateGuides(notes);
    const stepF = roundPos * SEQ_CELLS;
    for (let i = 0; i < SEQ_CELLS; i++) {
      const cell = cells ? cells[i] : null;
      const age = playing ? (((stepF - i) % SEQ_CELLS) + SEQ_CELLS) % SEQ_CELLS : 99;
      const boost = age < 1.6 ? 1 - age / 1.6 : 0;
      if (!cell) { pool[i].p.visible = false; continue; }
      if (!cell.on) { // an empty step is a bud; every fourth is a beat
        const beat = i % 4 === 0;
        place(pool[i], i, 0, beat ? beatColor : budColor, (beat ? 0.55 : 0.4) + 0.4 * boost, (beat ? 0.8 : 0.62) + 0.25 * boost);
        continue;
      }
      const idx = nearestIndex(notes, cell.n);
      place(pool[i], i, (idx + 1) / notes.length, color, 0.78 + 0.22 * boost, 1 + 0.25 * boost);
    }
  }

  const discs = [st.add(new PetalRing(petals, api))];
  return { frame, petals, update, discs };
}

/* ---------- the small controls round the rim ---------- */
const RIM = 3.68;
export const rim = (deg, r = RIM) => ({
  x: Math.sin((deg * Math.PI) / 180) * r,
  y: Math.cos((deg * Math.PI) / 180) * r,
});

export function buildRim(st, parent, api) {
  const scale = st.add(new Button(parent, {
    ...rim(30), r: 0.23, glyph: 'scale',
    onTap: () => {
      state.play.scale = (state.play.scale + 1) % SCALES.length;
      save();
      api.say(`scale: ${SCALES[state.play.scale].name}`);
    },
  }));
  const oct = st.add(new Knob(parent, {
    ...rim(52), r: 0.26, glyph: 'pitch', detents: 5,
    get: () => (state.play.oct + 2) / 4,
    set: (v) => { state.play.oct = Math.round(v * 4) - 2; save(); },
    fmt: () => `${state.play.oct > 0 ? '+' : ''}${state.play.oct}`,
  }));
  const bpm = st.add(new Knob(parent, {
    ...rim(74), r: 0.27, glyph: 'time',
    get: () => (state.seq.bpm - BPM_MIN) / (BPM_MAX - BPM_MIN),
    set: (v) => { state.seq.bpm = Math.round(BPM_MIN + v * (BPM_MAX - BPM_MIN)); save(); },
    fmt: () => `${state.seq.bpm}`,
  }));
  const bars = st.add(new Knob(parent, {
    ...rim(96), r: 0.27, glyph: 'bars', detents: SEQ_BAR_STOPS.length,
    get: () => Math.max(0, SEQ_BAR_STOPS.indexOf(state.seq.bars)) / (SEQ_BAR_STOPS.length - 1),
    set: (v) => setBars(SEQ_BAR_STOPS[Math.round(v * (SEQ_BAR_STOPS.length - 1))]),
    fmt: () => `${state.seq.bars} bar${state.seq.bars > 1 ? 's' : ''}`,
  }));
  /* how long each note is held: a flick to the whole sample */
  const gate = st.add(new Knob(parent, {
    ...rim(118), r: 0.26, glyph: 'etime', detents: GATES.length,
    get: () => (live(api.cur()) ? api.cur().seq.gate / (GATES.length - 1) : 1),
    set: (v) => {
      const t = api.cur();
      if (!live(t)) return;
      const g = Math.round(v * (GATES.length - 1));
      t.seq.gate = g;
      t.seq.pats.forEach((pat) => pat.forEach((c) => { c.g = g; }));
    },
    fmt: () => (live(api.cur()) ? GATE_NAMES[api.cur().seq.gate] : ''),
  }));
  /* record notes from a keyboard or MIDI, quantised to the nearest step */
  const rec = st.add(new Button(parent, {
    ...rim(-30), r: 0.23, glyph: 'rec', color: C.bad,
    onTap: () => {
      api.armed = !api.armed;
      if (api.armed && !seqPlaying()) seqToggle();
      api.say(api.armed ? 'recording notes: play the keyboard, they land on the nearest step' : 'notes recording off');
    },
  }));
  const midi = st.add(new Button(parent, {
    ...rim(-52), r: 0.23, glyph: 'midi',
    onTap: async () => { await enableMidi(); },
  }));

  /* patterns A-D: tap to look at / edit one; hold to copy the one you are looking at into it */
  const pats = PATTERN_NAMES.map((name, k) => st.add(new Button(parent, {
    ...rim((k - 1.5) * 14), r: 0.2, text: name,
    onTap: () => {
      state.seq.pattern = k;
      save();
      api.say(`pattern ${name}${seqPlaying() ? ' (swapped in on the next step)' : ''}`);
    },
    onHold: () => {
      const t = api.cur();
      const from = viewPattern();
      if (!live(t) || from === k) return;
      t.seq.pats[k] = JSON.parse(JSON.stringify(t.seq.pats[from]));
      state.seq.pattern = k;
      save();
      api.say(`pattern ${PATTERN_NAMES[from]} copied into ${name}`);
    },
  })));
  const clear = st.add(new Button(parent, {
    ...rim(-41), r: 0.23, glyph: 'stopclr',
    onTap: () => {
      const t = api.cur();
      if (!live(t)) return;
      const p = viewPattern();
      t.seq.pats[p].forEach((c) => { c.on = false; });
      save();
      api.say(`pattern ${PATTERN_NAMES[p]} cleared on this track`);
    },
  }));

  onNote((n, slot) => {
    if (!api.armed || !seqPlaying() || slot !== api.focus()) return;
    const t = api.cur();
    const pos = api.pos();
    if (!live(t) || !pos) return;
    const i = Math.round(pos.round * SEQ_CELLS) % SEQ_CELLS;
    const cell = t.seq.pats[viewPattern()][i];
    cell.on = true;
    cell.n = clampNote(n);
  });

  function update(t, color, now) {
    scale.setLit(state.play.scale !== 0, C.hot);
    rec.setLit(api.armed && Math.sin(now * 8) > -0.3, C.bad);
    midi.setLit(midiOn(), C.hot);
    const shown = viewPattern();
    const playingP = seqPlaying() ? state.seq.pattern : -1;
    pats.forEach((b, k) => {
      b.setLit(k === shown, PAT_COLORS[k]);
      b.setRing(k === playingP ? C.hot : (live(t) && patternHasSteps(t.seq, k) ? PAT_COLORS[k] : C.dim), 1);
    });
    [oct, bpm, bars, gate].forEach((k) => { k.setColor(color); k.render(); });
  }
  return { update, gate, scale, rec, oct, bpm, bars, midi, pats, clear };
}
