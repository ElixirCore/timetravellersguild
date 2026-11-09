import { state, runtime, MAX_LOOP_BARS } from '../state.js';
import { getCtx, ensureAudio, nodes, audioNow } from './context.js';
import { barDur, nextBarTime } from '../engine/clock.js';

let node = null;
let workletReady = null;
let crushNode = null;
let glitchTimer = null;

const loop = {
  st: 'EMPTY',
  buffer: null,
  dur: 0,
  bars: 0,
  source: null,
  anchor: 0,
  jobStart: 0,
};

function speedToRate(speed = state.looper.speed) {
  const t = speed / 100;
  return 0.25 * (16 ** t);
}

function loopPos(now = audioNow()) {
  if (!loop.buffer) return 0;
  const rate = speedToRate();
  const dur = loop.buffer.duration;
  return (((now - loop.anchor) * rate) % dur + dur) % dur;
}

function ensureCrushNode() {
  if (crushNode) return crushNode;
  const ctx = ensureAudio();
  crushNode = ctx.createWaveShaper();
  crushNode.oversample = '2x';
  crushNode.connect(nodes.looperGain);
  return crushNode;
}

function crushCurve(amount) {
  if (amount <= 0) return null;
  const curve = new Float32Array(65536);
  const steps = Math.max(2, Math.floor(2 ** (4 + (amount / 100) * 10)));
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}

function lockAnchorForRate(now = audioNow()) {
  if (!loop.source || !loop.buffer) return;
  const pos = loopPos(now);
  loop.anchor = now - pos / speedToRate();
}

export function applyLoopFx() {
  ensureCrushNode();
  const t = audioNow();
  crushNode.curve = crushCurve(state.looper.crush);
  if (loop.source && loop.st === 'LOOPING') {
    const rate = speedToRate();
    lockAnchorForRate(t);
    loop.source.playbackRate.setTargetAtTime(rate, t, 0.04);
  }
}

async function initWorklet() {
  const ctx = ensureAudio();
  ensureCrushNode();
  if (!workletReady) {
    workletReady = ctx.audioWorklet.addModule('js/audio/recorder-worklet.js').then(() => {
      node = new AudioWorkletNode(ctx, 'capture', { numberOfInputs: 1, numberOfOutputs: 1 });
      nodes.boardOut.connect(node);
      const sink = ctx.createGain();
      sink.gain.value = 0;
      node.connect(sink).connect(ctx.destination);
      node.port.onmessage = (e) => onCapture(e.data);
    });
  }
  return workletReady;
}

function startSource(when, offset = 0) {
  const ctx = getCtx();
  if (!ctx || !loop.buffer) return;
  stopSource();
  const src = ctx.createBufferSource();
  src.buffer = loop.buffer;
  src.loop = true;
  src.playbackRate.value = speedToRate();
  src.connect(ensureCrushNode());
  const off = Math.max(0, Math.min(offset, loop.buffer.duration - 0.001));
  src.start(when, off);
  loop.source = src;
  loop.anchor = when - off / speedToRate();
}

function stopSource() {
  try { loop.source?.stop(); } catch { /* already stopped */ }
  loop.source = null;
}

function buildBuffer(channels) {
  const ctx = getCtx();
  const len = channels[0].length;
  const buffer = ctx.createBuffer(2, Math.max(1, len), ctx.sampleRate);
  buffer.getChannelData(0).set(channels[0]);
  buffer.getChannelData(1).set(channels[1]);
  return buffer;
}

function clearGlitchTimer() {
  clearTimeout(glitchTimer);
  glitchTimer = null;
}

function syncGlitchTimer() {
  clearGlitchTimer();
  if (loop.st !== 'LOOPING' || !loop.source || state.looper.glitch <= 0) return;

  const tick = () => {
    if (loop.st !== 'LOOPING' || !loop.source || state.looper.glitch <= 0) return;
    const chaos = state.looper.glitch / 100;
    const now = audioNow();
    const base = speedToRate();
    const spike = base * (0.15 + Math.random() * 2.8 * chaos);
    loop.source.playbackRate.cancelScheduledValues(now);
    loop.source.playbackRate.setValueAtTime(spike, now);
    loop.source.playbackRate.setTargetAtTime(base, now + 0.02, 0.03 + chaos * 0.08);
    lockAnchorForRate(now);
    glitchTimer = setTimeout(tick, 35 + (1 - chaos) * 380);
  };
  tick();
}

function onCapture(msg) {
  const now = audioNow();
  if (msg.tag === 'loop') {
    if (loop.st !== 'REC') return;
    loop.buffer = buildBuffer(msg.channels);
    loop.dur = msg.end - msg.start;
    loop.bars = Math.max(1, Math.round(loop.dur / barDur()));
    loop.anchor = msg.end;
    applyLoopFx();
    if (now < msg.end - 0.005) startSource(msg.end);
    else startSource(now, loopPos(now));
    loop.st = 'LOOPING';
    syncGlitchTimer();
  } else if (msg.tag === 'dub') {
    if (loop.st !== 'DUB' || !loop.buffer) return;
    const sr = getCtx().sampleRate;
    const loopLen = loop.buffer.length;
    const offset = Math.round(loopPos(msg.start) * sr);
    for (let ch = 0; ch < 2; ch++) {
      const dest = loop.buffer.getChannelData(ch);
      const srcData = msg.channels[ch];
      for (let i = 0; i < srcData.length; i++) {
        dest[(offset + i) % loopLen] += srcData[i];
      }
    }
    const swapAt = nextBarTime(now + 0.05);
    const oldSrc = loop.source;
    try { oldSrc?.stop(swapAt); } catch { /* ignore */ }
    const posAtSwap = loopPos(swapAt);
    const ctx = getCtx();
    const fresh = ctx.createBufferSource();
    fresh.buffer = loop.buffer;
    fresh.loop = true;
    fresh.playbackRate.value = speedToRate();
    fresh.connect(ensureCrushNode());
    fresh.start(swapAt, posAtSwap);
    loop.source = fresh;
    loop.anchor = swapAt - posAtSwap / speedToRate();
    loop.st = 'LOOPING';
    syncGlitchTimer();
  }
}

export async function pressRec() {
  await initWorklet();
  const now = audioNow();

  if (loop.st === 'EMPTY') {
    const start = nextBarTime(now + 0.05);
    loop.jobStart = start;
    node.port.postMessage({
      cmd: 'arm', tag: 'loop', start, end: start + MAX_LOOP_BARS * barDur(),
    });
    loop.st = 'ARMED';
  } else if (loop.st === 'ARMED') {
    node.port.postMessage({ cmd: 'cancel' });
    loop.st = 'EMPTY';
  } else if (loop.st === 'REC') {
    const end = Math.max(nextBarTime(now + 0.02), loop.jobStart + barDur());
    node.port.postMessage({ cmd: 'close', end });
  } else if (loop.st === 'LOOPING') {
    const start = nextBarTime(now + 0.05);
    loop.jobStart = start;
    node.port.postMessage({ cmd: 'arm', tag: 'dub', start, end: start + loop.dur });
    loop.st = 'DUB';
  } else if (loop.st === 'DUB') {
    node.port.postMessage({ cmd: 'cancel' });
    loop.st = 'LOOPING';
    syncGlitchTimer();
  } else if (loop.st === 'STOPPED' && runtime.playing && loop.buffer) {
    const start = nextBarTime(now + 0.05);
    const pos = loopPos(start);
    startSource(start, pos);
    loop.st = 'LOOPING';
    syncGlitchTimer();
  }
}

export function pressStop() {
  if (loop.st === 'ARMED' || loop.st === 'REC') {
    node?.port.postMessage({ cmd: 'cancel' });
    loop.st = 'EMPTY';
  } else if (loop.st === 'DUB') {
    node?.port.postMessage({ cmd: 'cancel' });
    loop.st = 'LOOPING';
    syncGlitchTimer();
  } else if (loop.st === 'LOOPING') {
    stopSource();
    clearGlitchTimer();
    loop.st = 'STOPPED';
  } else if (loop.st === 'STOPPED') {
    loop.buffer = null;
    loop.dur = 0;
    loop.bars = 0;
    loop.st = 'EMPTY';
  }
}

export function onTransportStart(t0) {
  if (loop.st === 'LOOPING' && loop.buffer) {
    startSource(t0, 0);
    syncGlitchTimer();
  }
}

export function onTransportStop() {
  if (loop.st === 'ARMED' || loop.st === 'REC') {
    node?.port.postMessage({ cmd: 'cancel' });
    loop.st = 'EMPTY';
  } else if (loop.st === 'DUB') {
    node?.port.postMessage({ cmd: 'cancel' });
    loop.st = 'LOOPING';
  }
  stopSource();
  clearGlitchTimer();
}

export function looperStatus() {
  const now = audioNow();
  const bar = barDur();
  if (loop.st === 'ARMED') {
    if (now >= loop.jobStart) loop.st = 'REC';
    return { st: loop.st, text: loop.st === 'REC' ? 'REC 1' : 'ARM' };
  }
  if (loop.st === 'REC') {
    const bars = Math.min(MAX_LOOP_BARS, Math.floor((now - loop.jobStart) / bar) + 1);
    return { st: 'REC', text: `REC ${bars}` };
  }
  if (loop.st === 'LOOPING' || loop.st === 'DUB') {
    const playing = runtime.playing && loop.source;
    const pos = playing
      ? Math.floor((loopPos(now) / bar) + 1)
      : 1;
    const rate = speedToRate();
    const rateTag = Math.abs(rate - 1) > 0.04 ? ` ${rate.toFixed(2)}×` : '';
    const label = loop.st === 'DUB' ? 'DUB' : 'LOOP';
    return { st: loop.st, text: `${label} ${pos}/${loop.bars}${rateTag}` };
  }
  if (loop.st === 'STOPPED') return { st: 'STOPPED', text: `HELD ${loop.bars}` };
  return { st: 'EMPTY', text: 'EMPTY' };
}

export function resyncLoopFx() {
  applyLoopFx();
  syncGlitchTimer();
}

/** Reset speed to 1× and bar-quantize loop phase to the main transport grid. */
export function resyncLoopOneX() {
  state.looper.speed = 50;
  applyLoopFx();

  if (!loop.buffer || loop.st !== 'LOOPING') {
    return { ok: true, mode: 'speed' };
  }

  const now = audioNow();
  const syncAt = runtime.playing ? nextBarTime(now + 0.02) : now + 0.005;
  clearGlitchTimer();

  const oldSrc = loop.source;
  const ctx = getCtx();
  const src = ctx.createBufferSource();
  src.buffer = loop.buffer;
  src.loop = true;
  src.playbackRate.value = 1;
  src.connect(ensureCrushNode());
  src.start(syncAt, 0);
  loop.source = src;
  loop.anchor = syncAt;

  try { oldSrc?.stop(syncAt); } catch { /* ignore */ }

  syncGlitchTimer();
  return { ok: true, mode: runtime.playing ? 'bar' : 'now', at: syncAt };
}
