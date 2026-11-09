/* SEEDBED unit: the prompt-to-sound generator planted in the rig.
   Generation goes through the shared /interface2 backend (same daily cap);
   clips plant onto the 4 seed lanes and become sequenced voices. */
import { state, save, SEED_LANES } from '../state.js';
import { makeKnob } from './widgets.js';
import { buildSeedGrid, setSeedLength } from './seed-grid.js';
import { applyStrips } from '../audio/context.js';
import { fetchClips, generateClip, clipUrl } from '../api.js';
import {
  loadSeedLane, clearSeedLane, auditionSeedLane, syncSeedLanesFromState, playSeedLane,
} from '../audio/seed-voice.js';
import { ensureAudio } from '../audio/context.js';

const $ = (id) => document.getElementById(id);

const DURS = { music: [15, 30, 45, 60], sfx: [3, 5, 8, 12] };

export function buildSeedbedUnit() {
  const grid = buildSeedGrid($('seed-grid'));
  const statusEl = $('seed-status');
  const quotaEl = $('seed-quota');
  const promptEl = $('seed-prompt');
  const secSel = $('seed-seconds');
  const goBtn = $('seed-go');
  const listEl = $('seed-cliplist');
  let mode = 'music';

  function say(text, bad) {
    statusEl.textContent = text || 'READY';
    statusEl.classList.toggle('bad', !!bad);
  }

  makeKnob($('seed-level'), {
    label: 'LEVEL',
    reset: 80,
    get: () => state.seed.level,
    onSet: (v) => {
      state.seed.level = v;
      applyStrips();
      save();
    },
  });

  const power = $('seed-power');
  const muteBtn = $('seed-mute');
  const refreshPower = () => power.classList.toggle('lit', state.seed.on);
  const refreshMute = () => muteBtn.classList.toggle('lit', state.seed.mute);
  power.addEventListener('click', () => {
    state.seed.on = !state.seed.on;
    applyStrips();
    refreshPower();
    save();
  });
  muteBtn.addEventListener('click', () => {
    state.seed.mute = !state.seed.mute;
    applyStrips();
    refreshMute();
    save();
  });
  refreshPower();
  refreshMute();

  /* --- generator --- */
  function fillDurs() {
    secSel.innerHTML = '';
    DURS[mode].forEach((s) => {
      const o = document.createElement('option');
      o.value = s;
      o.textContent = `${s}s`;
      secSel.appendChild(o);
    });
  }
  fillDurs();

  $('seed-mode-music').addEventListener('click', () => {
    mode = 'music';
    $('seed-mode-music').classList.add('lit');
    $('seed-mode-sfx').classList.remove('lit');
    fillDurs();
  });
  $('seed-mode-sfx').addEventListener('click', () => {
    mode = 'sfx';
    $('seed-mode-sfx').classList.add('lit');
    $('seed-mode-music').classList.remove('lit');
    fillDurs();
  });

  goBtn.addEventListener('click', async () => {
    const prompt = promptEl.value.trim();
    if (!prompt) { say('GIVE IT WORDS FIRST', true); return; }
    goBtn.disabled = true;
    say(`GROWING ${secSel.value}S OF ${mode.toUpperCase()}\u2026`);
    try {
      const j = await generateClip({ mode, prompt, seconds: Number(secSel.value) });
      if (!j.ok) {
        say(j.error || 'FAILED', true);
      } else {
        say(`GROWN \u00b7 ${j.left_today} LEFT TODAY`);
        promptEl.value = '';
        await loadLibrary();
        await plantClip(j.id, prompt);
      }
    } catch (e) {
      say('NETWORK ERROR', true);
    }
    goBtn.disabled = false;
  });

  /* --- library --- */
  async function loadLibrary() {
    try {
      const j = await fetchClips();
      quotaEl.textContent = `${j.used_today} OF ${j.cap} GROWN TODAY`;
      listEl.innerHTML = '';
      (j.clips || []).forEach((c) => {
        const li = document.createElement('li');
        li.className = 'seed-clip';
        const plant = document.createElement('button');
        plant.type = 'button';
        plant.className = 'seed-clip-plant';
        plant.textContent = `${c.mode === 'music' ? '\u266a' : '\u2738'} ${c.prompt}`;
        plant.title = `plant on lane S${state.seed.activeLane + 1}`;
        plant.addEventListener('click', () => plantClip(c.id, c.prompt));
        const listen = document.createElement('button');
        listen.type = 'button';
        listen.className = 'seed-clip-play';
        listen.textContent = '\u25b6';
        listen.title = 'audition';
        listen.addEventListener('click', async (e) => {
          e.stopPropagation();
          await auditionClip(c.id, c.prompt);
        });
        const dl = document.createElement('a');
        dl.href = clipUrl(c.id, true);
        dl.textContent = '\u2193';
        dl.className = 'seed-clip-dl';
        dl.title = 'download mp3';
        li.appendChild(plant);
        li.appendChild(listen);
        li.appendChild(dl);
        listEl.appendChild(li);
      });
    } catch (e) {
      quotaEl.textContent = 'LIBRARY UNREACHABLE';
    }
  }

  /* Audition a clip without planting: an overflow lane that is never sequenced. */
  async function auditionClip(id, label) {
    say('HEARING\u2026');
    try {
      await loadSeedLane(SEED_LANES, id, label);
      const ctx = ensureAudio();
      await ctx.resume();
      playSeedLane(SEED_LANES, ctx.currentTime + 0.01, 0.75, 1);
      say('READY');
    } catch (e) {
      say('COULD NOT LOAD CLIP', true);
    }
  }

  async function plantClip(id, label) {
    const lane = state.seed.activeLane;
    say(`PLANTING ON S${lane + 1}\u2026`);
    state.seed.lanes[lane] = id;
    state.seed.laneLabels[lane] = label;
    save();
    grid.refreshAll();
    try {
      await loadSeedLane(lane, id, label);
      say(`PLANTED ON S${lane + 1}`);
      auditionSeedLane(lane, 1);
    } catch (e) {
      state.seed.lanes[lane] = null;
      state.seed.laneLabels[lane] = '';
      save();
      say('COULD NOT LOAD CLIP', true);
    }
    grid.refreshAll();
  }

  $('seed-eject').addEventListener('click', () => {
    const lane = state.seed.activeLane;
    clearSeedLane(lane);
    state.seed.lanes[lane] = null;
    state.seed.laneLabels[lane] = '';
    for (let i = 0; i < state.seed.steps[lane].length; i++) {
      state.seed.steps[lane][i].on = false;
      state.seed.steps[lane][i].rate = 1;
    }
    grid.refreshAll();
    say(`S${lane + 1} CLEARED`);
    save();
  });

  $('seed-len-minus').addEventListener('click', () => {
    setSeedLength(state.seed.length - 1);
    $('seed-steps-led').textContent = String(state.seed.length).padStart(2, '0');
    grid.refreshAll();
    save();
  });
  $('seed-len-plus').addEventListener('click', () => {
    setSeedLength(state.seed.length + 1);
    $('seed-steps-led').textContent = String(state.seed.length).padStart(2, '0');
    grid.refreshAll();
    save();
  });
  $('seed-steps-led').textContent = String(state.seed.length).padStart(2, '0');

  loadLibrary();

  return {
    grid,
    refreshAll: () => {
      grid.refreshAll();
      $('seed-steps-led').textContent = String(state.seed.length).padStart(2, '0');
      refreshPower();
      refreshMute();
    },
    syncLanes: async () => {
      await syncSeedLanesFromState();
      grid.refreshAll();
    },
  };
}
