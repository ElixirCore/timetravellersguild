import {
  state, save, DRUM_PARTS, DRUM_SOUNDS,
} from '../state.js';
import { makeKnob } from './widgets.js';
import { buildDrumGrid, setDrumLength } from './drum-grid.js';
import { applyStrips } from '../audio/context.js';
import { auditionDrum } from '../audio/drum-voice.js';

const $ = (id) => document.getElementById(id);
const PART_LABEL = { kick: 'KICK', snare: 'SNR', hat: 'HAT' };

export function buildDrumUnit() {
  const grid = buildDrumGrid($('drum-grid'));

  makeKnob($('drum-level'), {
    label: 'LEVEL',
    reset: 78,
    get: () => state.drums.level,
    onSet: (v) => {
      state.drums.level = v;
      applyStrips();
      save();
    },
  });

  const power = $('drum-power');
  const muteBtn = $('drum-mute');
  const refreshPower = () => power.classList.toggle('lit', state.drums.on);
  const refreshMute = () => muteBtn.classList.toggle('lit', state.drums.mute);

  power.addEventListener('click', () => {
    state.drums.on = !state.drums.on;
    applyStrips();
    refreshPower();
    save();
  });
  muteBtn.addEventListener('click', () => {
    state.drums.mute = !state.drums.mute;
    applyStrips();
    refreshMute();
    save();
  });
  refreshPower();
  refreshMute();

  const voices = $('drum-voices');
  voices.innerHTML = DRUM_PARTS.map(
    (part) => `<button type="button" class="pbtn pbtn-tiny drum-voice" data-part="${part}">${PART_LABEL[part]}</button>`,
  ).join('');

  const sounds = $('drum-sounds');

  function refreshSounds() {
    const part = state.drums.active;
    const names = DRUM_SOUNDS[part];
    const cur = state.drums.sounds[part];
    sounds.innerHTML = names.map(
      (name, i) => `<button type="button" class="pbtn pbtn-tiny sound-chip ${i === cur ? 'lit' : ''}" data-sound="${i}">${name}</button>`,
    ).join('');
  }

  function refreshVoices() {
    voices.querySelectorAll('.drum-voice').forEach((btn) => {
      btn.classList.toggle('lit', btn.dataset.part === state.drums.active);
    });
    grid.refreshAll();
    refreshSounds();
  }

  voices.addEventListener('click', (e) => {
    const btn = e.target.closest('.drum-voice');
    if (!btn) return;
    state.drums.active = btn.dataset.part;
    refreshVoices();
    save();
  });

  sounds.addEventListener('click', (e) => {
    const btn = e.target.closest('.sound-chip');
    if (!btn) return;
    state.drums.sounds[state.drums.active] = Number(btn.dataset.sound);
    refreshSounds();
    auditionDrum(state.drums.active);
    save();
  });

  $('drum-len-minus').addEventListener('click', () => {
    setDrumLength(state.drums.length - 1);
    $('drum-steps-led').textContent = String(state.drums.length).padStart(2, '0');
    grid.refreshAll();
    save();
  });
  $('drum-len-plus').addEventListener('click', () => {
    setDrumLength(state.drums.length + 1);
    $('drum-steps-led').textContent = String(state.drums.length).padStart(2, '0');
    grid.refreshAll();
    save();
  });
  $('drum-steps-led').textContent = String(state.drums.length).padStart(2, '0');

  refreshVoices();

  return {
    grid,
    refreshAll: () => {
      refreshVoices();
      $('drum-steps-led').textContent = String(state.drums.length).padStart(2, '0');
      refreshPower();
      refreshMute();
    },
  };
}
