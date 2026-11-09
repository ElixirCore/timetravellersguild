/* The one way sound gets in: a mic or an aux (line) input, chosen at Keter.
   Everything that listens (the sampler at Keter, FIELD TAP at Binah) takes
   its signal from inputBus(), so changing the device moves them all at once.
   Browser processing is off (no echo cancelling, noise suppression or auto
   gain), so a line input arrives as it is, in stereo where it is stereo. */
import { state, save } from '../state.js';
import { ensureAudio } from './engine.js';

let stream = null;
let source = null;
let bus = null;
let analyser = null;
let meterBuf = null;
let devices = [];
let current = null; // the MediaDeviceInfo in use, once known
const listeners = new Set();

export function onInputChange(fn) { listeners.add(fn); }
function changed() { listeners.forEach((fn) => fn(current)); }

function constraints(id) {
  return {
    audio: {
      deviceId: id ? { exact: id } : undefined,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 2 },
    },
  };
}

/* mic or aux, from what the device calls itself */
export function kindOf(dev) {
  const l = (dev?.label || '').toLowerCase();
  if (!l || /mic|built-in|internal|headset|airpods|buds|webcam|camera|default|iphone|ipad/.test(l)) return 'mic';
  return 'aux';
}

export function inputBus() {
  const ctx = ensureAudio();
  if (!bus || bus.context !== ctx) {
    bus = ctx.createGain();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    meterBuf = new Float32Array(analyser.fftSize);
    bus.connect(analyser);
  }
  return bus;
}

async function listDevices() {
  try {
    devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  } catch { devices = []; }
  return devices;
}

async function openStream(id) {
  let s;
  /* iPhones: recording needs the play-and-record session (see engine.js) */
  try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch { /* not offered */ }
  try {
    s = await navigator.mediaDevices.getUserMedia(constraints(id));
  } catch (err) {
    if (!id) throw err;
    s = await navigator.mediaDevices.getUserMedia(constraints(null)); // the saved device has gone
  }
  if (stream && stream !== s) stream.getTracks().forEach((t) => t.stop());
  stream = s;
  const ctx = ensureAudio();
  source?.disconnect();
  source = ctx.createMediaStreamSource(stream);
  source.connect(inputBus());
  await listDevices();
  const tid = stream.getAudioTracks()[0]?.getSettings?.().deviceId;
  current = devices.find((d) => d.deviceId === tid) || devices[0] || null;
  changed();
  return stream;
}

/* opens the chosen input (asking for permission the first time) */
export async function openInput() {
  if (stream && stream.active && source?.context === ensureAudio()) return stream;
  return openStream(state.input.deviceId);
}

/* steps to the next input the browser offers (mic, then any line/aux inputs).
   The first press only opens the input in use, so it never jumps off the
   mic before you have heard what it is. */
export async function nextInput() {
  if (!inputOpen()) { await openInput(); return current; }
  await listDevices();
  if (devices.length < 2) { changed(); return current; }
  const i = devices.findIndex((d) => d.deviceId === current?.deviceId);
  const next = devices[(i + 1) % devices.length];
  state.input.deviceId = next.deviceId;
  save();
  await openStream(next.deviceId);
  return current;
}

export function currentInput() { return current; }
export function inputCount() { return devices.length; }
export function inputOpen() { return !!(stream && stream.active); }

/* 0..1, for the meters */
export function inputLevel() {
  if (!analyser || !inputOpen()) return 0;
  analyser.getFloatTimeDomainData(meterBuf);
  let s = 0;
  for (let i = 0; i < meterBuf.length; i++) s += meterBuf[i] * meterBuf[i];
  return Math.min(1, Math.sqrt(Math.sqrt(s / meterBuf.length)) * 1.05);
}

navigator.mediaDevices?.addEventListener?.('devicechange', async () => {
  await listDevices();
  changed();
});
