/* INTERFACE v7 audio graph (as v6). Routing is fixed:

     tracks (8, /interface2 chains) ─┐
     FIELD TAP pads ─────────────────┴─> mix bus ─> DIRT > WAH > CHORUS > PHASER > ECHO > VERB
                                                        │
                                       board out ───────┼──> master ─> limiter ─> out
                                                        └──> LOOPSMITH capture
                                       LOOPSMITH play ─────> master

   The master + limiter are /interface2's (built for a phone aux into an amp).
   The mic / aux input is not monitored: it feeds only the sampler and FIELD
   TAP (see input.js). */
import { state } from '../state.js';
import { buildBoard } from './pedals.js';

let ctx = null;
export const nodes = {};

export function getCtx() {
  return ctx;
}

export function audioNow() {
  return ctx ? ctx.currentTime : 0;
}

export function makeLimiter(c) {
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -8; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.002; limiter.release.value = 0.18;
  return limiter;
}

function meter(c, from) {
  const a = c.createAnalyser();
  a.fftSize = 512;
  from.connect(a);
  return a;
}

/* iPhones: the ring/silent switch mutes Web Audio unless the page is
   playing "media". Asking for the playback session (Safari 16.4+) and keeping
   a silent looping <audio> alive makes the sound come out either way. */
let silent = null;
let sessionSet = false;
function unlockMedia() {
  if (!sessionSet) {
    sessionSet = true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not offered */ }
  }
  try {
    if (silent) { if (silent.paused) silent.play().catch(() => {}); return; }
    const n = 2205; // 50ms of silence, 22.05kHz 8-bit mono wav
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

export function ensureAudio() {
  unlockMedia();
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  nodes.mixBus = ctx.createGain();
  nodes.mixBus.gain.value = 0.9;
  nodes.fieldLevel = ctx.createGain();
  nodes.fieldLevel.connect(nodes.mixBus);

  nodes.board = buildBoard(ctx);
  nodes.mixBus.connect(nodes.board.input);
  nodes.boardOut = nodes.board.output;

  nodes.master = ctx.createGain();
  nodes.master.gain.value = 0.9;
  nodes.limiter = makeLimiter(ctx);
  nodes.boardOut.connect(nodes.master);

  nodes.looperGain = ctx.createGain();
  nodes.looperGain.connect(nodes.master);

  nodes.master.connect(nodes.limiter);
  nodes.limiter.connect(ctx.destination);

  nodes.meters = {
    mix: meter(ctx, nodes.mixBus),
    field: meter(ctx, nodes.fieldLevel),
    looper: meter(ctx, nodes.looperGain),
    out: meter(ctx, nodes.limiter),
    pedals: {},
  };
  for (const id of Object.keys(nodes.board.pedals)) {
    nodes.meters.pedals[id] = meter(ctx, nodes.board.pedals[id].output);
  }

  applyLevels();
  nodes.board.applyAll(state.pedals);
  return ctx;
}

export function applyLevels() {
  if (!ctx) return;
  const t = ctx.currentTime;
  nodes.fieldLevel.gain.setTargetAtTime((state.field.level / 100) * 1.02, t, 0.03);
  nodes.looperGain.gain.setTargetAtTime((state.looper.level / 100) * 1.1, t, 0.03);
}

export function applyPedal(id) {
  if (ctx) nodes.board.apply(id, state.pedals[id]);
}

const scratch = new Float32Array(512);
/** RMS of an analyser, roughly 0..1 for display. */
export function levelOf(an) {
  if (!an) return 0;
  an.getFloatTimeDomainData(scratch);
  let s = 0;
  for (let i = 0; i < scratch.length; i++) s += scratch[i] * scratch[i];
  return Math.min(1, Math.sqrt(Math.sqrt(s / scratch.length)) * 1.05);
}

/* iOS: resume on any touch anywhere (as /interface2) */
document.addEventListener('touchend', () => {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}, { passive: true });
