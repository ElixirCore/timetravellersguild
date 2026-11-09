import { state, save, clamp, FIELD_PADS, FIELD_STEPS } from '../state.js';
import { auditionFieldPad, hasFieldPad } from '../audio/field-voice.js';

const PAD_HUES = [12, 36, 72, 120, 168, 210, 258, 300];
const RATE_MIN = 0.25;
const RATE_MAX = 4;
const DRAG_PX = 72;
const TAP_SLOP = 6;

function rateFromDrag(startRate, deltaY) {
  const factor = 2 ** (-deltaY / DRAG_PX);
  return clamp(startRate * factor, RATE_MIN, RATE_MAX);
}

function formatRate(rate) {
  if (Math.abs(rate - 1) < 0.02) return '';
  return `${rate.toFixed(rate >= 2 ? 1 : 2)}×`;
}

export function buildFieldGrid(container) {
  container.innerHTML = `
    <div class="field-head">
      <span class="field-label-spacer"></span>
      ${Array.from({ length: FIELD_STEPS }, (_, i) => `<span class="field-num">${i + 1}</span>`).join('')}
    </div>
    ${Array.from({ length: FIELD_PADS }, (_, pad) => `
      <div class="field-row" data-pad="${pad}">
        <div class="field-row-labels">
          <button type="button" class="field-pad-label" data-pad="${pad}">P${pad + 1}</button>
          <button type="button" class="field-pad-mute" data-pad="${pad}" title="Mute this row">M</button>
        </div>
        <div class="field-steps">
          ${state.field.steps[pad].map((_, i) => `
            <button type="button" class="field-pad ${hasFieldPad(pad) ? '' : 'empty'}"
              data-pad="${pad}" data-step="${i}"></button>`).join('')}
        </div>
      </div>`).join('')}`;

  let curStep = -1;

  function refreshCell(pad, i) {
    const cell = container.querySelector(`.field-pad[data-pad="${pad}"][data-step="${i}"]`);
    if (!cell) return;
    const step = state.field.steps[pad][i];
    const on = step?.on;
    const rate = step?.rate ?? 1;
    cell.classList.toggle('on', !!on);
    cell.classList.toggle('dormant', i >= state.field.length);
    cell.classList.toggle('empty', !hasFieldPad(pad));
    cell.classList.toggle('speed-alt', Math.abs(rate - 1) > 0.02);
    cell.style.setProperty('--hue', PAD_HUES[pad]);
    cell.style.setProperty('--speed', String(clamp(rate, RATE_MIN, RATE_MAX)));
    cell.dataset.rate = formatRate(rate);
    cell.title = hasFieldPad(pad)
      ? `Step ${i + 1}${on ? ' · on' : ''}${formatRate(rate) ? ` · ${formatRate(rate)}` : ''} · drag ↕ speed`
      : '';
  }

  function refreshAll() {
    for (let pad = 0; pad < FIELD_PADS; pad++) {
      for (let i = 0; i < FIELD_STEPS; i++) refreshCell(pad, i);
      const label = container.querySelector(`.field-pad-label[data-pad="${pad}"]`);
      label?.classList.toggle('lit', pad === state.field.activePad);
      label?.classList.toggle('has-sample', hasFieldPad(pad));
      const muteBtn = container.querySelector(`.field-pad-mute[data-pad="${pad}"]`);
      muteBtn?.classList.toggle('lit', !!state.field.padMute?.[pad]);
    }
    container.querySelectorAll('.field-row').forEach((row) => {
      const pad = Number(row.dataset.pad);
      row.classList.toggle('active', pad === state.field.activePad);
      row.classList.toggle('muted', !!state.field.padMute?.[pad]);
    });
  }

  function clearPlayhead() {
    container.querySelectorAll('.field-pad.cur').forEach((p) => p.classList.remove('cur'));
    curStep = -1;
  }

  function showPlayhead(ev) {
    clearPlayhead();
    curStep = ev.idx;
    container.querySelectorAll(`.field-pad[data-step="${ev.idx}"]`).forEach((pad) => {
      pad.classList.add('cur');
      const padIdx = Number(pad.dataset.pad);
      if (ev.on && pad.classList.contains('on') && !pad.classList.contains('empty')
        && !state.field.padMute?.[padIdx]) {
        pad.classList.remove('hit');
        void pad.offsetWidth;
        pad.classList.add('hit');
      }
    });
  }

  container.querySelectorAll('.field-pad').forEach((cell) => {
    let drag = null;

    cell.addEventListener('pointerdown', (e) => {
      const pad = Number(cell.dataset.pad);
      const i = Number(cell.dataset.step);
      if (i >= state.field.length || !hasFieldPad(pad)) return;
      e.preventDefault();
      cell.setPointerCapture(e.pointerId);
      drag = {
        pad,
        i,
        y0: e.clientY,
        rate0: state.field.steps[pad][i].rate ?? 1,
        moved: false,
      };
      cell.classList.add('dragging');
    });

    cell.addEventListener('pointermove', (e) => {
      if (!drag || drag.pad !== Number(cell.dataset.pad) || drag.i !== Number(cell.dataset.step)) return;
      const dy = e.clientY - drag.y0;
      if (!drag.moved && Math.abs(dy) < TAP_SLOP) return;
      drag.moved = true;
      const rate = rateFromDrag(drag.rate0, dy);
      state.field.steps[drag.pad][drag.i].rate = rate;
      refreshCell(drag.pad, drag.i);
    });

    cell.addEventListener('pointerup', () => {
      if (!drag) return;
      const { pad, i, moved } = drag;
      cell.classList.remove('dragging');
      drag = null;

      if (!moved) {
        state.field.steps[pad][i].on = !state.field.steps[pad][i].on;
        refreshCell(pad, i);
        if (state.field.steps[pad][i].on) {
          auditionFieldPad(pad, state.field.steps[pad][i].rate ?? 1);
        }
      } else {
        refreshCell(pad, i);
        if (state.field.steps[pad][i].on) {
          auditionFieldPad(pad, state.field.steps[pad][i].rate ?? 1);
        }
      }
      save();
    });

    cell.addEventListener('pointercancel', () => {
      drag = null;
      cell.classList.remove('dragging');
    });
  });

  container.querySelectorAll('.field-pad-label').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.field.activePad = Number(btn.dataset.pad);
      refreshAll();
      save();
    });
    btn.title = 'Select this row for recording';
  });

  container.querySelectorAll('.field-pad-mute').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pad = Number(btn.dataset.pad);
      if (!Array.isArray(state.field.padMute)) {
        state.field.padMute = Array.from({ length: FIELD_PADS }, () => false);
      }
      state.field.padMute[pad] = !state.field.padMute[pad];
      refreshAll();
      save();
    });
  });

  refreshAll();
  return { refreshAll, showPlayhead, clearPlayhead };
}

export function setFieldLength(len) {
  state.field.length = clamp(len, 1, FIELD_STEPS);
}
