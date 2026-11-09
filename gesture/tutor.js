import { loadHands } from './face.js';
import { MUDRAS, readShape, classify, settle } from './mudras.js';

// A guided course in the hand language of Procrastinatrix Draw and Morph. Each lesson shows the
// shape, checks it live finger by finger, and only moves on once you've actually done it.
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } },
};

/* ── hand diagrams, from the same hand model the recogniser is tested against ── */
const FX = { index: 0.12, middle: 0, ring: -0.1, little: -0.2 };
const BASE = { index: 5, middle: 9, ring: 13, little: 17 };
const ALL = ['index', 'middle', 'ring', 'little'];
function pose({ open = [], touch = null, thumb = 'tucked' }) {
  const p = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  for (const f of ALL) {
    const b = BASE[f], x = FX[f];
    p[b] = { x, y: -0.4 };
    if (open.includes(f)) { p[b + 1] = { x, y: -0.6 }; p[b + 2] = { x, y: -0.72 }; p[b + 3] = { x, y: -0.84 }; }
    // The touched finger folds forward and down; the thumb comes across to meet its tip.
    else if (touch === f) { p[b + 1] = { x, y: -0.6 }; p[b + 2] = { x: x + 0.03, y: -0.58 }; p[b + 3] = { x: x * 0.6 + 0.05, y: -0.5 }; }
    else { p[b + 1] = { x, y: -0.55 }; p[b + 2] = { x: x * 0.9, y: -0.45 }; p[b + 3] = { x: x * 0.8, y: -0.36 }; }
  }
  p[1] = { x: 0.12, y: -0.08 }; p[2] = { x: 0.22, y: -0.18 }; p[3] = { x: 0.3, y: -0.26 };
  p[4] = touch ? { ...p[BASE[touch] + 3] } : thumb === 'out' ? { x: 0.42, y: -0.42 } : thumb === 'up' ? { x: 0.2, y: -0.72 } : { x: 0.06, y: -0.33 };
  if (touch) { const tip = p[4]; p[3] = { x: (0.3 + tip.x) / 2 + 0.05, y: (-0.26 + tip.y) / 2 - 0.02 }; }
  return p;
}
const POSES = {
  rest: pose({ open: ALL, thumb: 'out' }),
  gyan: pose({ open: ['middle', 'ring', 'little'], touch: 'index' }),
  tarjani: pose({ open: ['index'] }),
  shuni: pose({ open: ['index', 'ring', 'little'], touch: 'middle' }),
  surya: pose({ open: ['index', 'middle', 'little'], touch: 'ring' }),
  buddhi: pose({ open: ['index', 'middle', 'ring'], touch: 'little' }),
  kartari: pose({ open: ['index', 'middle'] }),
  karana: pose({ open: ['index', 'little'] }),
  trishula: pose({ open: ['index', 'middle', 'ring'] }),
  abhaya: pose({ open: ALL, thumb: 'out' }),
  mushti: pose({ open: [], thumb: 'tucked' }),
  shikhara: pose({ open: [], thumb: 'up' }),
};
POSES.anjali = POSES.abhaya;
const CHAINS = [['thumb', [1, 2, 3, 4]], ['index', [5, 6, 7, 8]], ['middle', [9, 10, 11, 12]], ['ring', [13, 14, 15, 16]], ['little', [17, 18, 19, 20]]];
// Which fingers matter for each shape, so the diagram can light them.
const KEY = {
  gyan: ['thumb', 'index'], tarjani: ['index'], shuni: ['thumb', 'middle'], surya: ['thumb', 'ring'], buddhi: ['thumb', 'little'],
  kartari: ['index', 'middle'], karana: ['index', 'little'], trishula: ['index', 'middle', 'ring'], abhaya: ['thumb', 'index', 'middle', 'ring', 'little'],
  mushti: ['index', 'middle', 'ring', 'little'], shikhara: ['thumb'], anjali: ['thumb', 'index', 'middle', 'ring', 'little'], rest: [],
};

function handSvg(id) {
  const palm = '<polygon class="palm"/>';
  const fingers = CHAINS.map(([f]) => `<polyline class="f f-${f}" data-f="${f}"/>`).join('');
  return `<g id="${id}">${palm}${fingers}<circle class="spot" r="0.035"/></g>`;
}
const diagram = { el: null, pose: 'rest', motion: null, t0: performance.now() };
function setDiagram(name, motion) {
  diagram.pose = name;
  diagram.motion = motion;
  diagram.t0 = performance.now();
  const svg = $('#diagram');
  svg.innerHTML = `<g class="trail"></g>${handSvg('hA')}${name === 'anjali' ? handSvg('hB') : ''}`;
  svg.querySelectorAll('.f').forEach(p => p.classList.toggle('key', (KEY[name] || []).includes(p.dataset.f)));
}
function drawHand(g, pts, ox, oy, sx, rot = 0) {
  const T = q => {
    const x = q.x * sx, y = q.y, c = Math.cos(rot), s = Math.sin(rot);
    return `${(ox + x * c - y * s).toFixed(3)},${(oy + x * s + y * c).toFixed(3)}`;
  };
  g.querySelector('.palm').setAttribute('points', [0, 1, 5, 9, 13, 17].map(i => T(pts[i])).join(' '));
  CHAINS.forEach(([f, ch]) => g.querySelector(`.f-${f}`).setAttribute('points', [f === 'thumb' ? 0 : ch[0], ...ch].map(i => T(pts[i])).join(' ')));
  const tip = T(pts[diagram.pose === 'gyan' ? 4 : 8]).split(',');
  const spot = g.querySelector('.spot');
  spot.setAttribute('cx', tip[0]);
  spot.setAttribute('cy', tip[1]);
  spot.style.opacity = ['gyan', 'tarjani'].includes(diagram.pose) ? 1 : 0;
}
function tickDiagram(now) {
  const svg = $('#diagram');
  if (!svg.firstChild) return;
  const T = 3.2, u = ((now - diagram.t0) / 1000 % T) / T;
  // Rest → shape → hold (with the shape's movement) → back to rest.
  const k = u < 0.25 ? ease(u / 0.25) : u < 0.8 ? 1 : 1 - ease((u - 0.8) / 0.2);
  const hold = u >= 0.25 && u < 0.8 ? (u - 0.25) / 0.55 : 0;
  const A = POSES.rest, B = POSES[diagram.pose] || A;
  const pts = A.map((a, i) => ({ x: lerp(a.x, B[i].x, k), y: lerp(a.y, B[i].y, k) }));
  let ox = 0, oy = 0.45, sx = 1, rot = 0;
  const m = diagram.motion, wave = Math.sin(hold * Math.PI * 2);
  if (m === 'sideways') ox = wave * 0.25 * k;
  if (m === 'updown') oy = 0.45 - wave * 0.14 * k;
  if (m === 'depth') sx = 1 + wave * 0.3 * k;
  if (m === 'draw') { ox = Math.cos(hold * Math.PI * 2) * 0.18 * k; oy = 0.45 + Math.sin(hold * Math.PI * 2) * 0.08 * k; }
  if (m === 'turn') rot = wave * 0.35 * k;
  const gA = svg.querySelector('#hA');
  const scale = m === 'depth' ? sx : 1;
  if (diagram.pose === 'anjali') {
    const gap = lerp(0.36, 0.13, k);
    drawHand(gA, pts, gap, oy, 0.85);
    drawHand(svg.querySelector('#hB'), pts, -gap, oy, -0.85);
  } else drawHand(gA, pts.map(q => ({ x: q.x * scale, y: q.y * scale })), ox, oy, 1, rot);
  const trail = svg.querySelector('.trail');
  if (m === 'draw' && k > 0.9) {
    const n = Math.floor(hold * 40), pts2 = [];
    for (let i = 0; i <= n; i++) { const h = i / 40; pts2.push(`${(Math.cos(h * Math.PI * 2) * 0.18 + 0.2).toFixed(3)},${(0.45 + Math.sin(h * Math.PI * 2) * 0.08 - 0.48).toFixed(3)}`); }
    trail.innerHTML = `<polyline points="${pts2.join(' ')}"/>`;
  } else if (trail.innerHTML) trail.innerHTML = '';
}

/* ── tracking ────────────────────────────────────────── */
const video = $('#cam');
let hands = [], tracker = null, live = false;
const camState = {};
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Video-normalised landmarks → mirrored screen-normalised, matching the cover-fit video on screen.
function toScreen(x, y) {
  const W = window.innerWidth, H = window.innerHeight, va = (video.videoWidth || 16) / (video.videoHeight || 9), sa = W / H;
  const sx = sa > va ? 1 : sa / va, sy = sa > va ? va / sa : 1;
  return { x: 1 - ((x - 0.5) / sx + 0.5), y: (y - 0.5) / sy + 0.5 };
}
function readHand(id, lm, now) {
  const s = camState[id] || (camState[id] = {});
  const size = D(lm[0], lm[9]) || 1e-3;
  const pi = D(lm[4], lm[8]) / size;
  const pinch = s.pinch ? pi < 0.5 : pi < 0.3;
  s.pinch = pinch;
  const shape = s.shape = readShape(lm, s.shape);
  const mudra = settle(s, classify(shape, pinch, s.mudra));
  const sc = lm.map(q => toScreen(q.x, q.y));
  const pt = { x: (sc[4].x + sc[8].x) / 2, y: (sc[4].y + sc[8].y) / 2 };
  let speed = 0;
  if (s.last) speed = Math.hypot(pt.x - s.last.x, pt.y - s.last.y) / (Math.max(1, now - s.last.t) / 1000);
  s.speed = lerp(s.speed || 0, speed, 0.4);
  s.last = { x: pt.x, y: pt.y, t: now };
  return {
    id, x: pt.x, y: pt.y, pinch, mudra, shape, lm: sc, speed: s.speed,
    depth: 1 - clamp((size - 0.09) / 0.17, 0, 1),
    open: ALL.every(f => shape.ext[f]),
    palm: { x: (sc[0].x + sc[9].x) / 2, y: (sc[0].y + sc[9].y) / 2 },
  };
}
async function startCam() {
  $('#gate').hidden = true;
  say('Waking the camera…');
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
    video.srcObject = stream;
    await video.play();
    say('Loading the hand tracker…');
    tracker = await loadHands();
    live = true;
    say('');
    let last = -1, t = 0;
    const pump = () => {
      if (video.readyState >= 2 && video.currentTime !== last) {
        last = video.currentTime;
        t = Math.max(performance.now(), t + 1);
        try {
          const r = tracker.detectForVideo(video, t), seen = new Set(), out = [];
          (r.landmarks || []).forEach((lm, i) => {
            const hd = r.handednesses && r.handednesses[i] && r.handednesses[i][0];
            // Pressed together, both hands are often labelled the same side; keep them apart, not one.
            let id = `h-${hd ? hd.categoryName : i}`;
            if (seen.has(id)) id = `${id}-${i}`;
            seen.add(id);
            out.push(readHand(id, lm, t));
          });
          for (const id of Object.keys(camState)) if (!seen.has(id)) delete camState[id];
          hands = out;
        } catch (err) { console.error(err); }
      }
      requestAnimationFrame(pump);
    };
    pump();
  } catch (err) {
    console.error(err);
    if (stream) stream.getTracks().forEach(tr => tr.stop());
    say(err && err.name === 'NotAllowedError' ? 'The camera was blocked. Allow it for this site and reload, or read through the lessons' : 'No camera here. You can still read through the lessons');
    watchOnly = true;
    renderLesson();
  }
}
let watchOnly = false;

/* ── what the tracker sees, finger by finger ─────────── */
const touching = (s, f) => s.shape.touch[f] < 0.34;
const REQ = {
  gyan: s => [['thumb touches index', s.pinch]],
  tarjani: s => [['index open', s.shape.ext.index], ['middle folded', !s.shape.ext.middle], ['ring folded', !s.shape.ext.ring], ['little folded', !s.shape.ext.little]],
  shuni: s => [['thumb touches middle', touching(s, 'middle')], ['index open', s.shape.ext.index], ['ring open', s.shape.ext.ring], ['little open', s.shape.ext.little]],
  surya: s => [['thumb touches ring', touching(s, 'ring')], ['index open', s.shape.ext.index], ['middle open', s.shape.ext.middle], ['little open', s.shape.ext.little]],
  buddhi: s => [['thumb touches little', touching(s, 'little')], ['index open', s.shape.ext.index], ['middle open', s.shape.ext.middle], ['ring open', s.shape.ext.ring]],
  kartari: s => [['index open', s.shape.ext.index], ['middle open', s.shape.ext.middle], ['ring folded', !s.shape.ext.ring], ['little folded', !s.shape.ext.little]],
  karana: s => [['index open', s.shape.ext.index], ['little open', s.shape.ext.little], ['middle folded', !s.shape.ext.middle], ['ring folded', !s.shape.ext.ring]],
  trishula: s => [['index open', s.shape.ext.index], ['middle open', s.shape.ext.middle], ['ring open', s.shape.ext.ring], ['little folded', !s.shape.ext.little]],
  abhaya: s => [['all four fingers open', s.open]],
  mushti: s => [['all four fingers folded', ALL.every(f => !s.shape.ext[f])], ['thumb tucked in', !s.shape.thumbOut]],
  shikhara: s => [['all four fingers folded', ALL.every(f => !s.shape.ext[f])], ['thumb up', s.shape.thumbOut]],
};
function anjaliReq() {
  const open = hands.filter(h => h.open);
  const close = open.length >= 2 && Math.hypot((open[0].palm.x - open[1].palm.x) * (window.innerWidth / window.innerHeight), open[0].palm.y - open[1].palm.y) < 0.2;
  return [['two hands seen', hands.length >= 2], ['both palms open', open.length >= 2], ['palms brought together', close]];
}
const isAnjali = () => anjaliReq().every(r => r[1]);
function drawSee() {
  const L = LESSONS[cur], target = L && L.pose;
  let list = '', who = '';
  if (target && target !== 'rest') {
    let reqs = [];
    if (target === 'anjali') reqs = anjaliReq();
    else if (REQ[target] && hands.length) {
      const scored = hands.map(h => REQ[target](h)).sort((a, b) => b.filter(r => r[1]).length - a.filter(r => r[1]).length);
      reqs = scored[0];
    } else if (REQ[target]) reqs = REQ[target]({ pinch: false, open: false, shape: { ext: {}, touch: { index: 9, middle: 9, ring: 9, little: 9 }, thumbOut: false } }).map(r => [r[0], false]);
    list = reqs.map(([t, ok]) => `<li class="${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${t}</li>`).join('');
  }
  if (!hands.length) who = live ? '<p class="none">No hand in view</p>' : '';
  const handsHtml = hands.slice(0, 2).map(h => {
    const m = isAnjali() ? 'anjali' : h.mudra;
    const fingers = ['thumb', ...ALL].map(f => {
      const on = f === 'thumb' ? h.shape.thumbOut : h.shape.ext[f];
      return `<span class="fi ${on ? 'open' : ''}" title="${f}">${f[0].toUpperCase()}</span>`;
    }).join('');
    return `<div class="seen"><b>${m ? MUDRAS[m].name.toUpperCase() : '—'}</b>${h.pinch ? '<em>pinch</em>' : ''}
      <div class="fingers">${fingers}</div>
      <div class="depthbar"><i style="left:${Math.round((1 - h.depth) * 100)}%"></i></div><small>far · depth · near</small></div>`;
  }).join('');
  const html = `${list ? `<ul class="req">${list}</ul>` : ''}${who}${handsHtml}`;
  if ($('#see').dataset.html !== html) { $('#see').innerHTML = html; $('#see').dataset.html = html; }
}

/* ── pointing at buttons, exactly as in Draw and Morph ── */
const DWELL = 700;
const pointers = new Map();
let pressHow = 'click';
function uiAt(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const el = document.elementFromPoint(x * window.innerWidth, y * window.innerHeight);
  if (!el || el.id === 'ov') return null;
  const c = el.closest('button, a.btn');
  return c && !c.disabled && !c.closest('[hidden]') ? c : null;
}
function activate(el, how) {
  pressHow = how;
  el.click();
  pressHow = 'click';
  el.classList.add('hand-click');
  setTimeout(() => el.classList.remove('hand-click'), 300);
}
function pointTick(now) {
  const seen = new Set();
  for (const h of hands) {
    seen.add(h.id);
    const pointing = h.mudra === 'tarjani', tip = pointing ? h.lm[8] : { x: h.x, y: h.y };
    const el = pointing || h.pinch ? uiAt(tip.x, tip.y) : null;
    h.overUI = !!el;
    let st = pointers.get(h.id);
    if (!st) { st = { el: null, since: 0, done: false, pinched: false, dot: document.createElement('div') }; st.dot.className = 'hc'; $('#cursors').appendChild(st.dot); pointers.set(h.id, st); }
    if (el !== st.el) {
      if (st.el) st.el.classList.remove('hand-hover');
      st.el = el; st.since = now; st.done = false;
      if (el) el.classList.add('hand-hover');
    }
    const prog = el && pointing && !st.done ? Math.min(1, (now - st.since) / DWELL) : 0;
    if (prog >= 1) { st.done = true; activate(el, 'dwell'); }
    if (h.pinch && !st.pinched && el) activate(el, 'pinch');
    st.pinched = h.pinch;
    st.dot.hidden = !pointing;
    st.dot.style.transform = `translate(${tip.x * window.innerWidth}px,${tip.y * window.innerHeight}px) translate(-50%,-50%)`;
    st.dot.style.setProperty('--p', prog.toFixed(3));
  }
  for (const [id, st] of pointers) {
    if (seen.has(id)) continue;
    if (st.el) st.el.classList.remove('hand-hover');
    st.dot.remove();
    pointers.delete(id);
  }
}

/* ── the practice pad: drawing in the air over your camera view, the way Draw does it ── */
const ov = $('#ov'), g = ov.getContext('2d');
const BRUSHES = ['neon', 'ribbon', 'dots', 'spray', 'wire'];
const SYMS = [1, 2, 3, 4, 6, 8];
const pad = { strokes: [], undone: [], hue: 0.55, size: 10, sym: 1, brush: 'neon', warp: 0, flash: 0, ink: 0 };
const pens = new Map();
const hsl = (h, l = 60) => `hsl(${Math.round(h * 360)} 95% ${l}%)`;
function padDraw(h, allowed) {
  const pen = pens.get(h.id);
  if (allowed && h.pinch && !h.overUI) {
    const p = { x: h.x * ov.width, y: h.y * ov.height, w: pad.size * (0.6 + (1 - h.depth) * 0.9) * devicePixelRatio };
    if (!pen) {
      const st = { pts: [p], hue: pad.hue, brush: pad.brush, sym: pad.sym, seed: Math.random() * 1e4 };
      pad.strokes.push(st);
      pad.undone = [];
      pens.set(h.id, { st, sx: p.x, sy: p.y });
    } else {
      const lp = pen.st.pts[pen.st.pts.length - 1], d = Math.hypot(p.x - lp.x, p.y - lp.y);
      // Smooth the hand's jitter before laying ink.
      pen.sx = lerp(pen.sx, p.x, 0.45); pen.sy = lerp(pen.sy, p.y, 0.45);
      if (d > 3 * devicePixelRatio) { pen.st.pts.push({ x: pen.sx, y: pen.sy, w: p.w }); pad.ink += d / devicePixelRatio; }
    }
  } else if (pen) {
    pens.delete(h.id);
    if (pen.st.pts.length < 2) pad.strokes = pad.strokes.filter(s => s !== pen.st);
  }
}
function rnd(seed) { let s = seed; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
function renderPad(t) {
  const W = ov.width, H = ov.height, cx = W / 2, cy = H / 2;
  g.save();
  pad.strokes.forEach((st, i) => {
    for (let k = 0; k < st.sym; k++) {
      g.save();
      g.translate(cx, cy);
      g.rotate((k / st.sym) * Math.PI * 2);
      if (pad.warp > 0.01) { g.translate(Math.sin(t * 2.3 + i) * pad.warp * 40, Math.cos(t * 1.7 + i * 2) * pad.warp * 30); g.rotate(Math.sin(t * 1.3 + i) * pad.warp * 0.3); }
      g.translate(-cx, -cy);
      const c = hsl(st.hue);
      g.strokeStyle = c; g.fillStyle = c; g.lineCap = 'round'; g.lineJoin = 'round';
      const P = st.pts;
      if (st.brush === 'dots' || st.brush === 'spray') {
        const r = rnd(st.seed);
        P.forEach((p, j) => {
          if (st.brush === 'dots' && j % 3) return;
          if (st.brush === 'dots') { g.beginPath(); g.arc(p.x, p.y, p.w * 0.7, 0, Math.PI * 2); g.fill(); }
          else for (let q = 0; q < 6; q++) { g.globalAlpha = 0.7; g.fillRect(p.x + (r() - 0.5) * p.w * 4, p.y + (r() - 0.5) * p.w * 4, 2, 2); }
        });
        g.globalAlpha = 1;
      } else {
        g.shadowBlur = st.brush === 'neon' ? 18 : 0;
        g.shadowColor = c;
        g.globalAlpha = st.brush === 'ribbon' ? 0.85 : 1;
        for (let j = 1; j < P.length; j++) {
          g.lineWidth = st.brush === 'wire' ? 1.5 * devicePixelRatio : st.brush === 'ribbon' ? P[j].w * 1.8 : P[j].w;
          g.beginPath(); g.moveTo(P[j - 1].x, P[j - 1].y); g.lineTo(P[j].x, P[j].y); g.stroke();
        }
        g.shadowBlur = 0; g.globalAlpha = 1;
      }
      g.restore();
    }
  });
  if (pad.flash > 0) { g.fillStyle = `rgba(255,255,255,${pad.flash * 0.6})`; g.fillRect(0, 0, W, H); }
  g.restore();
}
function undo() { const s = pad.strokes.pop(); if (s) { pad.undone.push(s); stats.undos++; } }
function redo() { const s = pad.undone.pop(); if (s) { pad.strokes.push(s); stats.redos++; } }
function seedStrokes(n) {
  const W = ov.width, H = ov.height;
  for (let k = 0; k < n; k++) {
    const pts = [], cx = W * (0.4 + k * 0.12), cy = H * 0.5, r = Math.min(W, H) * 0.08;
    for (let i = 0; i <= 30; i++) { const a = (i / 30) * Math.PI * 2; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, w: 10 * devicePixelRatio }); }
    pad.strokes.push({ pts, hue: (0.1 + k * 0.3) % 1, brush: 'neon', sym: 1, seed: k });
  }
}

/* ── mudra actions, gated by what the current lesson teaches ── */
const stats = { undos: 0, redos: 0, brushes: 0, saves: 0, clears: 0, hueMin: 1, hueMax: 0, big: false, small: false, symDrawn: false, turn: 0 };
const held = new Map();
const anjHold = { since: 0, seen: 0, fired: false };
let cubeY = -25;
function mudraTick(now, dt, allow) {
  pad.flash = Math.max(0, pad.flash - dt * 2);
  let warp = 0;
  // Overlapping hands flicker in and out of view, so the hold rides out gaps of under 0.4 s.
  const together = isAnjali();
  if (together) { if (!anjHold.since) anjHold.since = now; anjHold.seen = now; } else if (anjHold.since && now - anjHold.seen > 400) { anjHold.since = 0; anjHold.fired = false; }
  if (allow.has('anjali') && anjHold.since && !anjHold.fired && now - anjHold.since > 1200) { anjHold.fired = true; pad.strokes = []; pad.undone = []; stats.clears++; }
  const anj = !!anjHold.since;
  for (const h of hands) {
    const m = anj ? 'anjali' : h.mudra;
    let st = held.get(h.id);
    if (!st || st.m !== m) { st = { m, since: now, fired: false, next: 0, x: h.palm.x }; held.set(h.id, st); }
    padDraw(h, allow.has('draw'));
    if (!m || !allow.has(m)) continue;
    if (m === 'surya') { pad.hue = clamp((h.x - 0.1) / 0.8, 0, 1); stats.hueMin = Math.min(stats.hueMin, pad.hue); stats.hueMax = Math.max(stats.hueMax, pad.hue); }
    else if (m === 'buddhi') { pad.size = 3 * Math.pow(16, clamp((0.9 - h.y) / 0.75, 0, 1)); if (pad.size > 26) stats.big = true; if (pad.size < 7) stats.small = true; }
    else if (m === 'shuni') pad.sym = SYMS[clamp(Math.floor(clamp((0.9 - h.y) / 0.75, 0, 0.999) * SYMS.length), 0, SYMS.length - 1)];
    else if (m === 'mushti') warp = 1;
    else if (m === 'abhaya') { const d = h.palm.x - st.x; cubeY += d * 360; stats.turn += Math.abs(d * 360); st.x = h.palm.x; }
    else if (m === 'karana') { if (now >= st.next) { undo(); st.next = now + (st.fired ? 600 : 900); st.fired = true; } }
    else if (!st.fired) {
      st.fired = true;
      if (m === 'kartari') { pad.brush = BRUSHES[(BRUSHES.indexOf(pad.brush) + 1) % BRUSHES.length]; stats.brushes++; }
      else if (m === 'trishula') redo();
      else if (m === 'shikhara') { pad.flash = 1; stats.saves++; }
    }
  }
  for (const id of held.keys()) if (!hands.some(h => h.id === id)) held.delete(id);
  for (const id of [...pens.keys()]) if (!hands.some(h => h.id === id)) pens.delete(id);
  pad.warp += (warp - pad.warp) * (1 - Math.exp(-dt * (warp ? 5 : 2.5)));
  $('#cube').style.setProperty('--ry', `${cubeY}deg`);
}

/* ── lessons ─────────────────────────────────────────── */
const CHAPTERS = ['Being seen', 'Pointing', 'Drawing', 'Your brush', 'Time', 'Big gestures'];
const hold = (L, key, cond, secs, dt) => { L[key] = clamp((L[key] || 0) + (cond ? dt : -dt * 1.5), 0, secs); return L[key] / secs; };
const anyMudra = m => hands.some(h => h.mudra === m);
const BRUSHING = ['draw', 'surya', 'buddhi', 'shuni', 'kartari', 'karana', 'trishula'];
const LESSONS = [
  { ch: 0, pose: 'rest', title: 'Show me your hand', say: 'Hold one hand up, palm towards the camera, about an arm\'s length away.',
    tip: 'Face a light rather than having it behind you, and keep your whole hand in the picture.', widget: 'none', allow: [],
    tick(dt) { return hold(this, 'h', hands.length > 0, 1, dt); } },
  { ch: 0, pose: 'anjali', title: 'And both', say: 'Now both hands up together, palms open.',
    tip: 'Step back a little so both hands fit in the picture.', widget: 'none', allow: [],
    tick(dt) { return hold(this, 'h', hands.length >= 2, 1, dt); } },
  { ch: 1, pose: 'tarjani', title: 'Point', say: 'Point with your index finger. Fold the other three into your palm.',
    tip: 'Tuck the middle, ring and little fingers right down. Your thumb can rest wherever it likes.', widget: 'none', allow: [],
    tick(dt) { return hold(this, 'h', anyMudra('tarjani'), 0.8, dt); } },
  { ch: 1, pose: 'tarjani', title: 'Press by pointing', say: 'Point at each of the three buttons and hold still on it. A ring fills around your fingertip, and when it closes the button is pressed.',
    tip: 'Keep your hand steady: moving off the button restarts the ring.', widget: 'buttons', how: 'dwell', allow: [],
    tick() { return this.pressed ? this.pressed.size / 3 : 0; } },
  { ch: 1, pose: 'gyan', title: 'Or pinch it', say: 'Quicker: put your pinch over a button and touch thumb to index. It presses straight away. Pinch two buttons.',
    tip: 'Your pinch point is between your thumb and index tips, not your fingertip.', widget: 'buttons', how: 'pinch', allow: [],
    tick() { return this.pressed ? this.pressed.size / 2 : 0; } },
  { ch: 2, pose: 'gyan', motion: 'draw', title: 'Pinch to draw', say: 'Pinch, and move your hand while you keep pinching. Ink follows your pinch. Open your fingers to stop.',
    tip: 'Pinch firmly: thumb and index tips really touching. Draw slowly at first.', widget: 'pad', allow: ['draw'],
    init() { this.ink0 = pad.ink; }, tick() { return clamp((pad.ink - this.ink0) / 900, 0, 1); } },
  { ch: 2, pose: 'gyan', motion: 'depth', title: 'Near and far', say: 'Distance is depth. Reach towards the camera to draw near, pull back to draw far. Pinch inside each ring at its depth: NEAR, MIDDLE, FAR.',
    tip: 'Watch the depth bar on the right as you move your hand closer and further.', widget: 'depth', allow: [],
    init() { this.hit = new Set(); }, tick() { return this.hit.size / 3; } },
  { ch: 3, pose: 'surya', motion: 'sideways', title: 'Colour: Surya', say: 'Touch your thumb to your ring finger, keeping the other three open. Sweep your hand left and right: the colour follows.',
    tip: 'The ring finger is the one next to your little finger. Keep index, middle and little straight.', widget: 'pad', allow: ['draw', 'surya'],
    init() { stats.hueMin = 1; stats.hueMax = 0; }, tick() { return clamp((stats.hueMax - stats.hueMin) / 0.6, 0, 1); } },
  { ch: 3, pose: 'buddhi', motion: 'updown', title: 'Size: Buddhi', say: 'Thumb to your little finger, the other three open. Raise your hand for a thicker brush, lower it for thinner. Try both.',
    tip: 'Your little finger has to bend to meet the thumb. Keep index, middle and ring straight.', widget: 'pad', allow: ['draw', 'buddhi'],
    init() { stats.big = stats.small = false; }, tick() { return (+stats.big + +stats.small) / 2; } },
  { ch: 3, pose: 'shuni', motion: 'updown', title: 'Symmetry: Shuni', say: 'Thumb to your middle finger, the others open. Raise your hand for more mirrored copies. Set at least four, then pinch and draw.',
    tip: 'Raise the shape higher for 4, 6 or 8 copies, then switch to a pinch to draw with them.', widget: 'pad', allow: ['draw', 'shuni'],
    init() { this.n0 = pad.strokes.length; }, tick() { const ok = pad.sym >= 4; const drew = pad.strokes.slice(this.n0).some(s => s.sym >= 4 && s.pts.length > 8); return (ok ? 0.5 : 0) + (drew ? 0.5 : 0); } },
  { ch: 3, pose: 'kartari', title: 'Brush: Kartari', say: 'Index and middle up, like a V. Each time you make the V, you move to the next brush. Change brush twice.',
    tip: 'Drop your hand between Vs: the shape has to end before it can count again.', widget: 'pad', allow: ['draw', 'kartari'],
    init() { this.b0 = stats.brushes; }, tick() { return clamp((stats.brushes - this.b0) / 2, 0, 1); } },
  { ch: 4, pose: 'karana', title: 'Undo: Karana', say: 'Index and little finger up, middle and ring folded. That steps back in time and removes your last stroke. Hold it to keep going back.',
    tip: 'Like the horns sign. Fold the middle two right down.', widget: 'pad', allow: ['karana'],
    init() { if (pad.strokes.length < 2) seedStrokes(3); this.u0 = stats.undos; }, tick() { return clamp(stats.undos - this.u0, 0, 1); } },
  { ch: 4, pose: 'trishula', title: 'Redo: Trishula', say: 'Index, middle and ring up, little finger folded. That brings back what you undid.',
    tip: 'Three fingers up, like a trident. Fold just the little finger.', widget: 'pad', allow: ['trishula'],
    init() { if (!pad.undone.length) { if (!pad.strokes.length) seedStrokes(2); undo(); stats.undos--; } this.r0 = stats.redos; }, tick() { return clamp(stats.redos - this.r0, 0, 1); } },
  { ch: 5, pose: 'abhaya', motion: 'sideways', title: 'Turn the view: Abhaya', say: 'Open your whole hand and move it left or right. In Draw this turns your drawing around. Here, turn the cube a quarter turn.',
    tip: 'Keep all four fingers straight. Move steadily, like turning something on a table.', widget: 'cube', allow: ['abhaya'],
    init() { stats.turn = 0; }, tick() { return clamp(stats.turn / 90, 0, 1); } },
  { ch: 5, pose: 'mushti', title: 'Warp: Mushti', say: 'Make a fist, thumb tucked in. Everything warps while you hold it, and settles when you let go. Hold it for a second.',
    tip: 'Tuck your thumb over your fingers. A thumb sticking up is a different shape.', widget: 'pad', allow: ['mushti'],
    init() { if (pad.strokes.length < 2) seedStrokes(3); }, tick(dt) { return hold(this, 'h', anyMudra('mushti'), 1, dt); } },
  { ch: 5, pose: 'shikhara', title: 'Save: Shikhara', say: 'A fist with the thumb up. In Draw it saves a picture of your work.',
    tip: 'Thumbs up, with all four fingers curled.', widget: 'pad', allow: ['shikhara'],
    init() { this.s0 = stats.saves; }, tick() { return clamp(stats.saves - this.s0, 0, 1); } },
  { ch: 5, pose: 'anjali', title: 'Clear: Anjali', say: 'Bring both open palms together, as if in thanks, and hold them there. After a moment the canvas clears. In Draw, undo brings it back.',
    tip: 'Both hands fully open, fingertips up, palms close together in the middle of the picture.', widget: 'pad', allow: ['anjali'],
    init() { if (!pad.strokes.length) seedStrokes(2); this.c0 = stats.clears; }, tick() { return clamp(stats.clears - this.c0, 0, 1); } },
];

let cur = clamp(store.get('gesture-lesson', 0), 0, LESSONS.length);
let progress = 0, doneAt = 0, startedAt = 0, best = 0;
function say(t) { setTextIf('#msg', t); $('#msg').hidden = !t; }
function setTextIf(sel, t) { const el = $(sel); if (el.textContent !== t) el.textContent = t; }

function renderLesson() {
  const done = cur >= LESSONS.length;
  $('#lesson').hidden = done;
  $('#grad').hidden = !done;
  document.body.dataset.widget = done ? 'pad' : LESSONS[cur].widget;
  store.set('gesture-lesson', cur);
  $('#dots').innerHTML = LESSONS.map((_, i) => `<i class="${i < cur ? 'done' : i === cur ? 'now' : ''}"></i>`).join('');
  if (done) { setDiagram('rest'); return; }
  const L = LESSONS[cur];
  Object.keys(L).filter(k => !['ch', 'pose', 'motion', 'title', 'say', 'tip', 'widget', 'allow', 'how', 'tick', 'init'].includes(k)).forEach(k => delete L[k]);
  if (L.init) L.init();
  if (L.widget === 'buttons') {
    L.pressed = new Set();
    document.querySelectorAll('#targets button').forEach(b => b.classList.remove('lit'));
  }
  if (L.widget === 'depth') L.hit = new Set();
  $('#chapter').textContent = `${L.ch + 1} · ${CHAPTERS[L.ch].toUpperCase()}`;
  $('#title').textContent = L.title;
  $('#say').textContent = L.say;
  $('#tip').textContent = `Tip: ${L.tip}`;
  $('#tip').hidden = true;
  $('#back').disabled = cur === 0;
  setDiagram(L.pose, L.motion);
  progress = 0; best = 0; doneAt = 0; startedAt = performance.now();
  $('#bar').style.width = '0%';
  $('#lesson').classList.remove('passed');
}
function go(i) { cur = clamp(i, 0, LESSONS.length); renderLesson(); }
$('#back').addEventListener('click', () => go(cur - 1));
$('#skip').addEventListener('click', () => go(cur + 1));
$('#again').addEventListener('click', () => go(0));
$('#targets').addEventListener('click', e => {
  const b = e.target.closest('button');
  const L = LESSONS[cur];
  if (!b || !L || L.widget !== 'buttons') return;
  if (L.how && pressHow !== L.how && !watchOnly) { say(L.how === 'dwell' ? 'That was a pinch: try pointing and holding still' : 'That was a point: try a pinch instead'); setTimeout(() => say(''), 2200); return; }
  b.classList.add('lit');
  L.pressed.add(b.dataset.t);
});
$('#padClear').addEventListener('click', () => { pad.strokes = []; pad.undone = []; });
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') go(cur + 1);
  else if (e.key === 'ArrowLeft') go(cur - 1);
});

/* ── depth targets ───────────────────────────────────── */
const DEPTHS = [['NEAR', 0.42, 0, 0.38], ['MIDDLE', 0.56, 0.33, 0.67], ['FAR', 0.7, 0.62, 1]];
function depthTick(L) {
  const W = ov.width, H = ov.height, r = Math.min(W, H) * 0.09;
  DEPTHS.forEach(([name, fx, lo, hi]) => {
    const x = W * fx, y = H * 0.55, ok = L.hit.has(name);
    let inside = false;
    for (const h of hands) {
      const d = Math.hypot(h.x * W - x, h.y * H - y);
      if (d < r && h.depth >= lo && h.depth <= hi) { inside = true; if (h.pinch) L.hit.add(name); }
    }
    // Nearer rings are drawn bigger, the way near things look.
    const rr = r * (1.25 - fx * 0.5);
    g.lineWidth = 4 * devicePixelRatio;
    g.strokeStyle = ok ? '#e8ff3d' : inside ? '#3de8ff' : 'rgba(237,233,224,.45)';
    g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.stroke();
    if (ok) { g.fillStyle = 'rgba(232,255,61,.18)'; g.fill(); }
    g.fillStyle = ok ? '#e8ff3d' : 'rgba(237,233,224,.8)';
    g.font = `800 ${14 * devicePixelRatio}px ui-monospace,Menlo,monospace`;
    g.textAlign = 'center';
    g.fillText(ok ? `${name} ✓` : name, x, y + rr + 22 * devicePixelRatio);
  });
}

/* ── overlay: skeletons and pinch cursors ────────────── */
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
function drawHands() {
  const W = ov.width, H = ov.height;
  for (const h of hands) {
    g.lineWidth = 2 * devicePixelRatio;
    g.strokeStyle = h.mudra ? 'rgba(232,255,61,.75)' : 'rgba(237,233,224,.5)';
    g.beginPath();
    BONES.forEach(([a, b]) => { g.moveTo(h.lm[a].x * W, h.lm[a].y * H); g.lineTo(h.lm[b].x * W, h.lm[b].y * H); });
    g.stroke();
    // The pinch point, sized by depth and coloured with the brush.
    const r = (6 + (1 - h.depth) * 14) * devicePixelRatio;
    g.beginPath(); g.arc(h.x * W, h.y * H, r, 0, Math.PI * 2);
    g.fillStyle = h.pinch ? hsl(pad.hue) : 'rgba(237,233,224,.15)';
    g.fill();
    g.strokeStyle = hsl(pad.hue);
    g.stroke();
  }
}

/* ── frame ───────────────────────────────────────────── */
function resize() { ov.width = Math.round(window.innerWidth * devicePixelRatio); ov.height = Math.round(window.innerHeight * devicePixelRatio); }
window.addEventListener('resize', resize);
resize();
let last = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tickDiagram(now);
  g.clearRect(0, 0, ov.width, ov.height);
  const L = LESSONS[cur], free = cur >= LESSONS.length;
  pointTick(now);
  const allow = new Set(free ? [...BRUSHING, 'mushti', 'abhaya', 'shikhara', 'anjali'] : L.allow);
  mudraTick(now, dt, allow);
  if (free || (L && L.widget === 'pad')) renderPad(now / 1000);
  if (L && L.widget === 'depth') depthTick(L);
  drawHands();
  drawSee();
  if (!L || free) return;
  // Progress, the pass, and a tip if you seem stuck.
  if (!doneAt) {
    progress = live ? L.tick(dt) : 0;
    best = Math.max(best, progress);
    $('#bar').style.width = `${Math.round(progress * 100)}%`;
    if (now - startedAt > 9000 && best < 0.3) $('#tip').hidden = false;
    if (progress >= 1) { doneAt = now; $('#lesson').classList.add('passed'); if (navigator.vibrate) navigator.vibrate([10, 40, 10]); }
  } else if (now - doneAt > 1300) go(cur + 1);
}

/* ── start ───────────────────────────────────────────── */
$('#start').addEventListener('click', startCam);
$('#watch').addEventListener('click', () => { $('#gate').hidden = true; watchOnly = true; renderLesson(); });
if (cur > 0 && cur < LESSONS.length) $('#resume').textContent = `Lesson ${cur + 1} of ${LESSONS.length}: ${LESSONS[cur].title}`;
renderLesson();
requestAnimationFrame(frame);
