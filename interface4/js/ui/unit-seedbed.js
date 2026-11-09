/* SEEDBED unit: the prompt-to-sound generator planted in the rig.
   Generation goes through the shared /interface2 backend (same daily cap);
   clips plant onto the 4 seed lanes and become sequenced voices. */
import { state, save, SEED_LANES } from '../state.js';
import { makeKnob } from './widgets.js';
import { buildSeedGrid, setSeedLength } from './seed-grid.js';
import { loopFit } from '../audio/seed-voice.js';
import { applyStrips } from '../audio/context.js';
import { fetchClips, generateClip, clipUrl } from '../api.js';
import {
  loadSeedLane, clearSeedLane, auditionSeedLane, syncSeedLanesFromState, playSeedLane, hasSeedLane,
} from '../audio/seed-voice.js';
import { ensureAudio } from '../audio/context.js';

const $ = (id) => document.getElementById(id);

const DURS = { music: [15, 30, 45, 60], sfx: [3, 5, 8, 12] };

/* Appended to music prompts so clips come back as usable loops. It is
   stripped again wherever a clip name is shown. */
const LOOP_TAIL = '. Seamless loop: steady tempo and groove, no intro, no outro, no fade-out, no silence at the start or end, the last bar leads straight back into the first.';
const stripTail = (p) => String(p || '').replace(/\. Seamless loop:.*$/s, '');

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
    const typed = promptEl.value.trim();
    const prompt = (mode === 'music' && state.seed.loopGen) ? typed.slice(0, 320) + LOOP_TAIL : typed;
    if (!typed) { say('GIVE IT WORDS FIRST', true); return; }
    goBtn.disabled = true;
    say(`GROWING ${secSel.value}S OF ${mode.toUpperCase()}\u2026`);
    try {
      const j = await generateClip({ mode, prompt, seconds: Number(secSel.value) });
      if (!j.ok) {
        say(j.error || 'FAILED', true);
      } else {
        say(`GROWN \u00b7 ${j.left_today} LEFT TODAY`);
        promptEl.value = '';
        await loadLibrary(j.id);
        await plantClip(j.id, prompt, { fresh: true });
      }
    } catch (e) {
      say('NETWORK ERROR', true);
    }
    goBtn.disabled = false;
  });

  /* --- library --- */
  async function loadLibrary(freshId) {
    try {
      const j = await fetchClips();
      quotaEl.textContent = `${j.used_today} OF ${j.cap} GROWN TODAY`;
      listEl.innerHTML = '';
      [...(j.clips || [])].sort((a, b) => (b.ts || 0) - (a.ts || 0)).forEach((c) => {
        const li = document.createElement('li');
        li.className = `seed-clip${c.id === freshId ? ' fresh' : ''}`;
        const plant = document.createElement('button');
        plant.type = 'button';
        plant.className = 'seed-clip-plant';
        plant.textContent = `${c.mode === 'music' ? '\u266a' : '\u2738'} ${stripTail(c.prompt)}`;
        plant.title = `plant on lane S${state.seed.activeLane + 1}`;
        plant.addEventListener('click', () => plantClip(c.id, stripTail(c.prompt)));
        const listen = document.createElement('button');
        listen.type = 'button';
        listen.className = 'seed-clip-play';
        listen.textContent = '\u25b6';
        listen.title = 'audition';
        listen.addEventListener('click', async (e) => {
          e.stopPropagation();
          await auditionClip(c.id, stripTail(c.prompt));
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
      listEl.parentElement.scrollTop = 0; // newest clip always sits at the top
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

  async function plantClip(id, label, { fresh = false } = {}) {
    const lane = state.seed.activeLane;
    say(`PLANTING ON S${lane + 1}\u2026`);
    state.seed.lanes[lane] = id;
    state.seed.laneLabels[lane] = stripTail(label);
    save();
    grid.refreshAll();
    try {
      await loadSeedLane(lane, id, label);
      const isLoopClip = fresh ? (mode === 'music' && state.seed.loopGen) : false;
      if (isLoopClip) {
        setLaneMode(lane, 'loop');
        const f = loopFit(lane);
        say(`LOOP ON S${lane + 1} \u00b7 ${f.bars} BAR${f.bars > 1 ? 'S' : ''}`);
      } else {
        say(`PLANTED ON S${lane + 1}`);
        if (state.seed.laneMode[lane] !== 'loop') auditionSeedLane(lane, 1);
      }
      syncTools();
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
    state.seed.laneMode[lane] = 'shot';
    state.seed.laneRev[lane] = false;
    grid.refreshAll();
    syncTools();
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

  /* --- lane tools --- */
  const modeBtn = $('seed-mode');
  const revBtn = $('seed-rev');
  const snapBtn = $('seed-snap');
  const loopGenBtn = $('seed-loopgen');

  function syncTools() {
    const lane = state.seed.activeLane;
    const loop = state.seed.laneMode[lane] === 'loop';
    modeBtn.textContent = loop ? 'LOOP' : 'SHOT';
    modeBtn.classList.toggle('lit', loop);
    revBtn.classList.toggle('lit', !!state.seed.laneRev[lane]);
    snapBtn.classList.toggle('lit', state.seed.snap);
    loopGenBtn.classList.toggle('lit', state.seed.loopGen);
  }

  function setLaneMode(lane, m) {
    state.seed.laneMode[lane] = m;
    if (m === 'loop') {
      // a loop lane starts fully open; cut steps to gate it
      for (let i = 0; i < state.seed.length; i++) state.seed.steps[lane][i].on = true;
    }
    grid.refreshAll();
    save();
  }

  modeBtn.addEventListener('click', () => {
    const lane = state.seed.activeLane;
    const next = state.seed.laneMode[lane] === 'loop' ? 'shot' : 'loop';
    setLaneMode(lane, next);
    if (next === 'loop' && hasSeedLane(lane)) {
      const f = loopFit(lane);
      say(`S${lane + 1} LOOP \u00b7 ${f.bars} BAR${f.bars > 1 ? 'S' : ''} \u00b7 JOINS AT THE TOP`);
    } else {
      say(`S${lane + 1} ${next === 'loop' ? 'LOOP' : 'SHOT'}`);
    }
    syncTools();
  });
  revBtn.addEventListener('click', () => {
    const lane = state.seed.activeLane;
    state.seed.laneRev[lane] = !state.seed.laneRev[lane];
    syncTools();
    save();
  });
  snapBtn.addEventListener('click', () => {
    state.seed.snap = !state.seed.snap;
    syncTools();
    save();
  });
  loopGenBtn.addEventListener('click', () => {
    state.seed.loopGen = !state.seed.loopGen;
    syncTools();
    save();
  });
  const shift = (dir) => {
    const lane = state.seed.activeLane;
    const len = state.seed.length;
    const row = state.seed.steps[lane];
    const head = row.slice(0, len).map((st) => ({ ...st }));
    for (let i = 0; i < len; i++) row[(i + dir + len) % len] = head[i];
    grid.refreshAll();
    save();
  };
  $('seed-shift-l').addEventListener('click', () => shift(-1));
  $('seed-shift-r').addEventListener('click', () => shift(1));
  $('seed-clear').addEventListener('click', () => {
    const lane = state.seed.activeLane;
    for (let i = 0; i < state.seed.steps[lane].length; i++) {
      state.seed.steps[lane][i] = { on: false, rate: 1, rep: 1 };
    }
    grid.refreshAll();
    save();
  });
  $('seed-dice').addEventListener('click', () => {
    const lane = state.seed.activeLane;
    const loop = state.seed.laneMode[lane] === 'loop';
    const PITCHES = [0, 0, 0, 0, 3, 5, 7, -5, 12, -12]; // consonant leaps only
    for (let i = 0; i < state.seed.length; i++) {
      const strong = i % 4 === 0;
      const on = loop ? Math.random() < 0.8 : Math.random() < (strong ? 0.8 : 0.3);
      const semis = loop || Math.random() < 0.6 ? 0 : PITCHES[Math.floor(Math.random() * PITCHES.length)];
      state.seed.steps[lane][i] = {
        on,
        rate: semis ? 2 ** (semis / 12) : 1,
        rep: !loop && on && !strong && Math.random() < 0.15 ? 2 : 1,
      };
    }
    grid.refreshAll();
    save();
  });
  $('seed-grid').addEventListener('click', (e) => {
    if (e.target.closest('.seed-lane-label')) setTimeout(syncTools, 0);
  });
  syncTools();

  loadLibrary();

  return {
    grid,
    refreshAll: () => {
      grid.refreshAll();
      $('seed-steps-led').textContent = String(state.seed.length).padStart(2, '0');
      refreshPower();
      refreshMute();
      syncTools();
    },
    syncLanes: async () => {
      await syncSeedLanesFromState();
      grid.refreshAll();
    },
  };
}
