/* The playable parts. A Knob is a 270-degree arc you drag vertically
   (same feel as the /interface2 knobs: ~160px for the full sweep, wheel steps
   of 0.06); a Button is a disc you tap (and, where it says so, hold).
   Touch and mouse go through the same pointer path. */
import { THREE, C, ringGeo, circleGeo, mat, mesh, glyphMesh, textMesh, setText } from './gl.js';
import { clamp } from '../state.js';

export const hud = { readout: () => {}, endReadout: () => {} };

const START = Math.PI * 1.25; // value 0 sits lower-left; three.js angles run counter-clockwise
const SPAN = Math.PI * 1.5;

export class Control {
  constructor(parent, x, y, r) {
    this.g = new THREE.Group();
    this.g.position.set(x, y, 0);
    parent.add(this.g);
    this.x = x;
    this.y = y;
    this.r = r;
  }

  hit(lx, ly) {
    return this.g.visible && this.isLive() && Math.hypot(lx - this.x, ly - this.y) <= this.r * 1.2;
  }

  isLive() {
    let o = this.g;
    while (o) {
      if (!o.visible) return false;
      o = o.parent;
    }
    return true;
  }

  down() {}
  move() {}
  up() {}
}

export class Knob extends Control {
  constructor(parent, {
    x, y, r = 0.42, glyph, color = C.hot, get, set, fmt, detents = 0, sens = 160,
  }) {
    super(parent, x, y, r);
    Object.assign(this, { get, set, fmt, detents, sens, glyphName: glyph });
    mesh(circleGeo(r * 0.8), mat(C.panel, 0.92), this.g, 1);
    mesh(ringGeo(r * 0.84, r, START - SPAN, SPAN, 48), mat(C.line, 1), this.g, 2);
    this.arcMat = mat(color, 1);
    this.arc = mesh(ringGeo(r * 0.84, r, START, 1e-4, 4), this.arcMat, this.g, 3);
    this.tick = mesh(circleGeo(r * 0.11, 14), mat(C.ink, 1), this.g, 5);
    for (let i = 0; i < detents; i++) {
      const a = START - (SPAN * (i + 0.5)) / detents;
      const d = mesh(circleGeo(r * 0.05, 8), mat(C.dim, 1), this.g, 2);
      d.position.set(Math.cos(a) * r * 1.13, Math.sin(a) * r * 1.13, 0);
    }
    this.glyph = glyphMesh(this.g, glyph, r * 1.0, C.ink, 0.92);
    this.lastV = null;
    this.render();
  }

  setColor(c) { this.arcMat.color.set(c); }

  render() {
    const v = clamp(this.get(), 0, 1);
    const q = Math.round(v * 240) / 240;
    if (q === this.lastV) return;
    this.lastV = q;
    this.arc.geometry = ringGeo(this.r * 0.84, this.r, START - SPAN * q, SPAN * q, Math.max(4, Math.ceil(q * 48)));
    const a = START - SPAN * q;
    this.tick.position.set(Math.cos(a) * this.r * 0.92, Math.sin(a) * this.r * 0.92, 0);
  }

  show() {
    hud.readout(this.glyphName, this.fmt ? this.fmt(this.get()) : `${Math.round(clamp(this.get(), 0, 1) * 100)}`);
  }

  down(p) {
    this.drag = { sy: p.sy, v: clamp(this.get(), 0, 1) };
    this.show();
  }

  move(p) {
    if (!this.drag) return;
    const v = clamp(this.drag.v + (this.drag.sy - p.sy) / this.sens, 0, 1);
    if (v !== this.get()) this.set(v);
    this.render();
    this.show();
  }

  up() {
    this.drag = null;
    hud.endReadout();
  }

  wheel(dy) {
    this.set(clamp(this.get() - Math.sign(dy) * 0.06, 0, 1));
    this.render();
    this.show();
    clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => hud.endReadout(), 700);
  }
}

export class Button extends Control {
  constructor(parent, {
    x, y, r = 0.45, glyph, text, color = C.hot, onTap, onHold, holdMs = 900,
  }) {
    super(parent, x, y, r);
    Object.assign(this, { onTap, onHold, holdMs, color });
    this.base = mesh(circleGeo(r * 0.94), mat(C.panel, 0.92), this.g, 1);
    this.fillMat = mat(color, 0);
    this.fill = mesh(circleGeo(r * 0.94), this.fillMat, this.g, 2);
    this.ringMat = mat(C.dim, 1);
    this.ring = mesh(ringGeo(r * 0.9, r, 0, Math.PI * 2, 48), this.ringMat, this.g, 3);
    this.label = text != null
      ? textMesh(this.g, text, r * 0.8, C.ink, 1, 4)
      : glyphMesh(this.g, glyph, r * 1.05, C.ink, 1, 4);
    this.lit = false;
  }

  /** lit: filled; ring: outline colour; tint: fill colour */
  setLit(on, tint) {
    this.lit = !!on;
    if (tint != null) this.fillMat.color.set(tint);
    this.fillMat.opacity = on ? 0.95 : 0;
    this.label.material.color.set(on ? C.bg : C.ink);
  }

  setRing(color, opacity = 1) {
    this.ringMat.color.set(color);
    this.ringMat.opacity = opacity;
  }

  setText(str) { setText(this.label, str); }

  down() {
    this.held = false;
    if (this.onHold) {
      clearTimeout(this.holdTimer);
      this.holdTimer = setTimeout(() => {
        this.held = true;
        try { navigator.vibrate?.(12); } catch { /* unsupported */ }
        this.onHold();
      }, this.holdMs);
    }
  }

  move(p) {
    if (p.moved) clearTimeout(this.holdTimer);
  }

  up(p, tapped) {
    clearTimeout(this.holdTimer);
    if (tapped && !this.held) this.onTap?.();
  }
}

/** Builds the drag readout text for frequencies. */
export function hz(f) {
  return f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)}k` : `${Math.round(f)}`;
}

export function pct(v) {
  return `${Math.round(clamp(v, 0, 1) * 100)}`;
}
