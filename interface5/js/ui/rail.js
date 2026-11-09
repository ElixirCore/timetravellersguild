import { runtime, clamp, MIN_GATE, MAX_GATE } from '../state.js';

// Parametrised tine rail. cfg:
//   steps: array ref, getLength(), maxDegree, labelFor(degree),
//   audition(degree), onChange(), hueBase (brass default), size class handled by CSS.
export function buildTineRail(container, cfg) {
  const slots = [];
  container.innerHTML = '';

  cfg.steps.forEach((_, i) => {
    const slot = document.createElement('div');
    slot.className = 'tine-slot';
    slot.innerHTML = `
      <div class="tine"><span class="tine-note"></span></div>
      <span class="tine-led"></span>`;
    container.appendChild(slot);
    slots.push(slot);
    wireTine(slot, i);
  });

  function updateTine(i) {
    const step = cfg.steps[i];
    const slot = slots[i];
    const tine = slot.querySelector('.tine');
    const heightPct = 16 + ((step.gate - MIN_GATE) / (MAX_GATE - MIN_GATE)) * 80;
    tine.style.setProperty('--h', `${heightPct}%`);
    tine.style.setProperty('--hue', String((cfg.hueBase ?? 46) - step.degree * 1.9));
    tine.querySelector('.tine-note').textContent = cfg.labelFor(step.degree);
    tine.classList.toggle('off', !step.on);
    slot.classList.toggle('dormant', i >= cfg.getLength());
  }

  function update() {
    for (let i = 0; i < cfg.steps.length; i++) updateTine(i);
  }

  let currentSlot = -1;

  function clearPlayhead() {
    if (currentSlot >= 0) slots[currentSlot]?.classList.remove('cur');
    currentSlot = -1;
  }

  function showPlayhead(ev) {
    clearPlayhead();
    const slot = slots[ev.idx];
    if (!slot) return;
    slot.classList.add('cur');
    currentSlot = ev.idx;
    if (ev.on) {
      const tine = slot.querySelector('.tine');
      tine.classList.remove('pluck');
      void tine.offsetWidth;
      tine.classList.add('pluck');
    }
  }

  function wireTine(slot, i) {
    const tine = slot.querySelector('.tine');
    let drag = null;

    tine.addEventListener('pointerdown', (e) => {
      if (i >= cfg.getLength()) return;
      e.preventDefault();
      tine.setPointerCapture(e.pointerId);
      const step = cfg.steps[i];
      drag = { x: e.clientX, y: e.clientY, degree: step.degree, gate: step.gate, moved: false };
      slot.classList.add('editing');
    });

    tine.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (e.buttons === 0) { end(e); return; }
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) drag.moved = true;
      if (!drag.moved) return;

      const step = cfg.steps[i];
      const degree = clamp(drag.degree + Math.round(dx / 22), 0, cfg.maxDegree);
      const gate = clamp(Math.round(drag.gate - dy * 0.8), MIN_GATE, MAX_GATE);
      const retuned = degree !== step.degree;
      if (retuned || gate !== step.gate) {
        step.degree = degree;
        step.gate = gate;
        updateTine(i);
        runtime.dragInfo = `${cfg.labelFor(degree)} ${gate}%`;
        if (retuned && step.on) cfg.audition(degree);
      }
    });

    const end = (e) => {
      if (!drag) return;
      const step = cfg.steps[i];
      if (!drag.moved && e.type === 'pointerup') {
        step.on = !step.on;
        if (step.on) cfg.audition(step.degree);
        updateTine(i);
      }
      drag = null;
      runtime.dragInfo = null;
      slot.classList.remove('editing');
      cfg.onChange();
    };
    tine.addEventListener('pointerup', end);
    tine.addEventListener('pointercancel', end);
    tine.addEventListener('lostpointercapture', end);
  }

  update();
  return { update, showPlayhead, clearPlayhead };
}
