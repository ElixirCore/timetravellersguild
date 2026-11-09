/* INTERFACE v9 — the clock. It drives every track's own sequence and the song
   (see ../pattern.js). (v8's FIELD TAP pad layers are gone.) The sequencer: each FIELD TAP pad is a programmable layer
   of 16 cells, laid down as events (the v5 field-grid grammar: a cell is
   { on, rate }; rate is the pad's playback pitch). The BARS control does
   not add cells — it stretches the same 16 cells over that many bars, so a
   short pattern triggers quick and fast and a long one slow and pad-like
   (Toby's model, see ../seqmodel.js). Lookahead scheduling as v5: a 120ms
   horizon on a 25ms tick, sample-accurate start times. */
import { state, save } from '../state.js';
import { SEQ_CELLS, SEQ_BAR_STOPS, cellBeats, snapBars } from '../seqmodel.js';
import { ensureAudio, audioNow } from './engine.js';
import { slots, live, audible, playNote, gateSeconds } from './tracks.js';
import { patternFor, LEVELS } from '../pattern.js';

export { SEQ_CELLS };

const LOOKAHEAD = 0.12;
const TICK_MS = 25;

export function cellDur() {
  return (60 / state.seq.bpm) * cellBeats(state.seq.bars);
}

export function cycleCells() {
  return SEQ_CELLS;
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

/* every track plays its own step of whichever pattern the song is on */
function fireTracks(idx, time) {
  const c = idx % SEQ_CELLS;
  const { pattern } = patternFor(Math.floor(idx / SEQ_CELLS), state.seq.chain, state.seq.pattern);
  for (const t of slots) {
    if (!live(t) || !audible(t)) continue;
    const cell = t.seq.pats[pattern][c];
    if (cell.on) playNote(t, { n: cell.n, time, dur: gateSeconds(t, cell, cellDur()), vel: LEVELS[cell.v], mono: true });
  }
}

function fire(idx, time) {
  fireTracks(idx, time);
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
  if (pos < 0) return { cell: 0, frac: 0, cycle: 0, pattern: state.seq.pattern, slot: -1, round: 0 };
  const idx = Math.floor(pos);
  const cycle = Math.floor(idx / SEQ_CELLS);
  const { pattern, slot } = patternFor(cycle, state.seq.chain, state.seq.pattern);
  /* round: how far through this trip round the steps, 0..1 */
  return { cell: idx % SEQ_CELLS, frac: pos - idx, cycle, pattern, slot, round: ((idx % SEQ_CELLS) + (pos - idx)) / SEQ_CELLS };
}

/* context time the transport started (cycle 0 begins here) */
export function seqStartTime() {
  return t0;
}

/* context time of the next trip-round-the-steps boundary at or after now */
export function seqNextCycleStart() {
  if (!playing) return null;
  const rem = (SEQ_CELLS - (count % SEQ_CELLS)) % SEQ_CELLS;
  let at = next + rem * cellDur();
  if (at < audioNow() + 0.05) at += SEQ_CELLS * cellDur();
  return at;
}
