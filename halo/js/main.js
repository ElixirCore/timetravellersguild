/* HALO — a tiny instrument for any sound.

   One circle turning. Time goes round it (sixteen steps), pitch goes out from
   the middle (low at the centre, high at the rim). Tap the circle and the
   chosen sound lands there; tap a dot to lift it off; drag a dot to move it.
   Underneath are your sounds as pebbles: tap one to choose it and hear it,
   drag one onto the circle, hold one to let it go. Make new ones from words
   (a sound, or a piece of music that gets chopped into eight slices) or the
   microphone. Everything snaps to the beat and to the mood's scale, so
   whatever you do stays musical. */
import {
  S, STEPS, LANES, MOODS, load, save, remember, undo, dotAt, pebble, nextU, hueFor,
} from './state.js';
import {
  ensure, getPlayer, start, stop, isPlaying, position, renderLoop, micSession,
} from './audio.js';
import {
  KIT, defOf, bufferFor, fromWords, fromMic, looksLikeMusic, asksForVoice,
} from './sounds.js';

const TAU = Math.PI * 2;
const BG = '#0d0f0a';
const INK = '#d8e0c8';
const DIM = '#7a8468';
const HOT = '#e8b93c';
const PANEL = '#14170f';
const BAD = '#dd6666';
const MAXPAL = 8;
const R0 = 0.2; // where the lanes begin (fraction of the radius)
const laneR = (k) => R0 + (1 - R0) * (k / LANES) ** 0.8; // inner lanes a little wider

load();

const cv = document.getElementById('c');
const g = cv.getContext('2d');
const sayEl = document.getElementById('say');
const form = document.getElementById('words');
const wtext = document.getElementById('wtext');
const modeBtn = document.getElementById('mode');

let W = 0;
let H = 0;
let dpr = 1;
let cx = 0;
let cy = 0;
let R = 100;
let ctl = []; // round controls
let slots = []; // pebble positions
const flash = new Map(); // "t,p" -> when it last sounded
let lastStep = -1;
let pending = null; // a sound being made: { hue, t0 }
let micT0 = 0;
let sayTimer = null;

function say(msg, bad = false, ms = 3400) {
  sayEl.textContent = msg;
  sayEl.classList.toggle('bad', bad);
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => { sayEl.textContent = ''; }, ms);
}

/* ---------- layout ---------- */
const CTL = ['undo', 'mood', 'dice', 'clear', 'save', 'words', 'mic'];

function layout() {
  dpr = Math.min(3, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const land = W > H * 1.15;
  ctl = [];
  slots = [];
  if (!land) {
    const top = 80;
    const bot = 84;
    R = Math.min(W / 2 - 8, (H - top - bot) / 2 - 6);
    cx = W / 2;
    cy = top + (H - top - bot) / 2;
    const cr = Math.min(21, W / CTL.length / 2 - 4);
    CTL.forEach((id, i) => ctl.push({ id, x: (W * (i + 0.5)) / CTL.length, y: 50, r: cr }));
    const pr = Math.min(22, W / MAXPAL / 2 - 4);
    for (let i = 0; i < MAXPAL; i++) slots.push({ x: (W * (i + 0.5)) / MAXPAL, y: H - bot / 2 - 4, r: pr });
  } else {
    R = Math.min(H / 2 - 8, (W - 200) / 2);
    cx = W / 2;
    cy = H / 2;
    const cr = Math.min(21, H / CTL.length / 2 - 3);
    CTL.forEach((id, i) => ctl.push({ id, x: 42, y: (H * (i + 0.5)) / CTL.length, r: cr }));
    const pr = Math.min(20, H / MAXPAL / 2 - 6);
    for (let i = 0; i < MAXPAL; i++) slots.push({ x: W - 42, y: (H * (i + 0.5)) / MAXPAL, r: pr });
  }
}

/* ---------- what is under a finger ---------- */
function polar(x, y) {
  const dx = x - cx;
  const dy = y - cy;
  return { d: Math.hypot(dx, dy) / R, a: (Math.atan2(dx, -dy) + TAU) % TAU };
}

function cellAt(x, y) {
  const { d, a } = polar(x, y);
  if (d < R0 || d > 1.04) return null;
  let p = LANES - 1;
  for (let k = 1; k <= LANES; k++) if (d < laneR(k)) { p = k - 1; break; }
  return { t: Math.floor(a / (TAU / STEPS)) % STEPS, p };
}

function hitTest(x, y) {
  for (const b of ctl) if (Math.hypot(x - b.x, y - b.y) <= b.r + 5) return { type: 'ctl', id: b.id };
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (Math.hypot(x - s.x, y - s.y) <= s.r + 5 && S.pal[i]) return { type: 'pebble', u: S.pal[i].u };
  }
  const { d } = polar(x, y);
  if (d < R0 - 0.01) return { type: 'centre' };
  const c = cellAt(x, y);
  return c ? { type: 'cell', ...c } : null;
}

/* where a lane's dot sits, on screen */
function cellXY(t, p) {
  const a = -Math.PI / 2 + ((t + 0.5) * TAU) / STEPS;
  const r = ((laneR(p) + laneR(p + 1)) / 2) * R;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, r, a };
}

/* ---------- the sounds ---------- */
const homeLane = (u) => {
  const pb = pebble(u);
  if (pb && defOf(pb.src).role === 'chop') return 0;
  return Math.max(0, MOODS[S.mood].set.indexOf(0));
};

function hear(u, p = homeLane(u)) {
  ensure();
  getPlayer().note(u, p, 0);
}

async function loadVoice(pb) {
  try {
    const buf = await bufferFor(pb.src);
    getPlayer().set(pb.u, buf, defOf(pb.src));
    return true;
  } catch (e) {
    say(`${pb.src.name || 'a sound'}: ${e.message}`, true);
    return false;
  }
}

function addPebble(src) {
  const used = new Set(S.pal.map((x) => x.hue));
  let n = 0;
  while (used.has(hueFor(n)) && n < 20) n++;
  const pb = { u: nextU(), hue: hueFor(n), src };
  S.pal.push(pb);
  S.sel = pb.u;
  save();
  return pb;
}

function removePebble(u) {
  remember();
  const pb = pebble(u);
  S.pal = S.pal.filter((x) => x.u !== u);
  S.dots = S.dots.filter((x) => x.u !== u);
  if (S.sel === u) S.sel = S.pal[0]?.u ?? 0;
  save();
  say(`${nameOf(pb)} let go · undo brings it back`);
}

const nameOf = (pb) => (pb ? (pb.src.t === 'kit' ? KIT[pb.src.i].name : pb.src.name || 'sound') : '');

function tagOf(pb) {
  if (pb.src.t === 'kit') return KIT[pb.src.i].tag;
  if (/^mic /.test(pb.src.name || '')) return '●';
  const words = (pb.src.name || '').toLowerCase().split(/\s+/).filter((w) => w && !/^(a|an|the|of|some|mic)$/.test(w));
  if (!words.length) return '·';
  return words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
}

/* after undo, voices may need making again */
function syncVoices() {
  const p = getPlayer();
  S.pal.forEach((pb) => { if (!p.has(pb.u)) loadVoice(pb); });
}

/* ---------- making sounds ---------- */
let modeLocked = false;
function setMode(m, locked = false) {
  modeBtn.textContent = m;
  modeBtn.dataset.m = m;
  if (locked) modeLocked = true;
  wtext.placeholder = m === 'music'
    ? 'describe some music: "dusty soul drums", "glassy marimba riff"…'
    : 'describe a sound: "a wet glass tap", "a frog in a bucket"…';
}

function openWords() {
  if (S.pal.length >= MAXPAL) { say('eight sounds is the most: hold a pebble to let one go', true); return; }
  if (pending) { say('still making the last one…'); return; }
  form.hidden = !form.hidden;
  if (!form.hidden) {
    wtext.value = '';
    modeLocked = false;
    setMode('sound');
    wtext.focus();
  } else wtext.blur();
}

wtext.addEventListener('input', () => {
  if (!modeLocked) setMode(looksLikeMusic(wtext.value) ? 'music' : 'sound');
});
modeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  setMode(modeBtn.dataset.m === 'music' ? 'sound' : 'music', true);
  wtext.focus();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const words = wtext.value.trim();
  if (!words || pending) return;
  const mode = modeBtn.dataset.m;
  form.hidden = true;
  wtext.blur();
  ensure();
  pending = { t0: performance.now() };
  const music = mode === 'music';
  say(music
    ? `composing “${words}”${asksForVoice(words) ? ' (with a voice, as asked)' : ' (instrumental)'} at ${S.bpm} bpm…`
    : `making “${words}”…`, false, 120000);
  try {
    const src = await fromWords(words, mode, S.bpm);
    remember();
    const pb = addPebble(src);
    if (await loadVoice(pb)) {
      if (music) {
        /* so it plays at once: its first four slices on the four beats */
        for (let b = 0; b < 4; b++) {
          const p = [b, b + 4].find((q) => !dotAt(b * 4, q));
          if (p != null) S.dots.push({ u: pb.u, t: b * 4, p });
        }
        save();
        say('music chopped in eight: its slices go from the middle out. Move the dots to rearrange it');
        if (!isPlaying()) start();
      } else {
        hear(pb.u);
        say('made by ElevenLabs: tap the circle to place it');
      }
    }
  } catch (err) {
    say(err.message, true, 7000);
  }
  pending = null;
});

async function recordMic() {
  if (pending) return;
  if (S.pal.length >= MAXPAL) { say('eight sounds is the most: hold a pebble to let one go', true); return; }
  ensure();
  micSession(true);
  pending = { t0: performance.now(), mic: true };
  say('listening for a second… make a sound', false, 4000);
  try {
    const src = await fromMic(1200, () => { micT0 = performance.now(); });
    remember();
    const pb = addPebble(src);
    if (await loadVoice(pb)) { hear(pb.u); say('your sound: tap the circle to place it, it plays at every pitch'); }
  } catch (err) {
    say(err.message, true, 5000);
  }
  micT0 = 0;
  micSession(false);
  pending = null;
}

/* ---------- the controls ---------- */
function roll(u) {
  const pb = pebble(u);
  if (!pb) return;
  const def = defOf(pb.src);
  S.dots = S.dots.filter((x) => x.u !== u);
  const free = (t, p) => !dotAt(t, p);
  const put = (t, p) => { if (free(t, p)) S.dots.push({ u, t, p }); };
  const r = Math.random;
  if (def.role === 'drum') {
    const lane = { kick: 0, snare: 3, hat: 7, clap: 4 }[def.name] ?? homeLane(u);
    const grids = {
      kick: [[0, 10], [0, 7, 10], [0, 3, 8, 11], [0, 6, 8, 14]],
      snare: [[4, 12], [4, 12, 15], [4, 11, 12]],
      hat: [[2, 6, 10, 14], [0, 2, 4, 6, 8, 10, 12, 14], [2, 5, 6, 10, 13, 14]],
      clap: [[4, 12], [12], [4, 7, 12]],
    }[def.name] || [[0, 4, 8, 12]];
    grids[Math.floor(r() * grids.length)].forEach((t) => put(t, lane + (r() < 0.12 ? 1 : 0)));
  } else if (def.role === 'chop') {
    const order = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => r() - 0.5);
    for (let t = 0, k = 0; t < STEPS; t += 2) if (t % 4 === 0 || r() < 0.4) put(t, order[k++ % 8]);
  } else {
    const [lo, hi] = def.hits;
    const n = lo + Math.floor(r() * (hi - lo + 1));
    const weight = (t) => (t % 4 === 0 ? 3 : t % 2 === 0 ? 1.6 : 0.8) + r() * 1.5;
    const ts = Array.from({ length: STEPS }, (_, t) => [weight(t), t]).sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]).sort((a, b) => a - b);
    let p = def.role === 'bass' ? 2 : homeLane(u) + 1;
    ts.forEach((t) => {
      p = Math.max(0, Math.min(def.role === 'bass' ? 4 : LANES - 1, p + Math.round((r() - 0.5) * 3.2)));
      put(t, p);
    });
  }
}

const actions = {
  undo() { if (undo()) { syncVoices(); say('undone'); } else say('nothing to undo'); },
  mood() {
    S.mood = (S.mood + 1) % MOODS.length;
    save();
    say(`mood: ${MOODS[S.mood].name}. Every dot keeps its place and finds the new scale`);
    if (!isPlaying()) {
      const u = S.sel;
      [0, 2, 4, 7].forEach((p, i) => setTimeout(() => hear(u, Math.min(LANES - 1, homeLane(u) + i)), i * 110));
    }
  },
  dice() {
    if (!pebble(S.sel)) return;
    remember();
    roll(S.sel);
    save();
    say(`a new line for ${nameOf(pebble(S.sel))}`);
    if (!isPlaying()) start();
  },
  clear() {
    remember();
    const mine = S.dots.filter((x) => x.u === S.sel).length;
    if (mine) { S.dots = S.dots.filter((x) => x.u !== S.sel); say(`${nameOf(pebble(S.sel))} cleared · again clears everything`); } else { S.dots = []; say('the circle is empty'); }
    save();
  },
  async save() {
    say('rendering one turn…', false, 10000);
    try {
      const blob = await renderLoop();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `halo-${S.bpm}bpm.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      say('one turn saved as a wav: it loops seamlessly');
    } catch (e) { say(`could not render: ${e.message}`, true); }
  },
  words() { openWords(); },
  mic() { recordMic(); },
};

/* ---------- touch ---------- */
const touches = new Map();
const HOLD_MS = 650;

function placeAt(t, p, u = S.sel) {
  if (!pebble(u) || dotAt(t, p)) return false;
  S.dots.push({ u, t, p });
  hear(u, p);
  save();
  return true;
}

cv.addEventListener('pointerdown', (e) => {
  ensure();
  if (!form.hidden) { form.hidden = true; wtext.blur(); return; }
  try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
  const x = e.clientX;
  const y = e.clientY;
  const h = hitTest(x, y);
  if (!h) return;
  const base = { x0: x, y0: y, x, y, moved: false, t0: performance.now() };
  if (h.type === 'ctl') touches.set(e.pointerId, { ...base, kind: 'ctl', id: h.id });
  else if (h.type === 'centre') touches.set(e.pointerId, { ...base, kind: 'centre', bpm0: S.bpm });
  else if (h.type === 'pebble') {
    S.sel = h.u;
    save();
    hear(h.u);
    touches.set(e.pointerId, { ...base, kind: 'pebble', u: h.u });
  } else if (h.type === 'cell') {
    const d = dotAt(h.t, h.p);
    remember();
    if (d) {
      touches.set(e.pointerId, { ...base, kind: 'grab', dot: d, from: { t: d.t, p: d.p } });
      hear(d.u, d.p);
    } else {
      placeAt(h.t, h.p);
      touches.set(e.pointerId, { ...base, kind: 'paint', last: `${h.t},${h.p}` });
    }
  }
});

cv.addEventListener('pointermove', (e) => {
  const tc = touches.get(e.pointerId);
  if (!tc) return;
  tc.x = e.clientX;
  tc.y = e.clientY;
  if (Math.hypot(tc.x - tc.x0, tc.y - tc.y0) > 8) tc.moved = true;
  if (tc.kind === 'centre' && tc.moved) {
    S.bpm = Math.max(50, Math.min(200, Math.round(tc.bpm0 + (tc.y0 - tc.y) / 2)));
    save();
  } else if (tc.kind === 'paint') {
    const c = cellAt(tc.x, tc.y);
    if (c && `${c.t},${c.p}` !== tc.last) { tc.last = `${c.t},${c.p}`; placeAt(c.t, c.p); }
  } else if (tc.kind === 'grab' && tc.moved) {
    const c = cellAt(tc.x, tc.y);
    if (c && (c.t !== tc.dot.t || c.p !== tc.dot.p) && !dotAt(c.t, c.p)) {
      tc.dot.t = c.t;
      tc.dot.p = c.p;
      hear(tc.dot.u, c.p);
      save();
    }
  }
});

function release(e) {
  const tc = touches.get(e.pointerId);
  touches.delete(e.pointerId);
  if (!tc) return;
  const h = hitTest(tc.x, tc.y);
  if (tc.kind === 'centre') {
    if (!tc.moved && h?.type === 'centre') { if (isPlaying()) stop(); else start(); }
  } else if (tc.kind === 'ctl') {
    if (h?.type === 'ctl' && h.id === tc.id) actions[tc.id]();
  } else if (tc.kind === 'grab') {
    const { d } = polar(tc.x, tc.y);
    if (!tc.moved || d > 1.12) {
      S.dots = S.dots.filter((x) => x !== tc.dot); // a tap lifts it; a flick off the edge throws it away
      save();
    }
  } else if (tc.kind === 'pebble') {
    if (tc.held) return;
    if (tc.moved) {
      const c = cellAt(tc.x, tc.y);
      if (c) { remember(); placeAt(c.t, c.p, tc.u); }
    }
  }
}
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', (e) => { touches.delete(e.pointerId); });

/* hold a pebble to let it go */
setInterval(() => {
  const now = performance.now();
  touches.forEach((tc) => {
    if (tc.kind === 'pebble' && !tc.moved && !tc.held && now - tc.t0 > HOLD_MS) {
      tc.held = true;
      removePebble(tc.u);
    }
  });
}, 50);

/* keys: a s d f g h j k play the chosen sound low to high; while it turns,
   what you play lands on the nearest step. Space plays, z undoes. */
const KEYS = 'asdfghjk';
document.addEventListener('keydown', (e) => {
  if (e.target === wtext || e.repeat) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); actions.undo(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const p = KEYS.indexOf(e.key.toLowerCase());
  if (p >= 0) {
    e.preventDefault();
    hear(S.sel, p);
    if (isPlaying()) {
      const t = Math.round(position()) % STEPS;
      const d = dotAt(t, p);
      if (!d) { remember(); S.dots.push({ u: S.sel, t, p }); save(); }
    }
  } else if (e.key === ' ') { e.preventDefault(); if (isPlaying()) stop(); else start(); } else if (e.key.toLowerCase() === 'z') actions.undo();
});

/* ---------- drawing ---------- */
const col = (hue, l = 60, a = 1) => `hsla(${hue}, 62%, ${l}%, ${a})`;

function ring(r, color, w = 1) {
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.strokeStyle = color;
  g.lineWidth = w;
  g.stroke();
}

function icon(id, x, y, r) {
  g.save();
  g.translate(x, y);
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineWidth = Math.max(1.5, r * 0.09);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const u = r * 0.5;
  const dot = (px, py, pr) => { g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill(); };
  if (id === 'undo') {
    g.beginPath(); g.arc(0, u * 0.15, u * 0.75, Math.PI * 1.1, Math.PI * 2.25); g.stroke();
    const a = Math.PI * 1.1;
    const px = Math.cos(a) * u * 0.75;
    const py = Math.sin(a) * u * 0.75 + u * 0.15;
    g.beginPath(); g.moveTo(px - u * 0.1, py - u * 0.5); g.lineTo(px, py); g.lineTo(px + u * 0.48, py - u * 0.12); g.stroke();
  } else if (id === 'dice') {
    [[-0.5, -0.5], [0.5, -0.5], [0, 0], [-0.5, 0.5], [0.5, 0.5]].forEach(([a, b]) => dot(a * u * 1.1, b * u * 1.1, r * 0.08));
  } else if (id === 'clear') {
    g.beginPath(); g.moveTo(-u * 0.7, -u * 0.7); g.lineTo(u * 0.7, u * 0.7); g.moveTo(u * 0.7, -u * 0.7); g.lineTo(-u * 0.7, u * 0.7); g.stroke();
  } else if (id === 'save') {
    g.beginPath(); g.moveTo(0, -u); g.lineTo(0, u * 0.45); g.moveTo(-u * 0.55, -u * 0.1); g.lineTo(0, u * 0.45); g.lineTo(u * 0.55, -u * 0.1); g.stroke();
    g.beginPath(); g.moveTo(-u * 0.75, u * 0.95); g.lineTo(u * 0.75, u * 0.95); g.stroke();
  } else if (id === 'words') {
    dot(0, 0, r * 0.09);
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8;
      const r0 = 0.32;
      const r1 = i % 2 ? 0.5 : 0.7;
      g.beginPath(); g.moveTo(Math.cos(a) * r * r0, Math.sin(a) * r * r0); g.lineTo(Math.cos(a) * r * r1, Math.sin(a) * r * r1); g.stroke();
    }
  } else if (id === 'mic') {
    g.fillStyle = BAD;
    dot(0, 0, u * 0.5);
    g.beginPath(); g.arc(0, 0, u * 0.95, 0, TAU); g.stroke();
  }
  g.restore();
}

function text(s, x, y, size, color, weight = 600) {
  g.fillStyle = color;
  g.font = `${weight} ${Math.round(size)}px ui-monospace, Menlo, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(s, x, y + 1);
}

function drawControls(now) {
  for (const b of ctl) {
    let lit = false;
    if (b.id === 'words') lit = !form.hidden || (pending && !pending.mic);
    if (b.id === 'mic') lit = !!(pending && pending.mic);
    g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU);
    g.fillStyle = PANEL; g.fill();
    g.lineWidth = 1.5; g.strokeStyle = lit ? HOT : DIM; g.stroke();
    if (b.id === 'mood') text(MOODS[S.mood].name, b.x, b.y, b.r * 0.56, INK);
    else icon(b.id, b.x, b.y, b.r);
    if (b.id === 'mic' && micT0) {
      const f = Math.min(1, (now - micT0) / 1200);
      g.strokeStyle = BAD; g.lineWidth = 3;
      g.beginPath(); g.arc(b.x, b.y, b.r + 4, -Math.PI / 2, -Math.PI / 2 + f * TAU); g.stroke();
    }
  }
}

function drawPebbles(now) {
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const pb = S.pal[i];
    if (!pb) {
      if (pending && i === S.pal.length) {
        const k = 0.5 + 0.5 * Math.sin((now - pending.t0) / 180);
        g.beginPath(); g.arc(s.x, s.y, s.r * (0.55 + 0.25 * k), 0, TAU);
        g.strokeStyle = HOT; g.lineWidth = 2; g.stroke();
      } else {
        g.beginPath(); g.arc(s.x, s.y, s.r * 0.35, 0, TAU);
        g.strokeStyle = '#262b1e'; g.lineWidth = 1; g.stroke();
      }
      continue;
    }
    const sel = pb.u === S.sel;
    const def = defOf(pb.src);
    const r = s.r * (sel ? 1.08 : 0.9);
    g.beginPath(); g.arc(s.x, s.y, r, 0, TAU);
    g.fillStyle = col(pb.hue, sel ? 58 : 42, sel ? 1 : 0.85); g.fill();
    if (sel) { g.lineWidth = 2.5; g.strokeStyle = HOT; g.beginPath(); g.arc(s.x, s.y, r + 4, 0, TAU); g.stroke(); }
    if (def.role === 'chop') { // eight slices
      g.strokeStyle = 'rgba(13,15,10,0.7)'; g.lineWidth = 1.5;
      for (let k = 0; k < 8; k++) {
        const a = (k * TAU) / 8;
        g.beginPath(); g.moveTo(s.x + Math.cos(a) * r * 0.72, s.y + Math.sin(a) * r * 0.72); g.lineTo(s.x + Math.cos(a) * r * 0.96, s.y + Math.sin(a) * r * 0.96); g.stroke();
      }
    }
    text(tagOf(pb), s.x, s.y, r * 0.72, '#0d0f0a', 700);
    /* holding: a ring fills, then it goes */
    touches.forEach((tc) => {
      if (tc.kind === 'pebble' && tc.u === pb.u && !tc.moved && !tc.held) {
        const f = Math.min(1, (now - tc.t0) / HOLD_MS);
        if (f > 0.25) {
          g.strokeStyle = BAD; g.lineWidth = 3;
          g.beginPath(); g.arc(s.x, s.y, r + 4, -Math.PI / 2, -Math.PI / 2 + f * TAU); g.stroke();
        }
      }
    });
  }
}

function frame(ms) {
  const now = performance.now();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = BG;
  g.fillRect(0, 0, W, H);

  const playing = isPlaying();
  const pos = playing ? position() : null;
  const beat = pos != null ? (pos / 4) % 1 : 0.5;
  const pulse = playing ? Math.exp(-6 * beat) : 0;

  /* what just sounded */
  if (pos != null) {
    const cur = Math.floor(pos) % STEPS;
    if (cur !== lastStep) {
      lastStep = cur;
      for (const d of S.dots) if (d.t === cur) flash.set(`${d.t},${d.p}`, now);
    }
  } else lastStep = -1;

  /* the plate */
  g.beginPath(); g.arc(cx, cy, R * 1.02, 0, TAU);
  g.fillStyle = '#12150e'; g.fill();
  ring(R * 1.02, `rgba(122,132,104,${0.35 + 0.45 * pulse})`, 1.5);

  /* lanes: the home lane (the sound's own pitch) a little brighter */
  const selPb = pebble(S.sel);
  const home = selPb ? homeLane(S.sel) : -1;
  for (let k = 0; k <= LANES; k++) ring(laneR(k) * R, 'rgba(122,132,104,0.16)', 1);
  if (home >= 0) {
    g.beginPath();
    g.arc(cx, cy, laneR(home + 1) * R, 0, TAU);
    g.arc(cx, cy, laneR(home) * R, TAU, 0, true);
    g.fillStyle = selPb ? col(selPb.hue, 50, 0.07) : 'transparent';
    g.fill();
  }
  /* spokes: the beats brighter */
  for (let t = 0; t < STEPS; t++) {
    const a = -Math.PI / 2 + (t * TAU) / STEPS;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * R0 * R, cy + Math.sin(a) * R0 * R);
    g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    g.strokeStyle = t % 4 === 0 ? 'rgba(216,224,200,0.2)' : 'rgba(122,132,104,0.1)';
    g.lineWidth = 1;
    g.stroke();
  }

  /* the arm and its wake */
  const armA = -Math.PI / 2 + ((pos ?? 0) / STEPS) * TAU;
  if (playing) {
    for (let j = 0; j < 18; j++) {
      const a1 = armA - j * 0.03;
      g.beginPath();
      g.arc(cx, cy, R, a1 - 0.032, a1);
      g.arc(cx, cy, R0 * R, a1, a1 - 0.032, true);
      g.closePath();
      g.fillStyle = `rgba(232,185,60,${0.1 * (1 - j / 18)})`;
      g.fill();
    }
  }

  /* the dots */
  for (const d of S.dots) {
    const pb = pebble(d.u);
    if (!pb) continue;
    const { x, y, r: rr } = cellXY(d.t, d.p);
    const laneW = (laneR(d.p + 1) - laneR(d.p)) * R;
    const arc = (rr * TAU) / STEPS;
    const base = Math.min(laneW, arc) * 0.46;
    const age = (now - (flash.get(`${d.t},${d.p}`) ?? -1e9)) / 1000;
    const hit = age < 0.35 ? 1 - age / 0.35 : 0;
    const sel = d.u === S.sel;
    if (hit > 0) { // a ripple
      g.beginPath(); g.arc(x, y, base * (1.2 + 2.2 * (1 - hit)), 0, TAU);
      g.strokeStyle = col(pb.hue, 70, 0.6 * hit); g.lineWidth = 1.5; g.stroke();
    }
    g.beginPath(); g.arc(x, y, base * (1 + 0.45 * hit), 0, TAU);
    g.fillStyle = col(pb.hue, 55 + 25 * hit, sel ? 1 : 0.62);
    g.fill();
    if (defOf(pb.src).role === 'chop') text(String(d.p + 1), x, y, base * 1.1, '#0d0f0a', 700);
  }

  /* the arm itself */
  g.strokeStyle = playing ? HOT : 'rgba(232,185,60,0.35)';
  g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx + Math.cos(armA) * R0 * R, cy + Math.sin(armA) * R0 * R);
  g.lineTo(cx + Math.cos(armA) * R * 1.04, cy + Math.sin(armA) * R * 1.04);
  g.stroke();
  g.fillStyle = HOT;
  g.beginPath(); g.arc(cx + Math.cos(armA) * R * 1.04, cy + Math.sin(armA) * R * 1.04, 3.5 + 3 * pulse, 0, TAU); g.fill();

  /* the middle: play, and the tempo (drag it up or down) */
  const pr = (R0 - 0.03) * R;
  g.beginPath(); g.arc(cx, cy, pr * (1 + 0.05 * pulse), 0, TAU);
  g.fillStyle = playing ? HOT : PANEL; g.fill();
  g.lineWidth = 2; g.strokeStyle = playing ? HOT : DIM; g.stroke();
  const ink = playing ? PANEL : INK;
  g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 3; g.lineJoin = 'round';
  const s = pr * 0.32;
  const gy = cy - pr * 0.16;
  if (playing) {
    g.fillRect(cx - s * 0.75, gy - s, s * 0.5, s * 2);
    g.fillRect(cx + s * 0.25, gy - s, s * 0.5, s * 2);
  } else {
    g.beginPath(); g.moveTo(cx - s * 0.6, gy - s); g.lineTo(cx + s, gy); g.lineTo(cx - s * 0.6, gy + s); g.closePath(); g.fill();
  }
  text(`${S.bpm}`, cx, cy + pr * 0.52, pr * 0.3, ink, 600);

  /* a pebble being carried */
  touches.forEach((tc) => {
    if (tc.kind === 'pebble' && tc.moved && !tc.held) {
      const pb = pebble(tc.u);
      if (pb) { g.beginPath(); g.arc(tc.x, tc.y, 14, 0, TAU); g.fillStyle = col(pb.hue, 60, 0.85); g.fill(); }
    }
  });

  drawControls(now);
  drawPebbles(now);
  requestAnimationFrame(frame);
}

/* ---------- go ---------- */
window.addEventListener('resize', layout);
layout();
ensure();
S.pal.forEach((pb) => loadVoice(pb));
say('tap the middle · tap the circle · tap a pebble', false, 7000);
requestAnimationFrame(frame);
