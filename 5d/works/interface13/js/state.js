/* interface13 — what the instrument is.

   One circle. Around it, sixteen steps of time. Out from the middle, eight
   lanes of pitch, low at the centre, high at the rim. A dot is a sound at a
   time and a pitch: { u, t, p } (u = which pebble). A long sound (a piece of
   music) is chopped instead: its lanes are eight slices of it. One dot per
   place. That is all. */
export const STEPS = 16;
export const LANES = 8;

/* moods: eight pitches each, in semitones from the sound's own note */
export const MOODS = [
  { name: 'dusk', set: [-5, -2, 0, 3, 5, 7, 10, 12] },   // minor pentatonic
  { name: 'dawn', set: [-5, -3, 0, 2, 4, 7, 9, 12] },    // major pentatonic
  { name: 'east', set: [-5, -4, -2, 0, 1, 4, 5, 7] },    // hijaz
  { name: 'drift', set: [-6, -4, -2, 0, 2, 4, 6, 8] },   // whole tone
];

const HUES = [28, 200, 340, 150, 48, 270, 12, 180, 90, 310];

let uid = 1;
export const nextU = () => uid++;
export const hueFor = (n) => HUES[n % HUES.length];

function demo() {
  const pal = [
    { u: 1, src: { t: 'kit', i: 0 } }, // kick
    { u: 2, src: { t: 'kit', i: 1 } }, // snare
    { u: 3, src: { t: 'kit', i: 2 } }, // hat
    { u: 4, src: { t: 'kit', i: 4 } }, // sub
    { u: 5, src: { t: 'kit', i: 6 } }, // pluck
    { u: 6, src: { t: 'kit', i: 7 } }, // bell
  ].map((x, n) => ({ ...x, hue: hueFor(n) }));
  const dots = [];
  const put = (u, t, p) => dots.push({ u, t, p });
  [0, 7, 10].forEach((t) => put(1, t, 0));
  [4, 12].forEach((t) => put(2, t, 3));
  [2, 6, 11, 14].forEach((t) => put(3, t, 7));
  [[0, 2], [3, 2], [8, 1], [11, 4]].forEach(([t, p]) => put(4, t, p));
  [[1, 5], [5, 6], [9, 4], [13, 5], [15, 6]].forEach(([t, p]) => put(5, t, p));
  return { pal, dots };
}

const d = demo();
export const S = {
  bpm: 92,
  mood: 0,
  sel: 5, // the pebble that taps place
  pal: d.pal, // [{ u, hue, src: {t:'kit',i} | {t:'mine',id,name,long,bpm} }]
  dots: d.dots,
  snap: false, // false: drag a petal in or out to bend its pitch freely; true: it stays on the mood's scale
};
uid = 7;

const KEY = 'interface13';
const OLD = 'halo-v1'; // sounds and dots carry over from HALO

export function load() {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD) || 'null');
    if (!j || !Array.isArray(j.pal) || !Array.isArray(j.dots)) return;
    Object.assign(S, {
      bpm: Math.max(50, Math.min(200, j.bpm | 0 || 92)),
      mood: (j.mood | 0) % MOODS.length,
      sel: j.sel | 0,
      pal: j.pal,
      snap: !!j.snap,
      dots: j.dots.filter((x) => x.t >= 0 && x.t < STEPS && x.p >= 0 && x.p < LANES)
        .map((x) => (typeof x.f === 'number' && x.f >= 0 && x.f <= LANES - 1 ? x : { u: x.u, t: x.t, p: x.p })),
    });
    uid = Math.max(uid, ...S.pal.map((x) => x.u + 1));
    if (!S.pal.some((x) => x.u === S.sel)) S.sel = S.pal[0]?.u ?? 0;
  } catch { /* fresh */ }
}

let t = null;
export function save() {
  clearTimeout(t);
  t = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ bpm: S.bpm, mood: S.mood, sel: S.sel, snap: S.snap, pal: S.pal, dots: S.dots })); } catch { /* full or private */ }
  }, 250);
}

/* undo: a stack of what the circle looked like */
const past = [];
export function remember() {
  past.push(JSON.stringify({ pal: S.pal, dots: S.dots, sel: S.sel }));
  if (past.length > 60) past.shift();
}
export function undo() {
  const j = past.pop();
  if (!j) return false;
  Object.assign(S, JSON.parse(j));
  save();
  return true;
}

export const dotAt = (t, p) => S.dots.find((x) => x.t === t && x.p === p);
export const pebble = (u) => S.pal.find((x) => x.u === u);
