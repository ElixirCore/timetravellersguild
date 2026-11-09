/* INTERFACE v12 — the built-in kit. The /interface5 BEATBOX and LOWBUILDER
   voices, rendered once into samples (offline) so they play on the same
   petal rings as everything else: a kick, snare, hats, a clap, a tom, a sub
   bass and an acid bass. Needs no server, so there is always something to
   play. Drum samples sit at their natural pitch; the bass samples are C2, so
   the ring's notes walk up from there. */
import { getCtx, ensureAudio } from './engine.js';
import { storeSound } from './samples.js';

/* seed lines: [step, index into the scale]. Drums stay on the root. */
export const KIT = [
  { tag: 'ki', name: 'kick', role: 'drum', secs: 0.5, voice: 'kick', seed: [[0, 0], [5, 0], [8, 0], [13, 0]] },
  { tag: 'sn', name: 'snare', role: 'drum', secs: 0.3, voice: 'snare', seed: [[4, 0], [12, 0]] },
  { tag: 'hh', name: 'closed hat', role: 'drum', secs: 0.12, voice: 'hat', seed: [0, 2, 4, 6, 8, 10, 12, 14].map((s) => [s, 0]) },
  { tag: 'oh', name: 'open hat', role: 'drum', secs: 0.3, voice: 'ohat', seed: [[6, 0], [14, 0]] },
  { tag: 'cl', name: 'clap', role: 'drum', secs: 0.3, voice: 'clap', seed: [[4, 0], [12, 0]] },
  { tag: 'tm', name: 'tom', role: 'drum', secs: 0.45, voice: 'tom', seed: [[10, 0], [11, 1], [15, 2]] },
  { tag: 'sb', name: 'sub bass', role: 'bass', secs: 0.7, voice: 'sub', seed: [[0, 0], [3, 0], [6, 2], [8, 0], [10, 3], [12, 2], [14, 4]] },
  { tag: 'ab', name: 'acid bass', role: 'bass', secs: 0.5, voice: 'acid', seed: [[0, 0], [2, 0], [3, 3], [6, 0], [8, 2], [10, 0], [11, 4], [14, 3]] },
];

const VOICES = {
  kick(ctx, out) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, 0);
    env.gain.linearRampToValueAtTime(0.9, 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, 0.4);
    env.connect(out);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, 0);
    o.frequency.exponentialRampToValueAtTime(42, 0.08);
    o.connect(env);
    o.start(0);
    o.stop(0.45);
  },
  snare(ctx, out) {
    const te = ctx.createGain();
    te.gain.setValueAtTime(0.0001, 0);
    te.gain.linearRampToValueAtTime(0.35, 0.001);
    te.gain.exponentialRampToValueAtTime(0.0001, 0.09);
    te.connect(out);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, 0);
    o.frequency.exponentialRampToValueAtTime(90, 0.07);
    o.connect(te);
    o.start(0);
    o.stop(0.15);
    noise(ctx, out, 0.16, 'bandpass', 2800, 0.7, 0.9, 0.001);
  },
  hat(ctx, out) { noise(ctx, out, 0.04, 'highpass', 7000, 0.7, 0.8, 0.001); },
  ohat(ctx, out) { noise(ctx, out, 0.22, 'highpass', 6200, 0.7, 0.7, 0.001); },
  clap(ctx, out) {
    [0, 0.011, 0.023].forEach((t) => noise(ctx, out, 0.012, 'bandpass', 1300, 1.2, 0.8, 0.0005, t));
    noise(ctx, out, 0.2, 'bandpass', 1300, 1.2, 0.7, 0.0005, 0.034);
  },
  tom(ctx, out) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, 0);
    env.gain.linearRampToValueAtTime(0.8, 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, 0.4);
    env.connect(out);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(200, 0);
    o.frequency.exponentialRampToValueAtTime(95, 0.18);
    o.connect(env);
    o.start(0);
    o.stop(0.45);
  },
  sub(ctx, out) { // C2: sine and triangle, a round low note
    const f = 65.41;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, 0);
    env.gain.linearRampToValueAtTime(0.85, 0.008);
    env.gain.exponentialRampToValueAtTime(0.45, 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, 0.68);
    env.connect(out);
    for (const [type, g] of [['sine', 0.8], ['triangle', 0.4]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const gg = ctx.createGain();
      gg.gain.value = g;
      o.connect(gg).connect(env);
      o.start(0);
      o.stop(0.7);
    }
  },
  acid(ctx, out) { // C2: saw + triangle through a snapping low-pass (LOWBUILDER)
    const f = 65.41;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, 0);
    env.gain.linearRampToValueAtTime(0.8, 0.006);
    env.gain.exponentialRampToValueAtTime(0.35, 0.12);
    env.gain.exponentialRampToValueAtTime(0.0001, 0.48);
    env.connect(out);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 3 * 7, 0);
    lp.frequency.exponentialRampToValueAtTime(f * 3, 0.1);
    lp.Q.value = 8;
    lp.connect(env);
    for (const [type, g] of [['sawtooth', 0.55], ['triangle', 0.75]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const gg = ctx.createGain();
      gg.gain.value = g;
      o.connect(gg).connect(lp);
      o.start(0);
      o.stop(0.5);
    }
  },
};

function noise(ctx, out, dur, type, freq, q, peak, attack, at = 0) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.linearRampToValueAtTime(peak, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + attack + dur);
  env.connect(out);
  const n = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * (dur + attack)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  n.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  n.connect(f).connect(env);
  n.start(at);
}

/* a rendered voice as a mono Float32Array at the context's rate */
export async function renderVoice(name, secs) {
  const sr = getCtx()?.sampleRate || ensureAudio().sampleRate;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(1, Math.ceil(sr * secs), sr);
  VOICES[name](ctx, ctx.destination);
  const out = (await ctx.startRendering()).getChannelData(0);
  const data = new Float32Array(out);
  const fo = Math.min(data.length, Math.floor(sr * 0.012));
  for (let i = 0; i < fo; i++) data[data.length - 1 - i] *= i / fo;
  return data;
}

/* the kit entry as a stored sample */
export async function makeKitSound(i) {
  const k = KIT[i];
  const data = await renderVoice(k.voice, k.secs);
  return storeSound(data, k.name, 'kit', { role: k.role });
}
