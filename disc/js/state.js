/* DISC — what the instrument is. Four rings of sixteen steps; each ring plays
   one sound; a step is { on, n } where n is the note in semitones from the
   sound's own pitch. The keys at the middle are the scale. */
export const NRINGS = 4;
export const STEPS = 16;

/* eight keys per scale, in semitones */
export const SCALES = [
  { name: 'pentatonic', tag: 'pe', set: [0, 2, 4, 7, 9, 12, 14, 16] },
  { name: 'major', tag: 'ma', set: [0, 2, 4, 5, 7, 9, 11, 12] },
  { name: 'minor', tag: 'mi', set: [0, 2, 3, 5, 7, 8, 10, 12] },
  { name: 'blues', tag: 'bl', set: [0, 3, 5, 6, 7, 10, 12, 15] },
];

const line = (list) => {
  const steps = Array.from({ length: STEPS }, () => ({ on: false, n: 0 }));
  list.forEach(([i, n = 0]) => { steps[i] = { on: true, n }; });
  return steps;
};

/* it opens as a groove, so there is something to play with at once */
function demo() {
  return [
    { sound: { t: 'kit', i: 0 }, mute: false, steps: line([[0], [6], [10]]) },
    { sound: { t: 'kit', i: 1 }, mute: false, steps: line([[4], [12]]) },
    { sound: { t: 'kit', i: 2 }, mute: false, steps: line([0, 2, 4, 6, 8, 10, 12, 14].map((i) => [i])) },
    { sound: { t: 'kit', i: 5 }, mute: false, steps: line([[0, 0], [3, 0], [6, 7], [8, 0], [10, 5], [12, 3], [14, 7]]) },
  ];
}

export const S = {
  bpm: 96,
  scale: 0,
  focus: 3,
  brush: 0, // the note a tapped step takes: the last key you played
  rec: false,
  rings: demo(),
  mine: [], // [{ id, name }] sounds you made or recorded, newest first
};

const KEY = 'disc-v1';
export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw) return;
    S.bpm = Math.min(200, Math.max(50, Math.round(raw.bpm) || 96));
    S.scale = SCALES[raw.scale] ? raw.scale : 0;
    S.focus = Math.min(NRINGS - 1, Math.max(0, raw.focus | 0));
    S.mine = Array.isArray(raw.mine) ? raw.mine.filter((m) => m && m.id).slice(0, 6) : [];
    if (Array.isArray(raw.rings)) {
      raw.rings.slice(0, NRINGS).forEach((r, k) => {
        if (!r || !Array.isArray(r.steps)) return;
        S.rings[k].mute = !!r.mute;
        if (r.sound && (r.sound.t === 'kit' || r.sound.t === 'mine')) S.rings[k].sound = r.sound;
        S.rings[k].steps = Array.from({ length: STEPS }, (_, i) => {
          const c = r.steps[i];
          return { on: !!c?.on, n: Math.max(-24, Math.min(36, Math.round(Number(c?.n)) || 0)) };
        });
      });
    }
  } catch { /* start from the groove */ }
}

let pending = null;
export function save() {
  clearTimeout(pending);
  pending = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private window */ }
  }, 300);
}
