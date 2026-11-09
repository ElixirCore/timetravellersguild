import { state, SCALES, NOTE_NAMES } from '../state.js';

// Degrees index the current scale; default base is C3, bass uses C2.
export function degreeToMidi(degree, octShift = 0, base = 48) {
  const scale = SCALES[state.scale];
  const d = ((degree % scale.length) + scale.length) % scale.length;
  const oct = Math.floor(degree / scale.length) + octShift;
  return base + state.root + oct * 12 + scale[d];
}

export function midiToName(midi) {
  const n = ((midi % 12) + 12) % 12;
  return `${NOTE_NAMES[n]}${Math.floor(midi / 12) - 1}`;
}

export function degreeLabel(degree, base = 48) {
  return midiToName(degreeToMidi(degree, 0, base));
}
