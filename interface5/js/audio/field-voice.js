import { getCtx, ensureAudio, nodes } from './context.js';
import { saveFieldPad, loadAllFieldPads, migrateFieldPads } from './field-store.js';
import { clamp } from '../state.js';

const pads = new Map();
let loaded = false;

export function hasFieldPad(index) {
  return pads.has(index);
}

export function getFieldPadBuffer(index) {
  return pads.get(index) ?? null;
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
      pads.set(i, floatToBuffer(ctx, entry.sampleRate, entry.data));
    }
  });
}

export function setFieldPadBuffer(index, buffer) {
  pads.set(index, buffer);
}

export async function persistFieldPad(index, buffer) {
  const data = buffer.getChannelData(0);
  await saveFieldPad(index, buffer.sampleRate, data);
  pads.set(index, buffer);
}

export async function removeFieldPad(index) {
  pads.delete(index);
  const { clearFieldPad } = await import('./field-store.js');
  await clearFieldPad(index);
}

function floatToBuffer(ctx, sampleRate, data) {
  const buf = ctx.createBuffer(1, data.length, sampleRate);
  buf.getChannelData(0).set(data);
  return buf;
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

export async function trimFieldPadRange(index, startSample, endSample) {
  const ctx = ensureAudio();
  const buffer = pads.get(index);
  if (!buffer) return false;

  const minLen = Math.floor(buffer.sampleRate * 0.04);
  const start = Math.max(0, Math.min(startSample, buffer.length - minLen));
  const end = Math.max(start + minLen, Math.min(endSample, buffer.length));
  if (start <= 8 && end >= buffer.length - 8) return false;

  const trimmed = buffer.getChannelData(0).slice(start, end);
  const next = ctx.createBuffer(1, trimmed.length, buffer.sampleRate);
  next.getChannelData(0).set(trimmed);
  await persistFieldPad(index, next);
  return true;
}

/** @deprecated use trimFieldPadRange */
export async function trimFieldPad(index, endSample) {
  return trimFieldPadRange(index, 0, endSample);
}

export function float32ToAudioBuffer(ctx, sampleRate, data) {
  const buf = ctx.createBuffer(1, data.length, sampleRate);
  buf.getChannelData(0).set(data);
  return buf;
}
