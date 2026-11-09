import {
  state, zone, RATE_STEPS, RATE_MULT, BASS_RATE_STEPS,
} from '../state.js';

let t0 = 0;

export function setT0(t) { t0 = t; }
export function getT0() { return t0; }

export function beatDur() {
  return 60 / state.bpm;
}

export function barDur() {
  return beatDur() * 4;
}

export function arpInterval() {
  return beatDur() * RATE_MULT[RATE_STEPS[zone(state.arp.banks.motion.rate, RATE_STEPS.length)]];
}

export function bassInterval() {
  return beatDur() * RATE_MULT[BASS_RATE_STEPS[zone(state.bass.rate, BASS_RATE_STEPS.length)]];
}

export function drumInterval() {
  return beatDur() * 0.25;
}

export function octaveRange() {
  return 1 + zone(state.arp.banks.motion.range, 4);
}

export function swingOffset(count, interval) {
  const swing = state.arp.banks.motion.swing;
  return count % 2 ? interval * (swing / 100) * 0.42 : 0;
}

export function nextBarTime(after) {
  const bar = barDur();
  const n = Math.max(0, Math.ceil((after - t0) / bar - 1e-6));
  return t0 + n * bar;
}
