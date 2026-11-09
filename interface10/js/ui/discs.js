/* TIFERET · the melody (v9). Stacked discs round the cube, each a ring of
   petals; the length of a petal is the note information:

     PITCH   the outer disc: 16 petals, one per step. Drag a petal's tip out or
             in to move its note up or down the scale (pull it right in to
             silence the step); tap to switch a step on or off.
     LENGTH  how long the note is held, from a flick to playing out.
     LEVEL   how loud.
     SONG    the inner disc: eight petals, each a pattern (A–D) or nothing.
             One petal lasts one trip round the steps; every track follows.

   A spinner sweeps the discs once per trip round the steps, at the tempo, and
   the rings pulse on the beat. Round things only: petals are ellipses, the
   hand a thin wedge. */
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
  song: { r0: 1.08, r1: 1.34, n: 8 },
  level: { r0: 1.42, r1: 1.7, n: 16 },
  length: { r0: 1.78, r1: 2.06, n: 16 },
  pitch: { r0: 2.14, r1: 2.7, n: 16 },
};
const ORDER = ['song', 'level', 'length', 'pitch'];
const HAND_IN = 0.46;
const HAND_OUT = 2.72;

const cw = (deg) => Math.PI / 2 - (deg * Math.PI) / 180;
const stepAngle = (i, n) => cw(((i + 0.5) * 360) / n);

/* which pattern the discs are showing: the one the song is on while it plays */
let pinned = false; // a pattern button was pressed: keep looking at that pattern while the song moves on
export const viewPinned = () => pinned;
export function viewPattern(pos, playing) {
  return playing && pos && !pinned ? pos.pattern : state.seq.pattern;
}

/* ---------- one disc of petals: the touch surface ---------- */
class PetalDisc extends Control {
  constructor(parent, kind, api) {
    super(parent, 0, 0, DISCS[kind].r1);
    this.kind = kind;
    this.api = api;
    this.d = null;
    Object.assign(this, DISCS[kind]);
  }

  hit(lx, ly) {
    const d = Math.hypot(lx, ly);
    return this.isLive() && d >= this.r0 - 0.1 && d <= this.r1 + 0.1;
  }

  indexAt(lx, ly) {
    const f = ((((Math.PI / 2 - Math.atan2(ly, lx)) / TAU) % 1) + 1) % 1;
    return Math.min(this.n - 1, Math.floor(f * this.n));
  }

  cell(i) {
    const t = this.api.cur();
    if (!live(t)) return null;
    return t.seq.pats[this.api.view()][i];
  }

  audition(cell) {
    const t = this.api.cur();
    if (live(t)) playNote(t, { n: cell.n, vel: LEVELS[cell.v], dur: 0.3, mono: true });
  }

  down(p) {
    if (this.kind !== 'song' && !live(this.api.cur())) { this.api.say('no sample in this track yet'); return; }
    this.d = { i: this.indexAt(p.lx, p.ly), drag: false };
  }

  /* the petal tip follows the finger: its radius is the value */
  setFromRadius(r) {
    const { i } = this.d;
    const u = (r - this.r0) / (this.r1 - this.r0);
    if (this.kind === 'song') {
      const was = state.seq.chain[i];
      const p = u < 1 / 8 ? -1 : clamp(Math.round(u * 4 - 1), 0, 3);
      if (p !== was) { state.seq.chain[i] = p; if (p >= 0) state.seq.pattern = p; save(); }
      hud.readout('chain', p < 0 ? '-' : PATTERN_NAMES[p]);
      return;
    }
    const cell = this.cell(i);
    if (!cell) return;
    if (this.kind === 'pitch') {
      const notes = this.api.notes();
      if (u < 0.5 / notes.length) { cell.on = false; hud.readout('music', '-'); return; }
      let idx = clamp(Math.round(u * notes.length - 1), 0, notes.length - 1);
      /* a little stickiness: stay on the current note until the finger is well past its edge */
      const here = cell.on ? notes.indexOf(cell.n) : -1;
      if (here >= 0 && idx !== here && Math.abs(u * notes.length - 1 - here) < 0.5 + 0.2) idx = here;
      if (!cell.on || cell.n !== notes[idx]) {
        cell.on = true;
        cell.n = notes[idx];
        state.play.brush = cell.n;
        this.audition(cell);
      }
      hud.readout('music', noteName(cell.n));
    } else if (this.kind === 'length') {
      const g = clamp(Math.round(u * GATES.length - 1), 0, GATES.length - 1);
      if (g !== cell.g) { cell.g = g; this.audition(cell); }
      hud.readout('etime', GATE_NAMES[cell.g]);
    } else {
      const v = clamp(Math.round(u * LEVELS.length - 1), 0, LEVELS.length - 1);
      if (v !== cell.v) { cell.v = v; this.audition(cell); }
      hud.readout('vol', `${Math.round(LEVELS[cell.v] * 100)}`);
    }
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
    const { i } = d;
    if (this.kind === 'song') {
      const was = state.seq.chain[i];
      state.seq.chain[i] = was >= 3 ? -1 : was + 1;
      if (state.seq.chain[i] >= 0) state.seq.pattern = state.seq.chain[i];
      save();
      return;
    }
    const cell = this.cell(i);
    if (!cell) return;
    if (this.kind === 'pitch') {
      cell.on = !cell.on;
      if (cell.on) {
        cell.n = this.api.notes()[nearestIndex(this.api.notes(), state.play.brush)];
        this.audition(cell);
      }
    } else if (cell.on) {
      if (this.kind === 'length') cell.g = (cell.g + 1) % GATES.length;
      else cell.v = (cell.v + 1) % LEVELS.length;
      this.audition(cell);
    }
  }
}

/* ---------- the discs, the spinner, the pulse ---------- */
export function buildDiscs(st, parent, api) {
  const frame = new THREE.Group(); // always shown: the pulse and the spinner
  const petals = new THREE.Group(); // shown when the track has a sample
  parent.add(frame);
  parent.add(petals);

  const outlineMats = [];
  const outlines = new THREE.Group();
  frame.add(outlines);
  for (const k of ORDER) {
    const { r0, r1 } = DISCS[k];
    mesh(ringGeo(r0 - 0.04, r1 + 0.04, 0, TAU, 96), mat(C.panel, 0.72), frame, 0);
    const m1 = mat(C.dim, 0.5);
    const m2 = mat(C.dim, 0.5);
    mesh(ringGeo(r1 + 0.04, r1 + 0.055, 0, TAU, 96), m1, outlines, 1);
    mesh(ringGeo(r0 - 0.055, r0 - 0.04, 0, TAU, 96), m2, outlines, 1);
    outlineMats.push(m1, m2);
  }

  /* the spinner: a hand and the light it leaves */
  const wakeMat = mat(C.hot, 0.0);
  const wake = mesh(ringGeo(HAND_IN, HAND_OUT, 0, 0.5, 24), wakeMat, frame, 2);
  const handMat = mat(C.hot, 0.9);
  const hand = mesh(ringGeo(HAND_IN, HAND_OUT, -0.011, 0.022, 4), handMat, frame, 3);
  const bead = mesh(circleGeo(0.085, 14), handMat, frame, 3);

  /* faint rungs: the radius each value sits at, so the petals have something to land on */
  const guides = new THREE.Group();
  petals.add(guides);
  const guideMat = mat(C.dim, 0.26);
  const guideRoot = mat(C.ink, 0.55);
  function ring(kind, count, rootAt) {
    const { r0, r1 } = DISCS[kind];
    for (let k = 0; k < count; k++) {
      const r = r0 + ((k + 1) / count) * (r1 - r0);
      mesh(ringGeo(r - 0.0045, r + 0.0045, 0, TAU, 72), rootAt(k) ? guideRoot : guideMat, guides, 0);
    }
  }
  let guideKey = '';
  function updateGuides(notes) {
    const key = notes.join(',');
    if (key === guideKey) return;
    guideKey = key;
    while (guides.children.length) { const c = guides.children[0]; guides.remove(c); c.geometry.dispose(); }
    ring('pitch', notes.length, (k) => ((notes[k] % 12) + 12) % 12 === 0);
    ring('length', GATES.length, (k) => k === 3);
    ring('level', LEVELS.length, (k) => k === LEVELS.length - 1);
    ring('song', 4, () => false);
  }

  /* where each petal grows from */
  const roots = [];
  for (const k of ORDER) {
    const { r0, n } = DISCS[k];
    for (let i = 0; i < n; i++) {
      const a = stepAngle(i, n);
      const dot = mesh(circleGeo(0.028, 8), mat(C.dim, 0.9), petals, 1);
      dot.position.set(Math.cos(a) * (r0 + 0.01), Math.sin(a) * (r0 + 0.01), 0);
      roots.push(dot);
    }
  }

  const pool = {};
  for (const k of ORDER) {
    pool[k] = Array.from({ length: DISCS[k].n }, () => {
      const m = mat(C.hot, 0.8);
      const p = mesh(circleGeo(1, 28), m, petals, 2);
      p.visible = false;
      return { p, m };
    });
  }

  function place(item, kind, i, u, color, opacity, wBoost = 1) {
    const { r0, r1, n } = DISCS[kind];
    const a = stepAngle(i, n);
    const wMax = kind === 'pitch' ? 0.13 : kind === 'song' ? 0.085 : 0.07;
    const w = wMax * wBoost;
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

  const lenColor = new THREE.Color();
  const levColor = new THREE.Color(C.ink);

  function update(t, color, pos, now) {
    const playing = seqPlaying();
    const has = live(t);
    const view = viewPattern(pos, playing);
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

    lenColor.copy(color).lerp(levColor, 0.45);
    const cells = has ? t.seq.pats[view] : null;
    const notes = api.notes();
    updateGuides(notes);
    const stepF = roundPos * SEQ_CELLS;
    for (let i = 0; i < SEQ_CELLS; i++) {
      const cell = cells ? cells[i] : null;
      const age = playing ? (((stepF - i) % SEQ_CELLS) + SEQ_CELLS) % SEQ_CELLS : 99;
      const boost = age < 1.6 ? 1 - age / 1.6 : 0;
      const on = !!cell?.on;
      if (!on) {
        pool.pitch[i].p.visible = false;
        pool.length[i].p.visible = false;
        pool.level[i].p.visible = false;
        continue;
      }
      const idx = nearestIndex(notes, cell.n);
      place(pool.pitch[i], 'pitch', i, (idx + 1) / notes.length, color, 0.72 + 0.28 * boost, 1 + 0.4 * boost);
      place(pool.length[i], 'length', i, (cell.g + 1) / GATES.length, lenColor, 0.62 + 0.3 * boost, 1 + 0.3 * boost);
      place(pool.level[i], 'level', i, (cell.v + 1) / LEVELS.length, levColor, 0.5 + 0.4 * boost, 1 + 0.3 * boost);
    }
    for (let j = 0; j < CHAIN_SLOTS; j++) {
      const v = state.seq.chain[j];
      const item = pool.song[j];
      if (v < 0) { item.p.visible = false; continue; }
      const here = playing && pos && pos.slot === j;
      place(item, 'song', j, (v + 1) / 4, PAT_COLORS[v], here ? 1 : 0.7, here ? 1.25 : 1);
    }
  }

  const discs = ORDER.map((k) => st.add(new PetalDisc(petals, k, api)));
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
  const hold = st.add(new Button(parent, {
    ...rim(118), r: 0.23, glyph: 'hold',
    onTap: () => {
      const t = api.cur();
      if (!live(t)) return;
      t.seq.hold = !t.seq.hold;
      api.say(t.seq.hold ? 'held: a note loops until its length is up' : 'one-shot: a note plays its sample');
    },
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
      if (state.seq.pattern === k && state.seq.chain.some((v) => v >= 0)) {
        pinned = !pinned; // tapping the one in view lets go of it, or holds it, against the song
        api.say(pinned ? `holding pattern ${name} in view` : 'the discs follow the song');
        return;
      }
      state.seq.pattern = k;
      pinned = true;
      save();
      api.say(`pattern ${name}`);
    },
    onHold: () => {
      const t = api.cur();
      const from = viewPattern(api.pos(), seqPlaying());
      if (!live(t) || from === k) return;
      t.seq.pats[k] = JSON.parse(JSON.stringify(t.seq.pats[from]));
      state.seq.pattern = k;
      pinned = true;
      save();
      api.say(`pattern ${PATTERN_NAMES[from]} copied into ${name}`);
    },
  })));
  const clear = st.add(new Button(parent, {
    ...rim(-41), r: 0.23, glyph: 'stopclr',
    onTap: () => {
      const t = api.cur();
      if (!live(t)) return;
      const p = viewPattern(api.pos(), seqPlaying());
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
    const cell = t.seq.pats[viewPattern(pos, true)][i];
    cell.on = true;
    cell.n = clampNote(n);
  });

  function update(t, color, now) {
    hold.setLit(live(t) && t.seq.hold, C.hot);
    scale.setLit(state.play.scale !== 0, C.hot);
    rec.setLit(api.armed && Math.sin(now * 8) > -0.3, C.bad);
    midi.setLit(midiOn(), C.hot);
    if (!seqPlaying()) pinned = false; // the view only needs holding while the song moves
    const shown = viewPattern(api.pos(), seqPlaying());
    const playingP = seqPlaying() && api.pos() ? api.pos().pattern : -1;
    pats.forEach((b, k) => {
      b.setLit(k === shown, PAT_COLORS[k]);
      b.setRing(k === playingP ? C.hot : (live(t) && patternHasSteps(t.seq, k) ? PAT_COLORS[k] : C.dim), 1);
    });
    [oct, bpm, bars].forEach((k) => { k.setColor(color); k.render(); });
  }
  return { update, hold, scale, rec, oct, bpm, bars, midi, pats, clear };
}
