import { state, save } from '../state.js';
import { ensureAudio } from '../audio/context.js';
import { updateStylus, stopStylus } from '../audio/stylus-voice.js';

const PAD_AXES = {
  mood: {
    x: ['LOW', 'PITCH', 'HIGH'],
    y: ['LOUD', 'STRENGTH', 'SOFT'],
  },
  wub: {
    x: ['LOW', 'SUB', 'HIGH'],
    y: ['TIGHT', 'WUB', 'WIDE'],
  },
};

export function buildStylusPad(container, onNote) {
  container.innerHTML = `
    <div class="stylus-pad" id="stylus-surface">
      <div class="stylus-axis stylus-axis-x">
        <span data-x="0">LOW</span><span data-x="1">PITCH</span><span data-x="2">HIGH</span>
      </div>
      <div class="stylus-axis stylus-axis-y">
        <span data-y="0">LOUD</span><span data-y="1">STRENGTH</span><span data-y="2">SOFT</span>
      </div>
      <div class="stylus-glow"></div>
      <div class="stylus-cursor"></div>
    </div>`;

  const surface = container.querySelector('#stylus-surface');
  const cursor = container.querySelector('.stylus-cursor');
  const glow = container.querySelector('.stylus-glow');
  const xLabels = [...container.querySelectorAll('.stylus-axis-x span')];
  const yLabels = [...container.querySelectorAll('.stylus-axis-y span')];
  let dragging = false;

  function setPos(x, y, active) {
    state.stylus.x = x;
    state.stylus.y = y;
    cursor.style.left = `${x * 100}%`;
    cursor.style.top = `${(1 - y) * 100}%`;
    glow.style.opacity = active ? String(0.25 + y * 0.55) : '0';
    surface.classList.toggle('active', active);
    const note = updateStylus(x, y, active);
    onNote?.(note, active);
  }

  function posFromEvent(e) {
    const r = surface.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    return { x, y };
  }

  function begin(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    surface.setPointerCapture(e.pointerId);
    ensureAudio().resume();
    const { x, y } = posFromEvent(e);
    setPos(x, y, true);
  }

  function move(e) {
    if (!dragging) return;
    const { x, y } = posFromEvent(e);
    setPos(x, y, true);
  }

  function end() {
    if (!dragging) return;
    dragging = false;
    setPos(state.stylus.x, 0, false);
    stopStylus();
    save();
  }

  surface.addEventListener('pointerdown', begin);
  surface.addEventListener('pointermove', move);
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
  surface.addEventListener('lostpointercapture', end);

  function setMode(mode) {
    const axes = PAD_AXES[mode] || PAD_AXES.mood;
    xLabels.forEach((el, i) => { el.textContent = axes.x[i]; });
    yLabels.forEach((el, i) => { el.textContent = axes.y[i]; });
    surface.classList.toggle('stylus-pad-wub', mode === 'wub');
  }

  setMode(state.stylus.mode);
  setPos(state.stylus.x, 0, false);

  return {
    setMode,
    refresh() {
      setMode(state.stylus.mode);
      setPos(state.stylus.x, dragging ? state.stylus.y : 0, dragging);
    },
  };
}
