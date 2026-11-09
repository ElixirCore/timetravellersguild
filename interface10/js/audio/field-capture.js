/* FIELD TAP threshold capture (v5): REC waits for a sound above the GATE and
   keeps it on the selected pad; AUTO cuts every sound into a sub-second
   one-shot and moves on to the next pad. v6 has no step grid, so AUTO no
   longer writes starter steps into a row. v7 listens to the input chosen at
   Keter (mic or aux), through input.js. */
import { state, save, FIELD_PADS } from '../state.js';
import { ensureAudio, getCtx } from './engine.js';
import { openInput, inputBus } from './input.js';
import {
  persistFieldPad, normalizeFloat32, float32ToAudioBuffer,
} from './field-voice.js';

const MAX_MS = 3200;
const MIN_MS = 120;
const SILENCE_MS = 420;
const BLOCK = 2048;
/* AUTO mode: every gated sound becomes a sub-second one-shot, fills the next pad, re-arms. */
const AUTO_MAX_MS = 900;
const AUTO_MIN_MS = 30;
const AUTO_SILENCE_MS = 110;
const AUTO_HOLDOFF_MS = 220;
const PREROLL_BLOCKS = 3;

let processor = null;
let sink = null;
let mode = 'idle';
let listenPad = 0;
let recordChunks = [];
let recordStart = 0;
let silenceBlocks = 0;
let hotBlocks = 0;
let autoMode = false;
let holdUntil = 0;
let recent = [];
let runtimeLevel = 0;
let onStatus = () => {};
let onCaptured = () => {};

export function setFieldCaptureCallbacks(statusCb, capturedCb) {
  onStatus = statusCb ?? (() => {});
  onCaptured = capturedCb ?? (() => {});
}

export function thresholdLevel() {
  return 0.006 + (state.field.threshold / 100) * 0.09;
}

function rmsBlock(data) {
  let s = 0;
  for (let i = 0; i < data.length; i++) s += data[i] * data[i];
  return Math.sqrt(s / data.length);
}

function wireGraph() {
  const ctx = ensureAudio();
  if (processor) return;
  processor = ctx.createScriptProcessor(BLOCK, 1, 1);
  sink = ctx.createGain();
  sink.gain.value = 0;
  inputBus().connect(processor);
  processor.connect(sink);
  sink.connect(ctx.destination);

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    const level = rmsBlock(input);
    runtimeLevel = level;
    const thresh = thresholdLevel();

    if (mode === 'listening') {
      if (autoMode) {
        recent.push(new Float32Array(input));
        if (recent.length > PREROLL_BLOCKS) recent.shift();
        if (Date.now() < holdUntil) { hotBlocks = 0; return; }
      }
      if (level >= thresh) {
        hotBlocks++;
        if (hotBlocks >= (autoMode ? 1 : 2)) {
          mode = 'recording';
          recordChunks = autoMode ? recent.slice() : [];
          recent = [];
          recordStart = Date.now();
          silenceBlocks = 0;
          onStatus('REC');
        }
      } else {
        hotBlocks = 0;
      }
      return;
    }

    if (mode !== 'recording') return;

    recordChunks.push(new Float32Array(input));
    const elapsed = Date.now() - recordStart;

    if (level < thresh * 0.55) silenceBlocks++;
    else silenceBlocks = 0;

    const blockMs = (BLOCK / getCtx().sampleRate) * 1000;
    const silenceNeed = Math.ceil((autoMode ? AUTO_SILENCE_MS : SILENCE_MS) / blockMs);
    const maxMs = autoMode ? AUTO_MAX_MS : MAX_MS;
    const minMs = autoMode ? AUTO_MIN_MS : MIN_MS;
    if (elapsed >= maxMs || (elapsed >= minMs && silenceBlocks > silenceNeed)) {
      finishCapture();
    }
  };
}

function mergeChunks(chunks) {
  let n = 0;
  for (const c of chunks) n += c.length;
  const out = new Float32Array(n);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

async function finishCapture() {
  if (mode !== 'recording') return;
  mode = 'idle';
  hotBlocks = 0;
  silenceBlocks = 0;
  const pad = listenPad;
  let raw = mergeChunks(recordChunks);
  recordChunks = [];
  if (autoMode) raw = shapeAutoSample(raw, getCtx().sampleRate);

  const norm = raw && normalizeFloat32(raw);
  if (!norm) {
    onStatus('TOO QUIET');
    onCaptured(pad, null);
    if (autoMode) rearmAuto(pad);
    return;
  }

  const ctx = getCtx();
  const buffer = float32ToAudioBuffer(ctx, ctx.sampleRate, norm);
  await persistFieldPad(pad, buffer);
  onStatus(`PAD ${pad + 1} OK`);
  if (autoMode) rearmAuto(pad);
  onCaptured(pad, buffer);
}

/* Trim to the sound itself (pre-roll and tail silence out), cap under one second,
   short fade-out so the cut never clicks. */
function shapeAutoSample(data, sr) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak < 0.0008) return null;
  const floor = peak * 0.08;
  let a = 0;
  let b = data.length - 1;
  while (a < b && Math.abs(data[a]) < floor) a++;
  while (b > a && Math.abs(data[b]) < floor) b--;
  a = Math.max(0, a - Math.floor(sr * 0.004));
  b = Math.min(data.length - 1, b + Math.floor(sr * 0.01));
  const maxLen = Math.floor(sr * 0.95);
  const len = Math.min(b - a + 1, maxLen);
  if (len < Math.floor(sr * 0.02)) return null;
  const out = data.slice(a, a + len);
  const fade = Math.min(out.length, Math.floor(sr * 0.008));
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  return out;
}

function rearmAuto(filledPad) {
  const next = (filledPad + 1) % FIELD_PADS;
  state.field.activePad = next;
  save();
  listenPad = next;
  holdUntil = Date.now() + AUTO_HOLDOFF_MS;
  hotBlocks = 0;
  silenceBlocks = 0;
  recent = [];
  mode = 'listening';
  onStatus(`AUTO → P${next + 1}`);
}

export function setFieldAuto(on) {
  autoMode = !!on;
}

export async function armFieldListen(padIndex) {
  try {
    await ensureAudio().resume();
    await openInput();
    wireGraph();
    listenPad = padIndex;
    recent = [];
    holdUntil = 0;
    mode = 'listening';
    hotBlocks = 0;
    silenceBlocks = 0;
    recordChunks = [];
    onStatus(autoMode ? `AUTO → P${padIndex + 1}` : 'LISTEN');
    return true;
  } catch (err) {
    onStatus('NO MIC');
    mode = 'idle';
    return false;
  }
}

export function cancelFieldListen() {
  mode = 'idle';
  hotBlocks = 0;
  recordChunks = [];
  onStatus('READY');
}

export function fieldCaptureMode() {
  return mode;
}

export function peekInputLevel() {
  return runtimeLevel;
}
