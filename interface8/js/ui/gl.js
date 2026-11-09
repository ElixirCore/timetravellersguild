/* Shared Three.js helpers: palette, cached geometry, flat diagram meshes.
   Everything in the tree lies on the z = 0 plane and draws in renderOrder,
   so it reads as a diagram and hit-tests as one. */
import * as THREE from '../vendor/three.module.min.js';
import { glyphTexture, textTexture } from './glyphs.js';

export { THREE };

/* /interface2 palette */
export const C = {
  bg: 0x0d0f0a,
  ink: 0xd8e0c8,
  dim: 0x7a8468,
  hot: 0xe8b93c,
  line: 0x2a2f22,
  panel: 0x14170f,
  bad: 0xdd6666,
};

const geoCache = new Map();

export function ringGeo(r0, r1, a0 = 0, len = Math.PI * 2, seg = 64) {
  const key = `r${r0.toFixed(3)}|${r1.toFixed(3)}|${a0.toFixed(4)}|${len.toFixed(4)}|${seg}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.RingGeometry(r0, r1, seg, 1, a0, Math.max(1e-4, len));
    geoCache.set(key, g);
  }
  return g;
}

export function circleGeo(r, seg = 40) {
  const key = `c${r.toFixed(3)}|${seg}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.CircleGeometry(r, seg);
    geoCache.set(key, g);
  }
  return g;
}

const unitPlane = new THREE.PlaneGeometry(1, 1);

export function mat(color, opacity = 1, map = null) {
  return new THREE.MeshBasicMaterial({
    color, opacity, map, transparent: true, depthWrite: false, depthTest: false,
  });
}

export function mesh(geo, material, parent, order = 0) {
  const m = new THREE.Mesh(geo, material);
  m.renderOrder = order;
  parent.add(m);
  return m;
}

/** A straight line of world width w, as a thin quad. */
export function bar(parent, x1, y1, x2, y2, w, material, order = 0) {
  const m = mesh(unitPlane, material, parent, order);
  setBar(m, x1, y1, x2, y2, w);
  return m;
}

export function setBar(m, x1, y1, x2, y2, w) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0);
  m.scale.set(Math.max(1e-4, Math.hypot(dx, dy)), w, 1);
  m.rotation.z = Math.atan2(dy, dx);
}

export function glyphMesh(parent, name, size, color = C.ink, opacity = 1, order = 4) {
  const m = mesh(unitPlane, mat(color, opacity, glyphTexture(name)), parent, order);
  m.scale.set(size, size, 1);
  m.userData.glyph = name;
  return m;
}

export function setGlyph(m, name) {
  if (m.userData.glyph === name) return;
  m.userData.glyph = name;
  m.material.map = glyphTexture(name);
  m.material.needsUpdate = true;
}

export function textMesh(parent, str, h, color = C.ink, opacity = 1, order = 4) {
  const m = mesh(unitPlane, mat(color, opacity, textTexture(str)), parent, order);
  m.scale.set(h * 2, h, 1);
  m.userData.text = str;
  return m;
}

export function setText(m, str) {
  if (m.userData.text === str) return;
  m.userData.text = str;
  m.material.map = textTexture(str);
  m.material.needsUpdate = true;
}

export function hueColor(h, s = 0.62, l = 0.58) {
  return new THREE.Color().setHSL(h / 360, s, l);
}
