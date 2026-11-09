// Hand shapes read from MediaPipe's 21 hand landmarks: which fingers are open, which fingertip the
// thumb is touching, and whether the thumb stands out from the hand. Thresholds are relative to
// the hand's own size and use hysteresis, so a shape doesn't flicker on its borders.

export const MUDRAS = {
  gyan: { name: 'Gyan', does: 'grab', how: 'thumb + index' },
  mushti: { name: 'Mushti', does: 'mangle', how: 'fist' },
  shuni: { name: 'Shuni', does: 'beat repeat', how: 'thumb + middle, others open' },
  surya: { name: 'Surya', does: 'DJ filter', how: 'thumb + ring, others open' },
  buddhi: { name: 'Buddhi', does: 'tempo bend', how: 'thumb + little, others open' },
  abhaya: { name: 'Abhaya', does: 'breakdown', how: 'open palm, raised and still' },
  tarjani: { name: 'Tarjani', does: 'echo throw', how: 'index pointing' },
  karana: { name: 'Karana', does: 'reverse', how: 'index + little' },
  kartari: { name: 'Kartari', does: 'next clip', how: 'index + middle' },
  trishula: { name: 'Trishula', does: 'tree swap', how: 'index, middle, ring' },
  shikhara: { name: 'Shikhara', does: 'looper', how: 'fist, thumb up' },
  anjali: { name: 'Anjali', does: 'reset', how: 'both palms together' },
};

const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const FINGERS = [['index', 8, 6], ['middle', 12, 10], ['ring', 16, 14], ['little', 20, 18]];
const TOUCH = { middle: 'shuni', ring: 'surya', little: 'buddhi' };

export function readShape(lm, prev = {}) {
  const size = D(lm[0], lm[9]) || 1e-3, ext = {}, touch = {};
  for (const [k, tip, pip] of FINGERS) {
    const r = D(lm[0], lm[tip]) / (D(lm[0], lm[pip]) || 1e-3);
    ext[k] = prev.ext && prev.ext[k] ? r > 1.02 : r > 1.12;
    touch[k] = D(lm[4], lm[tip]) / size;
  }
  const out = D(lm[4], lm[5]) / size;
  return { ext, touch, thumbOut: prev.thumbOut ? out > 0.5 : out > 0.65, size };
}

// `was` is the mudra currently held, which loosens its own thresholds a little.
export function classify(sh, pinch, was) {
  const { ext: e, touch: t, thumbOut } = sh;
  if (pinch) return 'gyan';
  const near = k => t[k] < (was === TOUCH[k] ? 0.45 : 0.3);
  if (near('middle') && e.index && e.ring && e.little) return 'shuni';
  if (near('ring') && e.index && e.middle && e.little) return 'surya';
  if (near('little') && e.index && e.middle && e.ring) return 'buddhi';
  const open = +e.index + +e.middle + +e.ring + +e.little;
  if (open === 4) return thumbOut ? 'abhaya' : null;
  if (open === 0) return thumbOut ? 'shikhara' : 'mushti';
  if (e.index && e.middle && e.ring && !e.little) return 'trishula';
  if (e.index && e.middle && !e.ring && !e.little) return 'kartari';
  if (e.index && e.little && !e.middle && !e.ring) return 'karana';
  if (e.index && !e.middle && !e.ring && !e.little) return 'tarjani';
  return null;
}

// Debounce: a shape must hold for `on` frames to start and be gone for `off` frames to end.
export function settle(s, cand, on = 4, off = 3) {
  if (cand === s.mudra) { s.miss = 0; s.cand = cand; s.run = 0; return s.mudra; }
  if (cand === s.cand) s.run = (s.run || 0) + 1; else { s.cand = cand; s.run = 1; }
  s.miss = (s.miss || 0) + 1;
  if (s.run >= on) { s.mudra = cand; s.since = performance.now(); s.miss = 0; }
  else if (s.mudra && s.miss >= off && !cand) s.mudra = null;
  return s.mudra;
}
