/* interface13 — a mycelium chronometer.

   A mushroom cap seen from underneath, turned like a clock. Time goes round
   its sixteen gills; pitch grows out from the middle in rings. Each sound is a
   mushroom: tap the cap and the chosen one fruits there as a small body that
   glows when it sounds and sheds spores. Under the cap, threads of mycelium
   carry your ideas up from the bottom row: describe a sound (or a piece of
   music, which gets chopped in eight) or sing into the microphone, and it
   takes root as a new mushroom you can move, bend, tune and chop. The brass
   heart in the middle is the one tempo everything keeps. */
import {
  S, STEPS, LANES, MOODS, load, save, remember, undo, dotAt, pebble, nextU, hueFor,
} from './state.js';
import {
  ensure, getPlayer, start, stop, isPlaying, position, renderLoop, micSession, defaultFx, toneHz,
} from './audio.js';
import {
  KIT, defOf, bufferFor, fromWords, fromMic, looksLikeMusic, asksForVoice,
} from './sounds.js';

const TAU = Math.PI * 2;
const BG = '#0a0806';
const INK = '#e7dcc3'; // bone
const DIM = '#8a7a5c'; // old brass
const HOT = '#d9a441'; // brass
const PANEL = '#15100b';
const BAD = '#d1583f'; // rust
const FOX = '#8dffb8'; // foxfire
const MAXPAL = 8;
const R0 = 0.22; // where the lanes begin (fraction of the radius)
const OUT = 0.9; // where they end: beyond is the engraved rim
const laneR = (k) => R0 + (OUT - R0) * (Math.max(0, k) / LANES) ** 0.8; // inner lanes a little wider
const laneMid = (f) => (laneR(f) + laneR(f + 1)) / 2;
/* a distance from the middle -> a lane in between (0 .. LANES-1) */
function fracAt(d) {
  if (d <= laneMid(0)) return 0;
  if (d >= laneMid(LANES - 1)) return LANES - 1;
  let lo = 0;
  let hi = LANES - 1;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (laneMid(m) < d) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const DIALS = [['pitch', 'pitch'], ['tone', 'tone'], ['dec', 'decay'], ['grit', 'grit'], ['room', 'room'], ['pan', 'pan'], ['lvl', 'level']];
const PANH = 92;
let panelOpen = false;
let dials = []; // the DSP petals, when the panel is open
let lastDial = { key: '', t: 0 };

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
let slots = []; // flower positions
const flash = new Map(); // "t,p" -> when it last sounded
const flashU = new Map(); // sound -> when it last sounded
const bornAt = new Map(); // sound -> when it took root
const spores = [];
let bgCv = null;
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
const CTL = ['undo', 'mood', 'dice', 'clear', 'save', 'words', 'mic', 'tune', 'snap'];

function layout() {
  dpr = Math.min(3, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const land = W > H * 1.15;
  const extra = panelOpen ? PANH : 0;
  ctl = [];
  slots = [];
  dials = [];
  let panelTop = 0;
  let px0 = 0;
  let px1 = W;
  if (!land) {
    const top = 80;
    const bot = 84;
    R = Math.min(W / 2 - 8, (H - top - bot - extra) / 2 - 6);
    cx = W / 2;
    cy = top + (H - top - bot - extra) / 2;
    panelTop = H - bot - extra;
    const cr = Math.min(21, W / CTL.length / 2 - 3);
    CTL.forEach((id, i) => ctl.push({ id, x: (W * (i + 0.5)) / CTL.length, y: 50, r: cr }));
    const pr = Math.min(22, W / MAXPAL / 2 - 4);
    for (let i = 0; i < MAXPAL; i++) slots.push({ x: (W * (i + 0.5)) / MAXPAL, y: H - bot / 2 - 4, r: pr });
  } else {
    R = Math.min((H - extra) / 2 - 8, (W - 200) / 2);
    cx = W / 2;
    cy = (H - extra) / 2;
    panelTop = H - extra;
    px0 = 90;
    px1 = W - 90;
    const cr = Math.min(21, H / CTL.length / 2 - 3);
    CTL.forEach((id, i) => ctl.push({ id, x: 42, y: (H * (i + 0.5)) / CTL.length, r: cr }));
    const pr = Math.min(20, H / MAXPAL / 2 - 6);
    for (let i = 0; i < MAXPAL; i++) slots.push({ x: W - 42, y: (H * (i + 0.5)) / MAXPAL, r: pr });
  }
  if (panelOpen) {
    const w = (px1 - px0) / DIALS.length;
    DIALS.forEach(([key, label], i) => dials.push({ key, label, x: px0 + w * (i + 0.5), y: panelTop + PANH / 2, w, top: panelTop, x0: px0, x1: px1 }));
  }
  buildBg();
}

/* ---------- what is under a finger ---------- */
function polar(x, y) {
  const dx = x - cx;
  const dy = y - cy;
  return { d: Math.hypot(dx, dy) / R, a: (Math.atan2(dx, -dy) + TAU) % TAU };
}

function cellAt(x, y) {
  const { d, a } = polar(x, y);
  if (d < R0 || d > OUT + 0.04) return null;
  let p = LANES - 1;
  for (let k = 1; k <= LANES; k++) if (d < laneR(k)) { p = k - 1; break; }
  return { t: Math.floor(a / (TAU / STEPS)) % STEPS, p };
}

function hitTest(x, y) {
  for (const b of ctl) if (Math.hypot(x - b.x, y - b.y) <= b.r + 5) return { type: 'ctl', id: b.id };
  for (const dl of dials) if (Math.abs(x - dl.x) <= dl.w / 2 && y >= dl.top && y <= dl.top + PANH) return { type: 'dial', key: dl.key };
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
function cellXY(t, p, f = p) {
  const a = -Math.PI / 2 + ((t + 0.5) * TAU) / STEPS;
  const r = laneMid(f) * R;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, r, a };
}

/* ---------- the sounds ---------- */
const homeLane = (u) => {
  const pb = pebble(u);
  if (pb && defOf(pb.src).role === 'chop') return 0;
  return Math.max(0, MOODS[S.mood].set.indexOf(0));
};

function hear(u, p = homeLane(u), f = p) {
  ensure();
  getPlayer().note(u, p, 0, 1, f);
}

/* a sound's dials */
const fxOf = (pb) => {
  pb.fx = { ...defaultFx(defOf(pb.src)), ...(pb.fx || {}) };
  return pb.fx;
};
function applyFx(pb) { getPlayer().tune(pb.u, fxOf(pb)); save(); }

async function loadVoice(pb) {
  try {
    const buf = await bufferFor(pb.src);
    getPlayer().set(pb.u, buf, defOf(pb.src), fxOf(pb));
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
  bornAt.set(pb.u, performance.now());
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
  say(`${nameOf(pb)} returned to the soil · undo brings it back`);
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
    ? 'plant a song: "dusty soul drums", "glassy marimba riff"…'
    : 'plant a sound: "a wet glass tap", "a frog in a bucket"…';
}

function openWords() {
  if (S.pal.length >= MAXPAL) { say('eight mushrooms is the most: hold one to return it to the soil', true); return; }
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
    ? `growing “${words}”${asksForVoice(words) ? ' (with a voice, as asked)' : ' (instrumental)'} at ${S.bpm} bpm…`
    : `growing “${words}”…`, false, 120000);
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
        say('music chopped in eight: its slices go from the middle out. Move the mushrooms to rearrange it');
        if (!isPlaying()) start();
      } else {
        hear(pb.u);
        say('your idea has taken root: tap the cap to fruit it');
      }
    }
  } catch (err) {
    say(err.message, true, 7000);
  }
  pending = null;
});

async function recordMic() {
  if (pending) return;
  if (S.pal.length >= MAXPAL) { say('eight mushrooms is the most: hold one to return it to the soil', true); return; }
  ensure();
  micSession(true);
  pending = { t0: performance.now(), mic: true };
  say('listening for a second… make a sound', false, 4000);
  try {
    const src = await fromMic(1200, () => { micT0 = performance.now(); });
    remember();
    const pb = addPebble(src);
    if (await loadVoice(pb)) { hear(pb.u); say('your sound has taken root: tap the cap to fruit it, it plays at every pitch'); }
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
    say(`a new scatter of spores for ${nameOf(pebble(S.sel))}`);
    if (!isPlaying()) start();
  },
  clear() {
    remember();
    const mine = S.dots.filter((x) => x.u === S.sel).length;
    if (mine) { S.dots = S.dots.filter((x) => x.u !== S.sel); say(`${nameOf(pebble(S.sel))} cleared · again clears everything`); } else { S.dots = []; say('the cap is bare'); }
    save();
  },
  async save() {
    say('rendering one turn…', false, 10000);
    try {
      const blob = await renderLoop();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `interface13-${S.bpm}bpm.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      say('one turn saved as a wav: it loops seamlessly');
    } catch (e) { say(`could not render: ${e.message}`, true); }
  },
  words() { openWords(); },
  mic() { recordMic(); },
  tune() {
    panelOpen = !panelOpen;
    layout();
    if (panelOpen) say('the mushrooms below tune the chosen sound: drag one up or down, tap twice to reset', false, 5000);
  },
  snap() {
    remember();
    S.snap = !S.snap;
    if (S.snap) S.dots.forEach((d) => { if (d.f != null) delete d.f; });
    save();
    say(S.snap ? 'pitch snaps to the mood: every mushroom stays in key' : 'pitch is free: drag a mushroom in or out to bend it');
  },
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
  else if (h.type === 'dial') {
    const pb = pebble(S.sel);
    if (!pb) return;
    const now = performance.now();
    remember();
    if (lastDial.key === h.key && now - lastDial.t < 350) { // twice: back to how it began
      fxOf(pb)[h.key] = defaultFx(defOf(pb.src))[h.key];
      applyFx(pb);
      hear(pb.u);
      lastDial = { key: '', t: 0 };
    } else lastDial = { key: h.key, t: now };
    touches.set(e.pointerId, { ...base, kind: 'dial', key: h.key, u: pb.u, v0: fxOf(pb)[h.key], lastHear: 0 });
  } else if (h.type === 'centre') touches.set(e.pointerId, { ...base, kind: 'centre', bpm0: S.bpm });
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
  } else if (tc.kind === 'dial' && tc.moved) {
    const pb = pebble(tc.u);
    if (!pb) return;
    let v = Math.max(0, Math.min(1, tc.v0 + (tc.y0 - tc.y) / 130));
    if ((tc.key === 'pitch' || tc.key === 'pan') && Math.abs(v - 0.5) < 0.03) v = 0.5;
    fxOf(pb)[tc.key] = v;
    applyFx(pb);
    const now = performance.now();
    if (now - tc.lastHear > 170) { tc.lastHear = now; hear(pb.u); }
  } else if (tc.kind === 'grab' && tc.moved) {
    /* time snaps to the step; pitch follows the finger in and out */
    const { d, a } = polar(tc.x, tc.y);
    if (d < R0 || d > OUT + 0.04) return;
    const t = Math.floor(a / (TAU / STEPS)) % STEPS;
    const chop = defOf(pebble(tc.dot.u).src).role === 'chop';
    let f = fracAt(d);
    if (S.snap || chop) f = Math.round(f);
    const p = Math.round(f);
    if (S.dots.find((x) => x !== tc.dot && x.t === t && x.p === p)) return;
    if (t !== tc.dot.t || Math.abs(f - (tc.dot.f ?? tc.dot.p)) > 0.02) {
      tc.dot.t = t;
      tc.dot.p = p;
      if (Number.isInteger(f)) delete tc.dot.f; else tc.dot.f = f;
      const now = performance.now();
      if (now - (tc.lastHear || 0) > 90) { tc.lastHear = now; hear(tc.dot.u, p, f); }
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
const col = (hue, l = 55, a = 1) => `hsla(${hue}, 46%, ${l}%, ${a})`;
const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
const STEM = '#d8c9a8';

function ring(r, color, w = 1) {
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.strokeStyle = color;
  g.lineWidth = w;
  g.stroke();
}

function text(s, x, y, size, color, weight = 600, font = SERIF) {
  g.fillStyle = color;
  g.font = `${weight} ${Math.round(size)}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(s, x, y + 1);
}

/* a mushroom. (x, y) is its middle; ang is the way its cap faces (out from
   the middle of the cap, or up for the ones in the row). h tall, w wide. */
function mush(x, y, ang, h, w, cap, o = {}) {
  const { glow = 0, sel = false, spots = 3, outline = null, alpha = 1 } = o;
  g.save();
  g.translate(x, y);
  g.rotate(ang + Math.PI / 2);
  g.globalAlpha = alpha;
  if (glow > 0) { g.shadowColor = FOX; g.shadowBlur = 4 + 16 * glow; }
  /* the stem */
  g.beginPath();
  g.moveTo(-w * 0.12, h * 0.48);
  g.quadraticCurveTo(-w * 0.16, h * 0.2, -w * 0.09, -h * 0.02);
  g.lineTo(w * 0.09, -h * 0.02);
  g.quadraticCurveTo(w * 0.16, h * 0.2, w * 0.12, h * 0.48);
  g.closePath();
  if (outline) { g.strokeStyle = outline; g.lineWidth = 1; g.stroke(); } else { g.fillStyle = STEM; g.fill(); }
  /* the cap */
  g.beginPath();
  g.moveTo(-w / 2, 0);
  g.bezierCurveTo(-w / 2, -h * 0.66, w / 2, -h * 0.66, w / 2, 0);
  g.quadraticCurveTo(0, -h * 0.14, -w / 2, 0);
  g.closePath();
  if (outline) { g.strokeStyle = outline; g.lineWidth = 1; g.stroke(); } else {
    g.fillStyle = cap; g.fill();
    g.shadowBlur = 0;
    /* gills under the rim */
    g.strokeStyle = 'rgba(10,8,6,0.45)'; g.lineWidth = Math.max(0.8, w * 0.03);
    g.beginPath(); g.moveTo(-w * 0.46, -h * 0.01); g.quadraticCurveTo(0, -h * 0.15, w * 0.46, -h * 0.01); g.stroke();
    if (sel) { g.strokeStyle = HOT; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-w / 2, 0); g.bezierCurveTo(-w / 2, -h * 0.66, w / 2, -h * 0.66, w / 2, 0); g.stroke(); }
    /* spots */
    g.fillStyle = 'rgba(240,230,205,0.7)';
    const sp = [[-0.22, -0.27, 0.06], [0.16, -0.33, 0.05], [0.04, -0.2, 0.035], [-0.05, -0.38, 0.04], [0.3, -0.16, 0.035], [-0.34, -0.12, 0.03], [0.22, -0.24, 0.03], [-0.14, -0.43, 0.03]];
    for (let i = 0; i < Math.min(spots, sp.length); i++) {
      g.beginPath(); g.arc(sp[i][0] * w, sp[i][1] * h, Math.max(0.8, sp[i][2] * w), 0, TAU); g.fill();
    }
  }
  g.restore();
}

/* the plate, drawn once a layout: a cap seen from underneath, with brass round it */
function buildBg() {
  bgCv = bgCv || document.createElement('canvas');
  bgCv.width = Math.round(W * dpr);
  bgCv.height = Math.round(H * dpr);
  const b = bgCv.getContext('2d');
  b.setTransform(dpr, 0, 0, dpr, 0, 0);
  const vg = b.createRadialGradient(cx, cy, R * 0.2, cx, cy, Math.max(W, H));
  vg.addColorStop(0, '#16110b'); vg.addColorStop(1, BG);
  b.fillStyle = vg; b.fillRect(0, 0, W, H);
  let seed = 11;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 900; i++) { // soil
    b.fillStyle = `rgba(231,220,195,${0.015 + rnd() * 0.03})`;
    b.fillRect(rnd() * W, rnd() * H, 1, 1);
  }
  /* brass rim */
  const br = b.createRadialGradient(cx, cy, R * OUT, cx, cy, R);
  br.addColorStop(0, '#3a2b16'); br.addColorStop(0.5, '#5a4423'); br.addColorStop(1, '#2a1f10');
  b.beginPath(); b.arc(cx, cy, R, 0, TAU); b.fillStyle = br; b.fill();
  /* the underside of the cap */
  const cg = b.createRadialGradient(cx, cy, R * R0, cx, cy, R * OUT);
  cg.addColorStop(0, '#2b2015'); cg.addColorStop(1, '#17110b');
  b.beginPath(); b.arc(cx, cy, R * OUT, 0, TAU); b.fillStyle = cg; b.fill();
  /* gills: six to a step, the step edges plainer */
  const N = STEPS * 6;
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i * TAU) / N;
    const edge = i % 6 === 0;
    const beat = i % 24 === 0;
    const r0 = R * (edge ? R0 : R0 + 0.06 + (i % 3 ? 0.08 : 0));
    const r1 = R * OUT;
    const bend = 0.05;
    b.beginPath();
    b.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    b.quadraticCurveTo(cx + Math.cos(a + bend) * (r0 + r1) / 2, cy + Math.sin(a + bend) * (r0 + r1) / 2, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    b.strokeStyle = beat ? 'rgba(217,164,65,0.28)' : edge ? 'rgba(231,220,195,0.13)' : 'rgba(231,220,195,0.045)';
    b.lineWidth = beat ? 1.3 : 1;
    b.stroke();
  }
  /* growth rings: the pitches */
  for (let k = 0; k <= LANES; k++) {
    b.beginPath(); b.arc(cx, cy, laneR(k) * R, 0, TAU);
    b.strokeStyle = k === LANES ? 'rgba(217,164,65,0.5)' : 'rgba(217,164,65,0.07)';
    b.lineWidth = k === LANES ? 1.4 : 1;
    b.stroke();
  }
  /* engravings on the rim: sixty-four ticks, numerals on the beats */
  b.beginPath(); b.arc(cx, cy, R - 1, 0, TAU); b.strokeStyle = 'rgba(217,164,65,0.6)'; b.lineWidth = 1.2; b.stroke();
  const band = R * (1 - OUT);
  for (let i = 0; i < 64; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 64;
    const big = i % 4 === 0;
    const r0 = R * OUT + 1;
    const r1 = r0 + band * (big ? 0.3 : 0.16);
    b.beginPath();
    b.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    b.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    b.strokeStyle = `rgba(231,200,140,${big ? 0.55 : 0.25})`; b.lineWidth = 1; b.stroke();
  }
  const NUM = ['I', 'II', 'III', 'IV'];
  b.fillStyle = 'rgba(240,215,160,0.75)';
  b.font = `600 ${Math.max(8, Math.round(band * 0.42))}px ${SERIF}`;
  b.textAlign = 'center'; b.textBaseline = 'middle';
  for (let t = 0; t < STEPS; t++) {
    const a = -Math.PI / 2 + ((t + 0.5) * TAU) / STEPS;
    const rr = R * OUT + band * 0.62;
    b.save();
    b.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    b.rotate(a + Math.PI / 2);
    if (t % 4 === 0) b.fillText(NUM[t / 4], 0, 0);
    else { b.beginPath(); b.arc(0, 0, Math.max(1, band * 0.06), 0, TAU); b.fill(); }
    b.restore();
  }
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
  } else if (id === 'dice') { // a scatter of spores
    [[-0.55, -0.4, 0.09], [0.45, -0.55, 0.07], [0.05, 0.05, 0.1], [-0.4, 0.55, 0.07], [0.6, 0.4, 0.08], [-0.05, -0.75, 0.05]].forEach(([a, b, s]) => dot(a * u, b * u, r * s));
  } else if (id === 'clear') {
    g.beginPath(); g.moveTo(-u * 0.7, -u * 0.7); g.lineTo(u * 0.7, u * 0.7); g.moveTo(u * 0.7, -u * 0.7); g.lineTo(-u * 0.7, u * 0.7); g.stroke();
  } else if (id === 'save') {
    g.beginPath(); g.moveTo(0, -u); g.lineTo(0, u * 0.45); g.moveTo(-u * 0.55, -u * 0.1); g.lineTo(0, u * 0.45); g.lineTo(u * 0.55, -u * 0.1); g.stroke();
    g.beginPath(); g.moveTo(-u * 0.75, u * 0.95); g.lineTo(u * 0.75, u * 0.95); g.stroke();
  } else if (id === 'words') { // a spiral: an idea grown into a sound
    g.lineWidth = Math.max(1.3, r * 0.08);
    g.beginPath();
    for (let i = 0; i <= 60; i++) {
      const th = i * 0.2;
      const rr = u * 0.08 + u * 0.13 * th;
      const px = Math.cos(th) * rr;
      const py = Math.sin(th) * rr;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.stroke();
  } else if (id === 'tune') { // a little mushroom
    g.beginPath(); g.moveTo(-u * 0.9, 0); g.bezierCurveTo(-u * 0.9, -u * 1.15, u * 0.9, -u * 1.15, u * 0.9, 0); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(-u * 0.22, 0); g.lineTo(-u * 0.28, u * 0.9); g.lineTo(u * 0.28, u * 0.9); g.lineTo(u * 0.22, 0); g.stroke();
  } else if (id === 'snap') {
    g.beginPath();
    if (S.snap) { g.moveTo(-u, u * 0.8); g.lineTo(-u * 0.35, u * 0.8); g.lineTo(-u * 0.35, 0); g.lineTo(u * 0.35, 0); g.lineTo(u * 0.35, -u * 0.8); g.lineTo(u, -u * 0.8); } else {
      g.moveTo(-u, u * 0.6); g.bezierCurveTo(-u * 0.2, u * 0.7, u * 0.2, -u * 0.7, u, -u * 0.6);
    }
    g.stroke();
  } else if (id === 'mic') {
    g.fillStyle = BAD;
    dot(0, 0, u * 0.5);
    g.beginPath(); g.arc(0, 0, u * 0.95, 0, TAU); g.stroke();
  }
  g.restore();
}

/* brass coins */
function drawControls(now) {
  for (const b of ctl) {
    let lit = false;
    if (b.id === 'words') lit = !form.hidden || (pending && !pending.mic);
    if (b.id === 'mic') lit = !!(pending && pending.mic);
    if (b.id === 'tune') lit = panelOpen;
    if (b.id === 'snap') lit = S.snap;
    g.save();
    if (lit) { g.shadowColor = FOX; g.shadowBlur = 12; }
    g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU);
    g.fillStyle = PANEL; g.fill();
    g.lineWidth = 1.5; g.strokeStyle = lit ? HOT : 'rgba(217,164,65,0.45)'; g.stroke();
    g.restore();
    g.beginPath(); g.arc(b.x, b.y, b.r - 3, 0, TAU); g.strokeStyle = 'rgba(217,164,65,0.14)'; g.lineWidth = 1; g.stroke();
    if (b.id === 'mood') text(MOODS[S.mood].name, b.x, b.y, b.r * 0.62, INK, 600);
    else icon(b.id, b.x, b.y, b.r);
    if (b.id === 'mic' && micT0) {
      const f = Math.min(1, (now - micT0) / 1200);
      g.strokeStyle = BAD; g.lineWidth = 3;
      g.beginPath(); g.arc(b.x, b.y, b.r + 4, -Math.PI / 2, -Math.PI / 2 + f * TAU); g.stroke();
    }
  }
}

const ease = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

/* your sounds, as mushrooms in the row */
function drawPebbles(now) {
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const pb = S.pal[i];
    if (!pb) {
      if (pending && i === S.pal.length) { // something is growing
        const k = 0.5 + 0.5 * Math.sin((now - pending.t0) / 220);
        const grow = Math.min(1, (now - pending.t0) / 6000);
        mush(s.x, s.y, -Math.PI / 2, s.r * (0.8 + 0.9 * grow), s.r * (0.8 + 0.9 * grow), null, { outline: `rgba(141,255,184,${0.35 + 0.5 * k})` });
      } else {
        g.fillStyle = 'rgba(138,122,92,0.35)';
        [[-4, 3], [3, 1], [0, -3]].forEach(([a, b]) => { g.beginPath(); g.arc(s.x + a, s.y + b, 1.3, 0, TAU); g.fill(); });
      }
      continue;
    }
    const sel = pb.u === S.sel;
    const def = defOf(pb.src);
    const born = ease((now - (bornAt.get(pb.u) ?? -1e9)) / 900);
    const hitAge = (now - (flashU.get(pb.u) ?? -1e9)) / 1000;
    const hit = hitAge < 0.3 ? 1 - hitAge / 0.3 : 0;
    const r = s.r * (sel ? 1.12 : 0.95) * (0.2 + 0.8 * born) * (1 + 0.08 * hit);
    mush(s.x, s.y, -Math.PI / 2, r * 2, r * 2.1, col(pb.hue, sel ? 52 : 42), {
      sel, glow: Math.max(hit, (1 - born)), spots: def.role === 'chop' ? 8 : 3,
    });
    text(tagOf(pb), s.x, s.y - r * 0.5, r * 0.55, '#120d08', 700);
    touches.forEach((tc) => {
      if (tc.kind === 'pebble' && tc.u === pb.u && !tc.moved && !tc.held) {
        const f = Math.min(1, (now - tc.t0) / HOLD_MS);
        if (f > 0.25) {
          g.strokeStyle = BAD; g.lineWidth = 3;
          g.beginPath(); g.arc(s.x, s.y, s.r * 1.25, -Math.PI / 2, -Math.PI / 2 + f * TAU); g.stroke();
        }
      }
    });
  }
}

/* threads of mycelium from each mushroom in the row up to the cap: they glow
   when that sound plays */
function drawMycelium(now) {
  for (let i = 0; i < S.pal.length && i < slots.length; i++) {
    const pb = S.pal[i];
    const s = slots[i];
    const a = Math.atan2(s.y - cy, s.x - cx);
    const ex = cx + Math.cos(a) * R;
    const ey = cy + Math.sin(a) * R;
    const age = (now - (flashU.get(pb.u) ?? -1e9)) / 1000;
    const hit = age < 0.5 ? 1 - age / 0.5 : 0;
    const sel = pb.u === S.sel;
    for (let k = 0; k < 2; k++) {
      const w = (k ? -1 : 1) * (10 + (i % 3) * 6);
      const t = now / 2400 + i;
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.bezierCurveTo(
        s.x + w + Math.sin(t) * 4, s.y + (ey - s.y) * 0.35,
        ex - w * 0.6, ey + (s.y - ey) * 0.3 + Math.cos(t) * 4,
        ex + Math.cos(a + Math.PI / 2) * w * 0.4, ey + Math.sin(a + Math.PI / 2) * w * 0.4,
      );
      g.strokeStyle = hit > 0 ? `rgba(141,255,184,${0.12 + 0.5 * hit})` : col(pb.hue, 60, sel ? 0.2 : 0.09);
      g.lineWidth = k ? 0.8 : 1.2;
      g.stroke();
    }
  }
}

/* the tuning row: each dial is a mushroom whose cap rides up its stem */
function drawPanel() {
  if (!dials.length) return;
  const pb = pebble(S.sel);
  if (!pb) return;
  const fx = fxOf(pb);
  const d0 = dials[0];
  g.fillStyle = PANEL;
  g.beginPath();
  g.roundRect(d0.x0 + 2, d0.top + 2, d0.x1 - d0.x0 - 4, PANH - 4, 14);
  g.fill();
  g.strokeStyle = 'rgba(217,164,65,0.35)'; g.lineWidth = 1; g.stroke();
  const ph = 36;
  for (const dl of dials) {
    const v = fx[dl.key];
    const mid = dl.key === 'pitch' || dl.key === 'pan';
    const active = [...touches.values()].some((tc) => tc.kind === 'dial' && tc.key === dl.key);
    const x = dl.x;
    const yb = dl.top + 36 + ph; // bottom of the stem slot
    /* the slot */
    g.beginPath(); g.roundRect(x - 3, yb - ph, 6, ph, 3);
    g.fillStyle = 'rgba(138,122,92,0.15)'; g.fill();
    const y0 = mid ? yb - ph / 2 : yb;
    const y1 = yb - v * ph;
    g.beginPath(); g.roundRect(x - 3, Math.min(y0, y1), 6, Math.max(1, Math.abs(y1 - y0)), 3);
    g.fillStyle = active ? FOX : STEM; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1;
    if (mid) { g.beginPath(); g.moveTo(x - 8, yb - ph / 2); g.lineTo(x + 8, yb - ph / 2); g.strokeStyle = 'rgba(217,164,65,0.4)'; g.lineWidth = 1; g.stroke(); }
    /* its cap */
    mush(x, y1 - 3, -Math.PI / 2, 16, 24, col(pb.hue, active ? 60 : 48), { glow: active ? 0.6 : 0, spots: 2 });
    let val;
    if (dl.key === 'pitch') val = `${(v - 0.5) * 24 >= 0 ? '+' : ''}${((v - 0.5) * 24).toFixed(1)}`;
    else if (dl.key === 'pan') val = Math.abs(v - 0.5) < 0.02 ? 'C' : `${v < 0.5 ? 'L' : 'R'}${Math.round(Math.abs(v - 0.5) * 200)}`;
    else if (dl.key === 'tone') val = toneHz(v) >= 1000 ? `${(toneHz(v) / 1000).toFixed(1)}k` : `${Math.round(toneHz(v))}`;
    else val = `${Math.round(v * 100)}`;
    text(val, x, dl.top + 11, 10, active ? FOX : INK, 600, 'ui-monospace, Menlo, monospace');
    text(dl.label, x, dl.top + PANH - 9, 10, DIM, 600);
  }
}

let lastFrame = 0;
function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - (lastFrame || now)) / 1000);
  lastFrame = now;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (bgCv) g.drawImage(bgCv, 0, 0, W, H); else { g.fillStyle = BG; g.fillRect(0, 0, W, H); }

  const playing = isPlaying();
  const pos = playing ? position() : null;
  const beat = pos != null ? (pos / 4) % 1 : 0.5;
  const pulse = playing ? Math.exp(-6 * beat) : 0;

  /* what just sounded: it glows, sheds spores, and its thread lights */
  if (pos != null) {
    const cur = Math.floor(pos) % STEPS;
    if (cur !== lastStep) {
      lastStep = cur;
      for (const d of S.dots) {
        if (d.t !== cur) continue;
        flash.set(`${d.t},${d.p}`, now);
        flashU.set(d.u, now);
        const pb = pebble(d.u);
        if (!pb || spores.length > 260) continue;
        const { x, y, a } = cellXY(d.t, d.p, d.f ?? d.p);
        for (let k = 0; k < 5; k++) {
          const sa = a + (Math.random() - 0.5) * 1.6;
          const sp = 12 + Math.random() * 30;
          spores.push({ x, y, vx: Math.cos(sa) * sp, vy: Math.sin(sa) * sp, life: 1, hue: pb.hue });
        }
      }
    }
  } else lastStep = -1;

  /* the chosen sound's home ring */
  const selPb = pebble(S.sel);
  const home = selPb ? homeLane(S.sel) : -1;
  if (home >= 0 && defOf(selPb.src).role !== 'chop') {
    g.beginPath();
    g.arc(cx, cy, laneR(home + 1) * R, 0, TAU);
    g.arc(cx, cy, laneR(home) * R, TAU, 0, true);
    g.fillStyle = col(selPb.hue, 50, 0.07);
    g.fill();
  }

  /* the arm and its wake of foxfire */
  const armA = -Math.PI / 2 + ((pos ?? 0) / STEPS) * TAU;
  if (playing) {
    for (let j = 0; j < 22; j++) {
      const a1 = armA - j * 0.028;
      g.beginPath();
      g.arc(cx, cy, R * OUT, a1 - 0.03, a1);
      g.arc(cx, cy, R0 * R, a1, a1 - 0.03, true);
      g.closePath();
      g.fillStyle = `rgba(141,255,184,${0.075 * (1 - j / 22)})`;
      g.fill();
    }
  }

  drawMycelium(now);

  /* the mushrooms on the cap, facing out */
  for (const d of S.dots) {
    const pb = pebble(d.u);
    if (!pb) continue;
    const f = d.f ?? d.p;
    const { x, y, r: rr, a } = cellXY(d.t, d.p, f);
    const laneW = (laneR(f + 1) - laneR(f)) * R;
    const arc = (rr * TAU) / STEPS;
    const w0 = Math.min(arc * 0.9, laneW * 2.1);
    const h0 = Math.max(laneW * 1.75, w0 * 0.95);
    const age = (now - (flash.get(`${d.t},${d.p}`) ?? -1e9)) / 1000;
    const hit = age < 0.4 ? 1 - age / 0.4 : 0;
    const sel = d.u === S.sel;
    const k = 1 + 0.22 * hit;
    mush(x, y, a, h0 * k, w0 * k, col(pb.hue, 46 + 22 * hit, 1), {
      glow: hit, sel: false, spots: 2, alpha: sel ? 1 : 0.72,
    });
    if (defOf(pb.src).role === 'chop') text(String(d.p + 1), x + Math.cos(a) * h0 * 0.22, y + Math.sin(a) * h0 * 0.22, Math.min(w0, h0) * 0.42, '#120d08', 700);
  }

  /* spores drift out and fade */
  for (let i = spores.length - 1; i >= 0; i--) {
    const p = spores[i];
    p.life -= dt * 0.9;
    if (p.life <= 0) { spores.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.985; p.vy *= 0.985;
    g.fillStyle = `hsla(${p.hue}, 60%, 78%, ${p.life * 0.75})`;
    g.beginPath(); g.arc(p.x, p.y, 0.8 + p.life * 1.2, 0, TAU); g.fill();
  }

  /* the arm itself: a brass hand */
  g.strokeStyle = playing ? HOT : 'rgba(217,164,65,0.4)';
  g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx + Math.cos(armA) * R0 * R, cy + Math.sin(armA) * R0 * R);
  g.lineTo(cx + Math.cos(armA) * R * OUT, cy + Math.sin(armA) * R * OUT);
  g.stroke();
  {
    const tx = cx + Math.cos(armA) * R * (OUT + 0.05);
    const ty = cy + Math.sin(armA) * R * (OUT + 0.05);
    g.save(); g.translate(tx, ty); g.rotate(armA);
    if (playing) { g.shadowColor = FOX; g.shadowBlur = 6 + 10 * pulse; }
    g.beginPath(); g.moveTo(R * 0.045, 0); g.lineTo(0, -R * 0.022); g.lineTo(-R * 0.045, 0); g.lineTo(0, R * 0.022); g.closePath();
    g.fillStyle = HOT; g.fill();
    g.restore();
  }

  /* the brass heart: play, and the one tempo (drag it up or down) */
  const pr = (R0 - 0.03) * R;
  const hr = pr * (1 + 0.05 * pulse);
  const hg = g.createRadialGradient(cx - hr * 0.3, cy - hr * 0.35, hr * 0.1, cx, cy, hr);
  hg.addColorStop(0, playing ? '#f2c76a' : '#6b5228'); hg.addColorStop(1, playing ? '#a8741f' : '#2c2010');
  g.save();
  if (playing) { g.shadowColor = FOX; g.shadowBlur = 10 + 18 * pulse; }
  g.beginPath(); g.arc(cx, cy, hr, 0, TAU); g.fillStyle = hg; g.fill();
  g.restore();
  g.lineWidth = 1.5; g.strokeStyle = HOT; g.beginPath(); g.arc(cx, cy, hr, 0, TAU); g.stroke();
  g.beginPath(); g.arc(cx, cy, hr * 0.84, 0, TAU); g.strokeStyle = 'rgba(20,14,8,0.35)'; g.lineWidth = 1; g.stroke();
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * hr * 0.86, cy + Math.sin(a) * hr * 0.86); g.lineTo(cx + Math.cos(a) * hr * 0.95, cy + Math.sin(a) * hr * 0.95);
    g.strokeStyle = 'rgba(20,14,8,0.4)'; g.stroke();
  }
  const ink = playing ? '#1a120a' : INK;
  g.fillStyle = ink;
  const s = pr * 0.3;
  const gy = cy - pr * 0.16;
  if (playing) {
    g.fillRect(cx - s * 0.75, gy - s, s * 0.5, s * 2);
    g.fillRect(cx + s * 0.25, gy - s, s * 0.5, s * 2);
  } else {
    g.beginPath(); g.moveTo(cx - s * 0.6, gy - s); g.lineTo(cx + s, gy); g.lineTo(cx - s * 0.6, gy + s); g.closePath(); g.fill();
  }
  text(`${S.bpm}`, cx, cy + pr * 0.52, pr * 0.32, ink, 700);

  /* a mushroom being carried */
  touches.forEach((tc) => {
    if (tc.kind === 'pebble' && tc.moved && !tc.held) {
      const pb = pebble(tc.u);
      if (pb) mush(tc.x, tc.y, -Math.PI / 2, 30, 32, col(pb.hue, 55), { glow: 0.6, alpha: 0.9 });
    }
  });

  drawPanel();
  drawControls(now);
  drawPebbles(now);
  requestAnimationFrame(frame);
}

/* ---------- go ---------- */
window.addEventListener('resize', layout);
layout();
ensure();
S.pal.forEach((pb) => loadVoice(pb));
say('tap the brass heart · tap the cap · tap a mushroom', false, 8000);
requestAnimationFrame(frame);
