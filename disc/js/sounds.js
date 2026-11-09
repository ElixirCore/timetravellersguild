/* DISC — where sounds come from: eight built in (rendered once, in the
   browser), and three ways to make your own: words (ElevenLabs, through
   generate.php), the microphone, or nothing else. Everything is a short
   mono sample that the rings play at a pitch. */
import { ensure } from './audio.js';

/* gain/wet: how loud and how much room each sits in; hits: a sensible number
   of steps for the dice */
export const KIT = [
  { tag: 'ki', name: 'kick', role: 'drum', gain: 0.95, wet: 0, hits: [3, 5], secs: 0.5 },
  { tag: 'sn', name: 'snare', role: 'drum', gain: 0.7, wet: 0.22, hits: [2, 3], secs: 0.3 },
  { tag: 'hh', name: 'hat', role: 'drum', gain: 0.45, wet: 0.08, hits: [7, 12], secs: 0.12 },
  { tag: 'cl', name: 'clap', role: 'drum', gain: 0.7, wet: 0.35, hits: [2, 4], secs: 0.3 },
  { tag: 'sb', name: 'sub', role: 'bass', gain: 0.9, wet: 0, hits: [4, 7], secs: 0.7 },
  { tag: 'ab', name: 'acid', role: 'bass', gain: 0.75, wet: 0.08, hits: [5, 9], secs: 0.5 },
  { tag: 'pl', name: 'pluck', role: 'tune', gain: 0.8, wet: 0.3, hits: [4, 8], secs: 0.8 },
  { tag: 'be', name: 'bell', role: 'tune', gain: 0.7, wet: 0.5, hits: [3, 6], secs: 1.0 },
];

export const defOf = (sound) => (sound.t === 'kit'
  ? KIT[sound.i]
  : { tag: (sound.name || '??').slice(0, 2), name: sound.name || 'sound', role: 'tune', gain: 0.9, wet: 0.2, hits: [4, 8], secs: 0.6 });

/* ---------- the built-in voices (the /interface5 beatbox and bass, plus two) ---------- */
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

function thump(ctx, out, f0, f1, drop, dur, peak) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.linearRampToValueAtTime(peak, 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, dur);
  env.connect(out);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f0, 0);
  o.frequency.exponentialRampToValueAtTime(f1, drop);
  o.connect(env);
  o.start(0);
  o.stop(dur + 0.05);
}

function lowNote(ctx, out, mix, filter, secs) { // C2
  const f = 65.41;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.linearRampToValueAtTime(0.85, 0.007);
  env.gain.exponentialRampToValueAtTime(0.4, secs * 0.35);
  env.gain.exponentialRampToValueAtTime(0.0001, secs - 0.02);
  env.connect(out);
  let dest = env;
  if (filter) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 21, 0);
    lp.frequency.exponentialRampToValueAtTime(f * 3, 0.1);
    lp.Q.value = 8;
    lp.connect(env);
    dest = lp;
  }
  for (const [type, g] of mix) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const gg = ctx.createGain();
    gg.gain.value = g;
    o.connect(gg).connect(dest);
    o.start(0);
    o.stop(secs);
  }
}

const VOICES = {
  kick: (c, o) => thump(c, o, 150, 42, 0.08, 0.4, 0.9),
  snare(c, o) {
    thump(c, o, 180, 90, 0.07, 0.09, 0.35);
    noise(c, o, 0.16, 'bandpass', 2800, 0.7, 0.9, 0.001);
  },
  hat: (c, o) => noise(c, o, 0.05, 'highpass', 7000, 0.7, 0.8, 0.001),
  clap(c, o) {
    [0, 0.011, 0.023].forEach((t) => noise(c, o, 0.012, 'bandpass', 1300, 1.2, 0.8, 0.0005, t));
    noise(c, o, 0.2, 'bandpass', 1300, 1.2, 0.7, 0.0005, 0.034);
  },
  sub: (c, o) => lowNote(c, o, [['sine', 0.8], ['triangle', 0.4]], false, 0.7),
  acid: (c, o) => lowNote(c, o, [['sawtooth', 0.55], ['triangle', 0.75]], true, 0.5),
};

/* a plucked string (Karplus-Strong) and a small tuned bell, direct */
function pluck(sr, secs) {
  const n = Math.floor(sr * secs);
  const p = Math.round(sr / 261.63);
  const ring = new Float32Array(p);
  let s = 7;
  for (let i = 0; i < p; i++) ring[i] = (((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1);
  const o = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i % p;
    o[i] = ring[j];
    ring[j] = 0.5 * (ring[j] + ring[(j + 1) % p]) * 0.997;
  }
  return o;
}

function bell(sr, secs) {
  const n = Math.floor(sr * secs);
  const o = new Float32Array(n);
  const parts = [[1, 1, 3.2], [2.76, 0.6, 4.5], [5.4, 0.4, 6], [8.93, 0.25, 9]];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    for (const [m, a, d] of parts) v += a * Math.sin(2 * Math.PI * 261.63 * m * t) * Math.exp(-t * d);
    o[i] = v;
  }
  return o;
}

const NAMES = ['kick', 'snare', 'hat', 'clap', 'sub', 'acid', 'pluck', 'bell'];

async function renderKit(i, ctx) {
  const sr = ctx.sampleRate;
  const k = KIT[i];
  const name = NAMES[i];
  let data;
  if (name === 'pluck') data = pluck(sr, k.secs);
  else if (name === 'bell') data = bell(sr, k.secs);
  else {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const off = new OAC(1, Math.ceil(sr * k.secs), sr);
    VOICES[name](off, off.destination);
    data = new Float32Array((await off.startRendering()).getChannelData(0));
  }
  return finish(data, sr, 0.012);
}

/* normalise, and let the end fade so nothing clicks */
function finish(data, sr, fade) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const g = peak > 0 ? 0.89 / peak : 1;
  const fo = Math.min(data.length, Math.floor(sr * fade));
  for (let i = 0; i < data.length; i++) data[i] *= g;
  for (let i = 0; i < fo; i++) data[data.length - 1 - i] *= i / fo;
  return data;
}

/* a sample's silence trimmed off both ends, a short fade each side */
export function tidy(data, sr) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak < 0.003) return null; // nothing there
  const floor = peak * 0.03;
  let a = 0;
  let b = data.length;
  while (a < b && Math.abs(data[a]) < floor) a++;
  while (b > a && Math.abs(data[b - 1]) < floor) b--;
  a = Math.max(0, a - Math.floor(sr * 0.003));
  b = Math.min(data.length, b + Math.floor(sr * 0.02));
  const out = new Float32Array(data.subarray(a, Math.min(b, a + Math.floor(sr * 1.2))));
  const fi = Math.min(out.length, Math.floor(sr * 0.002));
  for (let i = 0; i < fi; i++) out[i] *= i / fi;
  return finish(out, sr, 0.02);
}

const toMono = (buf) => {
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += d[i] / buf.numberOfChannels;
  }
  return out;
};

/* ---------- your own sounds, kept in this browser ---------- */
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('disc-sounds-v1', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('sounds', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}
const idb = (mode, fn) => db().then((d) => new Promise((resolve, reject) => {
  const t = d.transaction('sounds', mode);
  const r = fn(t.objectStore('sounds'));
  t.oncomplete = () => resolve(r?.result);
  t.onerror = () => reject(t.error);
}));

async function keep(name, data, rate) {
  const id = `m${Date.now().toString(36)}`;
  try { await idb('readwrite', (s) => s.put({ id, name, rate, data })); } catch { /* not kept: still plays this session */ }
  cache.set(`mine:${id}`, { data, rate });
  return { id, name };
}

/* ---------- buffers ---------- */
const cache = new Map(); // key -> AudioBuffer | { data, rate }

export async function bufferFor(sound) {
  const ctx = ensure();
  const key = sound.t === 'kit' ? `kit:${sound.i}` : `mine:${sound.id}`;
  let hit = cache.get(key);
  if (!hit) {
    if (sound.t === 'kit') {
      const data = await renderKit(sound.i, ctx);
      hit = { data, rate: ctx.sampleRate };
    } else {
      const rec = await idb('readonly', (s) => s.get(sound.id));
      if (!rec) throw new Error('that sound is gone');
      hit = { data: rec.data, rate: rec.rate };
    }
    cache.set(key, hit);
  }
  if (hit instanceof AudioBuffer) return hit;
  const buf = ctx.createBuffer(1, hit.data.length, hit.rate);
  buf.copyToChannel(hit.data, 0);
  cache.set(key, buf);
  return buf;
}

/* ---------- making sounds ---------- */
const SUFFIX = ' Single isolated one-shot sound, dry, no background noise, no reverb tail, starts immediately.';

/* words -> a sound, through generate.php (ElevenLabs sound generation) */
export async function fromWords(words) {
  let res;
  try {
    res = await fetch('generate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: (words + SUFFIX).slice(0, 400), seconds: 0.6 }),
    });
  } catch { throw new Error('offline'); }
  let j = null;
  try { j = await res.json(); } catch { /* a static host answering with a page */ }
  if (!j || !j.ok) throw new Error(j?.error || 'no sound service here (it needs PHP and a key)');
  const audio = await fetch(`serve.php?f=${encodeURIComponent(j.id)}`);
  if (!audio.ok) throw new Error('could not fetch the sound');
  const ctx = ensure();
  const dec = await ctx.decodeAudioData(await audio.arrayBuffer());
  const data = tidy(toMono(dec), dec.sampleRate);
  if (!data) throw new Error('the sound came back silent');
  return keep(words.slice(0, 24), data, dec.sampleRate);
}

/* the microphone, for a second or so */
export async function fromMic(ms = 1200, onStart = () => {}) {
  const ctx = ensure();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch { throw new Error('no microphone (allow it, or plug one in)'); }
  const rec = new MediaRecorder(stream);
  const parts = [];
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  const done = new Promise((res) => { rec.onstop = res; });
  rec.start();
  onStart();
  await new Promise((r) => setTimeout(r, ms));
  rec.stop();
  await done;
  stream.getTracks().forEach((t) => t.stop());
  const dec = await ctx.decodeAudioData(await new Blob(parts, { type: rec.mimeType }).arrayBuffer());
  const data = tidy(toMono(dec), dec.sampleRate);
  if (!data) throw new Error('heard nothing');
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return keep(`mic ${time}`, data, dec.sampleRate);
}
