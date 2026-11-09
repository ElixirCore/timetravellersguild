/* DISC — a musical instrument made of circles.

   Four rings of sixteen steps turn under an arm. Tap a step to put the last
   note you played on it; drag round a ring to paint, tap a lit step to take it
   away (or to retune it). The ring of keys at the middle plays the chosen
   ring's sound, and with REC on it writes what you play onto the steps.
   Underneath, the sounds: eight built in, one made from words (ElevenLabs),
   one from the microphone, and the ones you made. Nothing else. */
import { S, NRINGS, STEPS, SCALES, load, save } from './state.js';
import {
  ensure, getPlayer, start, stop, isPlaying, position, renderLoop, micSession,
} from './audio.js';
import {
  KIT, defOf, bufferFor, fromWords, fromMic,
} from './sounds.js';

const TAU = Math.PI * 2;
const HUES = [42, 160, 205, 300];
const INK = '#d8e0c8';
const DIM = '#7a8468';
const HOT = '#e8b93c';
const PANEL = '#14170f';
const BAD = '#dd6666';
const ringColor = (k, l = 58, a = 1) => `hsla(${HUES[k]}, 55%, ${l}%, ${a})`;

/* geometry, in fractions of the disc's radius */
const BAND_IN = 0.47;
const BAND_PITCH = 0.13;
const BAND_W = 0.125;
const KEY_IN = 0.2;
const KEY_LEN = 0.23;
const PLAY_R = 0.15;

load();

const cv = document.getElementById('c');
const g = cv.getContext('2d');
const sayEl = document.getElementById('say');
const form = document.getElementById('words');
const wtext = document.getElementById('wtext');

let W = 0;
let H = 0;
let dpr = 1;
let cx = 0;
let cy = 0;
let R = 100;
let land = false;
let btns = [];
const keyFlash = new Array(8).fill(0); // when a key was last struck
const hint = ['tap steps · play the keys · tap a sound'];
let sayTimer = null;
let micArc = 0; // 0..1 while the microphone is open
let making = false;
let midiOn = false;

function say(msg, bad = false, ms = 3200) {
  sayEl.textContent = msg;
  sayEl.classList.toggle('bad', bad);
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => { sayEl.textContent = ''; }, ms);
}

/* ---------- layout ---------- */
function layout() {
  dpr = Math.min(3, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  land = W > H * 1.15;
  btns = [];
  const ctl = ['tempo', 'scale', 'dice', 'clear', 'mute', 'rec', 'midi', 'save'];
  const beads = [...KIT.map((_, i) => `k${i}`), 'spark', 'mic', ...Array.from({ length: 6 }, (_, i) => `m${i}`)];
  if (!land) {
    const top = 76;
    const bot = 128;
    R = Math.min(W / 2 - 6, (H - top - bot) / 2 - 2);
    cx = W / 2;
    cy = top + (H - top - bot) / 2;
    const cr = Math.min(23, W / ctl.length / 2 - 3);
    ctl.forEach((id, i) => btns.push({ id, x: (W * (i + 0.5)) / ctl.length, y: 44, r: cr }));
    const br = Math.min(22, W / 8 / 2 - 3);
    beads.forEach((id, i) => btns.push({
      id, x: (W * ((i % 8) + 0.5)) / 8, y: H - bot + 36 + Math.floor(i / 8) * 56, r: br,
    }));
  } else {
    const side = 96;
    R = Math.min(H / 2 - 6, (W - side * 2) / 2);
    cx = W / 2;
    cy = H / 2;
    const cr = Math.min(22, H / ctl.length / 2 - 2);
    ctl.forEach((id, i) => btns.push({ id, x: 40, y: (H * (i + 0.5)) / ctl.length, r: cr }));
    const br = Math.min(20, H / 8 / 2 - 2);
    beads.forEach((id, i) => btns.push({
      id, x: W - 30 - (1 - Math.floor(i / 8)) * 52 - 20 + 26 * 0, y: (H * ((i % 8) + 0.5)) / 8, r: br,
    }));
  }
}

/* ---------- what is under a finger ---------- */
function hitTest(x, y) {
  for (const b of btns) if (Math.hypot(x - b.x, y - b.y) <= b.r + 4) return { type: 'btn', b };
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy) / R;
  const a = (Math.atan2(dx, -dy) + TAU) % TAU; // clockwise from the top
  if (d < PLAY_R + 0.02) return { type: 'play' };
  if (d >= KEY_IN - 0.03 && d < BAND_IN - 0.015) return { type: 'key', j: Math.floor(a / (TAU / 8)) };
  if (d >= BAND_IN - 0.015 && d <= BAND_IN + 3 * BAND_PITCH + BAND_W + 0.02) {
    const k = Math.min(NRINGS - 1, Math.floor((d - (BAND_IN - 0.0025)) / BAND_PITCH));
    return { type: 'step', k, i: Math.floor(a / (TAU / STEPS)) };
  }
  return null;
}

/* ---------- playing ---------- */
const brushFor = (k) => (defOf(S.rings[k].sound).role === 'drum' ? 0 : S.brush);

function sound(k, n) {
  getPlayer().note(k, n, 0);
}

function keyNote(j) { return SCALES[S.scale].set[j]; }

function noteOn(n, j = -1) {
  ensure();
  sound(S.focus, n);
  if (defOf(S.rings[S.focus].sound).role !== 'drum') S.brush = n;
  if (j >= 0) keyFlash[j] = performance.now();
  if (S.rec && isPlaying()) {
    const p = position();
    if (p != null) {
      const cell = S.rings[S.focus].steps[Math.round(p) % STEPS];
      cell.on = true;
      cell.n = n;
    }
  }
  save();
}

function applyStep(k, i, mode) {
  const cell = S.rings[k].steps[i];
  if (mode === 'erase') { cell.on = false; save(); return; }
  const n = brushFor(k);
  if (cell.on && cell.n === n) return;
  cell.on = true;
  cell.n = n;
  sound(k, n);
  save();
}

/* ---------- the sounds ---------- */
async function loadRing(k) {
  const snd = S.rings[k].sound;
  try {
    const buf = await bufferFor(snd);
    const p = getPlayer();
    p.set(k, buf, defOf(snd));
    p.mute(k, S.rings[k].mute);
  } catch (e) {
    say(e.message, true);
    S.rings[k].sound = { t: 'kit', i: [0, 1, 2, 5][k] };
    save();
    loadRing(k);
  }
}

async function chooseSound(snd) {
  ensure();
  S.rings[S.focus].sound = snd;
  save();
  await loadRing(S.focus);
  sound(S.focus, brushFor(S.focus));
}

const sameSound = (a, b) => a.t === b.t && (a.t === 'kit' ? a.i === b.i : a.id === b.id);

const EXAMPLES = ['a wet glass tap', 'a rubber band pluck', 'a tiny thunderclap', 'a breathy flute note', 'a metal door, closing', 'a soft marimba hit', 'a frog in a bucket'];
let exIx = 0;

function openWords() {
  const open = form.hidden;
  form.hidden = !open;
  if (open) {
    wtext.placeholder = EXAMPLES[exIx++ % EXAMPLES.length];
    wtext.value = '';
    wtext.focus();
  } else wtext.blur();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const words = wtext.value.trim();
  if (!words || making) return;
  form.hidden = true;
  wtext.blur();
  making = true;
  ensure();
  say(`making “${words}”…`, false, 20000);
  try {
    const rec = await fromWords(words);
    S.mine = [rec, ...S.mine].slice(0, 6);
    await chooseSound({ t: 'mine', id: rec.id, name: rec.name });
    say('made by ElevenLabs: it is on the chosen ring');
  } catch (err) {
    say(err.message, true, 6000);
  }
  making = false;
});

async function recordMic() {
  if (making) return;
  making = true;
  ensure();
  micSession(true);
  say('listening for a second…', false, 4000);
  try {
    const t0 = performance.now();
    const tick = setInterval(() => { micArc = Math.min(1, (performance.now() - t0) / 1200); }, 40);
    const rec = await fromMic(1200, () => {});
    clearInterval(tick);
    S.mine = [rec, ...S.mine].slice(0, 6);
    await chooseSound({ t: 'mine', id: rec.id, name: rec.name });
    say('your sound is on the chosen ring');
  } catch (err) {
    say(err.message, true, 5000);
  }
  micArc = 0;
  micSession(false);
  making = false;
}

/* ---------- the controls ---------- */
function rollLine(k) {
  const r = S.rings[k];
  const def = defOf(r.sound);
  const [lo, hi] = def.hits;
  const hits = lo + Math.floor(Math.random() * (hi - lo + 1));
  const w = Array.from({ length: STEPS }, (_, i) => (i % 4 === 0 ? 3 : i % 2 === 0 ? 2 : 1) + Math.random() * 2);
  const chosen = w.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, hits).map((x) => x[1]);
  r.steps.forEach((c) => { c.on = false; });
  const set = SCALES[S.scale].set;
  let at = Math.floor(Math.random() * 3);
  chosen.sort((a, b) => a - b).forEach((i) => {
    at = Math.max(0, Math.min(set.length - 1, at + Math.round((Math.random() - 0.5) * 4)));
    r.steps[i] = { on: true, n: def.role === 'drum' ? 0 : set[at] };
  });
}

const actions = {
  scale() {
    S.scale = (S.scale + 1) % SCALES.length;
    save();
    say(`keys: ${SCALES[S.scale].name}`);
  },
  dice() { ensure(); rollLine(S.focus); save(); say('a new line, rolled'); },
  clear() { S.rings[S.focus].steps.forEach((c) => { c.on = false; }); save(); say('ring emptied'); },
  mute() {
    const r = S.rings[S.focus];
    r.mute = !r.mute;
    getPlayer().mute(S.focus, r.mute);
    save();
    say(r.mute ? 'ring muted' : 'ring back on');
  },
  rec() {
    S.rec = !S.rec;
    if (S.rec && !isPlaying()) start();
    say(S.rec ? 'recording: play the keys, they land on the nearest step' : 'recording off');
  },
  async midi() {
    if (midiOn) { say('MIDI is on'); return; }
    if (!navigator.requestMIDIAccess) { say('this browser has no MIDI', true); return; }
    try {
      const acc = await navigator.requestMIDIAccess();
      const hook = () => acc.inputs.forEach((inp) => { inp.onmidimessage = onMidi; });
      acc.onstatechange = hook;
      hook();
      midiOn = true;
      say(acc.inputs.size ? 'MIDI on: a keyboard plays the chosen ring' : 'MIDI on: plug a keyboard in');
    } catch { say('MIDI was not allowed', true); }
  },
  async save() {
    say('rendering one lap…', false, 8000);
    try {
      const blob = await renderLoop();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `disc-${S.bpm}bpm.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 8000);
      say('one lap kept as a wav, it loops cleanly');
    } catch (e) { say(`could not render: ${e.message}`, true); }
  },
  spark() { openWords(); },
  mic() { recordMic(); },
};

function onMidi(e) {
  const [st, note, vel] = e.data;
  if ((st & 0xf0) === 0x90 && vel > 0) noteOn(note - 60);
}

/* ---------- touch ---------- */
const touches = new Map();

cv.addEventListener('pointerdown', (e) => {
  ensure();
  if (!form.hidden && e.target === cv) { form.hidden = true; wtext.blur(); }
  cv.setPointerCapture(e.pointerId);
  const h = hitTest(e.clientX, e.clientY);
  if (!h) return;
  if (h.type === 'btn') {
    touches.set(e.pointerId, { type: 'btn', b: h.b, x0: e.clientX, y0: e.clientY, bpm0: S.bpm, moved: false });
  } else if (h.type === 'step') {
    S.focus = h.k;
    const cell = S.rings[h.k].steps[h.i];
    const mode = cell.on && cell.n === brushFor(h.k) ? 'erase' : 'place';
    touches.set(e.pointerId, { type: 'step', k: h.k, mode, last: h.i });
    applyStep(h.k, h.i, mode);
  } else if (h.type === 'key') {
    touches.set(e.pointerId, { type: 'key', j: h.j });
    noteOn(keyNote(h.j), h.j);
  } else if (h.type === 'play') {
    touches.set(e.pointerId, { type: 'play' });
  }
});

cv.addEventListener('pointermove', (e) => {
  const t = touches.get(e.pointerId);
  if (!t) return;
  if (t.type === 'btn' && t.b.id === 'tempo') {
    const dy = t.y0 - e.clientY;
    if (Math.abs(dy) > 3) t.moved = true;
    if (t.moved) {
      S.bpm = Math.max(50, Math.min(200, Math.round(t.bpm0 + dy / 2.2)));
      say(`${S.bpm} bpm`, false, 900);
      save();
    }
  } else if (t.type === 'step') {
    const h = hitTest(e.clientX, e.clientY);
    if (h && h.type === 'step' && h.k === t.k && h.i !== t.last) {
      t.last = h.i;
      applyStep(h.k, h.i, t.mode);
    }
  } else if (t.type === 'key') {
    const h = hitTest(e.clientX, e.clientY);
    if (h && h.type === 'key' && h.j !== t.j) { t.j = h.j; noteOn(keyNote(h.j), h.j); }
  }
});

function release(e) {
  const t = touches.get(e.pointerId);
  touches.delete(e.pointerId);
  if (!t) return;
  if (t.type === 'play') {
    const h = hitTest(e.clientX, e.clientY);
    if (h && h.type === 'play') { if (isPlaying()) stop(); else start(); }
  } else if (t.type === 'btn') {
    const h = hitTest(e.clientX, e.clientY);
    if (!h || h.type !== 'btn' || h.b !== t.b) return;
    const id = t.b.id;
    if (id === 'tempo') { if (!t.moved) say(`${S.bpm} bpm: drag up or down to change`); return; }
    if (actions[id]) { actions[id](); return; }
    if (id[0] === 'k') chooseSound({ t: 'kit', i: Number(id.slice(1)) });
    else if (isMine(id)) {
      const m = S.mine[Number(id.slice(1))];
      if (m) chooseSound({ t: 'mine', id: m.id, name: m.name });
    }
  }
}
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', release);

/* the computer keyboard: home row plays the keys, space plays */
const KEYS = 'asdfghjk'.split('');
const held = new Set();
document.addEventListener('keydown', (e) => {
  if (/^(input|textarea)$/i.test(e.target?.tagName || '') || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  const j = KEYS.indexOf(e.key.toLowerCase());
  if (j >= 0) { held.add(e.key); noteOn(keyNote(j), j); e.preventDefault(); } else if (e.key === ' ') { e.preventDefault(); if (isPlaying()) stop(); else start(); } else if (e.key.toLowerCase() === 'r') actions.rec();
});
document.addEventListener('keyup', (e) => held.delete(e.key));

/* ---------- drawing ---------- */
function sector(rIn, rOut, a0, a1) {
  g.beginPath();
  g.arc(cx, cy, rOut, a0, a1);
  g.arc(cx, cy, rIn, a1, a0, true);
  g.closePath();
}

function petal(rIn, rc, rOut, a, k, len, boost, alpha) {
  const semi = (rOut - rIn) * len / 2;
  const w = Math.min((rOut - rIn) * 0.44, (rIn * TAU) / STEPS / 2 * 0.8) * (1 + 0.2 * boost);
  const mid = rIn + semi;
  g.save();
  g.translate(cx + Math.cos(a) * mid, cy + Math.sin(a) * mid);
  g.rotate(a);
  g.beginPath();
  g.ellipse(0, 0, Math.max(1, semi), Math.max(1, w), 0, 0, TAU);
  g.restore();
  g.fillStyle = ringColor(k, 58 + 22 * boost, alpha);
  g.fill();
}

const noteLen = (n) => 0.55 + 0.45 * Math.max(0, Math.min(1, n / 16));

function icon(id, x, y, r, lit) {
  g.save();
  g.translate(x, y);
  g.strokeStyle = lit ? PANEL : INK;
  g.fillStyle = lit ? PANEL : INK;
  g.lineWidth = Math.max(1.5, r * 0.09);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const u = r * 0.5;
  const dot = (px, py, pr) => { g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill(); };
  if (id === 'dice') {
    g.beginPath(); g.arc(0, 0, u * 1.2, 0, TAU); g.stroke();
    [[-0.5, -0.5], [0.5, -0.5], [0, 0], [-0.5, 0.5], [0.5, 0.5]].forEach(([a, b]) => dot(a * u * 1.2, b * u * 1.2, r * 0.07));
  } else if (id === 'clear') {
    g.beginPath(); g.moveTo(-u * 0.8, -u * 0.8); g.lineTo(u * 0.8, u * 0.8); g.moveTo(u * 0.8, -u * 0.8); g.lineTo(-u * 0.8, u * 0.8); g.stroke();
  } else if (id === 'mute') {
    g.beginPath(); g.arc(-u * 0.3, 0, u * 0.45, 0, TAU); g.stroke();
    g.beginPath(); g.arc(u * 0.3, 0, u * 0.85, -0.9, 0.9); g.stroke();
    if (lit) { g.beginPath(); g.moveTo(-u, u); g.lineTo(u, -u); g.stroke(); }
  } else if (id === 'rec') {
    g.fillStyle = lit ? PANEL : BAD;
    dot(0, 0, u * 0.85);
  } else if (id === 'midi') {
    for (let i = 0; i < 5; i++) { const a = Math.PI + (i / 4) * Math.PI; dot(Math.cos(a) * u * 1.05, Math.sin(a) * u * 1.05 + u * 0.5, r * 0.08); }
  } else if (id === 'save') {
    g.beginPath(); g.moveTo(0, -u); g.lineTo(0, u * 0.5); g.moveTo(-u * 0.6, -u * 0.1); g.lineTo(0, u * 0.5); g.lineTo(u * 0.6, -u * 0.1); g.stroke();
    g.beginPath(); g.moveTo(-u * 0.8, u * 1.0); g.lineTo(u * 0.8, u * 1.0); g.stroke();
  } else if (id === 'spark') {
    dot(0, 0, r * 0.1);
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8;
      const r0 = i % 2 ? 0.5 : 0.45;
      const r1 = i % 2 ? 0.66 : 0.88;
      g.beginPath(); g.moveTo(Math.cos(a) * r * r0, Math.sin(a) * r * r0); g.lineTo(Math.cos(a) * r * r1, Math.sin(a) * r * r1); g.stroke();
    }
  } else if (id === 'mic') {
    g.beginPath(); g.arc(0, 0, u * 0.9, 0, TAU); g.stroke();
    dot(0, 0, u * 0.38);
  }
  g.restore();
}

function label(text, x, y, r, color) {
  g.fillStyle = color;
  g.font = `600 ${Math.round(r * 0.78)}px ui-monospace, Menlo, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y + 1);
}

const isMine = (id) => /^m\d$/.test(id);

function drawButtons(now, pulse) {
  const cur = S.rings[S.focus];
  for (const b of btns) {
    const id = b.id;
    let lit = false;
    let ring = DIM;
    if (id === 'rec') { lit = S.rec && Math.sin(now * 8) > -0.3; ring = S.rec ? BAD : DIM; }
    else if (id === 'mute') { lit = cur.mute; ring = cur.mute ? BAD : DIM; }
    else if (id === 'midi') { lit = midiOn; ring = midiOn ? HOT : DIM; }
    else if (id === 'spark') { lit = !form.hidden || making; ring = lit ? HOT : DIM; }
    else if (id[0] === 'k') { lit = sameSound(cur.sound, { t: 'kit', i: Number(id.slice(1)) }); ring = lit ? HOT : DIM; }
    else if (isMine(id)) {
      const m = S.mine[Number(id.slice(1))];
      lit = !!m && cur.sound.t === 'mine' && cur.sound.id === m.id;
      ring = m ? (lit ? HOT : INK) : '#2a2f22';
    }
    if (isMine(id) && !S.mine[Number(id.slice(1))]) {
      g.strokeStyle = '#2a2f22'; g.lineWidth = 1; g.beginPath(); g.arc(b.x, b.y, b.r * 0.6, 0, TAU); g.stroke();
      continue;
    }
    g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU);
    g.fillStyle = lit ? (id === 'rec' || id === 'mute' ? BAD : HOT) : PANEL;
    g.fill();
    g.lineWidth = 1.5; g.strokeStyle = ring; g.stroke();
    if (id === 'tempo') {
      const f = (S.bpm - 50) / 150;
      g.strokeStyle = HOT; g.lineWidth = 2.5; g.lineCap = 'round';
      g.beginPath(); g.arc(b.x, b.y, b.r - 4, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * f)); g.stroke();
      label(String(S.bpm), b.x, b.y, b.r * 0.9, INK);
    } else if (id === 'scale') label(SCALES[S.scale].tag, b.x, b.y, b.r, INK);
    else if (id[0] === 'k') label(KIT[Number(id.slice(1))].tag, b.x, b.y, b.r, lit ? PANEL : INK);
    else if (isMine(id)) label(String(Number(id.slice(1)) + 1), b.x, b.y, b.r, lit ? PANEL : INK);
    else icon(id, b.x, b.y, b.r, lit);
    if (id === 'mic' && micArc > 0) {
      g.strokeStyle = BAD; g.lineWidth = 3; g.beginPath(); g.arc(b.x, b.y, b.r + 3, -Math.PI / 2, -Math.PI / 2 + micArc * TAU); g.stroke();
    }
  }
}

function frame(ms) {
  const now = ms / 1000;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#0d0f0a';
  g.fillRect(0, 0, W, H);

  const playing = isPlaying();
  const pos = playing ? position() : null;
  const phase = pos != null ? (pos / 4) % 1 : ((now * S.bpm) / 60) % 1;
  const pulse = Math.exp(-5 * phase);

  /* the plate */
  g.beginPath(); g.arc(cx, cy, R * 1.015, 0, TAU);
  g.fillStyle = 'rgba(20,23,15,0.8)'; g.fill();
  g.lineWidth = 1.5; g.strokeStyle = `rgba(122,132,104,${0.35 + 0.5 * pulse})`; g.stroke();

  /* the rings */
  for (let k = 0; k < NRINGS; k++) {
    const rIn = (BAND_IN + k * BAND_PITCH) * R;
    const rOut = rIn + BAND_W * R;
    const ring = S.rings[k];
    const focus = k === S.focus;
    const dimmed = ring.mute ? 0.35 : 1;
    for (let i = 0; i < STEPS; i++) {
      const a0 = -Math.PI / 2 + (i * TAU) / STEPS + 0.012;
      const a1 = -Math.PI / 2 + ((i + 1) * TAU) / STEPS - 0.012;
      const am = (a0 + a1) / 2;
      const age = pos != null ? (((pos - i) % STEPS) + STEPS) % STEPS : 99;
      const boost = age < 1.6 ? 1 - age / 1.6 : 0;
      sector(rIn, rOut, a0, a1);
      g.fillStyle = i % 4 === 0 ? 'rgba(216,224,200,0.10)' : 'rgba(122,132,104,0.08)';
      g.fill();
      if (boost > 0) { g.fillStyle = ringColor(k, 60, 0.16 * boost * dimmed); g.fill(); }
      const c = ring.steps[i];
      if (c.on) { sector(rIn, rOut, a0, a1); g.fillStyle = ringColor(k, 50, 0.2 * dimmed); g.fill(); }
      if (c.on) petal(rIn, 0, rOut, am, k, noteLen(c.n), boost, (0.8 + 0.2 * boost) * dimmed);
    }
    if (focus) {
      g.lineWidth = 1.2; g.strokeStyle = `rgba(232,185,60,${0.55 + 0.3 * pulse})`;
      g.beginPath(); g.arc(cx, cy, rIn - 0.004 * R, 0, TAU); g.stroke();
      g.beginPath(); g.arc(cx, cy, rOut + 0.004 * R, 0, TAU); g.stroke();
    }
  }

  /* the keys */
  const set = SCALES[S.scale].set;
  const col = HUES[S.focus];
  for (let j = 0; j < 8; j++) {
    const a = -Math.PI / 2 + ((j + 0.5) * TAU) / 8;
    const len = noteLen(set[j]);
    const struck = Math.max(0, 1 - (performance.now() - keyFlash[j]) / 260);
    const rIn = KEY_IN * R;
    const semi = (KEY_LEN * R * len) / 2;
    g.save();
    g.translate(cx + Math.cos(a) * (rIn + semi), cy + Math.sin(a) * (rIn + semi));
    g.rotate(a);
    g.beginPath(); g.ellipse(0, 0, Math.max(2, semi), Math.min(R * 0.085, ((rIn * TAU) / 8 / 2) * 0.72), 0, 0, TAU);
    g.restore();
    g.fillStyle = struck > 0 ? `hsla(${col}, 60%, ${60 + 25 * struck}%, ${0.55 + 0.45 * struck})` : `hsla(${col}, 40%, 50%, 0.34)`;
    g.fill();
    if (set[j] === S.brush && defOf(S.rings[S.focus].sound).role !== 'drum') { g.lineWidth = 1.5; g.strokeStyle = HOT; g.stroke(); }
  }

  /* the arm */
  const armA = -Math.PI / 2 + ((pos ?? 0) / STEPS) * TAU;
  if (playing) {
    for (let j = 0; j < 22; j++) {
      const a1 = armA - j * 0.028;
      sector(R * 0.2, R * 1.01, a1 - 0.03, a1);
      g.fillStyle = `rgba(232,185,60,${0.13 * (1 - j / 22)})`;
      g.fill();
    }
  }
  g.strokeStyle = `rgba(232,185,60,${playing ? 0.95 : 0.3 + 0.3 * pulse})`;
  g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx + Math.cos(armA) * R * 0.2, cy + Math.sin(armA) * R * 0.2); g.lineTo(cx + Math.cos(armA) * R * 1.03, cy + Math.sin(armA) * R * 1.03); g.stroke();
  g.fillStyle = HOT;
  g.beginPath(); g.arc(cx + Math.cos(armA) * R * 1.03, cy + Math.sin(armA) * R * 1.03, 4 + (playing ? 3 * pulse : 0), 0, TAU); g.fill();

  /* the middle: play / stop */
  g.beginPath(); g.arc(cx, cy, PLAY_R * R, 0, TAU);
  g.fillStyle = playing ? HOT : PANEL; g.fill();
  g.lineWidth = 2; g.strokeStyle = playing ? HOT : DIM; g.stroke();
  g.strokeStyle = g.fillStyle = playing ? PANEL : INK;
  g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
  const pr = PLAY_R * R * 0.42;
  if (playing) {
    g.beginPath(); g.moveTo(cx - pr * 0.5, cy - pr); g.lineTo(cx - pr * 0.5, cy + pr); g.moveTo(cx + pr * 0.5, cy - pr); g.lineTo(cx + pr * 0.5, cy + pr); g.stroke();
  } else {
    g.beginPath(); g.moveTo(cx - pr * 0.6, cy - pr); g.lineTo(cx + pr * 0.95, cy); g.lineTo(cx - pr * 0.6, cy + pr); g.closePath(); g.fill(); g.stroke();
  }

  drawButtons(now, pulse);
  requestAnimationFrame(frame);
}

/* ---------- go ---------- */
window.addEventListener('resize', layout);
layout();
ensure();
for (let k = 0; k < NRINGS; k++) loadRing(k);
say(hint[0], false, 6000);
requestAnimationFrame(frame);
