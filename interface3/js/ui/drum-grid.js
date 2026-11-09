import { state, save, clamp, DRUM_PARTS, DRUM_STEPS } from '../state.js';
import { auditionDrum } from '../audio/drum-voice.js';

const PART_LABEL = { kick: 'KICK', snare: 'SNR', hat: 'HAT' };
const PART_HUE = { kick: 8, snare: 210, hat: 48 };

export function buildDrumGrid(container) {
  container.innerHTML = `
    <div class="drum-head">
      <span class="drum-label-spacer"></span>
      ${Array.from({ length: DRUM_STEPS }, (_, i) => `<span class="drum-num">${i + 1}</span>`).join('')}
    </div>
    ${DRUM_PARTS.map((part) => `
      <div class="drum-row" data-part="${part}">
        <span class="drum-label">${PART_LABEL[part]}</span>
        <div class="drum-steps">
          ${state.drums.steps[part].map((_, i) => `<button type="button" class="drum-pad" data-part="${part}" data-step="${i}"></button>`).join('')}
        </div>
      </div>`).join('')}`;

  const pads = [...container.querySelectorAll('.drum-pad')];
  let curStep = -1;

  function refreshPad(part, i) {
    const pad = container.querySelector(`.drum-pad[data-part="${part}"][data-step="${i}"]`);
    if (!pad) return;
    const on = state.drums.steps[part][i]?.on;
    pad.classList.toggle('on', !!on);
    pad.classList.toggle('dormant', i >= state.drums.length);
    pad.style.setProperty('--hue', PART_HUE[part]);
  }

  function refreshAll() {
    for (const part of DRUM_PARTS) {
      for (let i = 0; i < DRUM_STEPS; i++) refreshPad(part, i);
    }
    container.querySelectorAll('.drum-row').forEach((row) => {
      row.classList.toggle('active', row.dataset.part === state.drums.active);
    });
  }

  function clearPlayhead() {
    container.querySelectorAll('.drum-pad.cur').forEach((p) => p.classList.remove('cur'));
    curStep = -1;
  }

  function showPlayhead(ev) {
    clearPlayhead();
    curStep = ev.idx;
    container.querySelectorAll(`.drum-pad[data-step="${ev.idx}"]`).forEach((pad) => {
      pad.classList.add('cur');
      if (ev.on && pad.classList.contains('on')) {
        pad.classList.remove('hit');
        void pad.offsetWidth;
        pad.classList.add('hit');
      }
    });
  }

  pads.forEach((pad) => {
    pad.addEventListener('click', () => {
      const part = pad.dataset.part;
      const i = Number(pad.dataset.step);
      if (i >= state.drums.length) return;
      state.drums.steps[part][i].on = !state.drums.steps[part][i].on;
      refreshPad(part, i);
      if (state.drums.steps[part][i].on) auditionDrum(part);
      save();
    });
  });

  refreshAll();
  return { refreshAll, showPlayhead, clearPlayhead };
}

export function setDrumLength(len) {
  state.drums.length = clamp(len, 1, DRUM_STEPS);
}
