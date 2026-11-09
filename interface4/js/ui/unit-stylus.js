import { state, save } from '../state.js';
import { makeKnob } from './widgets.js';
import { buildStylusPad } from './stylus-pad.js';
import { applyStrips } from '../audio/context.js';
import { applyStylusFx } from '../audio/stylus-fx.js';
import { stylusNoteLabel, stopStylus, updateStylus } from '../audio/stylus-voice.js';

const $ = (id) => document.getElementById(id);

const VOICE_LABELS = {
  mood: ['RANGE', 'GLIDE', 'BREATH'],
  wub: ['SUB', 'SLIDE', 'RATE'],
};

const FX_LABELS = {
  mood: ['WARM', 'SPACE'],
  wub: ['CHUNK', 'RESO'],
};

export function buildStylusUnit() {
  const noteLcd = $('stylus-note');
  const pad = buildStylusPad($('stylus-pad'), (note, active) => {
    noteLcd.textContent = active ? note : '—';
  });

  const allKnobs = [];
  const voiceKnobs = [];

  allKnobs.push(makeKnob($('stylus-level'), {
    label: 'LEVEL',
    reset: 52,
    get: () => state.stylus.level,
    onSet: (v) => {
      state.stylus.level = v;
      applyStrips();
      save();
    },
  }));

  const voiceDefs = [
    { id: 'stylus-range', key: 'range', reset: 58 },
    { id: 'stylus-glide', key: 'glide', reset: 62 },
    { id: 'stylus-breath', key: 'breath', reset: 38 },
  ];
  for (const def of voiceDefs) {
    const knob = makeKnob($(def.id), {
      label: 'RANGE',
      reset: def.reset,
      get: () => state.stylus[def.key],
      onSet: (v) => {
        state.stylus[def.key] = v;
        save();
      },
    });
    voiceKnobs.push(knob);
    allKnobs.push(knob);
  }

  const warmKnob = makeKnob($('stylus-warm'), {
    label: 'WARM',
    reset: 44,
    get: () => state.stylus.fx.warm,
    onSet: (v) => {
      state.stylus.fx.warm = v;
      applyStylusFx();
      if (state.stylus.mode === 'wub' && state.stylus.y > 0) {
        updateStylus(state.stylus.x, state.stylus.y, true);
      }
      save();
    },
  });
  allKnobs.push(warmKnob);

  const spaceKnob = makeKnob($('stylus-space'), {
    label: 'SPACE',
    reset: 34,
    get: () => (state.stylus.mode === 'wub' ? state.stylus.wub.reso : state.stylus.fx.space),
    onSet: (v) => {
      if (state.stylus.mode === 'wub') {
        state.stylus.wub.reso = v;
        if (state.stylus.y > 0) {
          updateStylus(state.stylus.x, state.stylus.y, true);
        }
      } else {
        state.stylus.fx.space = v;
        applyStylusFx();
      }
      save();
    },
  });
  allKnobs.push(spaceKnob);

  const modeMoodBtn = $('stylus-mode-mood');
  const modeWubBtn = $('stylus-mode-wub');

  function refreshKnobLabels() {
    const mode = state.stylus.mode;
    VOICE_LABELS[mode].forEach((label, i) => voiceKnobs[i]?.setLabel(label));
    warmKnob.setLabel(FX_LABELS[mode][0]);
    spaceKnob.setLabel(FX_LABELS[mode][1]);
    spaceKnob.render();
    warmKnob.render();
    voiceKnobs.forEach((k) => k.render());
  }

  function refreshModeButtons() {
    const wub = state.stylus.mode === 'wub';
    modeMoodBtn.classList.toggle('lit', !wub);
    modeWubBtn.classList.toggle('lit', wub);
  }

  function setMode(mode) {
    if (state.stylus.mode === mode) return;
    state.stylus.mode = mode;
    stopStylus();
    refreshModeButtons();
    refreshKnobLabels();
    pad.setMode(mode);
    pad.refresh();
    noteLcd.textContent = '—';
    save();
  }

  modeMoodBtn.addEventListener('click', () => setMode('mood'));
  modeWubBtn.addEventListener('click', () => setMode('wub'));

  const power = $('stylus-power');
  const muteBtn = $('stylus-mute');
  const refreshPower = () => power.classList.toggle('lit', state.stylus.on);
  const refreshMute = () => muteBtn.classList.toggle('lit', state.stylus.mute);

  power.addEventListener('click', () => {
    state.stylus.on = !state.stylus.on;
    if (!state.stylus.on) stopStylus();
    applyStrips();
    refreshPower();
    pad.refresh();
    save();
  });
  muteBtn.addEventListener('click', () => {
    state.stylus.mute = !state.stylus.mute;
    if (state.stylus.mute) stopStylus();
    applyStrips();
    refreshMute();
    pad.refresh();
    save();
  });
  refreshPower();
  refreshMute();

  $('stylus-warm-toggle').addEventListener('click', () => {
    state.stylus.fx.chorusOn = !state.stylus.fx.chorusOn;
    $('stylus-warm-toggle').classList.toggle('lit', state.stylus.fx.chorusOn);
    applyStylusFx();
    save();
  });
  $('stylus-space-toggle').addEventListener('click', () => {
    state.stylus.fx.reverbOn = !state.stylus.fx.reverbOn;
    $('stylus-space-toggle').classList.toggle('lit', state.stylus.fx.reverbOn);
    applyStylusFx();
    save();
  });
  $('stylus-warm-toggle').classList.toggle('lit', state.stylus.fx.chorusOn);
  $('stylus-space-toggle').classList.toggle('lit', state.stylus.fx.reverbOn);

  refreshModeButtons();
  refreshKnobLabels();
  noteLcd.textContent = stylusNoteLabel();

  return {
    pad,
    refreshAll: () => {
      refreshPower();
      refreshMute();
      refreshModeButtons();
      refreshKnobLabels();
      pad.setMode(state.stylus.mode);
      $('stylus-warm-toggle').classList.toggle('lit', state.stylus.fx.chorusOn);
      $('stylus-space-toggle').classList.toggle('lit', state.stylus.fx.reverbOn);
      allKnobs.forEach((k) => k.render());
      pad.refresh();
    },
  };
}
