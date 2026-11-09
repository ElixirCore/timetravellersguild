/* DISC — the sound: one context, four rings of voices, a little room, and a
   clock that walks the sixteen steps. */
import { S, NRINGS, STEPS } from './state.js';

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

/* the voices of the four rings, on any context (live, or offline for export) */
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
    this.rings = Array.from({ length: NRINGS }, () => {
      const gain = c.createGain();
      const send = c.createGain();
      gain.connect(this.dry);
      gain.connect(send).connect(this.room);
      return { gain, send, buf: null, def: null, last: null, muted: false };
    });
  }

  set(k, buf, def) {
    const r = this.rings[k];
    r.buf = buf;
    r.def = def;
    r.gain.gain.value = r.muted ? 0 : def.gain;
    r.send.gain.value = def.wet;
  }

  mute(k, m) {
    const r = this.rings[k];
    r.muted = m;
    r.gain.gain.setTargetAtTime(m ? 0 : (r.def ? r.def.gain : 0.8), this.ctx.currentTime, 0.02);
  }

  /* one note of ring k, n semitones from the sound's own pitch */
  note(k, n, time, vel = 1) {
    const r = this.rings[k];
    if (!r.buf) return;
    const c = this.ctx;
    const at = Math.max(time, c.currentTime);
    const rate = Math.min(6, Math.max(0.2, Math.pow(2, n / 12)));
    const src = c.createBufferSource();
    src.buffer = r.buf;
    src.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vel, at + 0.003);
    src.connect(g).connect(r.gain);
    /* a ring is one voice: the next note cuts the last */
    if (r.last) {
      try {
        r.last.g.gain.cancelScheduledValues(at);
        r.last.g.gain.setTargetAtTime(0, at, 0.004);
        r.last.src.stop(at + 0.04);
      } catch { /* already over */ }
    }
    r.last = { src, g };
    src.start(at);
    src.stop(at + r.buf.duration / rate + 0.05);
    src.onended = () => { if (r.last && r.last.src === src) r.last = null; try { g.disconnect(); } catch { /* gone */ } };
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

export const stepSeconds = () => 60 / S.bpm / 4;
export const isPlaying = () => running;

function tick() {
  if (!running) return;
  const horizon = ctx.currentTime + LOOKAHEAD;
  while (next < horizon) {
    const i = count % STEPS;
    S.rings.forEach((r, k) => {
      const cell = r.steps[i];
      if (cell.on && !r.mute) player.note(k, cell.n, next);
    });
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
  player.rings.forEach((r, k) => { if (r.buf) p.set(k, r.buf, r.def); });
  for (let c = 0; c < 2; c++) {
    for (let i = 0; i < STEPS; i++) {
      S.rings.forEach((r, k) => {
        const cell = r.steps[i];
        if (cell.on && !r.mute) p.note(k, cell.n, (c * STEPS + i) * step);
      });
    }
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
