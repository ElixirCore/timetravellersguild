/* SEEDBED grid: 4 lanes x 16 steps. Mirrors FIELD TAP semantics -
   click toggles a step, vertical drag bends playback rate. */
import { state, save, clamp, SEED_LANES, SEED_STEPS } from '../state.js';
import { auditionSeedLane, hasSeedLane, getSeedLaneLabel } from '../audio/seed-voice.js';

const LANE_HUES = [96, 130, 64, 160]; // leaf, moss, sun, teal
const RATE_MIN = 0.25;
const RATE_MAX = 4;
const PX_PER_SEMI = 11; // vertical drag: one semitone per 11px
const TAP_SLOP = 7;
const HOLD_MS = 450; // long-press cycles the ratchet 1-2-3-4

function semisFromRate(rate) {
  return 12 * Math.log2(rate);
}

function rateFromSemis(semis) {
  return clamp(2 ** (semis / 12), RATE_MIN, RATE_MAX);
}

function formatStep(step) {
  const semis = Math.round(semisFromRate(step?.rate ?? 1));
  const bits = [];
  if (semis !== 0) bits.push(semis > 0 ? `+${semis}` : `${semis}`);
  if ((step?.rep ?? 1) > 1) bits.push(`\u00d7${step.rep}`);
  return bits.join(' ');
}

function buzz(ms = 6) {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
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
    cell.classList.toggle('speed-alt', Math.abs(rate - 1) > 0.02 || (step?.rep ?? 1) > 1);
    cell.classList.toggle('loopy', state.seed.laneMode?.[lane] === 'loop');
    cell.style.setProperty('--hue', LANE_HUES[lane]);
    cell.style.setProperty('--speed', String(clamp(rate, RATE_MIN, RATE_MAX)));
    cell.dataset.rate = state.seed.laneMode?.[lane] === 'loop' ? '' : formatStep(step);
    cell.title = hasSeedLane(lane)
      ? `Step ${i + 1}${on ? ' \u00b7 on' : ''} \u00b7 tap on/off \u00b7 drag \u2195 pitch \u00b7 drag \u2194 paint \u00b7 hold ratchet`
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

  function padAt(x, y, lane) {
    const el = document.elementFromPoint(x, y);
    const pad = el?.closest?.('.seed-pad');
    return pad && Number(pad.dataset.lane) === lane ? pad : null;
  }

  container.querySelectorAll('.seed-pad').forEach((cell) => {
    let drag = null;

    cell.addEventListener('pointerdown', (e) => {
      const lane = Number(cell.dataset.lane);
      const i = Number(cell.dataset.step);
      if (i >= state.seed.length || !hasSeedLane(lane)) return;
      e.preventDefault();
      cell.setPointerCapture(e.pointerId);
      const st = state.seed.steps[lane][i];
      drag = {
        lane, i, x0: e.clientX, y0: e.clientY, semi0: semisFromRate(st.rate ?? 1),
        axis: null, held: false, paintTo: null, last: i, hold: null,
      };
      drag.hold = setTimeout(() => {
        if (!drag || drag.axis) return;
        drag.held = true;
        const s2 = state.seed.steps[lane][i];
        s2.rep = (s2.rep % 4) + 1;
        s2.on = true;
        buzz(12);
        refreshCell(lane, i);
        save();
      }, HOLD_MS);
      cell.classList.add('dragging');
    });

    cell.addEventListener('pointermove', (e) => {
      if (!drag || drag.lane !== Number(cell.dataset.lane)) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (!drag.axis) {
        if (Math.hypot(dx, dy) < TAP_SLOP) return;
        clearTimeout(drag.hold);
        drag.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
        if (drag.axis === 'x') {
          // paint: the first pad's new state is applied to every pad crossed
          const st = state.seed.steps[drag.lane][drag.i];
          st.on = !st.on;
          drag.paintTo = st.on;
          refreshCell(drag.lane, drag.i);
        }
      }
      if (drag.axis === 'y') {
        if (state.seed.laneMode?.[drag.lane] === 'loop') return;
        let semis = drag.semi0 - dy / PX_PER_SEMI;
        if (state.seed.snap) semis = Math.round(semis);
        semis = clamp(semis, -24, 24);
        const st = state.seed.steps[drag.lane][drag.i];
        const before = Math.round(semisFromRate(st.rate ?? 1));
        st.rate = Math.abs(semis) < 0.01 ? 1 : rateFromSemis(semis);
        if (Math.round(semis) !== before && state.seed.snap) buzz(4);
        refreshCell(drag.lane, drag.i);
      } else {
        const pad = padAt(e.clientX, e.clientY, drag.lane);
        if (!pad) return;
        const j = Number(pad.dataset.step);
        if (j === drag.last || j >= state.seed.length) return;
        drag.last = j;
        state.seed.steps[drag.lane][j].on = drag.paintTo;
        refreshCell(drag.lane, j);
        buzz(3);
      }
    });

    cell.addEventListener('pointerup', () => {
      if (!drag) return;
      clearTimeout(drag.hold);
      const { lane, i, axis, held } = drag;
      cell.classList.remove('dragging');
      drag = null;
      if (!axis && !held) {
        state.seed.steps[lane][i].on = !state.seed.steps[lane][i].on;
        refreshCell(lane, i);
      }
      const st = state.seed.steps[lane][i];
      if (st.on && axis !== 'x' && state.seed.laneMode?.[lane] !== 'loop') {
        auditionSeedLane(lane, st.rate ?? 1);
      }
      save();
    });

    cell.addEventListener('pointercancel', () => {
      if (drag) clearTimeout(drag.hold);
      drag = null;
      cell.classList.remove('dragging');
    });

    // double-tap-free reset: right click / ctrl-click clears pitch and ratchet
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const st = state.seed.steps[Number(cell.dataset.lane)][Number(cell.dataset.step)];
      st.rate = 1;
      st.rep = 1;
      refreshCell(Number(cell.dataset.lane), Number(cell.dataset.step));
      save();
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
