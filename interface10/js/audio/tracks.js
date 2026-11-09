/* The /interface2 multitrack, its DSP unchanged: each clip becomes a looping
   layer with its own chain (drive, filter, wobble, echo, hall), volume,
   mute/solo and loop points. v6 holds the eight tracks in fixed slots, one per
   cell of the tesseract, and feeds them into the mix bus ahead of the pedals.
   v7: the clips are your own samples (mic or aux, kept in this browser), not
   the generated library.
   v9: each track is also an INSTRUMENT: notes of its sample (a slice at a
   pitch) can be played live or by its sequence, through the same chain. */
import {
  MAX_TRACKS, state, save, clamp, BPM_MIN, BPM_MAX,
} from '../state.js';
import { ensureAudio, nodes, makeLimiter } from './engine.js';
import { buildBoard } from './pedals.js';
import { looperRenderInfo } from './looper.js';
import { sampleData } from './samples.js';
import { startVoice } from './voice.js';
import { SEQ_CELLS, cellBeats, snapBars } from '../seqmodel.js';
import {
  GATES, LEVELS, PATTERNS, CHAIN_SLOTS, newSeq, cleanSeq, cloneSeq, hasSteps, chainPlan, patternFor,
} from '../pattern.js';

/* ---------- DSP helpers (same shapes as v1/v2) ---------- */
export const rateHz  = K => 0.25 * Math.pow(8, K.rate);
export const cutHz   = K => 120 * Math.pow(18000 / 120, K.cut);
export const resQ    = K => 0.5 + K.res * 11.5;
export const wobHz   = K => 0.1 * Math.pow(120, K.wobr);
export const echoSec = K => 0.05 + K.etime * 0.75;

function shaperCurve(amount) {
  const n = 1024, curve = new Float32Array(n), k = amount * 50;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = amount <= 0 ? x : (1 + k) * x / (1 + k * Math.abs(x));
  }
  return curve;
}

function impulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return ir;
}

/* one chain per track: src -> drive -> filt -> trem -> dry/echo/hall -> vol -> mutesolo -> dest */
export function buildChain(ctx, dest) {
  const drive = ctx.createWaveShaper(); drive.oversample = "2x";
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass"; filt.frequency.value = 18000; filt.Q.value = 0.6;
  const trem = ctx.createGain(); trem.gain.value = 1;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0;
  const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0;
  lfo.connect(lfoAmt); lfoAmt.connect(trem.gain); lfo.start();

  const dry = ctx.createGain(); dry.gain.value = 1;
  const echoSend = ctx.createGain(); echoSend.gain.value = 0;
  const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.28;
  const fb = ctx.createGain(); fb.gain.value = 0;
  const echoTone = ctx.createBiquadFilter(); echoTone.type = "lowpass"; echoTone.frequency.value = 2400;
  delay.connect(fb); fb.connect(echoTone); echoTone.connect(delay);
  echoSend.connect(delay);
  const hallSend = ctx.createGain(); hallSend.gain.value = 0;
  const conv = ctx.createConvolver(); conv.buffer = impulse(ctx, 2.2, 2.8);
  hallSend.connect(conv);

  const vol = ctx.createGain(); vol.gain.value = 0.8;
  const ms = ctx.createGain(); ms.gain.value = 1;

  drive.connect(filt); filt.connect(trem);
  trem.connect(dry); dry.connect(vol);
  trem.connect(echoSend); delay.connect(vol);
  trem.connect(hallSend); conv.connect(vol);
  vol.connect(ms); ms.connect(dest);

  return { drive, filt, trem, lfo, lfoAmt, dry, echoSend, delay, fb, echoTone, hallSend, conv, vol, ms, input: drive };
}

export function applyLive(t) {
  if (!t.nodes || !t.ctx) return;
  const K = t.K, n = t.nodes, tm = t.ctx.currentTime;
  n.filt.frequency.setTargetAtTime(cutHz(K), tm, 0.03);
  n.filt.Q.setTargetAtTime(resQ(K), tm, 0.03);
  if (t.driveAt !== K.drive) { n.drive.curve = shaperCurve(K.drive); t.driveAt = K.drive; }
  n.lfo.frequency.setTargetAtTime(K.wobd > 0 ? wobHz(K) : 0, tm, 0.05);
  n.lfoAmt.gain.setTargetAtTime(K.wobd * 0.6, tm, 0.05);
  n.delay.delayTime.setTargetAtTime(echoSec(K), tm, 0.05);
  n.echoSend.gain.setTargetAtTime(K.space * 0.9, tm, 0.05);
  n.fb.gain.setTargetAtTime(K.space * 0.72, tm, 0.05);
  n.hallSend.gain.setTargetAtTime(K.hall * 0.85, tm, 0.05);
  n.vol.gain.setTargetAtTime(t.vol * t.vol * 1.2, tm, 0.03); // gentle square law
  if (t.src) { try { t.src.playbackRate.setTargetAtTime(rateHz(K), tm, 0.03); } catch (e) {} }
}

/* ---------- tracks ---------- */
export const KDEF = [
  ["rate",  "pitch",  2 / 3],
  ["cut",   "filter", 1],
  ["res",   "reson",  0.1],
  ["drive", "drive",  0],
  ["wobr",  "wobrate",0.25],
  ["wobd",  "wobble", 0],
  ["etime", "echoLen",0.3],
  ["space", "echo",   0],
  ["hall",  "hall",   0]
];

export const slots = Array.from({ length: MAX_TRACKS }, () => null);
const MINLOOP = 0.02; /* seconds */
const listeners = new Set();
let say = () => {};

export function setSay(fn) { say = fn; }
export function onTracks(fn) { listeners.add(fn); }
function changed() { listeners.forEach(fn => fn()); }

export function live(t) { return !!(t && t.buf); }

export function audible(t) {
  const anySolo = slots.some(x => live(x) && x.solo);
  return anySolo ? t.solo : !t.mute;
}

export function applyMuteSolo() {
  slots.forEach(t => {
    if (live(t) && t.nodes) t.nodes.ms.gain.setTargetAtTime(audible(t) ? 1 : 0, t.ctx.currentTime, 0.02);
  });
  changed();
}

export function firstFree(prefer) {
  if (prefer != null && prefer >= 0 && prefer < MAX_TRACKS && !slots[prefer]) return prefer;
  return slots.findIndex(s => !s);
}

/* Adds a clip as a track in a free cell (prefer if it is free) and starts it,
   like /interface2. Returns the cell index, or -1. */
export async function addTrack(id, label, saved, prefer) {
  const slot = firstFree(prefer);
  if (slot < 0) { say("eight tracks is plenty", true); return -1; }
  const actx = ensureAudio();
  slots[slot] = { loading: true, id, label: label || id };
  changed();
  say("loading " + (label || "clip") + "…");
  let buf;
  try {
    const ab = await sampleData(id);
    if (!ab) throw new Error("no such sample");
    buf = await actx.decodeAudioData(ab);
  } catch (e) {
    slots[slot] = null;
    changed();
    say("that sample is gone", true);
    return -1;
  }

  const t = {
    id, label: label || id, buf, ctx: actx,
    /* v7 starts a track as it was recorded: 1× pitch (v2's 0.5 played at
       0.71×), the filter open and flat, no drive, wobble, echo or hall */
    K: { rate: 2 / 3, cut: 1, res: 0.018, drive: 0, wobr: 0.25, wobd: 0, etime: 0.3, space: 0, hall: 0 },
    vol: 0.8, mute: false, solo: false, playing: false, src: null,
    ls: 0, le: 1, /* loop start/end as 0..1 of the clip; the clip itself is never cut */
    pos: 0, nodes: null,
    /* v9: the instrument side: patterns, chops, hold; notes sounding; last hit */
    seq: saved?.seq ? cleanSeq(saved.seq) : newSeq(),
    voices: new Set(), seqVoice: null, hitAt: -1,
  };
  if (saved) {
    Object.assign(t.K, saved.K || {});
    t.vol = saved.vol != null ? saved.vol : 0.8;
    t.mute = !!saved.mute; t.solo = !!saved.solo;
    if (typeof saved.ls === "number" && typeof saved.le === "number" && saved.le - saved.ls > 0) {
      t.ls = Math.min(1, Math.max(0, saved.ls)); t.le = Math.min(1, Math.max(0, saved.le));
    }
  }
  t.nodes = buildChain(actx, nodes.mixBus);
  t.meter = actx.createAnalyser(); t.meter.fftSize = 512;
  t.nodes.ms.connect(t.meter);
  slots[slot] = t;
  applyLive(t);
  applyMuteSolo();
  say("");
  /* v7: nothing starts by itself; ▶ at the cube plays it */
  return slot;
}

export function playTrack(t) {
  if (!live(t) || t.playing) return;
  ensureAudio();
  t.src = t.ctx.createBufferSource();
  t.src.buffer = t.buf;
  t.src.loop = true;
  t.src.loopStart = t.ls * t.buf.duration;
  t.src.loopEnd = t.le * t.buf.duration;
  t.src.playbackRate.value = rateHz(t.K);
  t.src.connect(t.nodes.input);
  t.src.start(0, t.src.loopStart);
  t.pos = t.ls;
  t.playing = true;
  changed();
}

export function stopTrack(t) {
  if (!t) return;
  if (t.src) { try { t.src.stop(); } catch (e) {} try { t.src.disconnect(); } catch (e) {} t.src = null; }
  t.playing = false;
  changed();
}

export function toggleTrack(t) {
  if (!live(t)) return;
  t.playing ? stopTrack(t) : playTrack(t);
}

export function removeTrack(i) {
  const t = slots[i];
  if (!live(t)) return;
  stopTrack(t);
  killVoices(t);
  try { t.nodes.ms.disconnect(); } catch (e) {}
  slots[i] = null;
  applyMuteSolo();
}

export function stopAll() {
  slots.forEach(t => { if (live(t)) { stopTrack(t); killVoices(t); } });
}

/* ---------- v9: notes ---------- */
const MAX_VOICES = 16;

/* chop s of the track's loop region: where it starts and how long it is, in
   seconds of the buffer */
export function sliceOf(t, s) {
  const chops = t.seq.chops;
  const total = t.buf.duration;
  const span = ((t.le - t.ls) * total) / chops;
  const k = Math.min(chops - 1, Math.max(0, s | 0));
  return { from: t.ls * total + k * span, span };
}

/* n semitones from middle C: C4 plays the sample at the track's own pitch */
export function noteRate(t, n) {
  return Math.min(16, Math.max(0.03, rateHz(t.K) * Math.pow(2, n / 12)));
}

export function noteParams(t, n, s) {
  const { from, span } = sliceOf(t, s);
  return { rate: noteRate(t, n), from, span, loop: t.seq.hold };
}

/* One note, now or at `time` (context seconds). With hold on, `dur` is how
   long the key is down; a live key passes none and calls .release() itself.
   `mono` is the chip way: a new sequenced note cuts the one before it. */
export function playNote(t, { n = 0, s = 0, time = 0, dur = null, vel = 0.8, mono = false } = {}) {
  if (!live(t) || !t.nodes) return null;
  const when = Math.max(time, t.ctx.currentTime);
  const v = startVoice(t.ctx, t.nodes.input, t.buf, { time: when, vel, ...noteParams(t, n, s) });
  if (mono) {
    if (t.seqVoice) t.seqVoice.release(when, 0.006);
    t.seqVoice = v;
  }
  t.voices.add(v);
  v.onend = () => { t.voices.delete(v); if (t.seqVoice === v) t.seqVoice = null; };
  if (dur != null) v.release(when + dur);
  while (t.voices.size > MAX_VOICES) {
    const old = t.voices.values().next().value;
    old.release(when, 0.01);
    t.voices.delete(old);
  }
  t.hitAt = when;
  t.lastN = n;
  return v;
}

export function killVoices(t) {
  if (!t || !t.voices) return;
  for (const v of t.voices) v.release(0, 0.01);
  t.voices.clear();
  t.seqVoice = null;
}

/* how long a step's note is held before it is let go, or null to play it out */
export function gateSeconds(t, cell, cellSec) {
  const g = GATES[cell.g];
  if (g > 0) return g * cellSec;
  return t.seq.hold ? cellSec * 0.9 : null;
}

/* when a track is sounding by its notes (for the lights) */
export function noteActive(t) {
  return live(t) && (t.voices.size > 0 || (t.ctx.currentTime - t.hitAt) < 0.18);
}

/* ---------- loop points ---------- */
export function loopApply(t) {
  if (t.src) {
    try {
      t.src.loopStart = t.ls * t.buf.duration;
      t.src.loopEnd = t.le * t.buf.duration;
    } catch (e) {}
  }
}

export function setLoopPoint(t, which, f) {
  const gap = MINLOOP / t.buf.duration;
  f = Math.min(1, Math.max(0, f));
  if (which === "start") t.ls = Math.min(f, t.le - gap);
  else t.le = Math.max(f, t.ls + gap);
  t.ls = Math.max(0, t.ls); t.le = Math.min(1, t.le);
  loopApply(t);
}

export function resetLoop(t) {
  t.ls = 0; t.le = 1;
  loopApply(t);
}

/** Advances the display playhead (0..1 of the clip) for a playing track. */
export function advancePos(t, dt) {
  if (!live(t) || !t.playing) return;
  const span = Math.max(1e-4, t.le - t.ls);
  let p = t.pos + (dt * rateHz(t.K)) / t.buf.duration;
  if (p < t.ls || p >= t.le) p = t.ls + ((((p - t.ls) % span) + span) % span);
  t.pos = p;
}

/* ---------- keep the mix, in-browser ---------- */
const MIXKEY = "ttg_if10_mixes"; /* v10 keeps its own mixes; v7/v6/v2 mixes are only ever read where they live */

export function getMixes() {
  try { return JSON.parse(localStorage.getItem(MIXKEY)) || []; } catch (e) { return []; }
}
function setMixes(ms) {
  try { localStorage.setItem(MIXKEY, JSON.stringify(ms)); } catch (e) {}
  changed();
}

export function saveMix() {
  const held = slots.filter(live);
  if (!held.length) { say("nothing to keep yet", true); return; }
  const mixes = getMixes();
  const name = "mix " + (mixes.length + 1) + " · " + new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  mixes.push({
    name,
    /* v9: a mix also keeps each track's patterns and the song structure */
    chain: state.seq.chain.slice(), bpm: state.seq.bpm, bars: state.seq.bars,
    tracks: held.map(t => ({ id: t.id, label: t.label, vol: t.vol, mute: t.mute, solo: t.solo, ls: t.ls, le: t.le, K: Object.assign({}, t.K), seq: cloneSeq(t.seq) }))
  });
  setMixes(mixes);
  say("kept as " + name);
}

export function removeMix(i) {
  const ms = getMixes(); ms.splice(i, 1);
  setMixes(ms);
}

export async function loadMix(m) {
  slots.forEach((t, i) => removeTrack(i));
  for (const [i, s] of m.tracks.slice(0, MAX_TRACKS).entries()) {
    await addTrack(s.id, s.label, s, i);
  }
  if (Array.isArray(m.chain)) {
    state.seq.chain = Array.from({ length: CHAIN_SLOTS }, (_, i) => {
      const v = Math.round(Number(m.chain[i]));
      return v >= 0 && v < PATTERNS ? v : -1;
    });
  }
  if (Number.isFinite(m.bpm)) state.seq.bpm = clamp(Math.round(m.bpm), BPM_MIN, BPM_MAX);
  if (Number.isFinite(m.bars)) state.seq.bars = snapBars(Math.round(m.bars));
  save();
  changed();
  say(m.name + " loaded: play at the cube");
}

/* ---------- render the mix to a wav ---------- */
export function wavEncode(abuf) {
  const nCh = abuf.numberOfChannels, sr = abuf.sampleRate, len = abuf.length;
  const bytes = 44 + len * nCh * 2;
  const out = new DataView(new ArrayBuffer(bytes));
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, "RIFF"); out.setUint32(4, bytes - 8, true); wstr(8, "WAVE");
  wstr(12, "fmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
  out.setUint16(22, nCh, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * nCh * 2, true); out.setUint16(32, nCh * 2, true);
  out.setUint16(34, 16, true); wstr(36, "data"); out.setUint32(40, len * nCh * 2, true);
  let off = 44;
  const chans = [];
  for (let c = 0; c < nCh; c++) chans.push(abuf.getChannelData(c));
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nCh; c++) {
      let s = Math.max(-1, Math.min(1, chans[c][i]));
      out.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return out.buffer;
}

let exporting = false;
export function isExporting() { return exporting; }

/* As /interface2, one pass of the longest loop. v6 routes the tracks through
   the pedal chain as it is set, and adds the LOOPSMITH loop if one is running.
   FIELD TAP pads are played by hand, so they are not in the render. */
export async function exportMix() {
  if (exporting) return;
  const renderable = slots.filter(t => live(t) && audible(t));
  const loopInfo = looperRenderInfo();
  if (!renderable.length && !loopInfo) { say("nothing audible to render", true); return; }
  exporting = true;
  changed();
  say("rendering the mix…");
  try {
    let dur = 0;
    /* v9: a track with steps renders its sequence (one pass of the song);
       it also renders its free loop if that is playing, or if it has no steps */
    const loops = t => t.playing || !hasSteps(t.seq);
    const seqd = renderable.filter(t => hasSteps(t.seq));
    const plan = chainPlan(state.seq.chain);
    const cycles = plan.length || 1;
    const cellSec = (60 / state.seq.bpm) * cellBeats(state.seq.bars);
    if (seqd.length) dur = cycles * SEQ_CELLS * cellSec + 1.5;
    renderable.filter(loops).forEach(t => { dur = Math.max(dur, t.buf.duration * (t.le - t.ls) / rateHz(t.K)); });
    if (loopInfo) dur = Math.max(dur, loopInfo.buffer.duration / loopInfo.rate);
    dur = Math.min(180, Math.max(2, dur));
    const sr = 44100;
    const OfflineAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const octx = new OfflineAC(2, Math.ceil(sr * dur), sr);
    const omaster = octx.createGain(); omaster.gain.value = 0.9;
    const olim = makeLimiter(octx);
    omaster.connect(olim); olim.connect(octx.destination);
    const omix = octx.createGain(); omix.gain.value = 0.9;
    const board = buildBoard(octx);
    board.applyAll(state.pedals);
    omix.connect(board.input); board.output.connect(omaster);
    renderable.forEach(t => {
      const n = buildChain(octx, omix);
      const K = t.K, tm = 0;
      n.filt.frequency.setValueAtTime(cutHz(K), tm);
      n.filt.Q.setValueAtTime(resQ(K), tm);
      n.drive.curve = shaperCurve(K.drive);
      n.lfo.frequency.setValueAtTime(K.wobd > 0 ? wobHz(K) : 0, tm);
      n.lfoAmt.gain.setValueAtTime(K.wobd * 0.6, tm);
      n.delay.delayTime.setValueAtTime(echoSec(K), tm);
      n.echoSend.gain.setValueAtTime(K.space * 0.9, tm);
      n.fb.gain.setValueAtTime(K.space * 0.72, tm);
      n.hallSend.gain.setValueAtTime(K.hall * 0.85, tm);
      n.vol.gain.setValueAtTime(t.vol * t.vol * 1.2, tm);
      n.ms.gain.setValueAtTime(1, tm);
      if (loops(t)) {
        const s = octx.createBufferSource();
        s.buffer = t.buf; s.loop = true;
        s.loopStart = t.ls * t.buf.duration; s.loopEnd = t.le * t.buf.duration;
        s.playbackRate.setValueAtTime(rateHz(K), tm);
        s.connect(n.input);
        s.start(0, s.loopStart); s.stop(dur);
      }
      if (hasSteps(t.seq)) {
        let prev = null;
        for (let c = 0; c < cycles; c++) {
          const pat = patternFor(c, state.seq.chain, state.seq.pattern).pattern;
          for (let i = 0; i < SEQ_CELLS; i++) {
            const cell = t.seq.pats[pat][i];
            const at = (c * SEQ_CELLS + i) * cellSec;
            if (!cell.on || at >= dur) continue;
            if (prev) prev.release(at, 0.006);
            prev = startVoice(octx, n.input, t.buf, { time: at, vel: LEVELS[cell.v], ...noteParams(t, cell.n, 0) });
            const d = gateSeconds(t, cell, cellSec);
            if (d != null) prev.release(at + d);
          }
        }
      }
    });
    if (loopInfo) {
      const s = octx.createBufferSource();
      s.buffer = loopInfo.buffer; s.loop = true;
      s.playbackRate.setValueAtTime(loopInfo.rate, 0);
      const crush = octx.createWaveShaper(); crush.curve = loopInfo.crush;
      const g = octx.createGain(); g.gain.value = loopInfo.gain;
      s.connect(crush); crush.connect(g); g.connect(omaster);
      s.start(0, loopInfo.offset); s.stop(dur);
    }
    const rendered = await octx.startRendering();
    const blob = new Blob([wavEncode(rendered)], { type: "audio/wav" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "interface-mix-" + new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-") + ".wav";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    say("mix kept - " + Math.round(dur) + "s wav");
  } catch (e) {
    say("render failed: " + (e.message || e), true);
  }
  exporting = false;
  changed();
}
