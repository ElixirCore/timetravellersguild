import { state, runtime, save } from '../state.js';
import { makeKnob } from './widgets.js';
import { toggleRecord, setMasterExportStatusHandler } from '../audio/context.js';
import { startTransport, stopTransport } from '../engine/scheduler.js';

const $ = (id) => document.getElementById(id);

export function buildMasterUnit({ onStop } = {}) {
  let tempoKnob = null;
  let statusOverride = null;
  let statusTimer = null;

  tempoKnob = makeKnob($('tempo-knob'), {
    label: 'TEMPO',
    min: 40,
    max: 240,
    reset: 112,
    get: () => state.bpm,
    onSet: (v) => {
      state.bpm = Math.round(v);
      $('lcd-bpm').textContent = state.bpm;
      save();
    },
  });

  const playBtn = $('play');
  const recBtn = $('rec');
  const statusEl = $('master-status');

  function refreshStatus() {
    if (!statusEl) return;
    statusEl.classList.toggle('processing', runtime.recExporting);
    recBtn.classList.toggle('processing', runtime.recExporting);
    recBtn.disabled = runtime.recExporting;

    if (statusOverride) {
      statusEl.textContent = statusOverride;
      return;
    }
    if (runtime.rec) statusEl.textContent = 'REC';
    else if (runtime.playing) statusEl.textContent = 'PLAY';
    else statusEl.textContent = 'READY';
  }

  setMasterExportStatusHandler((phase, message) => {
    clearTimeout(statusTimer);
    if (phase === 'processing') {
      runtime.recExporting = true;
      statusOverride = message || 'MP3…';
    } else if (phase === 'saved' || phase === 'error') {
      runtime.recExporting = false;
      statusOverride = message || (phase === 'saved' ? 'SAVED' : 'FAIL');
      statusTimer = setTimeout(() => {
        statusOverride = null;
        refreshStatus();
      }, 2500);
    } else {
      statusOverride = null;
    }
    refreshStatus();
  });

  playBtn.addEventListener('click', async () => {
    if (runtime.playing) return;
    await startTransport();
    playBtn.classList.add('lit');
    refreshStatus();
  });

  $('stop').addEventListener('click', () => {
    stopTransport();
    playBtn.classList.remove('lit');
    onStop?.();
    refreshStatus();
  });

  recBtn.addEventListener('click', async () => {
    if (runtime.recExporting) return;
    runtime.rec = await toggleRecord();
    recBtn.classList.toggle('lit', runtime.rec);
    refreshStatus();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.target.matches('select, input, button')) return;
    e.preventDefault();
    (runtime.playing ? $('stop') : playBtn).click();
  });

  $('lcd-bpm').textContent = state.bpm;
  refreshStatus();

  return {
    refreshAll: () => {
      tempoKnob?.render();
      $('lcd-bpm').textContent = state.bpm;
      playBtn.classList.toggle('lit', runtime.playing);
      recBtn.classList.toggle('lit', runtime.rec);
      refreshStatus();
    },
  };
}
