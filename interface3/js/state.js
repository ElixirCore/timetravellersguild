export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const SCALES = {
  MINOR: [0, 2, 3, 5, 7, 8, 10],
  MAJOR: [0, 2, 4, 5, 7, 9, 11],
  DORIAN: [0, 2, 3, 5, 7, 9, 10],
  PHRYGIAN: [0, 1, 3, 5, 7, 8, 10],
  LYDIAN: [0, 2, 4, 6, 7, 9, 11],
  MIXO: [0, 2, 4, 5, 7, 9, 10],
  PENT: [0, 3, 5, 7, 10],
  CHROMATIC: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const RATE_STEPS = ['1/4', '1/8', '1/8T', '1/16', '1/16T'];
export const RATE_MULT = { '1/4': 1, '1/8': 0.5, '1/8T': 1 / 3, '1/16': 0.25, '1/16T': 1 / 6 };
export const BASS_RATE_STEPS = ['1/4', '1/8', '1/16'];
export const TIME_STEPS = ['1/16', '1/8', '1/8D', '1/4'];
export const TIME_MULT = { '1/16': 0.25, '1/8': 0.5, '1/8D': 0.75, '1/4': 1 };
export const SHAPE_NAMES = ['SAW', 'SQR', 'TRI', 'FM'];
export const DIRECTIONS = ['UP', 'DOWN', 'PEND', 'RAND'];

export const MAX_DEGREE = 14;
export const BASS_MAX_DEGREE = 7;
export const MAX_STEPS = 16;
export const BASS_STEPS = 8;
export const DRUM_STEPS = 16;
export const DRUM_PARTS = ['kick', 'snare', 'hat'];
export const FIELD_PADS = 8;
export const FIELD_STEPS = 16;
export const SEED_LANES = 4;
export const SEED_STEPS = 16;
export const DRUM_SOUNDS = {
  kick: ['PUNCH', 'SUB', '808'],
  snare: ['TIGHT', 'ROOM', 'TRAP'],
  hat: ['CLOSED', 'OPEN', 'METAL'],
};
export const MIN_GATE = 10;
export const MAX_GATE = 150;
export const MAX_LOOP_BARS = 16;

export const ARP_BANKS = [
  {
    id: 'voice', name: 'VOICE',
    params: [
      { key: 'shape', label: 'SHAPE' },
      { key: 'bright', label: 'BRIGHT' },
      { key: 'decay', label: 'DECAY' },
    ],
  },
  {
    id: 'tone', name: 'TONE',
    params: [
      { key: 'cutoff', label: 'CUTOFF' },
      { key: 'reso', label: 'RESO' },
      { key: 'level', label: 'LEVEL' },
    ],
  },
  {
    id: 'motion', name: 'MOTION',
    params: [
      { key: 'rate', label: 'RATE' },
      { key: 'range', label: 'RANGE' },
      { key: 'swing', label: 'SWING' },
    ],
  },
];

export const PEDAL_DEFS = [
  {
    id: 'drive', name: 'DIRT', accent: '#e07830',
    params: [{ key: 'drive', label: 'DRIVE' }, { key: 'tone', label: 'TONE' }, { key: 'level', label: 'LEVEL' }],
  },
  {
    id: 'wah', name: 'WAH', accent: '#d3a52f',
    params: [{ key: 'freq', label: 'FREQ' }, { key: 'reso', label: 'RESO' }, { key: 'speed', label: 'SPEED' }],
  },
  {
    id: 'chorus', name: 'CHORUS', accent: '#3f8fd2',
    params: [{ key: 'rate', label: 'RATE' }, { key: 'depth', label: 'DEPTH' }, { key: 'mix', label: 'MIX' }],
  },
  {
    id: 'phaser', name: 'PHASER', accent: '#9268cf',
    params: [{ key: 'rate', label: 'RATE' }, { key: 'depth', label: 'DEPTH' }, { key: 'mix', label: 'MIX' }],
  },
  {
    id: 'delay', name: 'ECHO', accent: '#4d9e5f',
    params: [{ key: 'time', label: 'TIME' }, { key: 'feedback', label: 'FDBK' }, { key: 'mix', label: 'MIX' }],
  },
  {
    id: 'reverb', name: 'VERB', accent: '#c8bfa5',
    params: [{ key: 'size', label: 'SIZE' }, { key: 'tone', label: 'TONE' }, { key: 'mix', label: 'MIX' }],
  },
];

export function zone(value, n) {
  return Math.min(n - 1, Math.floor((value / 100) * n));
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

const ARP_DEGREES = [0, 2, 4, 7, 2, 4, 7, 9, 4, 7, 9, 11, 7, 9, 11, 14];
const ARP_GATES = [70, 40, 40, 55, 70, 40, 40, 55, 70, 40, 40, 55, 80, 45, 45, 95];
const BASS_ONS = [true, false, true, false, true, false, true, true];
const BASS_DEGREES = [0, 0, 0, 0, 3, 0, 4, 3];
const BASS_GATES = [95, 40, 45, 40, 80, 40, 55, 110];
const DRUM_KICK = [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false];
const DRUM_SNARE = [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false];
const DRUM_HAT = [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false];

function drumSteps(values) {
  return values.map((on) => ({ on }));
}


function fieldSteps() {
  return Array.from({ length: FIELD_PADS }, () =>
    Array.from({ length: FIELD_STEPS }, () => ({ on: false, rate: 1 })));
}

function seedSteps() {
  return Array.from({ length: SEED_LANES }, () =>
    Array.from({ length: SEED_STEPS }, () => ({ on: false, rate: 1 })));
}

function defaultState() {
  return {
    bpm: 112,
    root: 0,
    scale: 'MINOR',
    arp: {
      mute: false,
      direction: 'UP',
      length: 16,
      mode: 0,
      steps: ARP_DEGREES.map((degree, i) => ({ on: true, degree, gate: ARP_GATES[i] })),
      banks: {
        voice: { shape: 12, bright: 66, decay: 42 },
        tone: { cutoff: 64, reso: 18, level: 75 },
        motion: { rate: 60, range: 34, swing: 12 },
      },
    },
    bass: {
      on: true,
      length: 8,
      rate: 40,
      glide: 25,
      tone: 45,
      punch: 60,
      level: 72,
      steps: BASS_DEGREES.map((degree, i) => ({ on: BASS_ONS[i], degree, gate: BASS_GATES[i] })),
    },
    drums: {
      on: true,
      mute: false,
      length: 16,
      active: 'kick',
      level: 78,
      sounds: { kick: 0, snare: 0, hat: 0 },
      steps: {
        kick: drumSteps(DRUM_KICK),
        snare: drumSteps(DRUM_SNARE),
        hat: drumSteps(DRUM_HAT),
      },
    },
    field: {
      on: true,
      mute: false,
      length: 16,
      activePad: 0,
      padMute: Array.from({ length: FIELD_PADS }, () => false),
      threshold: 35,
      level: 78,
      steps: fieldSteps(),
    },
    stylus: {
      on: true,
      mute: false,
      mode: 'mood',
      level: 52,
      range: 58,
      glide: 62,
      breath: 38,
      x: 0.5,
      y: 0,
      wub: { reso: 62 },
      fx: {
        chorusOn: true,
        reverbOn: true,
        warm: 44,
        space: 34,
      },
    },
    pedals: {
      drive: { on: false, drive: 25, tone: 60, level: 70 },
      wah: { on: false, freq: 45, reso: 40, speed: 0 },
      chorus: { on: false, rate: 30, depth: 40, mix: 35 },
      phaser: { on: false, rate: 25, depth: 50, mix: 40 },
      delay: { on: true, time: 55, feedback: 35, mix: 25 },
      reverb: { on: true, size: 55, tone: 60, mix: 30 },
    },
    looper: {
      level: 80,
      speed: 50,
      glitch: 0,
      crush: 0,
    },
    seed: {
      on: true,
      mute: false,
      length: 16,
      activeLane: 0,
      laneMute: Array.from({ length: SEED_LANES }, () => false),
      level: 80,
      lanes: Array.from({ length: SEED_LANES }, () => null),
      laneLabels: Array.from({ length: SEED_LANES }, () => ''),
      steps: seedSteps(),
    },
  };
}

export const state = defaultState();

export const runtime = {
  playing: false,
  rec: false,
  recExporting: false,
  lanes: null,
  queue: [],
  dragInfo: null,
  sceneActiveSlot: 0,
  sceneRecalledSlot: null,
};

const STORAGE_KEY = 'interface3-rig-v1';
const OLD_KEY = 'interface3-rig-v0';
let saveTimer = null;
let saveListeners = new Set();

export function onSave(fn) {
  saveListeners.add(fn);
  return () => saveListeners.delete(fn);
}

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* storage unavailable */ }
    saveListeners.forEach((fn) => fn());
  }, 300);
}

function mergeBranch(fresh, saved, keys) {
  const out = { ...fresh };
  for (const key of keys) {
    if (saved && saved[key] !== undefined) out[key] = saved[key];
  }
  return out;
}

export function captureSnapshot() {
  return JSON.parse(JSON.stringify({
    version: 1,
    bpm: state.bpm,
    root: state.root,
    scale: state.scale,
    arp: state.arp,
    bass: state.bass,
    drums: state.drums,
    field: state.field,
    stylus: state.stylus,
    pedals: state.pedals,
    seed: state.seed,
  }));
}

export function applySnapshot(snapshot) {
  if (!snapshot) return;
  const looper = { ...state.looper };
  applySaved(snapshot);
  state.looper = looper;
}

function applySaved(saved) {
  const fresh = defaultState();
  state.bpm = saved.bpm ?? fresh.bpm;
  state.root = saved.root ?? fresh.root;
  state.scale = SCALES[saved.scale] ? saved.scale : fresh.scale;

  state.arp = mergeBranch(fresh.arp, saved.arp, ['mute', 'direction', 'length', 'mode']);
  state.arp.steps = Array.isArray(saved.arp?.steps) && saved.arp.steps.length === MAX_STEPS
    ? saved.arp.steps
    : fresh.arp.steps;
  state.arp.banks = {};
  for (const bank of ARP_BANKS) {
    state.arp.banks[bank.id] = { ...fresh.arp.banks[bank.id], ...(saved.arp?.banks?.[bank.id] || {}) };
  }
  state.arp.mode = clamp(state.arp.mode, 0, ARP_BANKS.length - 1);

  state.bass = mergeBranch(fresh.bass, saved.bass, ['on', 'length', 'rate', 'glide', 'tone', 'punch', 'level']);
  state.bass.steps = Array.isArray(saved.bass?.steps) && saved.bass.steps.length === BASS_STEPS
    ? saved.bass.steps
    : fresh.bass.steps;

  state.drums = mergeBranch(fresh.drums, saved.drums, ['on', 'mute', 'length', 'active', 'level']);
  state.drums.sounds = { ...fresh.drums.sounds, ...(saved.drums?.sounds || {}) };
  state.drums.steps = { kick: [], snare: [], hat: [] };
  for (const part of DRUM_PARTS) {
    const savedSteps = saved.drums?.steps?.[part];
    state.drums.steps[part] = Array.isArray(savedSteps) && savedSteps.length === DRUM_STEPS
      ? savedSteps
      : fresh.drums.steps[part];
  }
  if (!DRUM_PARTS.includes(state.drums.active)) state.drums.active = 'kick';

  state.field = mergeBranch(fresh.field, saved.field, [
    'on', 'mute', 'length', 'activePad', 'threshold', 'level',
  ]);
  state.field.activePad = clamp(state.field.activePad ?? 0, 0, FIELD_PADS - 1);
  state.field.padMute = Array.from({ length: FIELD_PADS }, (_, i) => !!saved.field?.padMute?.[i]);
  const savedFieldSteps = saved.field?.steps;
  if (Array.isArray(savedFieldSteps) && savedFieldSteps.length === FIELD_PADS
    && savedFieldSteps.every((row) => Array.isArray(row) && row.length === FIELD_STEPS)) {
    state.field.steps = savedFieldSteps.map((row) =>
      row.map((s) => ({
        on: !!s?.on,
        rate: clamp(Number(s?.rate) || 1, 0.25, 4),
      })),
    );
  } else {
    state.field.steps = fieldSteps();
  }

  const savedStylus = saved.stylus || saved.chords;
  state.stylus = mergeBranch(fresh.stylus, savedStylus, [
    'on', 'mute', 'mode', 'level', 'range', 'glide', 'breath', 'x', 'y',
  ]);
  state.stylus.mode = savedStylus?.mode === 'wub' ? 'wub' : 'mood';
  state.stylus.wub = {
    reso: clamp(Number(savedStylus?.wub?.reso ?? fresh.stylus.wub.reso), 0, 100),
  };
  state.stylus.fx = {
    ...fresh.stylus.fx,
    chorusOn: savedStylus?.fx?.chorusOn ?? fresh.stylus.fx.chorusOn,
    reverbOn: savedStylus?.fx?.reverbOn ?? fresh.stylus.fx.reverbOn,
    warm: savedStylus?.fx?.warm ?? savedStylus?.fx?.cutoff ?? fresh.stylus.fx.warm,
    space: savedStylus?.fx?.space ?? savedStylus?.fx?.reverbMix ?? fresh.stylus.fx.space,
  };
  state.stylus.x = clamp(state.stylus.x ?? 0.5, 0, 1);
  state.stylus.y = clamp(state.stylus.y ?? 0, 0, 1);

  state.pedals = {};
  for (const def of PEDAL_DEFS) {
    state.pedals[def.id] = { ...fresh.pedals[def.id], ...(saved.pedals?.[def.id] || {}) };
  }

  state.seed = mergeBranch(fresh.seed, saved.seed, [
    'on', 'mute', 'length', 'activeLane', 'level',
  ]);
  state.seed.activeLane = clamp(state.seed.activeLane ?? 0, 0, SEED_LANES - 1);
  state.seed.laneMute = Array.from({ length: SEED_LANES }, (_, i) => !!saved.seed?.laneMute?.[i]);
  state.seed.lanes = Array.from({ length: SEED_LANES }, (_, i) => {
    const id = saved.seed?.lanes?.[i];
    return typeof id === 'string' && id ? id : null;
  });
  state.seed.laneLabels = Array.from({ length: SEED_LANES }, (_, i) =>
    typeof saved.seed?.laneLabels?.[i] === 'string' ? saved.seed.laneLabels[i] : '');
  const savedSeedSteps = saved.seed?.steps;
  if (Array.isArray(savedSeedSteps) && savedSeedSteps.length === SEED_LANES
    && savedSeedSteps.every((row) => Array.isArray(row) && row.length === SEED_STEPS)) {
    state.seed.steps = savedSeedSteps.map((row) =>
      row.map((st) => ({
        on: !!st?.on,
        rate: clamp(Number(st?.rate) || 1, 0.25, 4),
      })),
    );
  } else {
    state.seed.steps = seedSteps();
  }

  state.looper = { ...fresh.looper, ...(saved.looper || {}) };
}

function migrateMk2(old) {
  const fresh = defaultState();
  const banks = old.banks || {};
  return {
    bpm: old.bpm,
    root: old.root,
    scale: old.scale,
    arp: {
      direction: old.direction,
      length: old.length,
      mode: 0,
      steps: old.steps,
      banks: {
        voice: banks.voice,
        tone: {
          cutoff: banks.filter?.cutoff ?? fresh.arp.banks.tone.cutoff,
          reso: banks.filter?.reso ?? fresh.arp.banks.tone.reso,
          level: fresh.arp.banks.tone.level,
        },
        motion: banks.motion,
      },
    },
    pedals: {
      drive: { ...fresh.pedals.drive, drive: banks.filter?.drive ?? fresh.pedals.drive.drive },
      delay: {
        ...fresh.pedals.delay,
        time: banks.space?.time ?? fresh.pedals.delay.time,
        mix: banks.space?.echo ?? fresh.pedals.delay.mix,
        feedback: banks.space?.echo ?? fresh.pedals.delay.feedback,
      },
      reverb: { ...fresh.pedals.reverb, mix: banks.space?.verb ?? fresh.pedals.reverb.mix },
    },
  };
}

export function load() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const oldRaw = localStorage.getItem(OLD_KEY);
      if (oldRaw) {
        applySaved(migrateMk2(JSON.parse(oldRaw)));
        localStorage.removeItem(OLD_KEY);
        save();
        return;
      }
    }
    if (raw) applySaved(JSON.parse(raw));
  } catch { /* corrupt save; keep defaults */ }
}

export function reset() {
  const fresh = defaultState();
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OLD_KEY);
  } catch { /* ignore */ }
}
