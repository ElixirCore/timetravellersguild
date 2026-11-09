/* INTERFACE v9 — a count-in click while a take is lined up to the beat: one
   short tick per beat from now until the take ends, the first of each bar
   higher. It goes to the master, not through the pedals. */
import { ensureAudio, nodes } from './engine.js';

export function scheduleClicks(from, until, beatSec, barBeats = 4, phase0 = 0) {
  const ctx = ensureAudio();
  const k0 = Math.max(0, Math.ceil((ctx.currentTime + 0.02 - from) / beatSec));
  for (let k = k0; from + k * beatSec < until; k++) {
    const at = from + k * beatSec;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = (k + phase0) % barBeats === 0 ? 1700 : 1100;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.16, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    o.connect(g);
    g.connect(nodes.master);
    o.start(at);
    o.stop(at + 0.08);
  }
}
