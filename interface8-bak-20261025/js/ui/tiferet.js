/* TIFERET · the heart: the /interface2 mixer inside a tesseract.
   Eight cells, eight tracks. The chosen track's whole chain is laid out round
   the centre in signal order: the clip (a ring of its waveform, with its loop
   points) feeds pitch > drive > filter > reson > wobble rate > wobble >
   echo length > echo > hall > volume. */
import { C, THREE, ringGeo, circleGeo, mat, mesh, bar, hueColor, setGlyph } from './gl.js';
import { Control, Knob, Button, hud, hz, pct } from './widgets.js';
import { buildTesseract } from './tesseract.js';
import { MAX_TRACKS, clamp } from '../state.js';
import {
  slots, live, applyLive, toggleTrack, removeTrack, applyMuteSolo, setLoopPoint, resetLoop,
  advancePos, rateHz, cutHz, resQ, wobHz, echoSec, onTracks,
} from '../audio/tracks.js';
import { levelOf } from '../audio/engine.js';
import { PAD_HUES } from './stations.js';

const TAU = Math.PI * 2;
const WAVE_IN = 0.95;
const WAVE_OUT = 1.62;
const fracToAngle = (f) => Math.PI / 2 - f * TAU;
const angleToFrac = (a) => ((((Math.PI / 2 - a) / TAU) % 1) + 1) % 1;

export const TRACK_COLORS = PAD_HUES.map((h) => hueColor(h, 0.62, 0.58));

const CHAIN = [
  ['rate', 'pitch', (K) => `${rateHz(K).toFixed(2)}×`],
  ['drive', 'bolt', (K) => pct(K.drive)],
  ['cut', 'cut', (K) => hz(cutHz(K))],
  ['res', 'res', (K) => `Q${resQ(K).toFixed(1)}`],
  ['wobr', 'wobr', (K) => `${wobHz(K).toFixed(1)}Hz`],
  ['wobd', 'wobd', (K) => pct(K.wobd)],
  ['etime', 'etime', (K) => `${Math.round(echoSec(K) * 1000)}ms`],
  ['space', 'echo', (K) => pct(K.space)],
  ['hall', 'hall', (K) => pct(K.hall)],
  ['vol', 'vol', null],
];

/* a polar waveform per clip, drawn once */
const waveTex = new WeakMap();
function waveTexture(buf) {
  if (waveTex.has(buf)) return waveTex.get(buf);
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const d = buf.getChannelData(0);
  const N = 240;
  const step = Math.max(1, Math.floor(d.length / N));
  const r0 = (WAVE_IN / WAVE_OUT) * (S / 2);
  const r1 = S / 2 - 2;
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.lineWidth = 3;
  c.lineCap = 'round';
  let peak = 0.0001;
  const bins = [];
  for (let b = 0; b < N; b++) {
    let mx = 0;
    for (let i = b * step, e = Math.min(d.length, i + step); i < e; i += Math.max(1, step >> 5)) {
      const a = Math.abs(d[i]); if (a > mx) mx = a;
    }
    bins.push(mx);
    peak = Math.max(peak, mx);
  }
  bins.forEach((mx, b) => {
    const a = fracToAngle((b + 0.5) / N);
    const h = Math.max(0.03, mx / peak);
    const ra = r0;
    const rb = r0 + (r1 - r0) * h;
    c.beginPath();
    c.moveTo(S / 2 + Math.cos(a) * ra, S / 2 - Math.sin(a) * ra);
    c.lineTo(S / 2 + Math.cos(a) * rb, S / 2 - Math.sin(a) * rb);
    c.stroke();
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  waveTex.set(buf, tex);
  return tex;
}

class WaveRing extends Control {
  constructor(parent, getTrack) {
    super(parent, 0, 0, WAVE_OUT);
    this.getTrack = getTrack;
  }

  hit(lx, ly) {
    const d = Math.hypot(lx, ly);
    return this.isLive() && d >= 0.8 && d <= WAVE_OUT + 0.35;
  }

  pick(lx, ly) {
    const t = this.getTrack();
    let f = angleToFrac(Math.atan2(ly, lx));
    const last = this.which === 'start' ? t.ls : t.le;
    if (Math.abs(f - last) > 0.5) f = last > 0.5 ? 1 : 0; // no jump across the top
    setLoopPoint(t, this.which, f);
    hud.readout('whole', `${(t.ls * t.buf.duration).toFixed(2)}–${(t.le * t.buf.duration).toFixed(2)}s`);
  }

  down(p) {
    const t = this.getTrack();
    const f = angleToFrac(Math.atan2(p.ly, p.lx));
    const dist = (a, b) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
    this.which = dist(f, t.ls) <= dist(f, t.le) ? 'start' : 'end';
    if (t.ls === 0 && t.le === 1) this.which = f < 0.5 ? 'start' : 'end'; // both handles sit at the top
    this.pick(p.lx, p.ly);
  }

  move(p) { this.pick(p.lx, p.ly); }

  up() { hud.endReadout(); }
}

/* the /interface2 dish: x filter, y pitch */
class XYDish extends Control {
  constructor(parent, x, y, h, getTrack, onSet) {
    super(parent, x, y, h);
    this.h = h;
    this.getTrack = getTrack;
    this.onSet = onSet;
    const frame = mat(C.dim, 0.8);
    mesh(new THREE.PlaneGeometry(2 * h, 2 * h), mat(C.panel, 0.92), this.g, 1);
    bar(this.g, -h, -h, h, -h, 0.04, frame, 2);
    bar(this.g, h, -h, h, h, 0.04, frame, 2);
    bar(this.g, h, h, -h, h, 0.04, frame, 2);
    bar(this.g, -h, h, -h, -h, 0.04, frame, 2);
    const cross = mat(C.line, 1);
    this.hx = bar(this.g, -h, 0, h, 0, 0.02, cross, 2);
    this.hy = bar(this.g, 0, -h, 0, h, 0.02, cross, 2);
    this.dotMat = mat(C.hot, 1);
    this.dot = mesh(circleGeo(0.11, 16), this.dotMat, this.g, 3);
  }

  hit(lx, ly) {
    return this.isLive() && Math.abs(lx - this.x) <= this.h * 1.1 && Math.abs(ly - this.y) <= this.h * 1.1;
  }

  render() {
    const t = this.getTrack();
    if (!live(t)) return;
    const x = (t.K.cut * 2 - 1) * this.h;
    const y = (t.K.rate * 2 - 1) * this.h;
    this.dot.position.set(x, y, 0);
  }

  set(p) {
    const t = this.getTrack();
    t.K.cut = clamp((p.lx - (this.x - this.h)) / (2 * this.h), 0, 1);
    t.K.rate = clamp((p.ly - (this.y - this.h)) / (2 * this.h), 0, 1);
    applyLive(t);
    this.onSet();
    hud.readout('cut', `${hz(cutHz(t.K))} · ${rateHz(t.K).toFixed(2)}×`);
  }

  down(p) { this.set(p); }
  move(p) { this.set(p); }
  up() { hud.endReadout(); }
}

export function buildTiferet(st, app) {
  let focus = 0;
  const cur = () => slots[focus];

  const tessGroup = new THREE.Group();
  tessGroup.position.z = -0.6;
  st.g.add(tessGroup);
  const tess = buildTesseract(tessGroup, 2.45);

  /* the eight cells, chosen from an arc at the top */
  const markers = [];
  for (let k = 0; k < MAX_TRACKS; k++) {
    const a = ((90 + (3.5 - k) * 14) * Math.PI) / 180;
    markers.push(st.add(new Button(st.g, {
      x: Math.cos(a) * 3.42, y: Math.sin(a) * 3.42, r: 0.3, glyph: 'cube',
      onTap: () => setFocus(k),
    })));
  }

  const tg = new THREE.Group();
  st.g.add(tg);

  /* the chain path the knobs sit on */
  const chainMat = mat(C.dim, 0.45);
  const A0 = (200 * Math.PI) / 180;
  const A1 = (-20 * Math.PI) / 180;
  const KR = 2.5;
  mesh(ringGeo(KR - 0.025, KR + 0.025, A1, A0 - A1, 96), chainMat, tg, 0);
  bar(tg, Math.cos(A0) * WAVE_OUT, Math.sin(A0) * WAVE_OUT, Math.cos(A0) * (KR - 0.4), Math.sin(A0) * (KR - 0.4), 0.05, chainMat, 0);

  /* waveform ring with loop points */
  const waveMat = mat(C.ink, 0.5);
  const wave = mesh(new THREE.PlaneGeometry(WAVE_OUT * 2, WAVE_OUT * 2), waveMat, tg, 1);
  const loopMat = mat(C.hot, 0.22);
  const loopArc = mesh(ringGeo(WAVE_IN, WAVE_OUT, 0, TAU, 4), loopMat, tg, 2);
  const handleMat = mat(C.hot, 1);
  const hStart = mesh(circleGeo(0.13, 14), handleMat, tg, 4);
  const hEnd = mesh(circleGeo(0.13, 14), handleMat, tg, 4);
  const playhead = bar(tg, 0, 0, 0, 1, 0.045, mat(C.ink, 0.95), 4);
  st.add(new WaveRing(tg, cur));

  const play = st.add(new Button(tg, { x: 0, y: 0, r: 0.62, glyph: 'play', onTap: () => toggleTrack(cur()) }));

  const knobs = CHAIN.map(([key, glyph, fmt], k) => {
    const a = A0 - ((A0 - A1) * k) / (CHAIN.length - 1);
    return st.add(new Knob(tg, {
      x: Math.cos(a) * KR, y: Math.sin(a) * KR, r: 0.38, glyph,
      get: () => (live(cur()) ? (key === 'vol' ? cur().vol : cur().K[key]) : 0),
      set: (v) => {
        const t = cur();
        if (!live(t)) return;
        if (key === 'vol') t.vol = v; else t.K[key] = v;
        applyLive(t);
        dish.render();
      },
      fmt: fmt ? () => fmt(cur().K) : null,
    }));
  });

  const mute = st.add(new Button(tg, {
    x: -1.5, y: -2.4, r: 0.36, glyph: 'mute', color: C.bad,
    onTap: () => { const t = cur(); if (live(t)) { t.mute = !t.mute; applyMuteSolo(); } },
  }));
  const solo = st.add(new Button(tg, {
    x: -0.62, y: -2.4, r: 0.36, glyph: 'solo',
    onTap: () => { const t = cur(); if (live(t)) { t.solo = !t.solo; applyMuteSolo(); } },
  }));
  const whole = st.add(new Button(tg, {
    x: 0.26, y: -2.4, r: 0.36, glyph: 'whole',
    onTap: () => { const t = cur(); if (live(t)) resetLoop(t); },
  }));
  st.add(new Button(tg, {
    x: -1.06, y: -3.2, r: 0.32, glyph: 'remove',
    onTap: () => removeTrack(focus),
  }));
  const dish = st.add(new XYDish(tg, 1.5, -2.72, 0.58, cur, () => knobs.forEach((k) => k.render())));

  /* an empty cell points to the library */
  const empty = new THREE.Group();
  st.g.add(empty);
  const emptyBtn = st.add(new Button(empty, { x: 0, y: 0, r: 0.85, glyph: 'library', onTap: () => app.fly('chokmah') }));
  emptyBtn.setRing(C.dim, 0.6);

  const caption = document.getElementById('caption');
  st.overlay(caption, [-3.6, -4.65, 3.6, -4.05]);

  function setFocus(k) {
    focus = k;
    tess.setFocus(k);
    refresh();
  }

  function refresh() {
    const t = cur();
    const has = live(t);
    tg.visible = has;
    empty.visible = !has;
    caption.textContent = '';
    if (t) { const sp = document.createElement('span'); sp.textContent = t.label; caption.appendChild(sp); }
    if (has) {
      wave.material.map = waveTexture(t.buf);
      wave.material.needsUpdate = true;
      knobs.forEach((kn) => { kn.lastV = null; kn.setColor(TRACK_COLORS[focus]); kn.render(); });
      dish.dotMat.color.copy(TRACK_COLORS[focus]);
      dish.render();
    }
  }
  onTracks(refresh);

  let time = 0;
  const levels = new Array(MAX_TRACKS).fill(0);
  st.onUpdate((dt) => {
    time += dt;
    slots.forEach((t, k) => {
      advancePos(t, dt);
      const lv = live(t) && t.playing ? levelOf(t.meter) : 0;
      levels[k] += (lv - levels[k]) * Math.min(1, dt * 10);
      const m = markers[k];
      const loading = t && t.loading;
      m.setLit(live(t) && t.playing, TRACK_COLORS[k]);
      m.setRing(k === focus ? C.hot : (live(t) || loading ? TRACK_COLORS[k] : C.dim), loading ? 0.4 + 0.6 * (Math.sin(time * 8) > 0) : 1);
    });
    tess.update(dt, focus, (k) => ({ color: live(slots[k]) && slots[k].playing ? TRACK_COLORS[k] : null, level: levels[k] }));

    const t = cur();
    if (!live(t)) return;
    const a0 = fracToAngle(t.le);
    const q = (v) => Math.round(v * 720) / 720; // bounds the geometry cache while dragging
    loopArc.geometry = ringGeo(WAVE_IN, WAVE_OUT, fracToAngle(q(t.le)), Math.max(1e-4, (q(t.le) - q(t.ls)) * TAU), Math.max(4, Math.ceil((t.le - t.ls) * 96)));
    loopMat.color.copy(TRACK_COLORS[focus]);
    const as = fracToAngle(t.ls);
    hStart.position.set(Math.cos(as) * (WAVE_OUT + 0.16), Math.sin(as) * (WAVE_OUT + 0.16), 0);
    hEnd.position.set(Math.cos(a0) * (WAVE_OUT + 0.16), Math.sin(a0) * (WAVE_OUT + 0.16), 0);
    const ap = fracToAngle(t.pos);
    playhead.visible = t.playing;
    if (t.playing) {
      playhead.position.set(Math.cos(ap) * (WAVE_IN + WAVE_OUT) / 2, Math.sin(ap) * (WAVE_IN + WAVE_OUT) / 2, 0);
      playhead.scale.set(WAVE_OUT - WAVE_IN + 0.1, 0.045, 1);
      playhead.rotation.z = ap;
    }
    waveMat.opacity = t.playing ? 0.55 + levels[focus] * 0.4 : 0.35;
    play.setLit(t.playing, TRACK_COLORS[focus]);
    setGlyph(play.label, t.playing ? 'stop' : 'play');
    const soloed = slots.some((x) => live(x) && x.solo);
    mute.setLit(t.mute, C.bad);
    solo.setLit(t.solo, C.hot);
    mute.setRing(soloed && !t.solo ? C.bad : C.dim, soloed && !t.solo ? 0.6 : 1);
    whole.g.visible = t.ls > 0 || t.le < 1;
    knobs.forEach((kn) => kn.render());
    dish.render();
  });

  setFocus(0);
  return { setFocus, focus: () => focus };
}
