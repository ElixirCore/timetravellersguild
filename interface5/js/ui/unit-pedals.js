import { state, save, zone, PEDAL_DEFS, TIME_STEPS } from '../state.js';
import { makeKnob } from './widgets.js';
import { applyPedal } from '../audio/pedals.js';
import { ensureAudio } from '../audio/context.js';

async function syncPedal(id) {
  const audio = ensureAudio();
  if (audio.state === 'suspended') await audio.resume();
  applyPedal(id);
}

export function buildPedalboard() {
  const row = document.getElementById('pedal-row');
  row.innerHTML = '';

  const pedalKnobs = [];
  const pedalRefresh = [];

  for (const def of PEDAL_DEFS) {
    const pedal = document.createElement('div');
    pedal.className = 'pedal';
    pedal.style.setProperty('--accent', def.accent);
    pedal.innerHTML = `
      <div class="pedal-top">
        <span class="jewel"></span>
        <div class="pedal-knobs">
          ${def.params.map((p) => `<div class="knob-unit knob-mini" data-key="${p.key}"></div>`).join('')}
        </div>
      </div>
      <div class="pedal-name">${def.name}</div>
      <button class="stomp" aria-label="${def.name} bypass"><span class="stomp-cap"></span></button>`;
    row.appendChild(pedal);

    const cfg = state.pedals[def.id];
    const knobs = [];

    def.params.forEach((p) => {
      const holder = pedal.querySelector(`.knob-unit[data-key="${p.key}"]`);
      knobs.push(makeKnob(holder, {
        label: p.label,
        reset: 50,
        fmt: p.key === 'time' && def.id === 'delay'
          ? (v) => TIME_STEPS[zone(v, TIME_STEPS.length)]
          : undefined,
        get: () => cfg[p.key],
        onSet: (v) => {
          cfg[p.key] = v;
          syncPedal(def.id);
          save();
        },
      }));
    });
    pedalKnobs.push(...knobs);

    const refresh = () => {
      pedal.classList.toggle('on', cfg.on);
      knobs.forEach((k) => k.render());
    };
    pedalRefresh.push(refresh);

    pedal.querySelector('.stomp').addEventListener('click', () => {
      cfg.on = !cfg.on;
      syncPedal(def.id);
      refresh();
      save();
    });
    refresh();
  }

  return {
    refreshAll: () => {
      pedalRefresh.forEach((fn) => fn());
    },
  };
}
