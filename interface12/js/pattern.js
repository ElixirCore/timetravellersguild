/* INTERFACE v12 — what a track's melody is. Pure data, no audio.

   Every track has FOUR patterns (A B C D) of 16 steps (the one timing model,
   seqmodel.js: 16 steps stretched over 1–16 bars). A step is
   { on, n, g, v } and is drawn as a petal on each of the stacked discs:
     n  pitch: whole semitones from middle C, snapped to the chosen scale
        (C4 plays the sample as recorded, at the track's pitch)
     g  length: an index into GATES (how long the note is held before it is
        let go; the last stop plays it out)
     v  level: an index into LEVELS
   The SONG is a disc of eight petals, each naming a pattern or nothing; one
   petal lasts one trip round the steps, and every track follows the song
   together. An empty song just loops the pattern being shown. */
import { SEQ_CELLS } from './seqmodel.js';

export const PATTERNS = 4;
export const PATTERN_NAMES = ['A', 'B', 'C', 'D'];
export const CHAIN_SLOTS = 8;
export const CHOP_STOPS = [1, 2, 4, 8, 16];
export const NOTE_MIN = -36;
export const NOTE_MAX = 36;
/* lengths in steps (0 = play it out) and levels */
export const GATES = [0.125, 0.25, 0.5, 1, 2, 0];
export const LEVELS = [0.3, 0.5, 0.7, 0.9];
export const SCALES = [
  { name: 'pentatonic', set: [0, 2, 4, 7, 9] },
  { name: 'major', set: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'minor', set: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'chromatic', set: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

/* the notes a pitch disc offers: two octaves of the scale from middle C
   (one for chromatic), shifted by oct octaves */
export function scaleNotes(scaleIx, oct = 0) {
  const sc = SCALES[scaleIx] || SCALES[0];
  const span = sc.set.length > 7 ? 1 : 2;
  const out = [];
  for (let o = 0; o < span; o++) for (const k of sc.set) out.push(k + 12 * o + 12 * oct);
  out.push(12 * span + 12 * oct);
  return out;
}

export function nearestIndex(list, n) {
  let best = 0;
  for (let i = 1; i < list.length; i++) if (Math.abs(list[i] - n) < Math.abs(list[best] - n)) best = i;
  return best;
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/* n semitones from middle C (MIDI 60) -> "C4", "F#3" … */
export function noteName(n) {
  const m = 60 + n;
  return `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

export function pitchClassName(pc) {
  return NAMES[((pc % 12) + 12) % 12];
}

export const isSharp = (pc) => [1, 3, 6, 8, 10].includes(((pc % 12) + 12) % 12);

export function clampNote(n) {
  return Math.min(NOTE_MAX, Math.max(NOTE_MIN, Math.round(n)));
}

export function newCell() {
  return { on: false, n: 0, g: GATES.length - 1, v: LEVELS.length - 1 };
}

export function newPattern() {
  return Array.from({ length: SEQ_CELLS }, newCell);
}

export function newSeq() {
  return {
    pats: Array.from({ length: PATTERNS }, newPattern),
    gate: GATES.length - 1, // how long every note is held (index into GATES)
    hold: false, // false: a note plays its slice out; true: it loops while held, then lets go
    chops: 1, // (kept for old saves; the discs do not use it)
  };
}

/* a saved/loaded seq, made safe */
export function cleanSeq(raw) {
  const out = newSeq();
  if (!raw || typeof raw !== 'object') return out;
  out.hold = !!raw.hold;
  const gt = Math.round(Number(raw.gate));
  out.gate = Number.isFinite(gt) ? Math.min(GATES.length - 1, Math.max(0, gt)) : GATES.length - 1;
  const c = Math.round(Number(raw.chops));
  out.chops = CHOP_STOPS.includes(c) ? c : 1;
  if (Array.isArray(raw.pats)) {
    for (let p = 0; p < PATTERNS; p++) {
      const row = Array.isArray(raw.pats[p]) ? raw.pats[p] : [];
      for (let i = 0; i < SEQ_CELLS; i++) {
        const cell = row[i];
        if (!cell) continue;
        out.pats[p][i] = {
          on: !!cell.on,
          n: clampNote(Number(cell.n) || 0),
          g: Math.min(GATES.length - 1, Math.max(0, Math.round(Number.isFinite(Number(cell.g)) ? Number(cell.g) : GATES.length - 1))),
          v: Math.min(LEVELS.length - 1, Math.max(0, Math.round(Number.isFinite(Number(cell.v)) ? Number(cell.v) : LEVELS.length - 1))),
        };
      }
    }
  }
  return out;
}

export function cloneSeq(seq) {
  return cleanSeq(JSON.parse(JSON.stringify(seq)));
}

export function patternHasSteps(seq, p) {
  return !!seq && seq.pats[p].some((c) => c.on);
}

export function hasSteps(seq) {
  return !!seq && seq.pats.some((pat) => pat.some((c) => c.on));
}

/* the chain as the list of slot indexes that are in use, in order */
export function chainPlan(chain) {
  const out = [];
  chain.forEach((v, i) => { if (v >= 0) out.push(i); });
  return out;
}

/* which pattern and slot plays on the cycle-th trip round the steps.
   An empty chain loops `fallback` (the pattern being looked at). */
export function patternFor(cycle, chain, fallback) {
  const plan = chainPlan(chain);
  if (!plan.length) return { pattern: fallback, slot: -1 };
  const slot = plan[cycle % plan.length];
  return { pattern: chain[slot], slot };
}
