/* The v6 glyph set, plus aux and sample for v7. Controls are drawn, not
   labelled. Each glyph is drawn once on a unit square; the same drawing
   feeds the WebGL textures and the few DOM icons. */
import * as THREE from '../vendor/three.module.min.js';

const LW = 0.075;
const TAU = Math.PI * 2;

function P(c, pts, close) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  if (close) c.closePath();
  c.stroke();
}
function F(c, pts) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}
function L(c, x1, y1, x2, y2) { P(c, [[x1, y1], [x2, y2]]); }
function O(c, x, y, r, fill) {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  if (fill) c.fill(); else c.stroke();
}
function head(c, x, y, ang, l = 0.11) {
  L(c, x, y, x - l * Math.cos(ang - 0.55), y - l * Math.sin(ang - 0.55));
  L(c, x, y, x - l * Math.cos(ang + 0.55), y - l * Math.sin(ang + 0.55));
}
function wave(c, x0, x1, y, amp, cycles, phase = 0) {
  c.beginPath();
  for (let i = 0; i <= 64; i++) {
    const u = i / 64;
    const px = x0 + (x1 - x0) * u;
    const py = y - amp * Math.sin(u * cycles * TAU + phase);
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.stroke();
}
function arcArrow(c, r, a0, a1, ccw) {
  c.beginPath();
  c.arc(0.5, 0.5, r, a0, a1, ccw);
  c.stroke();
  const x = 0.5 + r * Math.cos(a1);
  const y = 0.5 + r * Math.sin(a1);
  head(c, x, y, a1 + (ccw ? -Math.PI / 2 : Math.PI / 2));
}
function dashed(c, fn) {
  c.setLineDash([0.075, 0.065]);
  fn();
  c.setLineDash([]);
}

const G = {
  play: (c) => F(c, [[0.34, 0.2], [0.34, 0.8], [0.82, 0.5]]),
  stop: (c) => c.fillRect(0.27, 0.27, 0.46, 0.46),
  mute: (c) => { O(c, 0.5, 0.5, 0.3); L(c, 0.29, 0.71, 0.71, 0.29); },
  solo: (c) => { O(c, 0.5, 0.5, 0.3); O(c, 0.5, 0.5, 0.12, true); },
  remove: (c) => { L(c, 0.28, 0.28, 0.72, 0.72); L(c, 0.72, 0.28, 0.28, 0.72); },
  pitch: (c) => { L(c, 0.5, 0.16, 0.5, 0.84); head(c, 0.5, 0.16, -Math.PI / 2); head(c, 0.5, 0.84, Math.PI / 2); },
  bolt: (c) => P(c, [[0.6, 0.1], [0.3, 0.54], [0.52, 0.54], [0.4, 0.9], [0.72, 0.44], [0.5, 0.44]], true),
  cut: (c) => { c.beginPath(); c.moveTo(0.1, 0.38); c.lineTo(0.5, 0.38); c.quadraticCurveTo(0.68, 0.38, 0.86, 0.86); c.stroke(); },
  res: (c) => {
    c.beginPath(); c.moveTo(0.1, 0.62); c.lineTo(0.4, 0.62);
    c.quadraticCurveTo(0.56, 0.62, 0.6, 0.18); c.quadraticCurveTo(0.66, 0.64, 0.9, 0.88); c.stroke();
  },
  wobr: (c) => wave(c, 0.1, 0.9, 0.5, 0.12, 4),
  wobd: (c) => wave(c, 0.1, 0.9, 0.5, 0.28, 1.5),
  etime: (c) => {
    L(c, 0.18, 0.25, 0.18, 0.75); L(c, 0.82, 0.25, 0.82, 0.75); L(c, 0.3, 0.5, 0.7, 0.5);
    head(c, 0.7, 0.5, 0); head(c, 0.3, 0.5, Math.PI);
  },
  echo: (c) => { L(c, 0.24, 0.2, 0.24, 0.8); L(c, 0.5, 0.3, 0.5, 0.7); L(c, 0.76, 0.4, 0.76, 0.6); },
  hall: (c) => {
    c.beginPath(); c.moveTo(0.2, 0.84); c.lineTo(0.2, 0.48); c.arc(0.5, 0.48, 0.3, Math.PI, 0); c.lineTo(0.8, 0.84); c.stroke();
    O(c, 0.5, 0.62, 0.06, true);
  },
  vol: (c) => P(c, [[0.14, 0.78], [0.86, 0.78], [0.86, 0.22]], true),
  whole: (c) => {
    L(c, 0.14, 0.28, 0.14, 0.72); L(c, 0.86, 0.28, 0.86, 0.72); L(c, 0.26, 0.5, 0.74, 0.5);
    head(c, 0.74, 0.5, 0); head(c, 0.26, 0.5, Math.PI);
  },
  music: (c) => {
    c.beginPath(); c.ellipse(0.37, 0.72, 0.13, 0.095, -0.4, 0, TAU); c.fill();
    L(c, 0.49, 0.7, 0.49, 0.16);
    c.beginPath(); c.moveTo(0.49, 0.16); c.quadraticCurveTo(0.56, 0.34, 0.76, 0.42); c.stroke();
  },
  sfx: (c) => {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const r1 = k % 2 ? 0.28 : 0.38;
      L(c, 0.5 + 0.12 * Math.cos(a), 0.5 + 0.12 * Math.sin(a), 0.5 + r1 * Math.cos(a), 0.5 + r1 * Math.sin(a));
    }
  },
  length: (c) => P(c, [[0.28, 0.18], [0.72, 0.18], [0.28, 0.82], [0.72, 0.82]], true),
  grow: (c) => {
    L(c, 0.5, 0.88, 0.5, 0.36);
    c.beginPath(); c.moveTo(0.5, 0.6); c.quadraticCurveTo(0.8, 0.6, 0.82, 0.34); c.quadraticCurveTo(0.58, 0.34, 0.5, 0.6); c.stroke();
    c.beginPath(); c.moveTo(0.5, 0.46); c.quadraticCurveTo(0.22, 0.46, 0.18, 0.2); c.quadraticCurveTo(0.44, 0.2, 0.5, 0.46); c.stroke();
  },
  word: (c) => {
    c.beginPath(); c.moveTo(0.82, 0.12); c.quadraticCurveTo(0.4, 0.18, 0.27, 0.74); c.stroke();
    c.beginPath(); c.moveTo(0.82, 0.12); c.quadraticCurveTo(0.76, 0.54, 0.31, 0.67); c.stroke();
    L(c, 0.27, 0.74, 0.17, 0.9);
  },
  rec: (c) => O(c, 0.5, 0.5, 0.24, true),
  auto: (c) => { arcArrow(c, 0.32, -Math.PI / 2 + 0.45, -Math.PI / 2 - 0.45 + TAU, false); O(c, 0.5, 0.5, 0.1, true); },
  gate: (c) => P(c, [[0.08, 0.76], [0.34, 0.76], [0.34, 0.3], [0.66, 0.3], [0.66, 0.76], [0.92, 0.76]]),
  clear: (c) => { dashed(c, () => O(c, 0.5, 0.5, 0.32)); L(c, 0.39, 0.39, 0.61, 0.61); L(c, 0.61, 0.39, 0.39, 0.61); },
  stomp: (c) => {
    c.beginPath(); c.arc(0.5, 0.54, 0.28, -Math.PI / 2 + 0.6, -Math.PI / 2 - 0.6 + TAU); c.stroke();
    L(c, 0.5, 0.14, 0.5, 0.46);
  },
  tone: (c) => { O(c, 0.5, 0.5, 0.3); c.beginPath(); c.arc(0.5, 0.5, 0.3, Math.PI / 2, (3 * Math.PI) / 2); c.fill(); },
  freq: (c) => { c.beginPath(); c.moveTo(0.1, 0.84); c.quadraticCurveTo(0.5, -0.12, 0.9, 0.84); c.stroke(); },
  speed: (c) => arcArrow(c, 0.3, Math.PI * 0.75, Math.PI * 2.3, false),
  rate: (c) => wave(c, 0.1, 0.9, 0.5, 0.18, 2),
  depth: (c) => {
    L(c, 0.5, 0.14, 0.5, 0.86); head(c, 0.5, 0.14, -Math.PI / 2); head(c, 0.5, 0.86, Math.PI / 2);
    L(c, 0.28, 0.5, 0.72, 0.5);
  },
  mix: (c) => { O(c, 0.37, 0.5, 0.22); O(c, 0.63, 0.5, 0.22); },
  time: (c) => { O(c, 0.5, 0.5, 0.32); L(c, 0.5, 0.5, 0.5, 0.28); L(c, 0.5, 0.5, 0.66, 0.58); },
  feedback: (c) => { arcArrow(c, 0.3, Math.PI * 0.25, -Math.PI * 1.3, true); O(c, 0.5, 0.5, 0.07, true); },
  size: (c) => { c.strokeRect(0.17, 0.17, 0.66, 0.66); c.strokeRect(0.36, 0.36, 0.28, 0.28); },
  recdub: (c) => { O(c, 0.36, 0.5, 0.17, true); L(c, 0.64, 0.5, 0.9, 0.5); L(c, 0.77, 0.37, 0.77, 0.63); },
  stopclr: (c) => { c.fillRect(0.14, 0.34, 0.32, 0.32); L(c, 0.6, 0.38, 0.86, 0.62); L(c, 0.86, 0.38, 0.6, 0.62); },
  loopspeed: (c) => { P(c, [[0.22, 0.28], [0.44, 0.5], [0.22, 0.72]]); P(c, [[0.52, 0.28], [0.74, 0.5], [0.52, 0.72]]); },
  onex: (c) => {
    P(c, [[0.24, 0.32], [0.36, 0.24], [0.36, 0.76]]);
    L(c, 0.52, 0.44, 0.8, 0.72); L(c, 0.8, 0.44, 0.52, 0.72);
  },
  glitch: (c) => P(c, [[0.08, 0.5], [0.28, 0.5], [0.36, 0.22], [0.46, 0.78], [0.56, 0.32], [0.64, 0.5], [0.92, 0.5]]),
  crush: (c) => P(c, [[0.12, 0.86], [0.12, 0.68], [0.32, 0.68], [0.32, 0.5], [0.52, 0.5], [0.52, 0.32], [0.72, 0.32], [0.72, 0.14], [0.88, 0.14]]),
  stopall: (c) => { c.fillRect(0.14, 0.3, 0.3, 0.4); c.fillRect(0.56, 0.3, 0.3, 0.4); },
  save: (c) => { P(c, [[0.18, 0.6], [0.18, 0.86], [0.82, 0.86], [0.82, 0.6]]); L(c, 0.5, 0.12, 0.5, 0.64); head(c, 0.5, 0.64, Math.PI / 2); },
  export: (c) => {
    P(c, [[0.56, 0.84], [0.16, 0.84], [0.16, 0.44]]);
    L(c, 0.34, 0.66, 0.84, 0.16); P(c, [[0.52, 0.16], [0.84, 0.16], [0.84, 0.48]]);
  },
  download: (c) => { L(c, 0.5, 0.14, 0.5, 0.7); head(c, 0.5, 0.7, Math.PI / 2); L(c, 0.22, 0.86, 0.78, 0.86); },
  unhide: (c) => arcArrow(c, 0.28, Math.PI * 1.85, Math.PI * 0.4, true),
  library: (c) => {
    for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(0.5, 0.3 + 0.2 * k, 0.32, 0.09, 0, 0, TAU); c.stroke(); }
  },
  mic: (c) => {
    c.beginPath(); if (c.roundRect) c.roundRect(0.38, 0.12, 0.24, 0.44, 0.12); else c.rect(0.38, 0.12, 0.24, 0.44); c.stroke();
    c.beginPath(); c.arc(0.5, 0.46, 0.21, 0, Math.PI); c.stroke();
    L(c, 0.5, 0.67, 0.5, 0.86); L(c, 0.35, 0.87, 0.65, 0.87);
  },
  aux: (c) => { // a jack plug
    O(c, 0.5, 0.11, 0.035, true); L(c, 0.5, 0.14, 0.5, 0.2);
    c.strokeRect(0.43, 0.2, 0.14, 0.3); L(c, 0.43, 0.32, 0.57, 0.32);
    c.strokeRect(0.36, 0.5, 0.28, 0.2); L(c, 0.5, 0.7, 0.5, 0.92);
  },
  sample: (c) => { // a take: a waveform caught between two marks
    L(c, 0.1, 0.2, 0.1, 0.8); L(c, 0.9, 0.2, 0.9, 0.8);
    [[0.22, 0.12], [0.32, 0.26], [0.42, 0.36], [0.52, 0.2], [0.62, 0.3], [0.72, 0.14], [0.8, 0.06]]
      .forEach(([x, h]) => L(c, x, 0.5 - h, x, 0.5 + h));
  },
  dirt: (c) => P(c, [[0.08, 0.5], [0.2, 0.26], [0.42, 0.26], [0.52, 0.5], [0.62, 0.74], [0.82, 0.74], [0.92, 0.5]]),
  wah: (c) => {
    c.beginPath(); c.moveTo(0.14, 0.7); c.quadraticCurveTo(0.5, 0.0, 0.86, 0.7); c.stroke();
    L(c, 0.22, 0.86, 0.78, 0.86); head(c, 0.78, 0.86, 0, 0.09); head(c, 0.22, 0.86, Math.PI, 0.09);
  },
  chorus: (c) => { wave(c, 0.1, 0.9, 0.38, 0.12, 1.5); wave(c, 0.1, 0.9, 0.64, 0.12, 1.5, 1.4); },
  phaser: (c) => {
    c.beginPath();
    for (let i = 0; i <= 90; i++) {
      const a = i * 0.17;
      const r = 0.02 + i * 0.0036;
      const x = 0.5 + r * Math.cos(a);
      const y = 0.5 + r * Math.sin(a);
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.stroke();
  },
  cube: (c) => {
    const pts = [];
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 3;
      pts.push([0.5 + 0.36 * Math.cos(a), 0.5 + 0.36 * Math.sin(a)]);
    }
    P(c, pts, true);
    L(c, 0.5, 0.5, pts[0][0], pts[0][1]); L(c, 0.5, 0.5, pts[2][0], pts[2][1]); L(c, 0.5, 0.5, pts[4][0], pts[4][1]);
  },
  loop: (c) => {
    c.beginPath();
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * TAU;
      const d = 1 + Math.sin(t) ** 2;
      const x = 0.5 + (0.38 * Math.cos(t)) / d;
      const y = 0.5 + (0.38 * Math.sin(t) * Math.cos(t)) / d;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.stroke();
  },
  speaker: (c) => {
    P(c, [[0.12, 0.4], [0.28, 0.4], [0.48, 0.22], [0.48, 0.78], [0.28, 0.6], [0.12, 0.6]], true);
    c.beginPath(); c.arc(0.5, 0.5, 0.17, -0.7, 0.7); c.stroke();
    c.beginPath(); c.arc(0.5, 0.5, 0.32, -0.7, 0.7); c.stroke();
  },
  home: (c) => {
    const n = [[0.5, 0.13], [0.24, 0.36], [0.76, 0.36], [0.5, 0.6], [0.5, 0.87]];
    [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [3, 4]].forEach(([a, b]) => L(c, n[a][0], n[a][1], n[b][0], n[b][1]));
    n.forEach(([x, y]) => O(c, x, y, 0.07, true));
  },
  empty: (c) => dashed(c, () => O(c, 0.5, 0.5, 0.32)),
  info: (c) => { O(c, 0.5, 0.5, 0.36); O(c, 0.5, 0.31, 0.045, true); L(c, 0.5, 0.45, 0.5, 0.72); },
};

export function drawGlyph(c, name, size, color = '#fff') {
  c.save();
  c.scale(size, size);
  c.lineWidth = LW;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = color;
  c.fillStyle = color;
  (G[name] || G.empty)(c);
  c.restore();
}

const texCache = new Map();
export function glyphTexture(name) {
  if (texCache.has(name)) return texCache.get(name);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  drawGlyph(cv.getContext('2d'), name, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(name, tex);
  return tex;
}

const urlCache = new Map();
export function glyphURL(name, color = '#d8e0c8') {
  const key = `${name}|${color}`;
  if (urlCache.has(key)) return urlCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 96;
  drawGlyph(cv.getContext('2d'), name, 96, color);
  const url = cv.toDataURL();
  urlCache.set(key, url);
  return url;
}

const textCache = new Map();
/** Short numbers and values (pad numbers, lengths). Returns a texture 2:1. */
export function textTexture(str) {
  if (textCache.has(str)) return textCache.get(str);
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff';
  c.font = '700 84px "Courier New", ui-monospace, monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(str, 128, 70);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  textCache.set(str, tex);
  return tex;
}
