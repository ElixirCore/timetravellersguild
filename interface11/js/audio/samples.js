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
const DB_NAME = 'interface11-samples-v1';
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

/* v9 keeps its own sample store so nothing here can overwrite what the live
   v7 rig reads. First run copies v9's samples across (read-only there). */
const SEED_DB = 'interface10-samples-v1';
export async function migrateSamples() {
  try {
    const flag = `migrated:${DB_NAME}`;
    if (localStorage.getItem(flag)) return;
    const existing = (await listSamples()) || [];
    if (!existing.length) {
      const oldDb = await new Promise((resolve, reject) => {
        const req = indexedDB.open(SEED_DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const all = await new Promise((res, rej) => {
        const t = oldDb.transaction(STORE, 'readonly');
        const r = t.objectStore(STORE).getAll();
        t.oncomplete = () => res(r.result || []);
        t.onerror = () => rej(t.error);
      });
      oldDb.close();
      for (const rec of all) {
        await tx('readwrite', (s) => s.put(rec)); // eslint-disable-line no-await-in-loop
      }
      if (all.length) changed();
    }
    localStorage.setItem(flag, '1');
  } catch { /* start empty */ }
}

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
    if (qrec) { qCollect(e); return; }
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
  const L = merge(taken[0]);
  const R = merge(taken[1]);
  if (!L.length) { onDone(null); return; }
  onDone(await commitTake(L, R, ''));
}

/* normalise a take, keep it as a wav; resolves with the stored record */
async function commitTake(L, R, tag, kindOverride) {
  const ctx = getCtx();
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = peak > 0 ? Math.min(MAX_GAIN, 0.89 / peak) : 1;
  for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
  const same = L.every((v, i) => v === R[i]);
  const buf = ctx.createBuffer(same ? 1 : 2, L.length, ctx.sampleRate);
  buf.copyToChannel(L, 0);
  if (!same) buf.copyToChannel(R, 1);

  const kind = kindOverride || kindOf(currentInput());
  const created = Date.now();
  const n = ((await listSamples()).length || 0) + 1;
  const time = new Date(created).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const rec = {
    id: `s${created.toString(36)}`,
    name: `${n} · ${kind} · ${tag || time}`,
    kind,
    seconds: buf.duration,
    created,
    silent: peak === 0,
    wav: new Blob([wavEncode(buf)], { type: 'audio/wav' }),
  };
  await tx('readwrite', (s) => s.put(rec));
  changed();
  return rec;
}

/* ---------- v9: a take that lands exactly on the beat ----------
   Starts at context time t0 and lasts exactly len seconds (one trip round the
   sequencer's steps), so the sample loops in time with the pulse. The block
   times are corrected for the output and block latency, roughly: a take
   played along to the click is close to, not exactly on, the grid. */
let qrec = null;
export function isQRecording() { return !!qrec; }

/* open the input and wire the recorder, ready for startQuantised */
export async function prepareQuantised() {
  try {
    await ensureAudio().resume();
    await openInput();
  } catch {
    return false;
  }
  wire();
  return true;
}

export function startQuantised(t0, len, done) {
  const ctx = getCtx();
  const lat = ctx.outputLatency || ctx.baseLatency || 0;
  qrec = { win0: t0 + lat, len, parts: [], done };
}

export function cancelQuantised() { qrec = null; }

function qCollect(e) {
  const ctx = getCtx();
  const sr = ctx.sampleRate;
  const block = e.inputBuffer.length / sr;
  const ts = e.playbackTime - block - (ctx.baseLatency || 0); // when this block's sound happened
  qrec.parts.push({
    ts, L: new Float32Array(e.inputBuffer.getChannelData(0)), R: new Float32Array(e.inputBuffer.getChannelData(1)),
  });
  if (ts >= qrec.win0 + qrec.len) finishQuantised();
}

async function finishQuantised() {
  const q = qrec;
  qrec = null;
  const sr = getCtx().sampleRate;
  const N = Math.round(q.len * sr);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  for (const p of q.parts) {
    const at = Math.round((p.ts - q.win0) * sr);
    for (let i = 0; i < p.L.length; i++) {
      const j = at + i;
      if (j >= 0 && j < N) { L[j] = p.L[i]; R[j] = p.R[i]; }
    }
  }
  q.done(await commitTake(L, R, 'loop'));
}


/* v11: a sound made by sound design (ElevenLabs or the built-in synth) */
export function storeSound(L, tag, kind = 'ai') {
  return commitTake(L, new Float32Array(L), tag, kind);
}
