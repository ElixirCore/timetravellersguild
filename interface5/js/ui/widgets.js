import { clamp } from '../state.js';

export function makeKnob(container, opts) {
  const { label, min = 0, max = 100, fmt = (v) => String(Math.round(v)), onSet } = opts;
  container.innerHTML = `
    <div class="knob-label">${label}</div>
    <div class="knob-cap"><div class="knob-pointer"></div></div>
    <div class="knob-led">--</div>`;
  const cap = container.querySelector('.knob-cap');
  const led = container.querySelector('.knob-led');
  const labelEl = container.querySelector('.knob-label');

  function render() {
    const v = opts.get();
    const angle = -135 + ((v - min) / (max - min)) * 270;
    cap.style.transform = `rotate(${angle}deg)`;
    led.textContent = (opts.fmt || fmt)(v);
  }

  let start = null;
  cap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    cap.setPointerCapture(e.pointerId);
    start = { y: e.clientY, v: opts.get() };
    container.classList.add('grabbing');
  });
  cap.addEventListener('pointermove', (e) => {
    if (!start) return;
    if (e.buttons === 0) { end(); return; }
    const span = max - min;
    const sens = span / (e.shiftKey ? 900 : 180);
    const v = clamp(start.v + (start.y - e.clientY) * sens, min, max);
    if (v !== opts.get()) {
      onSet(v);
      render();
    }
  });
  const end = () => {
    start = null;
    container.classList.remove('grabbing');
  };
  cap.addEventListener('pointerup', end);
  cap.addEventListener('pointercancel', end);
  cap.addEventListener('lostpointercapture', end);
  cap.addEventListener('dblclick', () => {
    if (opts.reset !== undefined) {
      onSet(opts.reset);
      render();
    }
  });

  render();
  return {
    render,
    setLabel(text) { labelEl.textContent = text; },
    el: container,
  };
}
