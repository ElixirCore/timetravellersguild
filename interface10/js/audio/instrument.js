/* INTERFACE v10 — playing a track like a MIDI instrument. Three ways in, all
   to the chosen track: the on-screen key ring (player.js), the computer
   keyboard (the piano rows: A W S E D F T G Y H U J K …, Z/X for octave),
   and any MIDI keyboard (Web MIDI; omni, every channel plays the chosen
   track). A note is the track's sample (its loop region, or one chop of it)
   at a pitch; middle C is the sample as recorded. */
import { state, save, clamp } from '../state.js';
import { clampNote } from '../pattern.js';
import { ensureAudio } from './engine.js';
import { slots, live, playNote, killVoices } from './tracks.js';

let target = () => 0; // () => chosen track slot
let active = () => false; // is the player showing (so the computer keyboard plays)
let say = () => {};
let onTransport = () => {};
let listener = () => {};
const held = new Map(); // `${slot}:${n}` -> voice
const heldNotes = new Set(); // notes (n) currently down, for the key lights

export function initInstrument(o) {
  target = o.target;
  active = o.active;
  say = o.say || say;
  onTransport = o.transport || onTransport;
}

/* told of every note played (keyboard, MIDI): the ring uses it to record */
export function onNote(fn) { listener = fn; }

export function noteOn(n, vel = 0.8, slot = target()) {
  const t = slots[slot];
  if (!live(t)) return;
  n = clampNote(n);
  ensureAudio();
  const key = `${slot}:${n}`;
  held.get(key)?.release(0);
  const v = playNote(t, { n, vel });
  if (v) held.set(key, v);
  heldNotes.add(n);
  state.play.brush = n;
  listener(n, slot);
  save();
}

export function noteOff(n, slot = target()) {
  n = clampNote(n);
  const key = `${slot}:${n}`;
  const v = held.get(key);
  held.delete(key);
  heldNotes.delete(n);
  /* a one-shot plays out; a held note (loop) is let go */
  if (v && slots[slot]?.seq.hold) v.release(0);
}

export function allNotesOff() {
  for (const v of held.values()) v.release(0);
  held.clear();
  heldNotes.clear();
}

export function isHeld(pc) {
  for (const n of heldNotes) if (((n % 12) + 12) % 12 === pc) return true;
  return false;
}

export function stopAllNotes() {
  allNotesOff();
  slots.forEach((t) => killVoices(t));
}

/* ---- computer keyboard: the piano rows ---- */
const KEYS = 'awsedftgyhujkolp;'.split('');
const down = new Map(); // key -> { n, slot }, so the key lets go of the note it started
document.addEventListener('keydown', (e) => {
  if (!active() || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  const i = KEYS.indexOf(k);
  if (i >= 0) {
    e.preventDefault();
    const n = i + 12 * state.play.oct;
    down.set(k, { n, slot: target() });
    noteOn(n, 0.8);
    return;
  }
  if (k === 'z' || k === 'x') {
    state.play.oct = clamp(state.play.oct + (k === 'x' ? 1 : -1), -2, 2);
    save();
    say(`octave ${state.play.oct > 0 ? '+' : ''}${state.play.oct}`);
  } else if (k === ' ') {
    e.preventDefault();
    onTransport();
  }
});
document.addEventListener('keyup', (e) => {
  const d = down.get(e.key.toLowerCase());
  if (!d) return;
  down.delete(e.key.toLowerCase());
  noteOff(d.n, d.slot);
});
window.addEventListener('blur', () => { down.clear(); allNotesOff(); });

/* ---- MIDI ---- */
let midi = null;
export function midiOn() { return !!midi; }
export function midiNames() {
  return midi ? [...midi.inputs.values()].map((i) => i.name).filter(Boolean) : [];
}

function onMidi(e) {
  const [st, d1, d2] = e.data;
  const cmd = st & 0xf0;
  if (cmd === 0x90 && d2 > 0) noteOn(d1 - 60, d2 / 127);
  else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) noteOff(d1 - 60);
  else if (cmd === 0xb0 && (d1 === 123 || d1 === 120)) allNotesOff();
}

export async function enableMidi() {
  if (midi) return true;
  if (!navigator.requestMIDIAccess) { say('this browser has no midi', true); return false; }
  try {
    midi = await navigator.requestMIDIAccess();
  } catch {
    say('midi was blocked', true);
    return false;
  }
  const hook = () => { for (const inp of midi.inputs.values()) inp.onmidimessage = onMidi; };
  midi.onstatechange = hook;
  hook();
  const names = midiNames();
  say(names.length ? `midi: ${names.join(', ')}` : 'midi on - plug a keyboard in');
  return true;
}
