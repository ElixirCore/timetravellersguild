/* INTERFACE v12 — the settings kept between visits: the pedal chain, the
   looper knobs, FIELD TAP and its step layers, the song structure and the
   keyboard octave. Tracks are not kept here, as
   in /interface2: SAVE keeps them as a mix. */
import { SEQ_CELLS, SEQ_DEFAULT_BARS, SEQ_BARS_MAX as MODEL_BARS_MAX, snapBars } from './seqmodel.js';
import { PATTERNS, CHAIN_SLOTS, clampNote } from './pattern.js';

export const MAX_TRACKS = 8; // the /interface2 cap; one track per cell of the tesseract
export const FIELD_PADS = 8;

/* The ECHO pedal steps through beat divisions, so it needs a tempo. There is
   no transport driving it (the /interface2 tracks loop freely), so the
   divisions sit on v5's default tempo, exactly as in v7: the sequencer's BPM
   is its own and does not move the pedal. */
export const FIXED_BPM = 112;
export const TIME_STEPS = ['1/16', '1/8', '1/8D', '1/4'];
export const TIME_MULT = { '1/16': 0.25, '1/8': 0.5, '1/8D': 0.75, '1/4': 1 };

export const SEQ_BARS_MAX = MODEL_BARS_MAX; // the family's cap (v5's MAX_LOOP_BARS)
export const BPM_MIN = 40;
export const BPM_MAX = 200;
export const RATE_MIN = 0.25;
export const RATE_MAX = 4;

export const PEDAL_DEFS = [
  {
    id: 'drive', name: 'DIRT', accent: '#e07830', glyph: 'dirt',
    params: [{ key: 'drive', glyph: 'bolt' }, { key: 'tone', glyph: 'tone' }, { key: 'level', glyph: 'vol' }],
  },
  {
    id: 'wah', name: 'WAH', accent: '#d3a52f', glyph: 'wah',
    params: [{ key: 'freq', glyph: 'freq' }, { key: 'reso', glyph: 'res' }, { key: 'speed', glyph: 'speed' }],
  },
  {
    id: 'chorus', name: 'CHORUS', accent: '#3f8fd2', glyph: 'chorus',
    params: [{ key: 'rate', glyph: 'rate' }, { key: 'depth', glyph: 'depth' }, { key: 'mix', glyph: 'mix' }],
  },
  {
    id: 'phaser', name: 'PHASER', accent: '#9268cf', glyph: 'phaser',
    params: [{ key: 'rate', glyph: 'rate' }, { key: 'depth', glyph: 'depth' }, { key: 'mix', glyph: 'mix' }],
  },
  {
    id: 'delay', name: 'ECHO', accent: '#4d9e5f', glyph: 'echo',
    params: [{ key: 'time', glyph: 'time' }, { key: 'feedback', glyph: 'feedback' }, { key: 'mix', glyph: 'mix' }],
  },
  {
    id: 'reverb', name: 'VERB', accent: '#c8bfa5', glyph: 'hall',
    params: [{ key: 'size', glyph: 'size' }, { key: 'tone', glyph: 'tone' }, { key: 'mix', glyph: 'mix' }],
  },
];

export function zone(value, n) {
  return Math.min(n - 1, Math.floor((value / 100) * n));
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function defaultState() {
  return {
    pedals: {
      drive: { on: false, drive: 25, tone: 60, level: 70 },
      wah: { on: false, freq: 45, reso: 40, speed: 0 },
      chorus: { on: false, rate: 30, depth: 40, mix: 35 },
      phaser: { on: false, rate: 25, depth: 50, mix: 40 },
      delay: { on: false, time: 55, feedback: 35, mix: 25 },
      reverb: { on: false, size: 55, tone: 60, mix: 30 },
    },
    looper: { level: 80, speed: 50, glitch: 0, crush: 0 },
    field: { activePad: 0, auto: false, threshold: 35, level: 78 },
    input: { deviceId: '' }, // the mic / aux input chosen at Keter
    /* the sequencer: each pad is a programmable layer of SEQ_CELLS cells;
       the bars count stretches those same cells over more time (see
       seqmodel.js) — it never adds cells. */
    seq: {
      bpm: FIXED_BPM,
      bars: SEQ_DEFAULT_BARS,
      padMute: Array.from({ length: FIELD_PADS }, () => false),
      steps: Array.from({ length: FIELD_PADS }, () => []),
      /* v9: the song. `pattern` is the one the tracks show (and loop, when the
         chain is empty); `chain` is up to CHAIN_SLOTS slots, each a pattern
         index or -1 for empty. See pattern.js. */
      pattern: 0,
      chain: Array.from({ length: CHAIN_SLOTS }, () => -1),
    },
    /* v9: playing a track like an instrument */
    play: {
      oct: 0, // keyboard octave, -2..2
      brush: 0, // the last note played: a step switched on takes it
      scale: 0, // which notes the pitch petals offer (pattern.js SCALES)
    },
  };
}

export const state = defaultState();

const STORAGE_KEY = 'interface12-rig-v1';
// read-only: a first visit starts from the v8 (else v7, v6, v5, v4) pedal, looper, field and sequencer settings
const SEED_KEYS = ['interface11-rig-v1', 'interface10-rig-v1', 'interface9-rig-v1', 'interface8-rig-v1', 'interface7-rig-v1', 'interface6-rig-v1', 'interface5-rig-v1', 'interface4-rig-v1'];
let saveTimer = null;

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* storage unavailable */ }
  }, 300);
}

function num(v, fallback, lo = 0, hi = 100) {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, lo, hi) : fallback;
}

function applySaved(saved) {
  const fresh = defaultState();
  for (const def of PEDAL_DEFS) {
    const s = saved.pedals?.[def.id] || {};
    const out = { ...fresh.pedals[def.id] };
    for (const key of Object.keys(out)) {
      if (key === 'on') out.on = s.on === undefined ? out.on : !!s.on;
      else out[key] = num(s[key], out[key]);
    }
    state.pedals[def.id] = out;
  }
  for (const key of Object.keys(fresh.looper)) {
    state.looper[key] = num(saved.looper?.[key], fresh.looper[key]);
  }
  state.field.threshold = num(saved.field?.threshold, fresh.field.threshold);
  state.field.level = num(saved.field?.level, fresh.field.level);
  state.field.activePad = Math.round(num(saved.field?.activePad, 0, 0, FIELD_PADS - 1));
  state.field.auto = !!saved.field?.auto;
  state.input.deviceId = typeof saved.input?.deviceId === 'string' ? saved.input.deviceId : '';

  const sq = saved.seq || {};
  state.seq.bpm = Math.round(num(sq.bpm, fresh.seq.bpm, BPM_MIN, BPM_MAX));
  state.seq.bars = snapBars(Math.round(num(sq.bars, fresh.seq.bars, 1, SEQ_BARS_MAX)));
  state.seq.pattern = Math.round(num(sq.pattern, 0, 0, PATTERNS - 1));
  if (Array.isArray(sq.chain)) {
    state.seq.chain = Array.from({ length: CHAIN_SLOTS }, (_, i) => {
      const v = Math.round(Number(sq.chain[i]));
      return Number.isFinite(v) && v >= 0 && v < PATTERNS ? v : -1;
    });
  }
  const pl = saved.play || {};
  state.play.oct = Math.round(num(pl.oct, 0, -2, 2));
  state.play.brush = clampNote(Number(pl.brush) || 0);
  state.play.scale = Math.round(num(pl.scale, 0, 0, 3));
  if (Array.isArray(sq.padMute)) {
    state.seq.padMute = Array.from({ length: FIELD_PADS }, (_, i) => !!sq.padMute[i]);
  }
  if (Array.isArray(sq.steps)) {
    state.seq.steps = Array.from({ length: FIELD_PADS }, (_, p) => {
      const row = Array.isArray(sq.steps[p]) ? sq.steps[p] : [];
      return Array.from({ length: SEQ_CELLS }, (_, i) => {
        const cell = row[i];
        return {
          on: !!cell?.on,
          rate: clamp(Number(cell?.rate) || 1, RATE_MIN, RATE_MAX),
        };
      });
    });
  }
}

export function load() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    for (const key of SEED_KEYS) {
      if (raw) break;
      raw = localStorage.getItem(key);
    }
    if (raw) applySaved(JSON.parse(raw));
  } catch { /* corrupt save; keep defaults */ }
  /* opens unaffected: every pedal starts switched off (their knobs are
     kept); stomp one to bring it in */
  for (const def of PEDAL_DEFS) state.pedals[def.id].on = false;
}
