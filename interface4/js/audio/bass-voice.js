import { state } from '../state.js';
import { getCtx, ensureAudio, nodes } from './context.js';

let lastFreq = null;

export function resetGlide() {
  lastFreq = null;
}

export function playBassNote(midi, time, vel, dur) {
  const ctx = getCtx();
  if (!ctx) return;
  const { glide, punch } = state.bass;
  const f = 440 * 2 ** ((midi - 69) / 12);

  const env = ctx.createGain();
  const peak = vel * 0.34;
  const punchAmt = punch / 100;
  const sus = peak * (0.65 - punchAmt * 0.4);
  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(peak, time + 0.006);
  env.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, sus),
    time + 0.02 + (1 - punchAmt) * 0.12 + dur * 0.35,
  );
  env.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.06);
  env.connect(nodes.bassFilter);

  // Per-note punch filter: snaps open then settles onto the strip's tone filter.
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  const baseF = f * 3;
  lp.frequency.setValueAtTime(baseF * (1 + punchAmt * 7), time);
  lp.frequency.exponentialRampToValueAtTime(baseF, time + 0.04 + punchAmt * 0.12);
  lp.Q.value = 2 + punchAmt * 6;
  lp.connect(env);

  const glideTime = (glide / 100) * 0.18;
  const startF = lastFreq ?? f;
  lastFreq = f;
  const stopAt = time + dur + 0.2;

  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  const tri = ctx.createOscillator();
  tri.type = 'triangle';
  for (const osc of [saw, tri]) {
    osc.frequency.setValueAtTime(Math.max(20, startF), time);
    if (glideTime > 0.004 && startF !== f) {
      osc.frequency.exponentialRampToValueAtTime(f, time + glideTime);
    } else {
      osc.frequency.setValueAtTime(f, time);
    }
    osc.start(time);
    osc.stop(stopAt);
  }
  const sawGain = ctx.createGain();
  sawGain.gain.value = 0.55;
  const triGain = ctx.createGain();
  triGain.gain.value = 0.75;
  saw.connect(sawGain).connect(lp);
  tri.connect(triGain).connect(lp);
}

export function auditionBass(midi) {
  const ctx = ensureAudio();
  ctx.resume();
  playBassNote(midi, ctx.currentTime + 0.01, 0.7, 0.25);
}
