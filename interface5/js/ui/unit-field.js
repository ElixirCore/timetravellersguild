import { state, save } from '../state.js';
import { makeKnob } from './widgets.js';
import { buildFieldGrid, setFieldLength } from './field-grid.js';
import { applyStrips } from '../audio/context.js';
import {
  armFieldListen, cancelFieldListen, fieldCaptureMode, peekInputLevel,
  setFieldCaptureCallbacks, setFieldAuto,
} from '../audio/field-capture.js';
import {
  auditionFieldPad, getFieldPadBuffer, hasFieldPad, removeFieldPad,
} from '../audio/field-voice.js';
import { wireFieldWaveformTrim } from './field-wave.js';

const $ = (id) => document.getElementById(id);

export function buildFieldUnit() {
  const grid = buildFieldGrid($('field-grid'));
  const wave = $('field-wave');
  const statusEl = $('field-status');
  const meterEl = $('field-meter-fill');
  const armBtn = $('field-arm');
  const autoBtn = $('field-auto');
  setFieldAuto(state.field.auto);
  const refreshAuto = () => autoBtn.classList.toggle('lit', !!state.field.auto);
  refreshAuto();
  autoBtn.addEventListener('click', () => {
    state.field.auto = !state.field.auto;
    setFieldAuto(state.field.auto);
    refreshAuto();
    save();
  });

  makeKnob($('field-level'), {
    label: 'LEVEL',
    reset: 78,
    get: () => state.field.level,
    onSet: (v) => {
      state.field.level = v;
      applyStrips();
      save();
    },
  });

  makeKnob($('field-threshold'), {
    label: 'GATE',
    reset: 35,
    get: () => state.field.threshold,
    onSet: (v) => {
      state.field.threshold = v;
      save();
    },
  });

  const power = $('field-power');
  const muteBtn = $('field-mute');
  const refreshPower = () => power.classList.toggle('lit', state.field.on);
  const refreshMute = () => muteBtn.classList.toggle('lit', state.field.mute);

  power.addEventListener('click', () => {
    state.field.on = !state.field.on;
    applyStrips();
    refreshPower();
    save();
  });
  muteBtn.addEventListener('click', () => {
    state.field.mute = !state.field.mute;
    applyStrips();
    refreshMute();
    save();
  });
  refreshPower();
  refreshMute();

  const waveWave = wireFieldWaveformTrim(wave, {
    getPadIndex: () => state.field.activePad,
    getBuffer: () => getFieldPadBuffer(state.field.activePad),
    onTrimmed: () => {
      statusEl.textContent = 'TRIMMED';
      save();
    },
  });

  function refreshWave() {
    wave.classList.toggle('has-sample', hasFieldPad(state.field.activePad));
    waveWave.redraw();
  }

  function refreshArm() {
    const mode = fieldCaptureMode();
    armBtn.classList.toggle('lit', mode === 'listening' || mode === 'recording');
    armBtn.textContent = mode === 'idle' ? 'REC' : 'STOP';
  }

  setFieldCaptureCallbacks(
    (text) => {
      statusEl.textContent = text;
      refreshArm();
    },
    (pad) => {
      grid.refreshAll();
      if (pad === state.field.activePad) refreshWave();
    },
  );

  armBtn.addEventListener('click', async () => {
    const mode = fieldCaptureMode();
    if (mode !== 'idle') {
      cancelFieldListen();
      refreshArm();
      return;
    }
    statusEl.textContent = 'MIC…';
    const ok = await armFieldListen(state.field.activePad);
    if (!ok) statusEl.textContent = 'NO MIC';
    refreshArm();
    refreshAuto();
    grid.refreshAll();
  });

  $('field-clear').addEventListener('click', async () => {
    cancelFieldListen();
    await removeFieldPad(state.field.activePad);
    for (let i = 0; i < state.field.steps[state.field.activePad].length; i++) {
      state.field.steps[state.field.activePad][i].on = false;
      state.field.steps[state.field.activePad][i].rate = 1;
    }
    grid.refreshAll();
    refreshWave();
    statusEl.textContent = 'CLEARED';
    refreshArm();
    save();
  });

  $('field-audition').addEventListener('click', () => {
    if (hasFieldPad(state.field.activePad)) auditionFieldPad(state.field.activePad);
  });

  $('field-len-minus').addEventListener('click', () => {
    setFieldLength(state.field.length - 1);
    $('field-steps-led').textContent = String(state.field.length).padStart(2, '0');
    grid.refreshAll();
    save();
  });
  $('field-len-plus').addEventListener('click', () => {
    setFieldLength(state.field.length + 1);
    $('field-steps-led').textContent = String(state.field.length).padStart(2, '0');
    grid.refreshAll();
    save();
  });
  $('field-steps-led').textContent = String(state.field.length).padStart(2, '0');

  setInterval(() => {
    const lvl = peekInputLevel();
    const gate = 0.006 + (state.field.threshold / 100) * 0.09;
    const pct = Math.min(100, (lvl / gate) * 45);
    meterEl.style.width = `${pct}%`;
    meterEl.classList.toggle('hot', lvl >= gate);
  }, 50);

  refreshWave();

  return {
    grid,
    refreshAll: () => {
      grid.refreshAll();
      $('field-steps-led').textContent = String(state.field.length).padStart(2, '0');
      refreshPower();
      refreshMute();
      refreshWave();
      refreshArm();
      refreshAuto();
    },
  };
}
