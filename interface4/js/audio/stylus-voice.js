import { state, NOTE_NAMES } from '../state.js';
import { getCtx, ensureAudio, nodes } from './context.js';
import { applyStylusFx } from './stylus-fx.js';

function moodPitchFromX(x) {
  const span = 0.85 + (state.stylus.range / 100) * 1.35;
  const minHz = 310;
  const maxHz = minHz * 2 ** span;
  return minHz * (maxHz / minHz) ** x;
}

function wubPitchFromX(x) {
  const span = 0.55 + (state.stylus.range / 100) * 1.05;
  const minHz = 36;
  const maxHz = minHz * 2 ** span;
  return minHz * (maxHz / minHz) ** x;
}

function pitchFromX(x) {
  return state.stylus.mode === 'wub' ? wubPitchFromX(x) : moodPitchFromX(x);
}

function hzToNote(hz) {
  const midi = 69 + 12 * Math.log2(hz / 440);
  const n = Math.round(midi);
  const name = NOTE_NAMES[((n % 12) + 12) % 12];
  return `${name}${Math.floor(n / 12) - 1}`;
}

export function stylusNoteLabel(x = state.stylus.x) {
  return hzToNote(pitchFromX(x));
}

function makeDriveCurve(amount) {
  const n = 256;
  const curve = new Float32Array(n);
  const k = 1 + (amount / 100) * 18;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

function ensureMoodVoice() {
  const ctx = ensureAudio();
  if (nodes.stylusMoodReady) return;

  const amp = ctx.createGain();
  amp.gain.value = 0;

  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = moodPitchFromX(0.5);

  const overtone = ctx.createOscillator();
  overtone.type = 'triangle';
  overtone.frequency.value = carrier.frequency.value * 2;
  const overGain = ctx.createGain();
  overGain.gain.value = 0.12;

  const vibrato = ctx.createOscillator();
  vibrato.type = 'sine';
  vibrato.frequency.value = 5.2;
  const vibratoGain = ctx.createGain();
  vibratoGain.gain.value = 0;
  vibrato.connect(vibratoGain).connect(carrier.frequency);

  const mix = ctx.createGain();
  carrier.connect(mix);
  overtone.connect(overGain).connect(mix);
  mix.connect(amp);
  amp.connect(nodes.stylusVoiceBus);

  carrier.start();
  overtone.start();
  vibrato.start();

  nodes.stylusMoodAmp = amp;
  nodes.stylusCarrier = carrier;
  nodes.stylusOvertone = overtone;
  nodes.stylusVibratoGain = vibratoGain;
  nodes.stylusMoodReady = true;
}

function ensureWubVoice() {
  const ctx = ensureAudio();
  if (nodes.stylusWubReady) return;

  const amp = ctx.createGain();
  amp.gain.value = 0;

  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.value = wubPitchFromX(0.5);

  const square = ctx.createOscillator();
  square.type = 'square';
  square.frequency.value = saw.frequency.value;
  const squareGain = ctx.createGain();
  squareGain.gain.value = 0.35;

  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = saw.frequency.value * 0.5;
  const subGain = ctx.createGain();
  subGain.gain.value = 0.55;

  const oscMix = ctx.createGain();
  saw.connect(oscMix);
  square.connect(squareGain).connect(oscMix);
  sub.connect(subGain).connect(oscMix);

  const drive = ctx.createWaveShaper();
  drive.curve = makeDriveCurve(state.stylus.fx.warm);
  drive.oversample = '2x';

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 120;
  filter.Q.value = 10;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 2;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0;
  lfo.connect(lfoDepth).connect(filter.frequency);

  oscMix.connect(drive).connect(filter).connect(amp);
  amp.connect(nodes.stylusVoiceBus);

  saw.start();
  square.start();
  sub.start();
  lfo.start();

  nodes.stylusWubAmp = amp;
  nodes.stylusWubSaw = saw;
  nodes.stylusWubSquare = square;
  nodes.stylusWubSub = sub;
  nodes.stylusWubFilter = filter;
  nodes.stylusWubDrive = drive;
  nodes.stylusWubLfo = lfo;
  nodes.stylusWubLfoDepth = lfoDepth;
  nodes.stylusWubReady = true;
}

function ensureVoiceBus() {
  const ctx = ensureAudio();
  if (nodes.stylusVoiceBus) return;
  nodes.stylusVoiceBus = ctx.createGain();
  nodes.stylusVoiceBus.gain.value = 1;
  nodes.stylusVoiceBus.connect(nodes.stylusIn);
}

export function ensureStylusVoice() {
  ensureVoiceBus();
  ensureMoodVoice();
  ensureWubVoice();
}

function updateMood(x, y, active) {
  ensureMoodVoice();
  const ctx = getCtx();
  const t = ctx.currentTime;
  const freq = moodPitchFromX(x);
  const glide = 0.015 + (1 - state.stylus.glide / 100) * 0.22;

  nodes.stylusCarrier.frequency.setTargetAtTime(freq, t, glide);
  nodes.stylusOvertone.frequency.setTargetAtTime(freq * 2, t, glide);

  const strength = active ? y ** 1.35 : 0;
  nodes.stylusMoodAmp.gain.setTargetAtTime(strength * 0.38, t, active ? 0.025 : 0.1);
  nodes.stylusVibratoGain.gain.setTargetAtTime(
    (state.stylus.breath / 100) * 5 * strength,
    t,
    0.04,
  );
  nodes.stylusWubAmp.gain.setTargetAtTime(0, t, 0.06);
}

function updateWub(x, y, active) {
  ensureWubVoice();
  const ctx = getCtx();
  const t = ctx.currentTime;
  const freq = wubPitchFromX(x);
  const glide = 0.012 + (1 - state.stylus.glide / 100) * 0.14;

  for (const osc of [nodes.stylusWubSaw, nodes.stylusWubSquare]) {
    osc.frequency.setTargetAtTime(freq, t, glide);
  }
  nodes.stylusWubSub.frequency.setTargetAtTime(freq * 0.5, t, glide);

  const strength = active ? Math.max(y ** 1.1, 0.05) : 0;
  const rate = 0.45 + (state.stylus.breath / 100) * 16;
  const reso = 4 + (state.stylus.wub.reso / 100) * 16;
  const baseCutoff = 70 + freq * 1.8 + (state.stylus.fx.warm / 100) * 120;
  const depth = active ? (80 + y * 2200) * (0.35 + (state.stylus.fx.warm / 100) * 0.45) : 0;

  nodes.stylusWubLfo.frequency.setTargetAtTime(rate, t, 0.04);
  nodes.stylusWubFilter.frequency.setTargetAtTime(baseCutoff, t, 0.03);
  nodes.stylusWubFilter.Q.setTargetAtTime(reso, t, 0.04);
  nodes.stylusWubLfoDepth.gain.setTargetAtTime(depth, t, active ? 0.02 : 0.08);
  nodes.stylusWubDrive.curve = makeDriveCurve(28 + (state.stylus.fx.warm / 100) * 72);
  nodes.stylusWubAmp.gain.setTargetAtTime(strength * 0.42, t, active ? 0.018 : 0.08);
  nodes.stylusMoodAmp.gain.setTargetAtTime(0, t, 0.06);
}

export function updateStylus(x, y, active) {
  if (!state.stylus.on || state.stylus.mute) {
    stopStylus();
    return stylusNoteLabel(x);
  }

  ensureStylusVoice();
  applyStylusFx();

  if (state.stylus.mode === 'wub') {
    updateWub(x, y, active);
  } else {
    updateMood(x, y, active);
  }

  return stylusNoteLabel(x);
}

export function stopStylus() {
  if (!getCtx()) return;
  const t = getCtx().currentTime;
  if (nodes.stylusMoodAmp) {
    nodes.stylusMoodAmp.gain.setTargetAtTime(0, t, 0.08);
  }
  if (nodes.stylusVibratoGain) {
    nodes.stylusVibratoGain.gain.setTargetAtTime(0, t, 0.06);
  }
  if (nodes.stylusWubAmp) {
    nodes.stylusWubAmp.gain.setTargetAtTime(0, t, 0.08);
  }
  if (nodes.stylusWubLfoDepth) {
    nodes.stylusWubLfoDepth.gain.setTargetAtTime(0, t, 0.06);
  }
}

export function resetStylusVoice() {
  stopStylus();
  nodes.stylusMoodReady = false;
  nodes.stylusWubReady = false;
  nodes.stylusVoiceBus = null;
}
