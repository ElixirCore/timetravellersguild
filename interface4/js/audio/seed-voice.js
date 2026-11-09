/* SEEDBED voice (v4): prompt-grown clips from the shared /interface2 library,
   planted onto 4 lanes. Two lane modes:
   SHOT - triggered per step like FIELD TAP (pitch, ratchet, reverse, choke)
   LOOP - the clip is trimmed of dead air, its end crossfaded into its start,
          stretched by rate to a whole number of bars at the master tempo and
          run continuously, bar-locked; steps gate it in and out.
   Only clip ids persist in state; buffers are re-fetched on load. */
import { state, clamp, SEED_LANES } from '../state.js';
import { ensureAudio, nodes } from './context.js';
import { clipUrl } from '../api.js';
import { barDur } from '../engine/clock.js';

const lanes = new Map(); // lane -> { id, label, shot, loop, rShot, rLoop }
const loading = new Map();
const loops = new Map(); // lane -> { src, gain, rev, bars }
const chokes = new Map(); // lane -> { env, stopAt } last one-shot voice

const SILENCE = 0.004;

function peakAt(buf, i) {
  let m = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) m = Math.max(m, Math.abs(buf.getChannelData(c)[i]));
  return m;
}

/* Trim leading and trailing dead air. Keeps at least half the clip. */
function trim(ctx, buf) {
  const n = buf.length;
  let a = 0;
  let b = n - 1;
  while (a < n * 0.25 && peakAt(buf, a) < SILENCE) a++;
  while (b > n * 0.5 && peakAt(buf, b) < SILENCE) b--;
  a = Math.max(0, a - 16);
  b = Math.min(n - 1, b + 16);
  if (a === 0 && b === n - 1) return buf;
  const out = ctx.createBuffer(buf.numberOfChannels, b - a + 1, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    out.getChannelData(c).set(buf.getChannelData(c).subarray(a, b + 1));
  }
  return out;
}

/* Equal-power crossfade of the tail into the head so the loop point is inaudible. */
function makeLoop(ctx, buf) {
  const n = buf.length;
  const xf = Math.max(32, Math.min(Math.round(buf.sampleRate * 0.08), Math.floor(n * 0.12)));
  const len = n - xf;
  const out = ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src.subarray(0, len));
    for (let i = 0; i < xf; i++) {
      const t = (i + 0.5) / xf;
      dst[i] = src[i] * Math.sin(t * Math.PI / 2) + src[len + i] * Math.cos(t * Math.PI / 2);
    }
  }
  return out;
}

function reversed(ctx, buf) {
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const s = buf.getChannelData(c);
    const d = out.getChannelData(c);
    for (let i = 0, j = s.length - 1; j >= 0; i++, j--) d[i] = s[j];
  }
  return out;
}

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
    const raw = await ctx.decodeAudioData(await r.arrayBuffer());
    const shot = trim(ctx, raw);
    stopLoop(lane);
    lanes.set(lane, { id, label, shot, loop: makeLoop(ctx, shot), rShot: null, rLoop: null });
    return raw;
  })();
  loading.set(lane, job);
  try {
    return await job;
  } finally {
    loading.delete(lane);
  }
}

export function clearSeedLane(lane) {
  stopLoop(lane);
  lanes.delete(lane);
}

export async function waitSeedLane(lane) {
  if (loading.has(lane)) {
    try { await loading.get(lane); } catch { /* surfaced in ui */ }
  }
  return lanes.has(lane);
}

export async function syncSeedLanesFromState() {
  const jobs = [];
  for (let lane = 0; lane < state.seed.lanes.length; lane++) {
    const id = state.seed.lanes[lane];
    if (!id) {
      clearSeedLane(lane);
      continue;
    }
    if (lanes.get(lane)?.id === id) continue;
    jobs.push(loadSeedLane(lane, id, state.seed.laneLabels[lane] || id).catch(() => {}));
  }
  await Promise.all(jobs);
}

function pick(entry, lane, kind, ctx) {
  const rev = !!state.seed.laneRev?.[lane];
  if (kind === 'loop') {
    if (!rev) return entry.loop;
    entry.rLoop ||= reversed(ctx, entry.loop);
    return entry.rLoop;
  }
  if (!rev) return entry.shot;
  entry.rShot ||= reversed(ctx, entry.shot);
  return entry.rShot;
}

/* ---------- SHOT ---------- */

/* maxDur trims the hit to a slice (ratchets). Any previous hit on the lane is
   faded out over 25ms so stacked hits stay clean instead of mushing. */
export function playSeedLane(lane, time, vel = 0.85, rate = 1, maxDur = 0) {
  const ctx = ensureAudio();
  const entry = lanes.get(lane);
  if (!entry || !nodes.seedLevel) return;

  const buffer = pick(entry, lane, 'shot', ctx);
  const playbackRate = clamp(rate, 0.25, 4);
  const full = buffer.duration / playbackRate;
  const duration = maxDur > 0 ? Math.min(full, maxDur) : full;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = playbackRate;
  const env = ctx.createGain();
  const peak = vel * 0.72;
  const atk = 0.006;
  const rel = Math.min(0.05, duration * 0.4);
  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(peak, time + atk);
  env.gain.setValueAtTime(peak, Math.max(time + atk, time + duration - rel));
  env.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.01);
  src.connect(env);
  env.connect(nodes.seedLevel);

  const prev = chokes.get(lane);
  if (prev && prev.stopAt > time) {
    try {
      prev.env.gain.cancelScheduledValues(time);
      prev.env.gain.setTargetAtTime(0.0001, time, 0.008);
      prev.src.stop(time + 0.06);
    } catch { /* already ended */ }
  }
  chokes.set(lane, { env, src, stopAt: time + duration });

  src.start(time);
  src.stop(time + duration + 0.05);
}

export async function auditionSeedLane(lane, rate = 1) {
  const ctx = ensureAudio();
  await ctx.resume();
  if (await waitSeedLane(lane)) playSeedLane(lane, ctx.currentTime + 0.01, 0.75, rate);
}

/* ---------- LOOP ---------- */

/* Whole bars nearest to the clip's natural length, in log terms, so the
   stretch stays as small as possible. */
export function loopFit(lane) {
  const entry = lanes.get(lane);
  if (!entry) return { bars: 1, rate: 1 };
  const d = entry.loop.duration;
  const bar = barDur();
  let best = 1;
  let bestErr = Infinity;
  for (const bars of [1, 2, 4, 8, 16]) {
    const err = Math.abs(Math.log(d / (bars * bar)));
    if (err < bestErr) { bestErr = err; best = bars; }
  }
  return { bars: best, rate: clamp(d / (best * bar), 0.5, 2) };
}

export function isLoopRunning(lane) {
  return loops.has(lane);
}

export function stopLoop(lane) {
  const l = loops.get(lane);
  if (!l) return;
  const ctx = ensureAudio();
  const t = ctx.currentTime;
  try {
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setTargetAtTime(0, t, 0.015);
    l.src.stop(t + 0.12);
  } catch { /* ignore */ }
  loops.delete(lane);
}

export function stopAllSeedLoops() {
  for (const lane of [...loops.keys()]) stopLoop(lane);
  const ctx = ensureAudio();
  chokes.forEach((c) => {
    try { c.env.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.01); c.src.stop(ctx.currentTime + 0.08); } catch { /* ignore */ }
  });
  chokes.clear();
}

/* Called once per step for a loop lane: starts the loop on the downbeat if it
   is not running, keeps its stretch locked to the tempo, and opens or closes
   the gate for this step. */
export function stepLoopLane(lane, time, open, startNow) {
  const ctx = ensureAudio();
  const entry = lanes.get(lane);
  if (!entry || !nodes.seedLevel) return;
  const rev = !!state.seed.laneRev?.[lane];
  let l = loops.get(lane);
  if (l && l.rev !== rev) { stopLoop(lane); l = null; }
  const fit = loopFit(lane);
  if (!l) {
    if (!startNow) return; // join on the next downbeat so it stays bar-locked
    const src = ctx.createBufferSource();
    src.buffer = pick(entry, lane, 'loop', ctx);
    src.loop = true;
    src.playbackRate.value = fit.rate;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(nodes.seedLevel);
    src.start(time);
    l = { src, gain, rev, bars: fit.bars };
    loops.set(lane, l);
  }
  l.src.playbackRate.setValueAtTime(fit.rate, time);
  l.bars = fit.bars;
  l.gain.gain.setTargetAtTime(open ? 0.8 : 0, time, 0.012);
}
