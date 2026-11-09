/* INTERFACE v7 — the settings kept between visits: the pedal chain, the
   looper knobs and FIELD TAP. Tracks are not kept here, as in /interface2:
   SAVE keeps them as a mix. */
export const MAX_TRACKS = 8; // the /interface2 cap; one track per cell of the tesseract
export const FIELD_PADS = 8;

/* The ECHO pedal steps through beat divisions, so it needs a tempo. v6 has
   no transport (tracks loop freely, as in /interface2), so the divisions sit
   on v5's default tempo. */
export const FIXED_BPM = 112;
export const TIME_STEPS = ['1/16', '1/8', '1/8D', '1/4'];
export const TIME_MULT = { '1/16': 0.25, '1/8': 0.5, '1/8D': 0.75, '1/4': 1 };

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
  };
}

export const state = defaultState();

const STORAGE_KEY = 'interface7-rig-v1';
// read-only: a first visit starts from the v6 (or v5, v4) pedal, looper and field settings
const SEED_KEYS = ['interface6-rig-v1', 'interface5-rig-v1', 'interface4-rig-v1'];
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
  /* v7 opens unaffected: every pedal starts switched off (their knobs are
     kept); stomp one to bring it in */
  for (const def of PEDAL_DEFS) state.pedals[def.id].on = false;
}
