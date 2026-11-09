import { state, runtime } from '../state.js';
import {
  setT0, arpInterval, bassInterval, drumInterval, octaveRange, swingOffset,
} from './clock.js';
import { degreeToMidi } from './harmony.js';
import { ensureAudio, audioNow } from '../audio/context.js';
import { applyAllPedals } from '../audio/pedals.js';
import { playArpNote } from '../audio/voices.js';
import { playBassNote, resetGlide } from '../audio/bass-voice.js';
import { playDrum } from '../audio/drum-voice.js';
import { playFieldPad, hasFieldPad } from '../audio/field-voice.js';
import { playSeedLane, hasSeedLane } from '../audio/seed-voice.js';
import { onTransportStart, onTransportStop } from '../audio/looper.js';
import { DRUM_PARTS, FIELD_PADS, SEED_LANES } from '../state.js';

const LOOKAHEAD = 0.12;
const TICK_MS = 25;
let timer = null;

function freshLanes() {
  return {
    arp: {
      next: 0,
      count: 0,
      idx: state.arp.direction === 'DOWN' ? state.arp.length - 1 : 0,
      dir: 1,
      oct: 0,
      passCount: 0,
    },
    bass: { next: 0, count: 0, idx: 0 },
    drums: { next: 0, count: 0, idx: 0 },
    field: { next: 0, count: 0, idx: 0 },
    seed: { next: 0, count: 0, idx: 0 },
  };
}

// The playback order IS the arp: ORDER walks the tine rail,
// RANGE shifts the whole pass up an octave each cycle.
function advanceArp(s) {
  const len = state.arp.length;
  const range = octaveRange();
  const dir = state.arp.direction;

  if (dir === 'RAND') {
    s.idx = Math.floor(Math.random() * len);
    if (++s.passCount >= len) {
      s.passCount = 0;
      s.oct = (s.oct + 1) % range;
    }
    return;
  }
  if (dir === 'UP') {
    if (++s.idx >= len) {
      s.idx = 0;
      s.oct = (s.oct + 1) % range;
    }
    return;
  }
  if (dir === 'DOWN') {
    if (--s.idx < 0) {
      s.idx = len - 1;
      s.oct = (s.oct + 1) % range;
    }
    return;
  }
  // PEND: bounce between the ends, octave up on each return home.
  if (len < 2) {
    s.idx = 0;
    s.oct = (s.oct + 1) % range;
    return;
  }
  s.idx += s.dir;
  if (s.idx >= len) {
    s.idx = len - 2;
    s.dir = -1;
  } else if (s.idx < 0) {
    s.idx = 1;
    s.dir = 1;
    s.oct = (s.oct + 1) % range;
  }
}

function fireArp(s, time) {
  if (s.idx >= state.arp.length) s.idx = 0;
  const step = state.arp.steps[s.idx];
  runtime.queue.push({ lane: 'arp', idx: s.idx, time, on: step.on && !state.arp.mute });
  if (!step.on || state.arp.mute) return;
  const midi = degreeToMidi(step.degree, s.oct);
  const dur = Math.max(0.06, arpInterval() * (step.gate / 100));
  playArpNote(midi, time, 0.85, dur);
}

function fireBass(s, time) {
  if (s.idx >= state.bass.length) s.idx = 0;
  const step = state.bass.steps[s.idx];
  runtime.queue.push({ lane: 'bass', idx: s.idx, time, on: step.on && state.bass.on });
  s.idx = (s.idx + 1) % state.bass.length;
  if (!step.on || !state.bass.on) return;
  const midi = degreeToMidi(step.degree, 0, 36);
  const dur = Math.max(0.08, bassInterval() * (step.gate / 100));
  playBassNote(midi, time, 0.9, dur);
}

function fireDrums(s, time) {
  if (s.idx >= state.drums.length) s.idx = 0;
  let any = false;
  for (const part of DRUM_PARTS) {
    const step = state.drums.steps[part][s.idx];
    if (step?.on) {
      any = true;
      if (state.drums.on && !state.drums.mute) playDrum(part, time);
    }
  }
  runtime.queue.push({
    lane: 'drums',
    idx: s.idx,
    time,
    on: any && state.drums.on && !state.drums.mute,
  });
  s.idx = (s.idx + 1) % state.drums.length;
}

function fireField(s, time) {
  if (s.idx >= state.field.length) s.idx = 0;
  let any = false;
  for (let pad = 0; pad < FIELD_PADS; pad++) {
    const step = state.field.steps[pad][s.idx];
    if (step?.on && hasFieldPad(pad) && !state.field.padMute?.[pad]) {
      any = true;
      if (state.field.on && !state.field.mute) {
        playFieldPad(pad, time, 0.88, step.rate ?? 1);
      }
    }
  }
  runtime.queue.push({
    lane: 'field',
    idx: s.idx,
    time,
    on: any && state.field.on && !state.field.mute,
  });
  s.idx = (s.idx + 1) % state.field.length;
}

function fireSeed(s, time) {
  if (s.idx >= state.seed.length) s.idx = 0;
  let any = false;
  for (let lane = 0; lane < SEED_LANES; lane++) {
    const step = state.seed.steps[lane][s.idx];
    if (step?.on && hasSeedLane(lane) && !state.seed.laneMute?.[lane]) {
      any = true;
      if (state.seed.on && !state.seed.mute) {
        playSeedLane(lane, time, 0.88, step.rate ?? 1);
      }
    }
  }
  runtime.queue.push({
    lane: 'seed',
    idx: s.idx,
    time,
    on: any && state.seed.on && !state.seed.mute,
  });
  s.idx = (s.idx + 1) % state.seed.length;
}

function tick() {
  if (!runtime.playing) return;
  const now = audioNow();
  const horizon = now + LOOKAHEAD;
  const { arp, bass, drums, field, seed } = runtime.lanes;

  while (arp.next < horizon) {
    const interval = arpInterval();
    fireArp(arp, arp.next + swingOffset(arp.count, interval));
    advanceArp(arp);
    arp.count++;
    arp.next += interval;
  }
  while (bass.next < horizon) {
    const interval = bassInterval();
    fireBass(bass, bass.next + swingOffset(bass.count, interval));
    bass.count++;
    bass.next += interval;
  }
  while (drums.next < horizon) {
    const interval = drumInterval();
    fireDrums(drums, drums.next + swingOffset(drums.count, interval));
    drums.count++;
    drums.next += interval;
  }
  while (field.next < horizon) {
    const interval = drumInterval();
    fireField(field, field.next + swingOffset(field.count, interval));
    field.count++;
    field.next += interval;
  }
  while (seed.next < horizon) {
    const interval = drumInterval();
    fireSeed(seed, seed.next + swingOffset(seed.count, interval));
    seed.count++;
    seed.next += interval;
  }

  timer = setTimeout(tick, TICK_MS);
}

export async function startTransport() {
  if (runtime.playing) return;
  const ctx = ensureAudio();
  await ctx.resume();
  applyAllPedals();
  runtime.playing = true;
  runtime.queue.length = 0;
  const start = ctx.currentTime + 0.1;
  setT0(start);
  runtime.lanes = freshLanes();
  runtime.lanes.arp.next = start;
  runtime.lanes.bass.next = start;
  runtime.lanes.drums.next = start;
  runtime.lanes.field.next = start;
  runtime.lanes.seed.next = start;
  resetGlide();
  onTransportStart(start);
  tick();
}

export function stopTransport() {
  runtime.playing = false;
  clearTimeout(timer);
  timer = null;
  runtime.queue.length = 0;
  onTransportStop();
}

export function resetOrder() {
  if (!runtime.lanes) return;
  const next = runtime.lanes.arp.next;
  const count = runtime.lanes.arp.count;
  runtime.lanes.arp = freshLanes().arp;
  runtime.lanes.arp.next = next;
  runtime.lanes.arp.count = count;
}
