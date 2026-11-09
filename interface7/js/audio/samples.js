/* The sampler (Keter) and the sample library (Chokmah). REC takes whatever
   is on the chosen input, mic or aux, until it is pressed again (or
   MAX_SEC). Every take is kept, however quiet: it is brought up towards
   full scale (by at most MAX_GAIN, so a near-silent take is not turned into
   roaring noise), kept in this browser as a wav and goes straight into a
   free track. Samples are never sent anywhere. */
import { ensureAudio, getCtx } from './engine.js';
import { openInput, inputBus, currentInput, kindOf } from './input.js';
import { wavEncode } from './tracks.js';

export const MAX_SEC = 60;
const MAX_GAIN = 32; // +30 dB
const BLOCK = 4096;
const DB_NAME = 'interface7-samples-v1';
const STORE = 'samples';

/* ---------- store ---------- */
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function tx(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r?.result);
    t.onerror = () => reject(t.error);
  }));
}

const listeners = new Set();
export function onSamples(fn) { listeners.add(fn); }
function changed() { listeners.forEach((fn) => fn()); }

/* newest first, without the audio */
export async function listSamples() {
  const all = (await tx('readonly', (s) => s.getAll())) || [];
  return all.map(({ id, name, kind, seconds, created }) => ({ id, name, kind, seconds, created }))
    .sort((a, b) => b.created - a.created);
}

export async function sampleBlob(id) {
  const rec = await tx('readonly', (s) => s.get(id));
  return rec ? rec.wav : null;
}

export async function sampleData(id) {
  const b = await sampleBlob(id);
  return b ? b.arrayBuffer() : null;
}

export async function deleteSample(id) {
  await tx('readwrite', (s) => s.delete(id));
  changed();
}

/* ---------- recording ---------- */
let proc = null;
let sink = null;
let chunks = null; // [[L...], [R...]] while recording
let startedAt = 0;
let onDone = () => {};

export function isSampling() { return !!chunks; }
export function samplingSeconds() { return chunks ? (performance.now() - startedAt) / 1000 : 0; }

function wire() {
  const ctx = ensureAudio();
  if (proc && proc.context === ctx) return;
  proc = ctx.createScriptProcessor(BLOCK, 2, 2);
  sink = ctx.createGain();
  sink.gain.value = 0;
  inputBus().connect(proc);
  proc.connect(sink);
  sink.connect(ctx.destination);
  proc.onaudioprocess = (e) => {
    if (!chunks) return;
    chunks[0].push(new Float32Array(e.inputBuffer.getChannelData(0)));
    chunks[1].push(new Float32Array(e.inputBuffer.getChannelData(1)));
    if (samplingSeconds() >= MAX_SEC) stopSampling();
  };
}

/* resolves with false if there is no input to record from */
export async function startSampling(done) {
  try {
    await ensureAudio().resume();
    await openInput();
  } catch {
    return false;
  }
  wire();
  onDone = done || (() => {});
  chunks = [[], []];
  startedAt = performance.now();
  return true;
}

function merge(list) {
  let n = 0;
  for (const c of list) n += c.length;
  const out = new Float32Array(n);
  let off = 0;
  for (const c of list) { out.set(c, off); off += c.length; }
  return out;
}

export async function stopSampling() {
  if (!chunks) return;
  const taken = chunks;
  chunks = null;
  const ctx = getCtx();
  const L = merge(taken[0]);
  const R = merge(taken[1]);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  if (!L.length) { onDone(null); return; }
  const g = peak > 0 ? Math.min(MAX_GAIN, 0.89 / peak) : 1;
  for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
  const same = L.every((v, i) => v === R[i]);
  const buf = ctx.createBuffer(same ? 1 : 2, L.length, ctx.sampleRate);
  buf.copyToChannel(L, 0);
  if (!same) buf.copyToChannel(R, 1);

  const kind = kindOf(currentInput());
  const created = Date.now();
  const n = ((await listSamples()).length || 0) + 1;
  const time = new Date(created).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const rec = {
    id: `s${created.toString(36)}`,
    name: `${n} · ${kind} · ${time}`,
    kind,
    seconds: buf.duration,
    created,
    silent: peak === 0,
    wav: new Blob([wavEncode(buf)], { type: 'audio/wav' }),
  };
  await tx('readwrite', (s) => s.put(rec));
  changed();
  onDone(rec);
}
