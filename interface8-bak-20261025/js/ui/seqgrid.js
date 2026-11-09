/* INTERFACE v8 — the FIELD TAP grid: each pad is a programmable layer of 16
   cells (the v5 grammar: tap lays a cell down and plays it, a vertical drag
   bends its pitch; a muted row is silent but kept). The panel also carries
   the transport: play/stop, tempo, and the stretch — how many bars the same
   16 cells are spread over (1/2/4/8/16: quick and fast when short, slow and
   pad-like when long, always quantised to the beat). The timing itself is
   the model in ../seqmodel.js; this panel only renders it. */
import {
  state, save, clamp, FIELD_PADS, BPM_MIN, BPM_MAX, RATE_MIN, RATE_MAX,
} from '../state.js';
import {
  SEQ_CELLS, cellDur, stretchBars, seqPlaying, seqToggle, seqPosition,
} from '../audio/seq.js';
import { cellBeats } from '../seqmodel.js';
import { auditionFieldPad, hasFieldPad } from '../audio/field-voice.js';
import { glyphURL } from './glyphs.js';

const PAD_HUES = [12, 36, 72, 120, 168, 210, 258, 300];
const DRAG_PX = 72;
const TAP_SLOP = 6;

const rateFromDrag = (r0, dy) => clamp(r0 * 2 ** (-dy / DRAG_PX), RATE_MIN, RATE_MAX);
const formatRate = (r) => (Math.abs(r - 1) < 0.02 ? '' : `${r.toFixed(r >= 2 ? 1 : 2)}×`);
const CELL_BEAT_NAMES = { 0.25: 'a 1/4 beat', 0.5: 'half a beat', 1: 'one beat', 2: '2 beats', 4: '4 beats (a whole bar)' };

let say = () => {};
let root = null;
let open = false;
let raf = 0;
let lastCell = -2;
let lastGlyph = '';
let frameCount = 0;
const els = {};

export function seqPanelOpen() {
  return open;
}

/* one cell's look from its step */
function paintCell(cell, pad, i) {
  const step = state.seq.steps[pad]?.[i];
  const on = !!step?.on;
  const rate = step?.rate ?? 1;
  cell.classList.toggle('on', on);
  cell.classList.toggle('empty', !hasFieldPad(pad));
  cell.style.setProperty('--hue', PAD_HUES[pad]);
  cell.dataset.rate = on ? formatRate(rate) : '';
  cell.title = hasFieldPad(pad)
    ? `pad ${pad + 1} · step ${i + 1} of ${SEQ_CELLS}${on ? ' · on' : ''}${formatRate(rate) ? ` · ${formatRate(rate)}` : ''} · drag up/down for pitch`
    : `pad ${pad + 1} is empty - catch a sound into it first`;
}

function paintRow(pad) {
  const row = els.rows[pad];
  row.classList.toggle('active', pad === state.field.activePad);
  row.classList.toggle('muted', !!state.seq.padMute[pad]);
  row.querySelector('.seq-pad').classList.toggle('has-sample', hasFieldPad(pad));
  row.querySelector('.seq-mute').classList.toggle('lit', !!state.seq.padMute[pad]);
  row.querySelectorAll('.seq-cell').forEach((cell, i) => paintCell(cell, pad, i));
}

function paintAll() {
  for (let p = 0; p < FIELD_PADS; p++) paintRow(p);
}

function paintLeds() {
  els.bpmLed.textContent = String(state.seq.bpm);
  els.barsLed.textContent = String(state.seq.bars);
  els.barsLed.title = `the pattern stretches over ${state.seq.bars} bar${state.seq.bars > 1 ? 's' : ''} — each step is ${CELL_BEAT_NAMES[cellBeats(state.seq.bars)] ?? `${cellBeats(state.seq.bars)} beats`}`;
}

function build() {
  root.replaceChildren();

  const head = document.createElement('div');
  head.className = 'seq-head';

  els.play = document.createElement('button');
  els.play.type = 'button';
  els.play.className = 'seq-play';
  els.play.title = 'play / stop the sequencer';
  els.play.setAttribute('aria-label', 'play / stop the sequencer');
  const playImg = document.createElement('img');
  playImg.alt = '';
  els.play.appendChild(playImg);
  els.playImg = playImg;
  els.play.addEventListener('click', () => { seqToggle(); });

  const mkStepper = (label, ledName, minus, plus) => {
    const wrap = document.createElement('span');
    wrap.className = 'seq-stepper';
    const lbl = document.createElement('span');
    lbl.className = 'seq-lbl';
    lbl.textContent = label;
    const dn = document.createElement('button');
    dn.type = 'button';
    dn.textContent = '−';
    dn.title = `${label} down`;
    dn.setAttribute('aria-label', `${label} down`);
    const led = document.createElement('span');
    led.className = 'seq-led';
    const up = document.createElement('button');
    up.type = 'button';
    up.textContent = '+';
    up.title = `${label} up`;
    up.setAttribute('aria-label', `${label} up`);
    dn.addEventListener('click', minus);
    up.addEventListener('click', plus);
    wrap.append(lbl, dn, led, up);
    els[ledName] = led;
    return wrap;
  };

  head.appendChild(els.play);
  head.appendChild(mkStepper('BPM', 'bpmLed',
    () => { state.seq.bpm = clamp(state.seq.bpm - 1, BPM_MIN, BPM_MAX); save(); paintLeds(); },
    () => { state.seq.bpm = clamp(state.seq.bpm + 1, BPM_MIN, BPM_MAX); save(); paintLeds(); }));
  head.appendChild(mkStepper('BARS', 'barsLed',
    () => { stretchBars(-1); paintLeds(); },
    () => { stretchBars(1); paintLeds(); }));

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'seq-close';
  close.title = 'close the grid';
  close.setAttribute('aria-label', 'close the grid');
  const closeImg = document.createElement('img');
  closeImg.alt = '';
  closeImg.src = glyphURL('remove');
  close.appendChild(closeImg);
  close.addEventListener('click', () => closeSeqPanel());
  head.appendChild(close);

  root.appendChild(head);

  els.rows = [];
  for (let p = 0; p < FIELD_PADS; p++) {
    const row = document.createElement('div');
    row.className = 'seq-row';
    row.dataset.pad = p;

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'seq-pad';
    label.textContent = `P${p + 1}`;
    label.title = `choose pad ${p + 1} (and play it)`;
    label.addEventListener('click', () => {
      state.field.activePad = p;
      save();
      if (hasFieldPad(p)) auditionFieldPad(p);
      paintAll();
    });

    const mute = document.createElement('button');
    mute.type = 'button';
    mute.className = 'seq-mute';
    mute.textContent = 'M';
    mute.title = `mute layer ${p + 1}`;
    mute.addEventListener('click', () => {
      state.seq.padMute[p] = !state.seq.padMute[p];
      save();
      paintRow(p);
    });

    const cells = document.createElement('div');
    cells.className = 'seq-cells';
    for (let i = 0; i < SEQ_CELLS; i++) {
      cells.appendChild(mkCell(p, i));
    }

    row.append(label, mute, cells);
    root.appendChild(row);
    els.rows.push(row);
  }
}

function mkCell(pad, i) {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'seq-cell';
  cell.dataset.pad = pad;
  cell.dataset.step = i;
  let drag = null;

  cell.addEventListener('pointerdown', (e) => {
    if (!hasFieldPad(pad)) { say(`pad ${pad + 1} is empty - catch a sound into it first`); return; }
    e.preventDefault();
    try { cell.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    drag = {
      y0: e.clientY,
      rate0: state.seq.steps[pad]?.[i]?.rate ?? 1,
      moved: false,
    };
    cell.classList.add('dragging');
  });

  cell.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < TAP_SLOP) return;
    drag.moved = true;
    const step = state.seq.steps[pad]?.[i];
    if (!step) return;
    step.rate = rateFromDrag(drag.rate0, dy);
    paintCell(cell, pad, i);
  });

  const finish = () => {
    if (!drag) return;
    const { moved } = drag;
    drag = null;
    cell.classList.remove('dragging');
    const step = state.seq.steps[pad]?.[i];
    if (!step) return;
    if (!moved) step.on = !step.on;
    if (step.on) auditionFieldPad(pad, step.rate ?? 1);
    save();
    paintCell(cell, pad, i);
  };
  cell.addEventListener('pointerup', finish);
  cell.addEventListener('pointercancel', () => {
    drag = null;
    cell.classList.remove('dragging');
  });

  /* keyboard: Enter/Space clicks toggle the step (the pointerup path does
     not run for keyboard activation) */
  cell.addEventListener('click', (e) => {
    if (e.detail !== 0) return; // pointer taps already handled above
    if (!hasFieldPad(pad)) return;
    const step = state.seq.steps[pad]?.[i];
    if (!step) return;
    step.on = !step.on;
    if (step.on) auditionFieldPad(pad, step.rate ?? 1);
    save();
    paintCell(cell, pad, i);
  });

  return cell;
}

function frame() {
  if (!open) return;
  const pos = seqPosition();
  const cell = pos ? pos.cell : -1;
  if (cell !== lastCell) {
    lastCell = cell;
    root.querySelectorAll('.seq-cell.cur').forEach((c) => c.classList.remove('cur'));
    if (cell >= 0) {
      root.querySelectorAll(`.seq-cell[data-step="${cell}"]`).forEach((c) => c.classList.add('cur'));
    }
  }
  const glyph = seqPlaying() ? 'stop' : 'play';
  if (glyph !== lastGlyph) {
    lastGlyph = glyph;
    els.playImg.src = glyphURL(glyph);
  }
  els.play.classList.toggle('lit', seqPlaying());
  /* pads caught (REC/AUTO) while the grid is open show up within a moment */
  frameCount++;
  if (frameCount % 120 === 0) paintAll();
  raf = requestAnimationFrame(frame);
}

export function openSeqPanel() {
  if (open) return;
  open = true;
  lastCell = -2;
  root.hidden = false;
  paintLeds();
  paintAll();
  raf = requestAnimationFrame(frame);
}

export function closeSeqPanel() {
  if (!open) return;
  open = false;
  cancelAnimationFrame(raf);
  root.hidden = true;
}

export function toggleSeqPanel() {
  if (open) closeSeqPanel();
  else openSeqPanel();
}

export function initSeqGrid({ say: sayFn } = {}) {
  say = sayFn || say;
  root = document.getElementById('seq');
  build();
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      e.stopImmediatePropagation();
      closeSeqPanel();
    }
  }, true);
}
