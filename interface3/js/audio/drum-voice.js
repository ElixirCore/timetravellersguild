import { state } from '../state.js';
import { getCtx, ensureAudio, nodes } from './context.js';

function out() {
  return nodes.drumLevel;
}

function envPeak(time, peak, attack, decay) {
  const env = getCtx().createGain();
  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(peak, time + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  env.connect(out());
  return env;
}

function playKick(time, variant, vel = 0.9) {
  const ctx = getCtx();
  if (!ctx) return;
  const peak = vel * 0.55;
  const configs = [
    { f0: 150, f1: 42, drop: 0.08, dur: 0.35 },
    { f0: 110, f1: 28, drop: 0.14, dur: 0.55 },
    { f0: 180, f1: 52, drop: 0.06, dur: 0.42 },
  ];
  const c = configs[variant] ?? configs[0];
  const env = envPeak(time, peak, 0.002, c.dur);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(c.f0, time);
  osc.frequency.exponentialRampToValueAtTime(c.f1, time + c.drop);
  osc.connect(env);
  osc.start(time);
  osc.stop(time + c.dur + 0.05);

  if (variant === 2) {
    const click = ctx.createOscillator();
    const clickEnv = envPeak(time, peak * 0.25, 0.001, 0.018);
    click.type = 'triangle';
    click.frequency.value = 820;
    click.connect(clickEnv);
    click.start(time);
    click.stop(time + 0.04);
  }
}

function playSnare(time, variant, vel = 0.85) {
  const ctx = getCtx();
  if (!ctx) return;
  const peak = vel * 0.42;
  const configs = [
    { tone: 180, noise: 0.12, toneAmt: 0.35 },
    { tone: 220, noise: 0.22, toneAmt: 0.28 },
    { tone: 260, noise: 0.08, toneAmt: 0.5 },
  ];
  const c = configs[variant] ?? configs[0];

  const toneEnv = envPeak(time, peak * c.toneAmt, 0.001, 0.09);
  const tone = ctx.createOscillator();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(c.tone, time);
  tone.frequency.exponentialRampToValueAtTime(90, time + 0.07);
  tone.connect(toneEnv);
  tone.start(time);
  tone.stop(time + 0.15);

  const nEnv = envPeak(time, peak, 0.001, c.noise);
  const n = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * c.noise), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  n.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = variant === 2 ? 4200 : 2800;
  bp.Q.value = 0.7;
  n.connect(bp).connect(nEnv);
  n.start(time);
}

function playHat(time, variant, vel = 0.75) {
  const ctx = getCtx();
  if (!ctx) return;
  const peak = vel * 0.28;
  const configs = [
    { dur: 0.035, freq: 7000 },
    { dur: 0.16, freq: 6200 },
    { dur: 0.025, freq: 9500 },
  ];
  const c = configs[variant] ?? configs[0];
  const env = envPeak(time, peak, 0.001, c.dur);
  const n = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * c.dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  n.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = c.freq;
  n.connect(hp).connect(env);
  n.start(time);
}

export function playDrum(part, time, vel = 0.85) {
  const variant = state.drums.sounds[part] ?? 0;
  if (part === 'kick') playKick(time, variant, vel);
  else if (part === 'snare') playSnare(time, variant, vel);
  else playHat(time, variant, vel);
}

export function auditionDrum(part) {
  const ctx = ensureAudio();
  ctx.resume();
  playDrum(part, ctx.currentTime + 0.01, 0.8);
}
