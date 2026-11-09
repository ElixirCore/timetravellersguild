/* INTERFACE v6 audio graph. Routing is fixed:

     tracks (8, /interface2 chains) ─┐
     FIELD TAP pads ─────────────────┴─> mix bus ─> DIRT > WAH > CHORUS > PHASER > ECHO > VERB
                                                        │
                                       board out ───────┼──> master ─> limiter ─> out
                                                        └──> LOOPSMITH capture
                                       LOOPSMITH play ─────> master

   The master + limiter are /interface2's (built for a phone aux into an amp). */
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

export function ensureAudio() {
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
