import { state, zone, SHAPE_NAMES } from '../state.js';
import { getCtx, ensureAudio, nodes } from './context.js';

export function playArpNote(midi, time, vel, dur) {
  const ctx = getCtx();
  if (!ctx) return;
  const { shape, bright, decay } = state.arp.banks.voice;
  const shapeName = SHAPE_NAMES[zone(shape, SHAPE_NAMES.length)];
  const f = 440 * 2 ** ((midi - 69) / 12);

  const env = ctx.createGain();
  const peak = vel * 0.22 * (shapeName === 'SQR' ? 0.7 : 1);
  const sus = peak * (0.12 + (decay / 100) * 0.5);
  const tail = 0.04 + (decay / 100) * 0.45;
  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(peak, time + 0.004);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus), time + Math.max(0.02, dur * 0.7));
  env.gain.exponentialRampToValueAtTime(0.0001, time + dur + tail);
  env.connect(nodes.arpFilter);

  const stopAt = time + dur + tail + 0.1;

  if (shapeName === 'FM') {
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    carrier.frequency.value = f;
    mod.frequency.value = f * 2;
    modGain.gain.setValueAtTime(f * (0.5 + (bright / 100) * 6), time);
    modGain.gain.exponentialRampToValueAtTime(f * 0.2, time + dur + tail);
    mod.connect(modGain).connect(carrier.frequency);
    carrier.connect(env);
    mod.start(time);
    carrier.start(time);
    mod.stop(stopAt);
    carrier.stop(stopAt);
    return;
  }

  const osc = ctx.createOscillator();
  osc.type = { SAW: 'sawtooth', SQR: 'square', TRI: 'triangle' }[shapeName];
  osc.frequency.value = f;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(f * (1.5 + (bright / 100) * 14), time);
  lp.frequency.exponentialRampToValueAtTime(f * (1 + bright / 50), time + Math.max(0.06, dur * 0.5));
  osc.connect(lp).connect(env);
  osc.start(time);
  osc.stop(stopAt);
}

export function auditionArp(midi) {
  const ctx = ensureAudio();
  ctx.resume();
  playArpNote(midi, ctx.currentTime + 0.01, 0.6, 0.18);
}
