import {
  state, save, zone, BASS_RATE_STEPS, BASS_MAX_DEGREE,
} from '../state.js';
import { makeKnob } from './widgets.js';
import { buildTineRail } from './rail.js';
import { applyStrips } from '../audio/context.js';
import { auditionBass } from '../audio/bass-voice.js';
import { degreeToMidi, degreeLabel } from '../engine/harmony.js';

const $ = (id) => document.getElementById(id);

const KNOBS = [
  { id: 'bass-rate', label: 'RATE', key: 'rate', fmt: (v) => BASS_RATE_STEPS[zone(v, BASS_RATE_STEPS.length)] },
  { id: 'bass-glide', label: 'GLIDE', key: 'glide' },
  { id: 'bass-tone', label: 'TONE', key: 'tone' },
  { id: 'bass-punch', label: 'PUNCH', key: 'punch' },
  { id: 'bass-level', label: 'LEVEL', key: 'level' },
];

export function buildBassUnit() {
  const rail = buildTineRail($('bass-rail'), {
    steps: state.bass.steps,
    getLength: () => state.bass.length,
    maxDegree: BASS_MAX_DEGREE,
    labelFor: (degree) => degreeLabel(degree, 36),
    audition: (degree) => auditionBass(degreeToMidi(degree, 0, 36)),
    onChange: save,
    hueBase: 20, // copper, a register darker than the arp's brass
  });

  const bassKnobs = [];
  for (const def of KNOBS) {
    bassKnobs.push(makeKnob($(def.id), {
      label: def.label,
      reset: 50,
      fmt: def.fmt,
      get: () => state.bass[def.key],
      onSet: (v) => {
        state.bass[def.key] = v;
        applyStrips();
        save();
      },
    }));
  }

  const power = $('bass-power');
  const refreshPower = () => power.classList.toggle('lit', state.bass.on);
  power.addEventListener('click', () => {
    state.bass.on = !state.bass.on;
    refreshPower();
    save();
  });
  refreshPower();

  return {
    rail,
    refreshRail: () => rail.update(),
    refreshAll: () => {
      rail.update();
      refreshPower();
      bassKnobs.forEach((k) => k.render());
    },
  };
}
