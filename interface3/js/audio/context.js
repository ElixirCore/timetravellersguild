import { state } from '../state.js';
import { buildBoard, applyAllPedals } from './pedals.js';
import { buildStylusFx, applyStylusFx } from './stylus-fx.js';
import { encodeAudioBufferToMp3, downloadBlob, preloadMp3Encoder } from './mp3-export.js';

let ctx = null;
export const nodes = {};

export function getCtx() {
  return ctx;
}

export function audioNow() {
  return ctx ? ctx.currentTime : 0;
}

export function ensureAudio() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  nodes.arpFilter = ctx.createBiquadFilter();
  nodes.arpFilter.type = 'lowpass';
  nodes.arpLevel = ctx.createGain();
  nodes.arpFilter.connect(nodes.arpLevel);

  nodes.bassFilter = ctx.createBiquadFilter();
  nodes.bassFilter.type = 'lowpass';
  nodes.bassLevel = ctx.createGain();
  nodes.bassFilter.connect(nodes.bassLevel);

  nodes.drumLevel = ctx.createGain();
  nodes.fieldLevel = ctx.createGain();
  nodes.seedLevel = ctx.createGain();

  const stylusFxOut = buildStylusFx(ctx);
  nodes.stylusLevel = ctx.createGain();
  stylusFxOut.connect(nodes.stylusLevel);

  nodes.mixBus = ctx.createGain();
  nodes.mixBus.gain.value = 0.9;
  nodes.arpLevel.connect(nodes.mixBus);
  nodes.bassLevel.connect(nodes.mixBus);
  nodes.drumLevel.connect(nodes.mixBus);
  nodes.fieldLevel.connect(nodes.mixBus);
  nodes.seedLevel.connect(nodes.mixBus);
  nodes.stylusLevel.connect(nodes.mixBus);

  const board = buildBoard(ctx);
  nodes.boardOut = board.output;
  nodes.mixBus.connect(board.input);

  nodes.comp = ctx.createDynamicsCompressor();
  nodes.comp.threshold.value = -14;
  nodes.comp.ratio.value = 4;
  nodes.master = ctx.createGain();
  nodes.master.gain.value = 0.8;

  nodes.looperGain = ctx.createGain();
  nodes.looperGain.connect(nodes.comp);

  nodes.boardOut.connect(nodes.comp);
  nodes.comp.connect(nodes.master).connect(ctx.destination);

  applyStrips();
  applyStylusFx();
  applyAllPedals();
  return ctx;
}

export function applyStrips() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const tone = state.arp.banks.tone;
  nodes.arpFilter.frequency.setTargetAtTime(80 * (6000 / 80) ** (tone.cutoff / 100), t, 0.03);
  nodes.arpFilter.Q.setTargetAtTime(0.3 + (tone.reso / 100) * 14, t, 0.03);
  nodes.arpLevel.gain.setTargetAtTime(state.arp.mute ? 0 : (tone.level / 100) * 1.1, t, 0.03);

  nodes.bassFilter.frequency.setTargetAtTime(60 * 50 ** (state.bass.tone / 100), t, 0.03);
  nodes.bassFilter.Q.setTargetAtTime(1.2, t, 0.03);
  nodes.bassLevel.gain.setTargetAtTime((state.bass.level / 100) * 1.15, t, 0.03);

  const drumGain = state.drums.on && !state.drums.mute ? (state.drums.level / 100) * 1.05 : 0;
  nodes.drumLevel.gain.setTargetAtTime(drumGain, t, 0.03);

  const fieldGain = state.field.on && !state.field.mute ? (state.field.level / 100) * 1.02 : 0;
  nodes.fieldLevel.gain.setTargetAtTime(fieldGain, t, 0.03);

  const seedGain = state.seed.on && !state.seed.mute ? (state.seed.level / 100) * 1.02 : 0;
  nodes.seedLevel.gain.setTargetAtTime(seedGain, t, 0.03);

  const stylusGain = state.stylus.on && !state.stylus.mute ? (state.stylus.level / 100) * 0.88 : 0;
  nodes.stylusLevel.gain.setTargetAtTime(stylusGain, t, 0.03);

  nodes.looperGain.gain.setTargetAtTime((state.looper.level / 100) * 1.1, t, 0.03);
  applyStylusFx();
}

export function makeImpulse(c, seconds, decayPow = 2.2) {
  const n = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decayPow;
  }
  return b;
}

let mediaDest = null;
let recorder = null;
let chunks = [];
let recordMime = '';
let exportStatusHandler = null;

export function setMasterExportStatusHandler(fn) {
  exportStatusHandler = fn;
}

function emitExportStatus(phase, message = '') {
  exportStatusHandler?.(phase, message);
}

function pickRecordMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

async function finishRecording(rec) {
  emitExportStatus('processing', 'MP3…');
  const type = rec.mimeType || recordMime || 'audio/webm';

  try {
    if (!chunks.length) throw new Error('No audio captured');
    const blob = new Blob(chunks, { type });
    if (blob.size === 0) throw new Error('Empty recording');

    const audioBuffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const mp3 = await encodeAudioBufferToMp3(audioBuffer);
    downloadBlob(mp3, `lab-${Date.now()}.mp3`);
    emitExportStatus('saved', 'SAVED');
  } catch (err) {
    console.error('Master MP3 export failed', err);
    try {
      if (chunks.length) {
        downloadBlob(new Blob(chunks, { type }), `lab-${Date.now()}.webm`);
        emitExportStatus('saved', 'WEBM');
      } else {
        emitExportStatus('error', 'NO AUDIO');
      }
    } catch (fallbackErr) {
      console.error('Master recording fallback failed', fallbackErr);
      emitExportStatus('error', 'FAIL');
    }
  } finally {
    chunks = [];
  }
}

export async function toggleRecord() {
  const audio = ensureAudio();
  if (audio.state === 'suspended') await audio.resume();

  if (recorder?.state === 'recording') {
    const rec = recorder;
    recorder = null;

    await new Promise((resolve) => {
      rec.onstop = async () => {
        await finishRecording(rec);
        resolve();
      };
      try {
        rec.requestData();
      } catch (_) {}
      rec.stop();
    });
    return false;
  }

  if (!mediaDest) {
    mediaDest = audio.createMediaStreamDestination();
    nodes.master.connect(mediaDest);
  }

  preloadMp3Encoder();
  chunks = [];
  recordMime = pickRecordMimeType();
  recorder = recordMime
    ? new MediaRecorder(mediaDest.stream, { mimeType: recordMime })
    : new MediaRecorder(mediaDest.stream);

  recorder.ondataavailable = (e) => {
    if (e.data?.size > 0) chunks.push(e.data);
  };

  recorder.start(500);
  emitExportStatus('recording');
  return true;
}
