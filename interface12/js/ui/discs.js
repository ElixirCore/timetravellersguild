/* TIFERET · the record (v12). Every loaded track is a ring of one stacked
   disc, inner to outer in cell order; a spinner is the tone arm and turns once
   per round of the steps, at the tempo.

     the FOCUSED ring is opened wide, a circular piano roll: sixteen steps
       round, a petal on each, and the length of the petal is its note (drag
       the tip out for higher, in for lower, right in to take it away; tap a
       bud to grow one). Dice lays down a new line.
     the OTHER rings close to grooves, each a dot per step, so the whole
       arrangement stays in view while it plays. Tap a groove to open it.
     a LOOP (music from sound design) is a ring of bar marks.
     the SONG is the small ring at the middle: eight laps, each a pattern
       A-D or nothing (tap to cycle). One lap is one round of the steps.

   Round things only: petals are ellipses, the arm a thin wedge. */
import {
  C, THREE, ringGeo, circleGeo, mat, mesh, hueColor,
} from './gl.js';
import { Control, Knob, Button, hud } from './widgets.js';
import {
  state, save, clamp, BPM_MIN, BPM_MAX, MAX_TRACKS,
} from '../state.js';
import { SEQ_CELLS, SEQ_BAR_STOPS } from '../seqmodel.js';
import {
  PATTERN_NAMES, CHAIN_SLOTS, GATES, LEVELS, SCALES, noteName, scaleNotes, nearestIndex, clampNote, patternHasSteps,
} from '../pattern.js';
import {
  slots, live, playNote, isLoop, retempoLoops, loopPeriod,
} from '../audio/tracks.js';
import { seqPlaying, seqToggle, setBars, seqPosition } from '../audio/seq.js';
import { enableMidi, midiOn, onNote } from '../audio/instrument.js';
import { ensureAudio } from '../audio/engine.js';

const TAU = Math.PI * 2;
export const PAT_COLORS = [40, 150, 210, 290].map((h) => hueColor(h, 0.55, 0.52));
const GATE_NAMES = ['1/8', '1/4', '1/2', '1', '2', 'full'];

export const STACK = { r0: 1.36, r1: 2.72, n: SEQ_CELLS };
export const SONG = { r0: 1.04, r1: 1.26, n: CHAIN_SLOTS };
const HAND_IN = 1.0;
const HAND_OUT = 2.76;

const cw = (deg) => Math.PI / 2 - (deg * Math.PI) / 180;
const stepAngle = (i, n) => cw(((i + 0.5) * 360) / n);
const angleIndex = (lx, ly, n) => {
  const f = ((((Math.PI / 2 - Math.atan2(ly, lx)) / TAU) % 1) + 1) % 1;
  return Math.min(n - 1, Math.floor(f * n));
};

/* which pattern is on show (and being edited). With a song, the discs follow
   the lap that is playing, unless a pattern button has pinned one in view. */
let pinned = false;
const hasSong = () => state.seq.chain.some((v) => v >= 0);
export function viewPattern() {
  if (pinned || !hasSong() || !seqPlaying()) return state.seq.pattern;
  const pos = seqPosition();
  return pos ? pos.pattern : state.seq.pattern;
}

/* the radius a note sits at in the open ring, 0..1 (the lowest still shows as a petal) */
const noteU = (idx, len) => 0.14 + (0.86 * idx) / Math.max(1, len - 1);
const uNote = (u, len) => clamp(Math.round(((u - 0.14) / 0.86) * (len - 1)), 0, len - 1);

/* ---------- where the rings are (shared by drawing and touch) ---------- */
function makeGeom() {
  const bands = Array.from({ length: MAX_TRACKS }, () => ({
    ri: 0, ro: 0, ti: 0, to: 0, init: false,
  }));
  return {
    bands,
    any: () => slots.some(live),
    /* the track whose ring holds radius d, or the nearest groove */
    trackAt(d) {
      let best = -1;
      let bd = 1e9;
      for (let k = 0; k < MAX_TRACKS; k++) {
        if (!live(slots[k])) continue;
        const b = bands[k];
        if (d >= b.ri - 0.03 && d <= b.ro + 0.03) return k;
        const dd = Math.min(Math.abs(d - b.ri), Math.abs(d - b.ro));
        if (dd < bd) { bd = dd; best = k; }
      }
      return bd < 0.16 ? best : -1;
    },
  };
}

/* the stack: touch surface for every ring */
class StackTouch extends Control {
  constructor(parent, api, geom) {
    super(parent, 0, 0, STACK.r1);
    this.api = api;
    this.geom = geom;
    this.d = null;
  }

  hit(lx, ly) {
    const d = Math.hypot(lx, ly);
    return this.isLive() && this.geom.any() && d >= STACK.r0 - 0.06 && d <= STACK.r1 + 0.1;
  }

  down(p) {
    const k = this.geom.trackAt(Math.hypot(p.lx, p.ly));
    if (k < 0) return;
    const edit = k === this.api.focus() && live(this.api.cur()) && !isLoop(this.api.cur());
    this.d = { k, edit, i: angleIndex(p.lx, p.ly, STACK.n), drag: false };
  }

  cell(i) {
    const t = this.api.cur();
    return live(t) ? t.seq.pats[viewPattern()][i] : null;
  }

  audition(cell) {
    const t = this.api.cur();
    if (live(t)) playNote(t, { n: cell.n, vel: LEVELS[cell.v], dur: 0.3, mono: true });
  }

  /* the petal tip follows the finger: its radius in the open ring is the note */
  setFromRadius(r) {
    const cell = this.cell(this.d.i);
    if (!cell) return;
    const b = this.geom.bands[this.d.k];
    const u = (r - b.ri) / Math.max(0.2, b.ro - b.ri);
    const notes = this.api.notes();
    if (u < 0.07) { cell.on = false; hud.readout('music', '-'); return; }
    let idx = uNote(u, notes.length);
    /* a little stickiness: stay on the current note until the finger is well past its edge */
    const here = cell.on ? notes.indexOf(cell.n) : -1;
    if (here >= 0 && idx !== here && Math.abs(((u - 0.14) / 0.86) * (notes.length - 1) - here) < 0.7) idx = here;
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
    if (!this.d || !this.d.edit || !p.moved) return;
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
    if (!d.edit) { // a tap on another groove (or a loop) opens it
      if (d.k !== this.api.focus()) this.api.setFocus(d.k);
      return;
    }
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

/* the song: eight laps */
class SongTouch extends Control {
  constructor(parent, api) {
    super(parent, 0, 0, SONG.r1);
    this.api = api;
    this.d = null;
  }

  hit(lx, ly) {
    const d = Math.hypot(lx, ly);
    return this.isLive() && slots.some(live) && d >= SONG.r0 - 0.08 && d <= SONG.r1 + 0.08;
  }

  down(p) { this.d = angleIndex(p.lx, p.ly, SONG.n); }

  up(p, tapped) {
    const i = this.d;
    this.d = null;
    if (i == null || !tapped) return;
    const was = state.seq.chain[i];
    state.seq.chain[i] = was >= PATTERN_NAMES.length - 1 ? -1 : was + 1;
    if (state.seq.chain[i] >= 0) state.seq.pattern = state.seq.chain[i];
    save();
    const v = state.seq.chain[i];
    this.api.say(v < 0 ? `lap ${i + 1}: empty` : `lap ${i + 1}: pattern ${PATTERN_NAMES[v]}`);
  }
}

/* ---------- the record, the arm, the pulse ---------- */
export function buildDiscs(st, parent, api) {
  const frame = new THREE.Group(); // always shown: the pulse and the arm
  const petals = new THREE.Group(); // shown when a track has a sample
  parent.add(frame);
  parent.add(petals);
  const geom = makeGeom();

  /* the plate under the rings, and its outlines (they pulse on the beat) */
  const outlineMats = [];
  const outlines = new THREE.Group();
  frame.add(outlines);
  mesh(ringGeo(SONG.r0 - 0.06, STACK.r1 + 0.04, 0, TAU, 96), mat(C.panel, 0.72), frame, 0);
  for (const [r, w] of [[STACK.r1 + 0.04, 0.015], [SONG.r0 - 0.06, 0.012]]) {
    const m = mat(C.dim, 0.5);
    mesh(ringGeo(r, r + w, 0, TAU, 96), m, outlines, 1);
    outlineMats.push(m);
  }

  /* the arm: a thin wedge and the light it leaves */
  const wakeMat = mat(C.hot, 0.0);
  const wake = mesh(ringGeo(HAND_IN, HAND_OUT, 0, 0.5, 24), wakeMat, frame, 6);
  const handMat = mat(C.hot, 0.9);
  const hand = mesh(ringGeo(HAND_IN, HAND_OUT, -0.011, 0.022, 4), handMat, frame, 7);
  const bead = mesh(circleGeo(0.085, 14), handMat, frame, 7);

  /* faint rungs on the open ring: the radius each note sits at */
  const guideMat = mat(C.dim, 0.34);
  const guideRoot = mat(C.ink, 0.45);
  const guides = new THREE.Group();
  petals.add(guides);
  let guideKey = '';

  /* one row per track: a band, two edges, seventeen dots/petals */
  const rows = Array.from({ length: MAX_TRACKS }, () => {
    const g = new THREE.Group();
    petals.add(g);
    const bgMat = mat(C.panel, 0.8);
    const bg = mesh(new THREE.RingGeometry(1, 1.01, 4), bgMat, g, 1);
    const edgeMat = mat(C.dim, 0.5);
    const eIn = mesh(ringGeo(0.987, 1, 0, TAU, 96), edgeMat, g, 2);
    const eOut = mesh(ringGeo(0.987, 1, 0, TAU, 96), edgeMat, g, 2);
    const dots = Array.from({ length: SEQ_CELLS + 1 }, () => {
      const m = mat(C.hot, 0.8);
      const p = mesh(circleGeo(1, 28), m, g, 3);
      p.visible = false;
      return { p, m };
    });
    return { g, bg, bgMat, edgeMat, eIn, eOut, dots, built: [-1, -1] };
  });

  /* the song: eight laps */
  const songDots = Array.from({ length: CHAIN_SLOTS }, (_, j) => {
    const m = mat(C.dim, 0.6);
    const p = mesh(circleGeo(1, 24), m, petals, 4);
    const a = stepAngle(j, CHAIN_SLOTS);
    const r = (SONG.r0 + SONG.r1) / 2;
    p.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    return { p, m };
  });

  function updateGuides(notes, b) {
    const key = `${notes.join(',')}|${b ? b.ri.toFixed(2) + b.ro.toFixed(2) : 'x'}`;
    if (key === guideKey) return;
    guideKey = key;
    while (guides.children.length) { const c = guides.children[0]; guides.remove(c); c.geometry.dispose(); }
    if (!b || b.ro - b.ri < 0.4) return;
    notes.forEach((nn, k) => {
      const r = b.ri + noteU(k, notes.length) * (b.ro - b.ri);
      const m = mesh(new THREE.RingGeometry(r - 0.0045, r + 0.0045, 72), ((nn % 12) + 12) % 12 === 0 ? guideRoot : guideMat, guides, 2);
      m.userData.own = true;
    });
  }

  /* a petal (or, at u = 0, a bud) on step i of a band */
  function petal(item, i, ri, ro, u, color, opacity, w) {
    const a = stepAngle(i, STACK.n);
    const tip = Math.max(ri + 2.2 * w, ri + u * (ro - ri));
    const semi = (tip - ri) / 2;
    const rc = ri + semi;
    item.p.visible = true;
    item.p.position.set(Math.cos(a) * rc, Math.sin(a) * rc, 0);
    item.p.rotation.z = a;
    item.p.scale.set(semi, Math.min(w, semi), 1);
    item.m.color.copy(color);
    item.m.opacity = opacity;
  }

  /* a round dot on step i, mid-band */
  function dot(item, ang, r, size, color, opacity) {
    item.p.visible = true;
    item.p.position.set(Math.cos(ang) * r, Math.sin(ang) * r, 0);
    item.p.rotation.z = 0;
    item.p.scale.set(size, size, 1);
    item.m.color.copy(color);
    item.m.opacity = opacity;
  }

  const budColor = new THREE.Color(C.dim);
  const beatColor = new THREE.Color(C.ink);
  const white = new THREE.Color(C.ink);
  const hot = new THREE.Color(C.hot);
  const tmp = new THREE.Color();
  let lastNow = 0;

  function layout(dt, focus) {
    const T = STACK.r1 - STACK.r0;
    const ks = [];
    slots.forEach((tr, k) => { if (live(tr)) ks.push(k); });
    const fl = live(slots[focus]);
    const others = ks.filter((k) => k !== focus).length;
    let Wf = 0;
    let Wo = 0;
    if (fl) { Wo = others ? clamp((T - 0.7) / others, 0.085, 0.3) : 0; Wf = T - others * Wo; } else if (others) Wo = clamp(T / others, 0.085, 0.3);
    let r = STACK.r0;
    geom.bands.forEach((b, k) => {
      if (live(slots[k])) {
        const w = k === focus ? Wf : Wo;
        b.ti = r; b.to = r + w; r += w;
        if (!b.init) { b.init = true; b.ri = b.ti; b.ro = b.ti; }
      } else { b.ti = r; b.to = r; b.init = false; }
      const f = Math.min(1, dt * 14);
      b.ri += (b.ti - b.ri) * f;
      b.ro += (b.to - b.ro) * f;
      if (Math.abs(b.ti - b.ri) < 0.001) b.ri = b.ti;
      if (Math.abs(b.to - b.ro) < 0.001) b.ro = b.to;
    });
  }

  function update(t, color, pos, now) {
    const dt = lastNow ? Math.min(0.1, now - lastNow) : 0.016;
    lastNow = now;
    const focus = api.focus();
    const playing = seqPlaying();
    const view = viewPattern();
    layout(dt, focus);

    /* the pulse on the beat, the arm */
    const roundPos = playing && pos ? pos.round : 0;
    const beatsPerCycle = state.seq.bars * 4;
    const phase = playing && pos ? (roundPos * beatsPerCycle) % 1 : ((now * state.seq.bpm) / 60) % 1;
    const pulse = Math.exp(-5 * phase);
    outlines.scale.setScalar(1 + 0.01 * pulse);
    for (const m of outlineMats) m.opacity = 0.35 + 0.55 * pulse;
    const ang = cw(roundPos * 360);
    hand.rotation.z = ang;
    wake.rotation.z = ang;
    bead.position.set(Math.cos(ang) * HAND_OUT, Math.sin(ang) * HAND_OUT, 0);
    handMat.opacity = playing ? 0.95 : 0.3 + 0.3 * pulse;
    wakeMat.opacity = playing ? 0.14 : 0;
    bead.scale.setScalar(1 + (playing ? 0.5 * pulse : 0));

    const notes = api.notes();
    const fb = live(slots[focus]) && !isLoop(slots[focus]) ? geom.bands[focus] : null;
    updateGuides(notes, fb);
    const stepF = roundPos * SEQ_CELLS;
    const ac = ensureAudio().currentTime;

    rows.forEach((row, k) => {
      const tr = slots[k];
      const b = geom.bands[k];
      const open = live(tr) && b.ro - b.ri > 0.012;
      row.g.visible = open;
      if (!open) return;
      const W = b.ro - b.ri;
      const focused = k === focus;
      const col = api.colorOf(k);
      /* the band */
      if (Math.abs(row.built[0] - b.ri) > 0.002 || Math.abs(row.built[1] - b.ro) > 0.002) {
        row.bg.geometry.dispose();
        row.bg.geometry = new THREE.RingGeometry(b.ri, b.ro, 96);
        row.built = [b.ri, b.ro];
      }
      if (focused) row.bgMat.color.set(C.panel); else row.bgMat.color.copy(col).multiplyScalar(0.2);
      row.bgMat.opacity = focused ? 0.9 : 0.7;
      row.edgeMat.color.copy(focused ? hot : col);
      row.edgeMat.opacity = focused ? 0.9 : 0.4;
      row.eIn.scale.setScalar(b.ri);
      row.eOut.scale.setScalar(b.ro);

      const mid = (b.ri + b.ro) / 2;
      if (isLoop(tr)) {
        /* bar marks, and the head of the loop */
        const n = Math.max(1, Math.min(16, tr.loopBars || 1));
        for (let i = 0; i < SEQ_CELLS; i++) {
          const item = row.dots[i];
          if (i >= n) { item.p.visible = false; continue; }
          dot(item, cw((i / n) * 360), mid, Math.min(W * 0.4, focused ? 0.1 : 0.04), col, i === 0 ? 0.95 : 0.55);
        }
        const head = row.dots[SEQ_CELLS];
        if (playing && tr.loopT0 != null && ac >= tr.loopT0) {
          const ph = (((ac - tr.loopT0) / loopPeriod(tr)) % 1 + 1) % 1;
          dot(head, cw(ph * 360), mid, Math.min(W * 0.5, focused ? 0.13 : 0.055), white, 1);
        } else head.p.visible = false;
        return;
      }
      row.dots[SEQ_CELLS].p.visible = false;
      const cells = tr.seq.pats[view];
      for (let i = 0; i < SEQ_CELLS; i++) {
        const cell = cells[i];
        const item = row.dots[i];
        const age = playing ? (((stepF - i) % SEQ_CELLS) + SEQ_CELLS) % SEQ_CELLS : 99;
        const boost = age < 1.6 ? 1 - age / 1.6 : 0;
        if (focused) {
          if (!cell.on) { // a bud; every fourth step is a beat
            const beat = i % 4 === 0;
            petal(item, i, b.ri, b.ro, 0, beat ? beatColor : budColor, (beat ? 0.55 : 0.4) + 0.4 * boost, (beat ? 0.085 : 0.06) + 0.03 * boost);
          } else {
            const idx = nearestIndex(notes, cell.n);
            petal(item, i, b.ri, b.ro, noteU(idx, notes.length), col, 0.78 + 0.22 * boost, Math.min(0.15, W * 0.2) * (1 + 0.25 * boost));
          }
        } else if (cell.on) {
          tmp.copy(col).lerp(white, boost * 0.7);
          dot(item, stepAngle(i, STACK.n), mid, Math.min(W * 0.4, 0.05) * (1 + boost * 0.7), tmp, 0.75 + 0.25 * boost);
        } else item.p.visible = false;
      }
    });

    /* the song */
    const show = slots.some(live);
    const pSlot = playing && pos ? pos.slot : -1;
    songDots.forEach((sd, j) => {
      sd.p.visible = show;
      const v = state.seq.chain[j];
      const here = j === pSlot;
      if (v < 0) { sd.m.color.set(C.dim); sd.m.opacity = 0.5; sd.p.scale.setScalar(0.035); } else {
        sd.m.color.copy(PAT_COLORS[v]);
        sd.m.opacity = here ? 1 : 0.8;
        sd.p.scale.setScalar(here ? 0.1 + 0.03 * pulse : 0.075);
      }
    });
  }

  const geomRef = geom;
  const touch = [st.add(new StackTouch(petals, api, geomRef)), st.add(new SongTouch(petals, api))];
  return { frame, petals, update, discs: touch };
}

/* ---------- the small controls round the rim ---------- */
const RIM = 3.68;
export const rim = (deg, r = RIM) => ({
  x: Math.sin((deg * Math.PI) / 180) * r,
  y: Math.cos((deg * Math.PI) / 180) * r,
});

/* a fresh line for the open ring: a few steps, leaning on the beats, walking
   about the scale. Drum tracks keep their pitch. */
export function dice(t, notes) {
  const pat = t.seq.pats[viewPattern()];
  const hits = 4 + Math.floor(Math.random() * 5);
  const w = Array.from({ length: SEQ_CELLS }, (_, i) => (i % 4 === 0 ? 3 : i % 2 === 0 ? 2 : 1) + Math.random() * 2);
  const order = w.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, hits).map((x) => x[1]).sort((a, b) => a - b);
  let k = Math.floor(Math.random() * 3);
  pat.forEach((c) => { c.on = false; });
  order.forEach((i) => {
    k = clamp(k + Math.round((Math.random() - 0.5) * 4), 0, Math.min(notes.length - 1, 7));
    const c = pat[i];
    c.on = true;
    c.n = t.role === 'drum' ? 0 : notes[k];
    c.g = t.seq.gate;
    c.v = Math.random() < 0.25 ? 2 : LEVELS.length - 1;
  });
}

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
    set: (v) => { state.seq.bpm = Math.round(BPM_MIN + v * (BPM_MAX - BPM_MIN)); save(); retempoLoops(); },
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
      if (state.seq.pattern === k && hasSong()) {
        pinned = !pinned; // the lit one: hold it in view against the song, or let the song lead
        api.say(pinned ? `holding pattern ${name} in view` : 'the rings follow the song');
        return;
      }
      state.seq.pattern = k;
      pinned = true;
      save();
      api.say(`pattern ${name}${seqPlaying() && !hasSong() ? ' (swapped in on the next step)' : ''}`);
    },
    onHold: () => {
      const t = api.cur();
      const from = viewPattern();
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
      const p = viewPattern();
      t.seq.pats[p].forEach((c) => { c.on = false; });
      save();
      api.say(`pattern ${PATTERN_NAMES[p]} cleared on this track`);
    },
  }));
  const diceBtn = st.add(new Button(parent, {
    ...rim(41), r: 0.23, glyph: 'dice',
    onTap: () => {
      const t = api.cur();
      if (!live(t) || isLoop(t)) return;
      dice(t, api.notes());
      save();
      api.say('a new line, rolled');
    },
  }));

  onNote((n, slot) => {
    if (!api.armed || !seqPlaying() || slot !== api.focus()) return;
    const t = api.cur();
    const pos = api.pos();
    if (!live(t) || !pos || isLoop(t)) return;
    const i = Math.round(pos.round * SEQ_CELLS) % SEQ_CELLS;
    const cell = t.seq.pats[viewPattern()][i];
    cell.on = true;
    cell.n = clampNote(n);
  });

  function update(t, color, now) {
    scale.setLit(state.play.scale !== 0, C.hot);
    rec.setLit(api.armed && Math.sin(now * 8) > -0.3, C.bad);
    midi.setLit(midiOn(), C.hot);
    if (!seqPlaying()) pinned = false; // the view only needs holding while the song moves
    const shown = viewPattern();
    const pos = seqPlaying() ? seqPosition() : null;
    const playingP = pos ? pos.pattern : -1;
    pats.forEach((b, k) => {
      b.setLit(k === shown, PAT_COLORS[k]);
      b.setRing(k === playingP ? C.hot : (live(t) && patternHasSteps(t.seq, k) ? PAT_COLORS[k] : C.dim), 1);
    });
    [oct, bpm, bars, gate].forEach((k) => { k.setColor(color); k.render(); });
  }
  return { update, gate, scale, rec, oct, bpm, bars, midi, pats, clear, dice: diceBtn };
}
