import { state, runtime, save } from '../state.js';
import { makeKnob } from './widgets.js';
import { applyStrips, ensureAudio } from '../audio/context.js';
import { pressRec, pressStop, applyLoopFx, resyncLoopFx, resyncLoopOneX } from '../audio/looper.js';
import { startTransport } from '../engine/scheduler.js';

const $ = (id) => document.getElementById(id);

export function buildLooperUnit() {
  makeKnob($('looper-level'), {
    label: 'LEVEL',
    reset: 80,
    get: () => state.looper.level,
    onSet: (v) => {
      state.looper.level = v;
      applyStrips();
      save();
    },
  });

  const speedKnob = makeKnob($('looper-speed'), {
    label: 'SPEED',
    reset: 50,
    fmt: (v) => {
      const t = v / 100;
      return `${(0.25 * (16 ** t)).toFixed(2)}×`;
    },
    get: () => state.looper.speed,
    onSet: (v) => {
      state.looper.speed = v;
      applyLoopFx();
      save();
    },
  });

  $('looper-speed-1x').addEventListener('click', () => {
    resyncLoopOneX();
    speedKnob.render();
    save();
  });

  makeKnob($('looper-glitch'), {
    label: 'GLITCH',
    reset: 0,
    get: () => state.looper.glitch,
    onSet: (v) => {
      state.looper.glitch = v;
      resyncLoopFx();
      save();
    },
  });

  makeKnob($('looper-crush'), {
    label: 'CRUSH',
    reset: 0,
    get: () => state.looper.crush,
    onSet: (v) => {
      state.looper.crush = v;
      applyLoopFx();
      save();
    },
  });

  $('looper-rec').addEventListener('click', async () => {
    ensureAudio();
    if (!runtime.playing) {
      await startTransport();
      $('play').classList.add('lit');
    }
    await pressRec();
  });

  $('looper-stop').addEventListener('click', () => {
    pressStop();
  });

  applyLoopFx();
}
