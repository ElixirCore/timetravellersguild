/**
 * orrery.js — Geocentric Chronometer № 13 orrery, ported for /box.
 *
 * Exports createOrrery() and updateOrrery(). The astronomy math
 * (ephemeris, gmst) is identical to chronometer.js — one instrument,
 * two rooms.
 */

import * as THREE from 'three';

// ── Astronomy ────────────────────────────────────────────────────────
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const rev  = d => (d % 360 + 360) % 360;
const sind = x => Math.sin(x * D2R);
const cosd = x => Math.cos(x * D2R);
const atan2d = (y, x) => rev(Math.atan2(y, x) * R2D);

function kepler(M, e) {
  let E = M + e * R2D * sind(M) * (1 + e * cosd(M));
  for (let i = 0; i < 6; i++) E = E - (E - e * R2D * sind(E) - M) / (1 - e * cosd(E));
  return E;
}
function helio(N, i, w, a, e, M) {
  const E  = kepler(M, e);
  const xv = a * (cosd(E) - e), yv = a * Math.sqrt(1 - e * e) * sind(E);
  const v  = atan2d(yv, xv), r = Math.hypot(xv, yv);
  const u  = v + w;
  return {
    x: r * (cosd(N) * cosd(u) - sind(N) * sind(u) * cosd(i)),
    y: r * (sind(N) * cosd(u) + cosd(N) * sind(u) * cosd(i)), r,
  };
}
function sunXY(d) {
  const ws = rev(282.9404 + 4.70935e-5 * d), es = 0.016709 - 1.151e-9 * d,
        Ms = rev(356.0470 + 0.9856002585 * d);
  const Es = kepler(Ms, es);
  const xe = cosd(Es) - es, ye = Math.sqrt(1 - es * es) * sind(Es);
  const lon = rev(atan2d(ye, xe) + ws), r = Math.hypot(xe, ye);
  return { x: r * cosd(lon), y: r * sind(lon), lon, r, Ms, ws };
}
export function venusGeoXY(dateMs) {
  const d = dateMs / 86400000 - 10956;
  const s = sunXY(d);
  const h = helio(rev(76.6799 + 2.4659e-5 * d), 3.3946, rev(54.8910 + 1.38374e-5 * d),
                  0.723330, 0.006773 - 1.302e-9 * d, rev(48.0052 + 1.6021302244 * d));
  return { x: h.x + s.x, y: h.y + s.y };
}
export function ephemeris(dateMs) {
  const d  = dateMs / 86400000 - 10956;
  const s  = sunXY(d);
  const Nm = rev(125.1228 - 0.0529538083 * d), wm = rev(318.0634 + 0.1643573223 * d),
        Mm = rev(115.3654 + 13.0649929509 * d);
  const mp = helio(Nm, 5.1454, wm, 60.2666, 0.0549, Mm);
  let moonLon = atan2d(mp.y, mp.x);
  const Ls = rev(s.Ms + s.ws), Lm = rev(Mm + wm + Nm), Dm = rev(Lm - Ls), F = rev(Lm - Nm);
  moonLon = rev(moonLon
    - 1.274 * sind(Mm - 2 * Dm) + 0.658 * sind(2 * Dm) - 0.186 * sind(s.Ms)
    - 0.059 * sind(2 * Mm - 2 * Dm) - 0.057 * sind(Mm - 2 * Dm + s.Ms) + 0.053 * sind(Mm + 2 * Dm)
    + 0.046 * sind(2 * Dm - s.Ms) + 0.041 * sind(Mm - s.Ms) - 0.035 * sind(Dm)
    - 0.031 * sind(Mm + s.Ms) - 0.015 * sind(2 * F - 2 * Dm) + 0.011 * sind(Mm - 4 * Dm));
  const el = {
    mercury: [48.3313 + 3.24587e-5 * d, 7.0047, 29.1241 + 1.01444e-5 * d, 0.387098, 0.205635 + 5.59e-10 * d, 168.6562 + 4.0923344368 * d],
    venus:   [76.6799 + 2.4659e-5 * d, 3.3946, 54.8910 + 1.38374e-5 * d, 0.723330, 0.006773 - 1.302e-9 * d, 48.0052 + 1.6021302244 * d],
    mars:    [49.5574 + 2.11081e-5 * d, 1.8497, 286.5016 + 2.92961e-5 * d, 1.523688, 0.093405 + 2.516e-9 * d, 18.6021 + 0.5240207766 * d],
    jupiter: [100.4542 + 2.76854e-5 * d, 1.3030, 273.8777 + 1.64505e-5 * d, 5.20256, 0.048498 + 4.469e-9 * d, 19.8950 + 0.0830853001 * d],
    saturn:  [113.6634 + 2.3898e-5 * d, 2.4886, 339.3939 + 2.97661e-5 * d, 9.55475, 0.055546 - 9.499e-9 * d, 316.9670 + 0.0334442282 * d],
    uranus:  [74.0005 + 1.3978e-5 * d, 0.7733 + 1.9e-8 * d, 96.6612 + 3.0565e-5 * d, 19.18171 - 1.55e-8 * d, 0.047318 + 7.45e-9 * d, 142.5905 + 0.011725806 * d],
    neptune: [131.7806 + 3.0173e-5 * d, 1.7700 - 2.55e-7 * d, 272.8461 - 6.027e-6 * d, 30.05826 + 3.313e-8 * d, 0.008606 + 2.15e-9 * d, 260.2471 + 0.005995147 * d],
  };
  const Mj = rev(el.jupiter[5]), Msa = rev(el.saturn[5]), Mu = rev(el.uranus[5]);
  const out = { sun: { lon: s.lon, dist: s.r }, moon: { lon: moonLon, dist: mp.r / 23455 } };
  for (const k in el) {
    const [N, i, w, a, e, M] = el[k];
    const h = helio(rev(N), i, rev(w), a, e, rev(M));
    let lc = 0;
    if (k === 'jupiter') lc = -0.332 * sind(2 * Mj - 5 * Msa - 67.6) - 0.056 * sind(2 * Mj - 2 * Msa + 21)
      + 0.042 * sind(3 * Mj - 5 * Msa + 21) - 0.036 * sind(Mj - 2 * Msa) + 0.022 * cosd(Mj - Msa)
      + 0.023 * sind(2 * Mj - 3 * Msa + 52) - 0.016 * sind(Mj - 5 * Msa - 69);
    if (k === 'saturn') lc = 0.812 * sind(2 * Mj - 5 * Msa - 67.6) - 0.229 * cosd(2 * Mj - 4 * Msa - 2)
      + 0.119 * sind(Mj - 2 * Msa - 3) + 0.046 * sind(2 * Mj - 6 * Msa - 69) + 0.014 * sind(Mj - 3 * Msa + 32);
    if (k === 'uranus') lc = 0.040 * sind(Msa - 2 * Mu + 6) + 0.035 * sind(Msa - 3 * Mu + 33) - 0.015 * sind(Mj - Mu + 20);
    if (lc) {
      const hl = atan2d(h.y, h.x) + lc, hr = Math.hypot(h.x, h.y);
      h.x = hr * cosd(hl); h.y = hr * sind(hl);
    }
    const gx = h.x + s.x, gy = h.y + s.y;
    out[k] = { lon: atan2d(gy, gx), dist: Math.hypot(gx, gy) };
  }
  { // Pluto
    const S = rev(50.03 + 0.033459652 * d), P = rev(238.95 + 0.003968789 * d);
    const lo = rev(238.9508 + 0.00400703 * d
      - 19.799 * sind(P) + 19.848 * cosd(P) + 0.897 * sind(2 * P) - 4.956 * cosd(2 * P)
      + 0.610 * sind(3 * P) + 1.211 * cosd(3 * P) - 0.341 * sind(4 * P) - 0.190 * cosd(4 * P)
      + 0.128 * sind(5 * P) - 0.034 * cosd(5 * P) - 0.038 * sind(6 * P) + 0.031 * cosd(6 * P)
      + 0.020 * sind(S - P) - 0.010 * cosd(S - P));
    const r  = 40.72 + 6.68 * sind(P) + 6.90 * cosd(P) - 1.18 * sind(2 * P) - 0.03 * cosd(2 * P)
      + 0.15 * sind(3 * P) - 0.14 * cosd(3 * P);
    const gx = r * cosd(lo) + s.x, gy = r * sind(lo) + s.y;
    out.pluto = { lon: atan2d(gy, gx), dist: Math.hypot(gx, gy) };
  }
  return out;
}
export const gmst = ms => rev(280.46061837 + 360.98564736629 * (ms / 86400000 - 10957.5));

// ── Scene helpers ────────────────────────────────────────────────────
function circleLine(r, color, opacity, segs = 180) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = i / segs * Math.PI * 2;
    pts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), 0));
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
}
function glowSprite(hex, size, alpha = 1) {
  const c  = document.createElement('canvas'); c.width = c.height = 128;
  const x  = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  const col = '#' + hex.toString(16).padStart(6, '0');
  gr.addColorStop(0, col); gr.addColorStop(0.3, col + '99'); gr.addColorStop(1, 'transparent');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: alpha,
  }));
  s.scale.set(size, size, 1); return s;
}
function sphericalEdges(geom, R, color, opacity) {
  const eg  = new THREE.EdgesGeometry(geom);
  const p   = eg.attributes.position, pos = [];
  const a   = new THREE.Vector3(), b = new THREE.Vector3(), v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 2) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1);
    for (let s = 0; s < 14; s++) {
      v.lerpVectors(a, b, s / 14).normalize().multiplyScalar(R);
      w.lerpVectors(a, b, (s + 1) / 14).normalize().multiplyScalar(R);
      pos.push(v.x, v.y, v.z, w.x, w.y, w.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}
function bead(color, size) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.TetrahedronGeometry(size), new THREE.MeshBasicMaterial({ color }));
  g.add(t);
  g.add(glowSprite(color, size * 6, 0.8));
  g.userData.tet = t;
  return g;
}
function hand(ringR, color, beadSize) {
  const grp  = new THREE.Group();
  grp.add(circleLine(ringR, color, 0.2));
  const spar = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.55, 0), new THREE.Vector3(0, ringR, 0)]),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  grp.add(spar);
  const b = bead(color, beadSize); b.position.set(0, ringR, 0.08);
  grp.add(b);
  grp.userData.bead = b;
  return grp;
}

// ── Bodies ───────────────────────────────────────────────────────────
const BODIES = [
  { key: 'moon',    name: 'Luna',    glyph: '☾', color: 0xd8d2c4, ring: 3.8,  size: 0.20, tier: 0.55 },
  { key: 'mercury', name: 'Mercury', glyph: '☿', color: 0xb98d5e, ring: 4.65, size: 0.15, tier: 0.85 },
  { key: 'venus',   name: 'Venus',   glyph: '♀', color: 0xe3cf9e, ring: 5.5,  size: 0.22, tier: 1.15 },
  { key: 'sun',     name: 'Sol',     glyph: '☉', color: 0xd9a441, ring: 6.45, size: 0.62, tier: 1.45 },
  { key: 'mars',    name: 'Mars',    glyph: '♂', color: 0xb3573f, ring: 7.35, size: 0.18, tier: 1.75 },
  { key: 'jupiter', name: 'Jupiter', glyph: '♃', color: 0xc2a075, ring: 8.25, size: 0.30, tier: 2.05 },
  { key: 'saturn',  name: 'Saturn',  glyph: '♄', color: 0xb8ab7d, ring: 9.15, size: 0.26, tier: 2.35 },
  { key: 'uranus',  name: 'Uranus',  glyph: '♅', color: 0xa8c4b0, ring: 10.0, size: 0.24, tier: 2.6  },
  { key: 'neptune', name: 'Neptune', glyph: '♆', color: 0x8aa8b8, ring: 10.85, size: 0.23, tier: 2.85 },
  { key: 'pluto',   name: 'Pluto',   glyph: '♇', color: 0xb59a8a, ring: 11.7, size: 0.12, tier: 3.1  },
];

// ── Rose of Venus ─────────────────────────────────────────────────────
const ROSE_SCALE = 3.35, ROSE_SPAN = 8 * 365.25 * 86400000;

// ── createOrrery ─────────────────────────────────────────────────────
/**
 * Build the orrery and attach it to `scene`. Returns a state object
 * consumed by updateOrrery() each frame.
 *
 * @param {THREE.Scene}    scene
 * @param {THREE.WebGLRenderer} renderer  — needed for anisotropy
 * @param {object}         opts
 * @param {number}         [opts.scale=1]   — uniform scale for the whole orrery
 * @param {THREE.Vector3}  [opts.offset]    — world-space offset from origin
 */
export function createOrrery(scene, renderer, { scale = 1, offset = new THREE.Vector3(0, 0, 0) } = {}) {
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  root.position.copy(offset);
  scene.add(root);

  // ── Earth grid ──
  const EARTH_R = 1.12, GLOBE_Z = 1.55;
  const earthGrid = new THREE.Group();
  earthGrid.position.z = GLOBE_Z;
  root.add(earthGrid);
  {
    const gridCol = 0x9a8a6c;
    for (let m = 0; m < 12; m++) {
      const mer = circleLine(EARTH_R, gridCol, 0.14, 90);
      mer.rotation.x = Math.PI / 2; mer.rotation.y = m * Math.PI / 12;
      earthGrid.add(mer);
    }
    [[0, 0.32], [19.47, 0.24], [-19.47, 0.24], [52, 0.1], [-52, 0.1]].forEach(([lat, op]) => {
      const ring = circleLine(EARTH_R * cosd(lat), lat === 0 ? 0xc9a45c : gridCol, op, 120);
      ring.position.z = EARTH_R * sind(lat);
      earthGrid.add(ring);
    });
    earthGrid.add(sphericalEdges(new THREE.IcosahedronGeometry(1, 0), EARTH_R * 1.002, 0x7fae94, 0.8));
    earthGrid.add(sphericalEdges(new THREE.DodecahedronGeometry(1, 0), EARTH_R * 1.002, 0x8a7040, 0.4));
    const tg = new THREE.TetrahedronGeometry(EARTH_R * 0.98);
    const q  = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 1, 1).normalize(), new THREE.Vector3(0, 0, 1));
    const tetra = new THREE.LineSegments(
      new THREE.EdgesGeometry(tg),
      new THREE.LineBasicMaterial({ color: 0xe6c07a, transparent: true, opacity: 0.85 }),
    );
    tetra.quaternion.copy(q);
    earthGrid.add(tetra);
    earthGrid.add(glowSprite(0xc98a52, 1.1, 0.8));
  }
  const earthAura = glowSprite(0x7fae94, 4.8, 0.22);
  earthAura.position.z = GLOBE_Z; root.add(earthAura);
  { // pillar
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.09, GLOBE_Z - EARTH_R * 0.55, 10),
      new THREE.MeshBasicMaterial({ color: 0x8a7040 }),
    );
    pillar.rotation.x = Math.PI / 2;
    pillar.position.z = (GLOBE_Z - EARTH_R * 0.55) / 2;
    root.add(pillar);
  }

  // ── Clock hands ──
  const clockGrp = new THREE.Group(); clockGrp.position.z = 0.05; root.add(clockGrp);
  const hourHand   = hand(1.62, 0xc9a45c, 0.17);
  const minuteHand = hand(2.02, 0x7fae94, 0.13);
  const secondHand = hand(2.42, 0xe6c07a, 0.09);
  clockGrp.add(hourHand, minuteHand, secondHand);

  // ── Dial ──
  {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), cx = S / 2;
    x.translate(cx, cx);
    x.strokeStyle = 'rgba(201,164,92,.85)'; x.lineWidth = 2.5;
    x.beginPath(); x.arc(0, 0, 492, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(0, 0, 404, 0, Math.PI * 2); x.lineWidth = 1; x.strokeStyle = 'rgba(201,164,92,.3)'; x.stroke();
    for (let i = 0; i < 60; i++) {
      const a = i * 6 * D2R, maj = i % 5 === 0;
      x.strokeStyle = maj ? 'rgba(233,223,200,.9)' : 'rgba(201,164,92,.4)';
      x.lineWidth = maj ? 4 : 1.6;
      x.beginPath();
      x.moveTo(Math.sin(a) * (maj ? 440 : 460), -Math.cos(a) * (maj ? 440 : 460));
      x.lineTo(Math.sin(a) * 486, -Math.cos(a) * 486);
      x.stroke();
    }
    const numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    x.fillStyle = 'rgba(233,223,200,.92)'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = "54px 'IM Fell English SC',serif";
    numerals.forEach((nu, i) => {
      const a = i * 30 * D2R;
      x.save(); x.translate(Math.sin(a) * 356, -Math.cos(a) * 356); x.rotate(a); x.fillText(nu, 0, 0); x.restore();
    });
    const tex  = new THREE.CanvasTexture(c);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const dial = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 5.6),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    dial.position.z = 0.02; root.add(dial);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.8, 72),
      new THREE.MeshBasicMaterial({ color: 0x120d07, transparent: true, opacity: 0.82 }),
    );
    root.add(disc);
  }

  // ── Orrery planets ──
  const orreryGrp = new THREE.Group(); root.add(orreryGrp);
  const bodyObjs  = [];
  BODIES.forEach(b => {
    orreryGrp.add(circleLine(b.ring, b.color, 0.13));
    const raised = circleLine(b.ring, b.color, 0.05); raised.position.z = b.tier;
    orreryGrp.add(raised);
    const grp = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(b.size, 24, 18),
      new THREE.MeshBasicMaterial({ color: b.color }),
    );
    mesh.position.z = b.tier; grp.add(mesh);
    const gl = glowSprite(b.color, b.size * 6.5, 0.9); gl.position.z = b.tier; grp.add(gl);
    const stem = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, b.tier - b.size * 0.9)]),
      new THREE.LineBasicMaterial({ color: b.color, transparent: true, opacity: 0.5 }),
    );
    grp.add(stem);
    const foot = new THREE.Mesh(
      new THREE.CircleGeometry(0.05, 10),
      new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.7 }),
    );
    foot.position.z = 0.01; grp.add(foot);
    if (b.key === 'saturn') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(b.size * 1.5, b.size * 2.2, 48),
        new THREE.MeshBasicMaterial({ color: b.color, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
      );
      ring.rotation.x = 1.1; ring.position.z = b.tier; grp.add(ring);
    }
    b.group = grp;
    orreryGrp.add(grp);
    bodyObjs.push(b);
  });

  // ── Zodiac floor ring ──
  {
    const S = 2048, c = document.createElement('canvas'); c.width = c.height = S;
    const x  = c.getContext('2d'), cx = S / 2;
    const Ro = 1010, Ri = 896;
    x.translate(cx, cx);
    x.strokeStyle = 'rgba(201,164,92,.55)'; x.lineWidth = 3;
    x.beginPath(); x.arc(0, 0, Ro, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(0, 0, Ri, 0, Math.PI * 2); x.stroke();
    for (let dg = 0; dg < 360; dg += 5) {
      const a = dg * D2R, maj = dg % 30 === 0;
      x.strokeStyle = maj ? 'rgba(201,164,92,.85)' : 'rgba(201,164,92,.26)';
      x.lineWidth = maj ? 3 : 1.5;
      x.beginPath();
      x.moveTo(Math.cos(a) * Ri, -Math.sin(a) * Ri);
      x.lineTo(Math.cos(a) * (maj ? Ro : Ri + 26), -Math.sin(a) * (maj ? Ro : Ri + 26));
      x.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const R  = 13.2;
    const zr = new THREE.Mesh(
      new THREE.PlaneGeometry(R * 2, R * 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    zr.position.z = 0; root.add(zr);
  }

  // ── Syzygy thread ──
  const syzygy = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-12.9, 0, 0), new THREE.Vector3(12.9, 0, 0),
    ]),
    new THREE.LineBasicMaterial({
      color: 0xe6c07a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending,
    }),
  );
  syzygy.position.z = 0.06; root.add(syzygy);

  // ── Rose of Venus ──
  let roseLine = null, roseCenter = null;
  function buildRose(centerMs) {
    roseCenter = centerMs;
    const N   = 1462, pts = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const t = centerMs - ROSE_SPAN / 2 + ROSE_SPAN * i / (N - 1);
      const v = venusGeoXY(t);
      pts[i * 3] = v.x * ROSE_SCALE; pts[i * 3 + 1] = v.y * ROSE_SCALE; pts[i * 3 + 2] = 0.04;
    }
    if (roseLine) { roseLine.geometry.dispose(); root.remove(roseLine); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    roseLine = new THREE.Line(g, new THREE.LineBasicMaterial({
      color: 0xb06a52, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
    }));
    root.add(roseLine);
  }
  buildRose(Date.now());

  return {
    root, earthGrid, earthAura,
    clockGrp, hourHand, minuteHand, secondHand,
    orreryGrp, bodies: bodyObjs,
    syzygy, buildRose,
    _roseCenter: () => roseCenter,
    _roseLine: () => roseLine,
  };
}

// ── updateOrrery ─────────────────────────────────────────────────────
/**
 * Call each frame with the current simulation time (ms) and frame delta (s).
 *
 * @param {ReturnType<typeof createOrrery>} state
 * @param {number} simTime   — ms timestamp (Date.now() or time-travelled)
 * @param {number} dt        — frame delta in seconds
 * @param {boolean} reduceMotion
 */
export function updateOrrery(state, simTime, dt, reduceMotion = false) {
  const { earthGrid, earthAura, clockGrp, hourHand, minuteHand, secondHand, bodies, syzygy } = state;

  // Clock hands
  const dte = new Date(simTime);
  const hh  = dte.getHours(), mm = dte.getMinutes(), ss = dte.getSeconds(), msf = dte.getMilliseconds() / 1000;
  hourHand.rotation.z   = -((hh % 12) + mm / 60 + ss / 3600) * 30 * D2R;
  minuteHand.rotation.z = -(mm + (ss + msf) / 60) * 6 * D2R;
  secondHand.rotation.z = -(ss + msf) * 6 * D2R;
  if (!reduceMotion) {
    hourHand.userData.bead.userData.tet.rotation.y   += dt * 0.4;
    minuteHand.userData.bead.userData.tet.rotation.y += dt * 0.7;
    secondHand.userData.bead.userData.tet.rotation.y += dt * 1.2;
  }

  // Earth sidereal rotation
  earthGrid.rotation.z = gmst(simTime) * D2R;

  // Planets
  const eph = ephemeris(simTime);
  bodies.forEach(b => {
    const lon = eph[b.key].lon * D2R;
    b.group.position.set(b.ring * Math.cos(lon), b.ring * Math.sin(lon), 0);
  });

  // Syzygy thread
  {
    const el  = rev(eph.moon.lon - eph.sun.lon);
    const sep = Math.min(el, 360 - el, Math.abs(el - 180));
    syzygy.material.opacity = sep < 1.2 ? 0.5 * (1 - sep / 1.2) : 0;
    if (sep < 1.2) syzygy.rotation.z = eph.sun.lon * D2R;
  }

  // Rebuild Rose of Venus if time has wandered far
  if (Math.abs(simTime - state._roseCenter()) > ROSE_SPAN / 4) state.buildRose(simTime);

  return eph;
}
