/* SEEDBED voice: prompt-grown clips (from the shared /interface2 library)
   planted onto 4 lanes, played like FIELD TAP pads but fetched, not mic'd.
   Only clip ids persist in state; buffers are re-fetched on load. */
import { state, clamp } from '../state.js';
import { getCtx, ensureAudio, nodes } from './context.js';
import { clipUrl } from '../api.js';

const lanes = new Map(); // lane -> { id, label, buffer }
const loading = new Map(); // lane -> Promise

export function hasSeedLane(lane) {
  return lanes.has(lane);
}

export function getSeedLaneLabel(lane) {
  return lanes.get(lane)?.label ?? '';
}

export async function loadSeedLane(lane, id, label) {
  const ctx = ensureAudio();
  const job = (async () => {
    const r = await fetch(clipUrl(id));
    if (!r.ok) throw new Error(`clip ${r.status}`);
    const buf = await ctx.decodeAudioData(await r.arrayBuffer());
    lanes.set(lane, { id, label, buffer: buf });
    return buf;
  })();
  loading.set(lane, job);
  try {
    return await job;
  } finally {
    loading.delete(lane);
  }
}

export function clearSeedLane(lane) {
  lanes.delete(lane);
}

export async function waitSeedLane(lane) {
  if (loading.has(lane)) {
    try { await loading.get(lane); } catch { /* surfaced in ui */ }
  }
  return lanes.has(lane);
}

/* Re-fetch buffers for every lane the state says is planted (startup + scene recall). */
export async function syncSeedLanesFromState() {
  const jobs = [];
  for (let lane = 0; lane < state.seed.lanes.length; lane++) {
    const id = state.seed.lanes[lane];
    if (!id) {
      lanes.delete(lane);
      continue;
    }
    if (lanes.get(lane)?.id === id) continue;
    jobs.push(loadSeedLane(lane, id, state.seed.laneLabels[lane] || id).catch(() => {}));
  }
  await Promise.all(jobs);
}

export function playSeedLane(lane, time, vel = 0.85, rate = 1) {
  const ctx = ensureAudio();
  const entry = lanes.get(lane);
  if (!entry || !nodes.seedLevel) return;

  const playbackRate = clamp(rate, 0.25, 4);
  const src = ctx.createBufferSource();
  src.buffer = entry.buffer;
  src.playbackRate.value = playbackRate;
  const env = ctx.createGain();
  const peak = vel * 0.72;
  const duration = entry.buffer.duration / playbackRate;
  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(peak, time + 0.004);
  env.gain.setValueAtTime(peak, Math.max(time + 0.005, time + duration - 0.04));
  env.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.02);
  src.connect(env);
  env.connect(nodes.seedLevel);
  src.start(time);
  src.stop(time + duration + 0.05);
}

export async function auditionSeedLane(lane, rate = 1) {
  const ctx = ensureAudio();
  await ctx.resume();
  if (await waitSeedLane(lane)) playSeedLane(lane, ctx.currentTime + 0.01, 0.75, rate);
}
