/* HALO — the sound: one context, a voice per pebble, a little room, and a
   clock that walks the sixteen steps. */
import { S, STEPS, LANES, MOODS } from './state.js';

let ctx = null;
let player = null;

/* iPhones: the ring/silent switch mutes Web Audio unless the page is playing
   "media". The playback audio session (Safari 16.4+) and a silent looping
   <audio> let the sound out either way. */
let silent = null;
function unlockMedia() {
  try { if (navigator.audioSession && navigator.audioSession.type !== 'play-and-record') navigator.audioSession.type = 'playback'; } catch { /* not offered */ }
  try {
    if (silent) { if (silent.paused) silent.play().catch(() => {}); return; }
    const n = 2205;
    const h = new DataView(new ArrayBuffer(44 + n));
    const w = (o, t) => [...t].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); h.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); h.setUint32(16, 16, true);
    h.setUint16(20, 1, true); h.setUint16(22, 1, true); h.setUint32(24, 22050, true); h.setUint32(28, 22050, true);
    h.setUint16(32, 1, true); h.setUint16(34, 8, true); w(36, 'data'); h.setUint32(40, n, true);
    for (let i = 0; i < n; i++) h.setUint8(44 + i, 128);
    silent = new Audio(URL.createObjectURL(new Blob([h.buffer], { type: 'audio/wav' })));
    silent.loop = true;
    silent.volume = 0.01;
    silent.play().catch(() => {});
  } catch { /* fine without it */ }
}

/* a short, dark room */
function impulse(c) {
  const len = Math.floor(c.sampleRate * 1.3);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return buf;
}

/* the voices, on any context (live, or offline for export) */
export class Player {
  constructor(c, dest) {
    this.ctx = c;
    this.dry = c.createGain();
    this.dry.connect(dest);
    this.room = c.createConvolver();
    this.room.buffer = impulse(c);
    const wet = c.createGain();
    wet.gain.value = 0.7;
    this.room.connect(wet).connect(dest);
    this.v = new Map(); // u -> voice
  }

  set(u, buf, def) {
    let v = this.v.get(u);
    if (!v) {
      const gain = this.ctx.createGain();
      const send = this.ctx.createGain();
      gain.connect(this.dry);
      gain.connect(send).connect(this.room);
      v = { gain, send, live: [] };
      this.v.set(u, v);
    }
    v.buf = buf;
    v.def = def;
    v.gain.gain.value = def.gain;
    v.send.gain.value = def.wet;
  }

  drop(u) {
    const v = this.v.get(u);
    if (!v) return;
    try { v.gain.disconnect(); v.send.disconnect(); } catch { /* gone */ }
    this.v.delete(u);
  }

  has(u) { return !!this.v.get(u)?.buf; }

  /* pebble u at lane p. Short sounds: a pitch from the mood. Long sounds: the
     p-th of eight slices, kept in time with the tempo. */
  note(u, p, time, vel = 1) {
    const v = this.v.get(u);
    if (!v || !v.buf) return;
    const c = this.ctx;
    const at = Math.max(time, c.currentTime);
    const src = c.createBufferSource();
    src.buffer = v.buf;
    let offset = 0;
    let len;
    let rate;
    if (v.def.role === 'chop') {
      rate = Math.min(2, Math.max(0.5, S.bpm / (v.def.bpm || S.bpm)));
      const slice = v.buf.duration / LANES;
      offset = slice * p;
      len = slice / rate;
    } else {
      rate = Math.min(6, Math.max(0.2, 2 ** (MOODS[S.mood].set[p] / 12)));
      len = v.buf.duration / rate;
    }
    src.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vel, at + 0.003);
    if (v.def.role === 'chop') {
      g.gain.setValueAtTime(vel, at + Math.max(0.004, len - 0.012));
      g.gain.linearRampToValueAtTime(0, at + len);
    }
    src.connect(g).connect(v.gain);
    /* a sound cuts its own earlier notes (a chord, struck together, rings) */
    v.live = v.live.filter((n) => {
      if (n.at < at - 0.001) {
        try {
          n.g.gain.cancelScheduledValues(at);
          n.g.gain.setTargetAtTime(0, at, 0.006);
          n.src.stop(at + 0.05);
        } catch { /* over */ }
        return false;
      }
      return true;
    });
    const n = { src, g, at };
    v.live.push(n);
    src.start(at, offset);
    src.stop(at + len + 0.05);
    src.onended = () => { v.live = v.live.filter((x) => x !== n); try { g.disconnect(); } catch { /* gone */ } };
  }
}

/* ---------- the live instrument ---------- */
export function ensure() {
  unlockMedia();
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8; comp.knee.value = 0; comp.ratio.value = 20; comp.attack.value = 0.002; comp.release.value = 0.18;
  master.connect(comp).connect(ctx.destination);
  player = new Player(ctx, master);
  return ctx;
}

export const getPlayer = () => { ensure(); return player; };
export const audioTime = () => (ctx ? ctx.currentTime : 0);

/* told that a recording is about to use the microphone: iPhones then need the
   play-and-record session */
export function micSession(on) {
  try { if (navigator.audioSession) navigator.audioSession.type = on ? 'play-and-record' : 'playback'; } catch { /* not offered */ }
}

/* ---------- the clock ---------- */
const LOOKAHEAD = 0.12;
let running = false;
let timer = null;
let next = 0; // when step `count` sounds
let count = 0;
let onStep = () => {};
export const whenStep = (fn) => { onStep = fn; };

export const stepSeconds = () => 60 / S.bpm / 4;
export const isPlaying = () => running;

function tick() {
  if (!running) return;
  const horizon = ctx.currentTime + LOOKAHEAD;
  while (next < horizon) {
    const i = count % STEPS;
    for (const d of S.dots) if (d.t === i) player.note(d.u, d.p, next);
    onStep(i, next);
    count++;
    next += stepSeconds();
  }
  timer = setTimeout(tick, 25);
}

export async function start() {
  if (running) return;
  ensure();
  await ctx.resume();
  running = true;
  next = ctx.currentTime + 0.08;
  count = 0;
  tick();
}

export function stop() {
  running = false;
  clearTimeout(timer);
}

/* where the arm is, in steps (0..16), counted from what has been scheduled so
   a change of tempo moves it on smoothly */
export function position() {
  if (!running) return null;
  const p = count - (next - ctx.currentTime) / stepSeconds();
  return ((p % STEPS) + STEPS) % STEPS;
}

/* ---------- one lap as a wav, seamless: the second of two laps, so the
   tails of the first lap are in it ---------- */
export async function renderLoop() {
  ensure();
  const sr = ctx.sampleRate;
  const step = stepSeconds();
  const lap = step * STEPS;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new OAC(2, Math.ceil(sr * lap * 2), sr);
  const master = off.createGain();
  master.gain.value = 0.9;
  master.connect(off.destination);
  const p = new Player(off, master);
  player.v.forEach((v, u) => { if (v.buf) p.set(u, v.buf, v.def); });
  const ds = [...S.dots].sort((a, b) => a.t - b.t);
  for (let c = 0; c < 2; c++) {
    for (const d of ds) p.note(d.u, d.p, (c * STEPS + d.t) * step);
  }
  const out = await off.startRendering();
  const from = Math.round(sr * lap);
  const len = Math.round(sr * lap);
  const L = out.getChannelData(0).subarray(from, from + len);
  const R = out.getChannelData(1).subarray(from, from + len);
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0 ? Math.min(2, 0.92 / peak) : 1;
  const bytes = 44 + len * 4;
  const dv = new DataView(new ArrayBuffer(bytes));
  const w = (o, t) => [...t].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true);
  dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, len * 4, true);
  for (let i = 0; i < len; i++) {
    dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i] * g)) * 0x7fff, true);
    dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i] * g)) * 0x7fff, true);
  }
  return new Blob([dv.buffer], { type: 'audio/wav' });
}
