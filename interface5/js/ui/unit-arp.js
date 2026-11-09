import {
  state, save, reset, clamp, zone,
  NOTE_NAMES, SCALES, DIRECTIONS, ARP_BANKS,
  RATE_STEPS, SHAPE_NAMES, MAX_DEGREE, MAX_STEPS,
} from '../state.js';
import { makeKnob } from './widgets.js';
import { buildTineRail } from './rail.js';
import { applyStrips } from '../audio/context.js';
import { auditionArp } from '../audio/voices.js';
import { degreeToMidi, degreeLabel } from '../engine/harmony.js';
import { stopTransport, resetOrder } from '../engine/scheduler.js';

const $ = (id) => document.getElementById(id);

function fmtParam(key, value) {
  if (key === 'shape') return SHAPE_NAMES[zone(value, SHAPE_NAMES.length)];
  if (key === 'rate') return RATE_STEPS[zone(value, RATE_STEPS.length)];
  if (key === 'range') return `${1 + zone(value, 4)} OCT`;
  return String(Math.round(value));
}

const macroKnobs = [];
const MODE_ANGLES = [-40, 0, 40];

function buildKnobs() {
  ['knob-a', 'knob-b', 'knob-c'].forEach((id, i) => {
    macroKnobs.push(makeKnob($(id), {
      label: '—',
      reset: 50,
      get: () => {
        const bank = ARP_BANKS[state.arp.mode];
        return state.arp.banks[bank.id][bank.params[i].key];
      },
      fmt: (v) => fmtParam(ARP_BANKS[state.arp.mode].params[i].key, v),
      onSet: (v) => {
        const bank = ARP_BANKS[state.arp.mode];
        state.arp.banks[bank.id][bank.params[i].key] = v;
        applyStrips();
        save();
      },
    }));
  });

  buildModeKnob();
  refreshBank();
}

function buildModeKnob() {
  const list = $('mode-list');
  list.innerHTML = ARP_BANKS.map(
    (b, i) => `<button class="mode-tag" data-mode="${i}"><span class="led led-amber"></span>${b.name}</button>`,
  ).join('');
  list.addEventListener('click', (e) => {
    const tag = e.target.closest('.mode-tag');
    if (tag) setMode(Number(tag.dataset.mode));
  });

  const container = $('mode-knob');
  container.innerHTML = `
    <div class="knob-label">MODE</div>
    <div class="knob-cap mode-cap"><div class="knob-pointer mode-pointer"></div></div>
    <div class="knob-led" id="mode-led">--</div>`;
  const cap = container.querySelector('.knob-cap');

  let start = null;
  let moved = false;
  cap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    cap.setPointerCapture(e.pointerId);
    start = { y: e.clientY, mode: state.arp.mode };
    moved = false;
  });
  cap.addEventListener('pointermove', (e) => {
    if (!start) return;
    if (e.buttons === 0) { start = null; return; }
    const detents = Math.round((start.y - e.clientY) / 36);
    if (detents !== 0) moved = true;
    const m = clamp(start.mode + detents, 0, ARP_BANKS.length - 1);
    if (m !== state.arp.mode) setMode(m);
  });
  cap.addEventListener('pointerup', () => {
    if (start && !moved) setMode((state.arp.mode + 1) % ARP_BANKS.length);
    start = null;
  });
  cap.addEventListener('pointercancel', () => { start = null; });
  cap.addEventListener('lostpointercapture', () => { start = null; });
}

function setMode(m) {
  state.arp.mode = m;
  save();
  refreshBank();
}

function refreshBank() {
  const bank = ARP_BANKS[state.arp.mode];
  const cap = document.querySelector('#mode-knob .knob-cap');
  if (cap) cap.style.transform = `rotate(${MODE_ANGLES[state.arp.mode]}deg)`;
  $('mode-led').textContent = bank.name;
  $('lcd-mode').textContent = bank.name;
  document.querySelectorAll('.mode-tag').forEach((tag, i) => {
    tag.classList.toggle('lit', i === state.arp.mode);
  });
  macroKnobs.forEach((knob, i) => {
    knob.setLabel(bank.params[i].label);
    knob.render();
  });
}

function wireMute() {
  const muteBtn = $('arp-mute');
  const refreshMute = () => muteBtn.classList.toggle('lit', state.arp.mute);
  muteBtn.addEventListener('click', () => {
    state.arp.mute = !state.arp.mute;
    applyStrips();
    refreshMute();
    save();
  });
  refreshMute();
}

function wireLower(rail) {
  const dir = $('dir');
  dir.innerHTML = DIRECTIONS.map(
    (d) => `<button class="pbtn pbtn-tiny dir-btn" data-dir="${d}">${d}</button>`,
  ).join('');
  dir.addEventListener('click', (e) => {
    const btn = e.target.closest('.dir-btn');
    if (!btn) return;
    state.arp.direction = btn.dataset.dir;
    resetOrder();
    refreshDir();
    save();
  });

  $('len-minus').addEventListener('click', () => setLength(rail, state.arp.length - 1));
  $('len-plus').addEventListener('click', () => setLength(rail, state.arp.length + 1));

  const key = $('key');
  key.innerHTML = NOTE_NAMES.map((n, i) => `<option value="${i}">${n}</option>`).join('');
  key.value = String(state.root);
  key.addEventListener('change', () => {
    state.root = Number(key.value);
    harmonyChanged();
  });

  const scale = $('scale');
  scale.innerHTML = Object.keys(SCALES).map((s) => `<option value="${s}">${s}</option>`).join('');
  scale.value = state.scale;
  scale.addEventListener('change', () => {
    state.scale = scale.value;
    harmonyChanged();
  });

  $('init').addEventListener('click', () => {
    if (!window.confirm('Reset the whole rig — pattern, bass, pedals, knobs — to factory state?')) return;
    stopTransport();
    reset();
    window.location.reload();
  });

  refreshDir();
  refreshLength();
}

let onHarmonyChange = () => {};
let railRef = null;

function setLength(rail, len) {
  state.arp.length = clamp(len, 1, MAX_STEPS);
  refreshLength();
  rail.update();
  save();
}

function harmonyChanged() {
  refreshLcdKey();
  railRef?.update();
  onHarmonyChange();
  save();
}

function refreshDir() {
  document.querySelectorAll('.dir-btn').forEach((btn) => {
    btn.classList.toggle('lit', btn.dataset.dir === state.arp.direction);
  });
}

function refreshLength() {
  $('steps-led').textContent = String(state.arp.length).padStart(2, '0');
}

function refreshLcdKey() {
  $('lcd-key').textContent = `${NOTE_NAMES[state.root]} ${state.scale}`;
}

export function buildArpUnit(hooks = {}) {
  onHarmonyChange = hooks.onHarmonyChange ?? (() => {});

  const rail = buildTineRail($('rail'), {
    steps: state.arp.steps,
    getLength: () => state.arp.length,
    maxDegree: MAX_DEGREE,
    labelFor: (degree) => degreeLabel(degree),
    audition: (degree) => auditionArp(degreeToMidi(degree)),
    onChange: save,
  });
  railRef = rail;

  buildKnobs();
  wireMute();
  wireLower(rail);
  refreshLcdKey();
  $('lcd-bpm').textContent = state.bpm;

  return { rail, refreshRail: () => rail.update(), refreshAll: refreshFromState };
}

function refreshFromState() {
  refreshBank();
  refreshDir();
  refreshLength();
  railRef?.update();
  refreshLcdKey();
  $('lcd-bpm').textContent = state.bpm;
  $('key').value = String(state.root);
  $('scale').value = state.scale;
  document.getElementById('arp-mute')?.classList.toggle('lit', state.arp.mute);
  macroKnobs.forEach((k) => k.render());
}
