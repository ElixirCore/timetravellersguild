/* INTERFACE v8 — the sequencer: each FIELD TAP pad is a programmable layer
   of 16 cells, laid down as events (the v5 field-grid grammar: a cell is
   { on, rate }; rate is the pad's playback pitch). The BARS control does
   not add cells — it stretches the same 16 cells over that many bars, so a
   short pattern triggers quick and fast and a long one slow and pad-like
   (Toby's model, see ../seqmodel.js). Lookahead scheduling as v5: a 120ms
   horizon on a 25ms tick, sample-accurate start times. */
import { state, save, FIELD_PADS } from '../state.js';
import { SEQ_CELLS, SEQ_BAR_STOPS, cellBeats, snapBars } from '../seqmodel.js';
import { ensureAudio, audioNow } from './engine.js';
import { playFieldPad, hasFieldPad } from './field-voice.js';

export { SEQ_CELLS };

const LOOKAHEAD = 0.12;
const TICK_MS = 25;

export function cellDur() {
  return (60 / state.seq.bpm) * cellBeats(state.seq.bars);
}

export function cycleCells() {
  return SEQ_CELLS;
}

/* rows always hold exactly SEQ_CELLS cells */
export function ensureRows() {
  for (let p = 0; p < FIELD_PADS; p++) {
    const row = state.seq.steps[p] || (state.seq.steps[p] = []);
    while (row.length < SEQ_CELLS) row.push({ on: false, rate: 1 });
    if (row.length > SEQ_CELLS) row.length = SEQ_CELLS;
  }
}

export function setBars(n) {
  state.seq.bars = snapBars(Math.round(n));
  save();
}

/* walk the stretch stops: 1 -> 2 -> 4 -> 8 -> 16 bars and back */
export function stretchBars(dir) {
  const i = SEQ_BAR_STOPS.indexOf(state.seq.bars);
  const j = Math.min(SEQ_BAR_STOPS.length - 1, Math.max(0, (i < 0 ? 0 : i) + dir));
  state.seq.bars = SEQ_BAR_STOPS[j];
  save();
}

let playing = false;
let timer = null;
let next = 0;
let count = 0;
let t0 = 0;

export function seqPlaying() {
  return playing;
}

export async function seqStart() {
  if (playing) return;
  const ctx = ensureAudio();
  await ctx.resume();
  playing = true;
  t0 = ctx.currentTime + 0.1;
  next = t0;
  count = 0;
  tick();
}

export function seqStop() {
  playing = false;
  clearTimeout(timer);
  timer = null;
}

export function seqToggle() {
  return playing ? (seqStop(), false) : (seqStart(), true);
}

function fire(idx, time) {
  const c = idx % SEQ_CELLS;
  for (let pad = 0; pad < FIELD_PADS; pad++) {
    const st = state.seq.steps[pad]?.[c];
    if (st?.on && hasFieldPad(pad) && !state.seq.padMute[pad]) {
      playFieldPad(pad, time, 0.88, st.rate ?? 1);
    }
  }
}

function tick() {
  if (!playing) return;
  const horizon = audioNow() + LOOKAHEAD;
  while (next < horizon) {
    fire(count, next);
    count++;
    next += cellDur();
  }
  timer = setTimeout(tick, TICK_MS);
}

/* where the playhead is: { cell (0..SEQ_CELLS-1, wraps), frac } or null */
export function seqPosition() {
  if (!playing) return null;
  const d = cellDur();
  const pos = (audioNow() - t0) / d;
  if (pos < 0) return { cell: 0, frac: 0 };
  return { cell: Math.floor(pos) % SEQ_CELLS, frac: pos - Math.floor(pos) };
}
