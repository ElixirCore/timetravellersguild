/* FIELD TAP voice (v5). v6 has no step grid, so a pad sounds when it is
   tapped; it plays into the mix bus ahead of the pedal chain. */
import { ensureAudio, nodes } from './engine.js';
import { saveFieldPad, loadAllFieldPads, migrateFieldPads, clearFieldPad } from './field-store.js';
import { clamp } from '../state.js';

const pads = new Map();
const lastHit = new Map(); // pad -> ctx time of its last trigger, for the ui flash
let loaded = false;

export function hasFieldPad(index) {
  return pads.has(index);
}

export function getFieldPadBuffer(index) {
  return pads.get(index) ?? null;
}

export function fieldPadHitAt(index) {
  return lastHit.get(index) ?? -1;
}

export async function initFieldVoice() {
  if (loaded) return;
  await migrateFieldPads();
  await reloadFieldPadsFromStore();
  loaded = true;
}

export async function reloadFieldPadsFromStore() {
  const ctx = ensureAudio();
  pads.clear();
  const saved = await loadAllFieldPads();
  saved.forEach((entry, i) => {
    if (entry?.data?.length) {
      pads.set(i, float32ToAudioBuffer(ctx, entry.sampleRate, entry.data));
    }
  });
}

export async function persistFieldPad(index, buffer) {
  const data = buffer.getChannelData(0);
  await saveFieldPad(index, buffer.sampleRate, data);
  pads.set(index, buffer);
}

export async function removeFieldPad(index) {
  pads.delete(index);
  await clearFieldPad(index);
}

export function playFieldPad(index, time, vel = 0.85, rate = 1) {
  const ctx = ensureAudio();
  const buffer = pads.get(index);
  if (!buffer || !nodes.fieldLevel) return;

  const playbackRate = clamp(rate, 0.25, 4);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = playbackRate;
  const env = ctx.createGain();
  const peak = vel * 0.72;
  const duration = buffer.duration / playbackRate;
  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(peak, time + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.05);
  src.connect(env);
  env.connect(nodes.fieldLevel);
  src.start(time);
  src.stop(time + duration + 0.08);
  lastHit.set(index, time);
}

export function auditionFieldPad(index, rate = 1) {
  const ctx = ensureAudio();
  ctx.resume();
  playFieldPad(index, ctx.currentTime + 0.01, 0.75, rate);
}

export function normalizeFloat32(data) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak < 0.0008) return null;
  const out = new Float32Array(data.length);
  const g = 0.9 / peak;
  for (let i = 0; i < data.length; i++) out[i] = data[i] * g;
  return out;
}

export function float32ToAudioBuffer(ctx, sampleRate, data) {
  const buf = ctx.createBuffer(1, data.length, sampleRate);
  buf.getChannelData(0).set(data);
  return buf;
}
