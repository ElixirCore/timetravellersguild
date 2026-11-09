/* The Tree of Life as the signal path. Ten sephirot are the ten parts of the
   instrument; the 22 paths are drawn, and the ones that carry audio light up
   with what is actually flowing through them. Routing is fixed: it follows the
   tree from the crown (the word that becomes a sound) down to the kingdom
   (the speaker).

     KETER     generate (prompt -> clip)
     CHOKMAH   the clip library            BINAH    FIELD TAP (mic pads)
     CHESED    CHORUS + PHASER             GEVURAH  DIRT + WAH
     TIFERET   the tesseract: eight tracks (the /interface2 mixer)
     NETZACH   ECHO                        HOD      VERB
     YESOD     LOOPSMITH
     MALKUTH   out: stop all, keep, export, kept mixes */
import { THREE, C, ringGeo, circleGeo, mat, mesh, bar, glyphMesh } from './gl.js';

const U = 4.2;
const R3 = Math.sqrt(3);

export const LAYOUT = {
  keter:   { x: 0,       y: 8 * U, R: 3.2, glyph: 'word' },
  chokmah: { x: R3 * U,  y: 7 * U, R: 3.2, glyph: 'library' },
  binah:   { x: -R3 * U, y: 7 * U, R: 3.2, glyph: 'mic' },
  chesed:  { x: R3 * U,  y: 5 * U, R: 3.2, glyph: 'chorus' },
  gevurah: { x: -R3 * U, y: 5 * U, R: 3.2, glyph: 'dirt' },
  tiferet: { x: 0,       y: 4 * U, R: 4.0, glyph: 'cube' },
  netzach: { x: R3 * U,  y: 3 * U, R: 2.9, glyph: 'echo' },
  hod:     { x: -R3 * U, y: 3 * U, R: 2.9, glyph: 'hall' },
  yesod:   { x: 0,       y: 2 * U, R: 3.2, glyph: 'loop' },
  malkuth: { x: 0,       y: 0,     R: 3.1, glyph: 'speaker' },
};

export const PATHS = [
  ['keter', 'chokmah'], ['keter', 'binah'], ['keter', 'tiferet'], ['chokmah', 'binah'],
  ['chokmah', 'tiferet'], ['chokmah', 'chesed'], ['binah', 'tiferet'], ['binah', 'gevurah'],
  ['chesed', 'gevurah'], ['chesed', 'tiferet'], ['chesed', 'netzach'], ['gevurah', 'tiferet'],
  ['gevurah', 'hod'], ['tiferet', 'netzach'], ['tiferet', 'yesod'], ['tiferet', 'hod'],
  ['netzach', 'hod'], ['netzach', 'yesod'], ['netzach', 'malkuth'], ['hod', 'yesod'],
  ['hod', 'malkuth'], ['yesod', 'malkuth'],
];

export function neighbours(key) {
  return PATHS.filter((p) => p.includes(key)).map((p) => (p[0] === key ? p[1] : p[0]));
}

export class Station {
  constructor(scene, key) {
    const L = LAYOUT[key];
    Object.assign(this, { key, x: L.x, y: L.y, R: L.R, glyph: L.glyph });
    this.g = new THREE.Group();
    this.g.position.set(L.x, L.y, 0);
    scene.add(this.g);
    this.controls = [];
    this.overlays = [];
    this.updaters = [];
    this.ringMat = mat(C.dim, 0.55);
    mesh(circleGeo(this.R, 72), mat(C.bg, 0.94), this.g, -2);
    mesh(ringGeo(this.R - 0.035, this.R, 0, Math.PI * 2, 96), this.ringMat, this.g, -1);
    if (key !== 'tiferet') {
      this.icon = glyphMesh(this.g, L.glyph, 0.62, C.dim, 0.9, 4);
      this.icon.position.set(0, this.R + 0.5, 0);
    }
    /* while you are at another station this one recedes: its controls are
       not live there, a tap on it travels to it */
    this.veil = mesh(circleGeo(this.R + 1.25, 72), mat(C.bg, 0), this.g, 60);
  }

  add(control) {
    this.controls.push(control);
    return control;
  }

  overlay(el, rect) {
    this.overlays.push({ el, rect });
  }

  onUpdate(fn) {
    this.updaters.push(fn);
  }

  hitControl(lx, ly) {
    for (let i = this.controls.length - 1; i >= 0; i--) {
      if (this.controls[i].hit(lx, ly)) return this.controls[i];
    }
    return null;
  }

  update(dt, focused, elsewhere) {
    const veil = elsewhere ? 0.6 : 0;
    const vm = this.veil.material;
    vm.opacity += (veil - vm.opacity) * Math.min(1, dt * 6);
    this.veil.visible = vm.opacity > 0.01;
    this.ringMat.color.set(focused ? C.hot : C.dim);
    this.ringMat.opacity = focused ? 0.8 : 0.5;
    if (this.icon) this.icon.material.color.set(focused ? C.hot : C.dim);
    for (const fn of this.updaters) fn(dt);
  }
}

/* Draws the 22 paths and the live routes. routes: [from, to, level()] */
export function buildPaths(scene, routes) {
  const group = new THREE.Group();
  scene.add(group);
  const ends = (a, b) => {
    const A = LAYOUT[a];
    const B = LAYOUT[b];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const d = Math.hypot(dx, dy);
    const ux = dx / d;
    const uy = dy / d;
    return { x1: A.x + ux * A.R, y1: A.y + uy * A.R, x2: B.x - ux * B.R, y2: B.y - uy * B.R };
  };
  const faint = mat(C.dim, 0.22);
  PATHS.forEach(([a, b]) => {
    const e = ends(a, b);
    bar(group, e.x1, e.y1, e.x2, e.y2, 0.05, faint, -4);
  });

  const live = routes.map(([a, b, level]) => {
    const e = ends(a, b);
    const m = mat(C.hot, 0.15);
    bar(group, e.x1, e.y1, e.x2, e.y2, 0.11, m, -3);
    const dots = [0, 1, 2, 3].map((i) => {
      const dm = mat(C.hot, 0);
      const dot = mesh(circleGeo(0.16, 12), dm, group, -3);
      return { dot, dm, phase: i / 4 };
    });
    return { e, m, dots, level, smooth: 0 };
  });

  function update(dt) {
    for (const r of live) {
      const v = Math.max(0, Math.min(1, r.level() || 0));
      r.smooth += (v - r.smooth) * Math.min(1, dt * 10);
      r.m.opacity = 0.14 + r.smooth * 0.75;
      for (const d of r.dots) {
        d.phase = (d.phase + dt * (0.25 + r.smooth * 0.9)) % 1;
        d.dot.position.set(r.e.x1 + (r.e.x2 - r.e.x1) * d.phase, r.e.y1 + (r.e.y2 - r.e.y1) * d.phase, 0);
        d.dm.opacity = r.smooth > 0.02 ? Math.min(1, 0.25 + r.smooth * 1.2) * Math.sin(d.phase * Math.PI) : 0;
      }
    }
  }

  return { group, update };
}

export function treeBounds() {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const L of Object.values(LAYOUT)) {
    x0 = Math.min(x0, L.x - L.R); x1 = Math.max(x1, L.x + L.R);
    y0 = Math.min(y0, L.y - L.R); y1 = Math.max(y1, L.y + L.R + 1);
  }
  return { x0, x1, y0, y1 };
}
