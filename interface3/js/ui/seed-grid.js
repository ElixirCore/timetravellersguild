/* SEEDBED grid: 4 lanes x 16 steps. Mirrors FIELD TAP semantics -
   click toggles a step, vertical drag bends playback rate. */
import { state, save, clamp, SEED_LANES, SEED_STEPS } from '../state.js';
import { auditionSeedLane, hasSeedLane, getSeedLaneLabel } from '../audio/seed-voice.js';

const LANE_HUES = [96, 130, 64, 160]; // leaf, moss, sun, teal
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
  return `${rate.toFixed(rate >= 2 ? 1 : 2)}\u00d7`;
}

export function buildSeedGrid(container) {
  container.innerHTML = `
    <div class="seed-head">
      <span class="seed-label-spacer"></span>
      ${Array.from({ length: SEED_STEPS }, (_, i) => `<span class="seed-num">${i + 1}</span>`).join('')}
    </div>
    ${Array.from({ length: SEED_LANES }, (_, lane) => `
      <div class="seed-row" data-lane="${lane}">
        <div class="seed-row-labels">
          <button type="button" class="seed-lane-label" data-lane="${lane}">S${lane + 1}</button>
          <button type="button" class="seed-lane-mute" data-lane="${lane}" title="Mute this lane">M</button>
        </div>
        <div class="seed-steps">
          ${Array.from({ length: SEED_STEPS }, (_, i) => `
            <button type="button" class="seed-pad empty" data-lane="${lane}" data-step="${i}"></button>`).join('')}
        </div>
      </div>`).join('')}`;

  let curStep = -1;

  function refreshCell(lane, i) {
    const cell = container.querySelector(`.seed-pad[data-lane="${lane}"][data-step="${i}"]`);
    if (!cell) return;
    const step = state.seed.steps[lane][i];
    const on = step?.on;
    const rate = step?.rate ?? 1;
    cell.classList.toggle('on', !!on);
    cell.classList.toggle('dormant', i >= state.seed.length);
    cell.classList.toggle('empty', !hasSeedLane(lane));
    cell.classList.toggle('speed-alt', Math.abs(rate - 1) > 0.02);
    cell.style.setProperty('--hue', LANE_HUES[lane]);
    cell.style.setProperty('--speed', String(clamp(rate, RATE_MIN, RATE_MAX)));
    cell.dataset.rate = formatRate(rate);
    cell.title = hasSeedLane(lane)
      ? `Step ${i + 1}${on ? ' \u00b7 on' : ''}${formatRate(rate) ? ` \u00b7 ${formatRate(rate)}` : ''} \u00b7 drag \u2195 speed`
      : '';
  }

  function refreshAll() {
    for (let lane = 0; lane < SEED_LANES; lane++) {
      for (let i = 0; i < SEED_STEPS; i++) refreshCell(lane, i);
      const label = container.querySelector(`.seed-lane-label[data-lane="${lane}"]`);
      if (label) {
        const clipName = getSeedLaneLabel(lane) || state.seed.laneLabels[lane] || '';
        label.textContent = clipName ? `S${lane + 1} ${clipName.slice(0, 18)}` : `S${lane + 1}`;
        label.classList.toggle('lit', lane === state.seed.activeLane);
        label.classList.toggle('has-sample', hasSeedLane(lane));
        label.title = clipName ? `${clipName} \u00b7 select lane` : `Lane ${lane + 1} \u00b7 empty \u00b7 select lane`;
      }
      const muteBtn = container.querySelector(`.seed-lane-mute[data-lane="${lane}"]`);
      muteBtn?.classList.toggle('lit', !!state.seed.laneMute?.[lane]);
    }
    container.querySelectorAll('.seed-row').forEach((row) => {
      const lane = Number(row.dataset.lane);
      row.classList.toggle('active', lane === state.seed.activeLane);
      row.classList.toggle('muted', !!state.seed.laneMute?.[lane]);
    });
  }

  function clearPlayhead() {
    container.querySelectorAll('.seed-pad.cur').forEach((p) => p.classList.remove('cur'));
    curStep = -1;
  }

  function showPlayhead(ev) {
    clearPlayhead();
    curStep = ev.idx;
    container.querySelectorAll(`.seed-pad[data-step="${ev.idx}"]`).forEach((pad) => {
      pad.classList.add('cur');
      const lane = Number(pad.dataset.lane);
      if (ev.on && pad.classList.contains('on') && !pad.classList.contains('empty')
        && !state.seed.laneMute?.[lane]) {
        pad.classList.remove('hit');
        void pad.offsetWidth;
        pad.classList.add('hit');
      }
    });
  }

  container.querySelectorAll('.seed-pad').forEach((cell) => {
    let drag = null;

    cell.addEventListener('pointerdown', (e) => {
      const lane = Number(cell.dataset.lane);
      const i = Number(cell.dataset.step);
      if (i >= state.seed.length || !hasSeedLane(lane)) return;
      e.preventDefault();
      cell.setPointerCapture(e.pointerId);
      drag = { lane, i, y0: e.clientY, rate0: state.seed.steps[lane][i].rate ?? 1, moved: false };
      cell.classList.add('dragging');
    });

    cell.addEventListener('pointermove', (e) => {
      if (!drag || drag.lane !== Number(cell.dataset.lane) || drag.i !== Number(cell.dataset.step)) return;
      const dy = e.clientY - drag.y0;
      if (!drag.moved && Math.abs(dy) < TAP_SLOP) return;
      drag.moved = true;
      state.seed.steps[drag.lane][drag.i].rate = rateFromDrag(drag.rate0, dy);
      refreshCell(drag.lane, drag.i);
    });

    cell.addEventListener('pointerup', () => {
      if (!drag) return;
      const { lane, i, moved } = drag;
      cell.classList.remove('dragging');
      drag = null;
      if (!moved) {
        state.seed.steps[lane][i].on = !state.seed.steps[lane][i].on;
        refreshCell(lane, i);
      }
      if (state.seed.steps[lane][i].on) {
        auditionSeedLane(lane, state.seed.steps[lane][i].rate ?? 1);
      }
      save();
    });

    cell.addEventListener('pointercancel', () => {
      drag = null;
      cell.classList.remove('dragging');
    });
  });

  container.querySelectorAll('.seed-lane-label').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.seed.activeLane = Number(btn.dataset.lane);
      refreshAll();
      save();
    });
  });

  container.querySelectorAll('.seed-lane-mute').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lane = Number(btn.dataset.lane);
      state.seed.laneMute[lane] = !state.seed.laneMute[lane];
      refreshAll();
      save();
    });
  });

  refreshAll();
  return { refreshAll, showPlayhead, clearPlayhead };
}

export function setSeedLength(len) {
  state.seed.length = clamp(len, 1, SEED_STEPS);
}
