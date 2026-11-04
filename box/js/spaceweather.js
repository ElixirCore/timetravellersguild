/**
 * spaceweather.js — Live NOAA SWPC solar flare feed + WebGL overlay.
 *
 * Data: GOES X-ray flares (7-day) via NOAA Space Weather Prediction Center.
 * CORS is allowed on all *.swpc.noaa.gov/json/ endpoints.
 */

import * as THREE from 'three';

const FLARE_URL = 'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json';
const KINDEX_URL = 'https://services.swpc.noaa.gov/json/planetary-k-index-dst.json';

// ── Flare classification ─────────────────────────────────────────────
const CLASS_COLOR = {
  X: 0xff2020,   // red — extreme
  M: 0xff7a20,   // orange — major
  C: 0xf0d040,   // yellow — moderate
  B: 0x40c8f0,   // cyan — minor
  A: 0x60e090,   // green — quiet
};
const CLASS_INTENSITY = { X: 1.0, M: 0.65, C: 0.38, B: 0.18, A: 0.08 };
const CLASS_ORDER = ['A', 'B', 'C', 'M', 'X'];

function parseClass(str) {
  if (!str) return { letter: 'A', num: 1, raw: str };
  const m = String(str).match(/^([XMCBA])([\d.]+)?/i);
  if (!m) return { letter: 'A', num: 1, raw: str };
  return { letter: m[1].toUpperCase(), num: parseFloat(m[2] ?? 1) || 1, raw: str };
}

function flareAge(flare) {
  const t = new Date(flare.max_time || flare.begin_time || 0).getTime();
  return (Date.now() - t) / 1000;   // seconds ago (negative = future)
}

function flareAlpha(flare) {
  const age_h = flareAge(flare) / 3600;
  if (age_h < 0) return 1.0;        // active / upcoming
  if (age_h < 2)  return 1.0;       // recent
  if (age_h < 12) return 0.55;
  if (age_h < 48) return 0.22;
  if (age_h < 168) return 0.08;
  return 0;
}

// ── Fetch helpers ─────────────────────────────────────────────────────
export async function fetchFlares() {
  try {
    const res = await fetch(FLARE_URL, { cache: 'no-cache' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export async function fetchKIndex() {
  try {
    const res = await fetch(KINDEX_URL, { cache: 'no-cache' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

// ── WebGL overlay ─────────────────────────────────────────────────────
/**
 * Build the flare overlay attached to the Sun's group in the orrery.
 *
 * @param {THREE.Group} sunGroup   the Sun body group from the orrery
 * @param {number}      sunSize    radius of the Sun sphere (orrery units, pre-scale)
 * @param {number}      sunTier    Sun's z-tier (height above dial)
 * @returns { update(flares), updateKp(kData) }
 */
export function createSunOverlay(sunGroup, sunSize, sunTier) {
  const overlayGroup = new THREE.Group();
  overlayGroup.position.z = sunTier;
  sunGroup.add(overlayGroup);

  // ── Corona (always visible) ──────────────────────────────────────
  function glowCanvas(hex, inner, outer, alpha) {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), cx = S / 2;
    const gr = x.createRadialGradient(cx, cx, inner * cx, cx, cx, outer * cx);
    const col = '#' + hex.toString(16).padStart(6, '0');
    gr.addColorStop(0, col + Math.round(alpha * 255).toString(16).padStart(2, '0'));
    gr.addColorStop(0.4, col + '44');
    gr.addColorStop(1, 'transparent');
    x.fillStyle = gr; x.fillRect(0, 0, S, S);
    return new THREE.CanvasTexture(c);
  }
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowCanvas(0xffb840, 0.2, 1.0, 0.55),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  corona.scale.set(sunSize * 5.5, sunSize * 5.5, 1);
  overlayGroup.add(corona);

  // ── Flare spikes container ───────────────────────────────────────
  const spikeGroup = new THREE.Group();
  overlayGroup.add(spikeGroup);

  // ── Kp storm ring (shown when Kp ≥ 5) ───────────────────────────
  const stormRingMat = new THREE.LineBasicMaterial({
    color: 0xff2060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
  });
  const stormRingPts = [];
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * Math.PI * 2;
    stormRingPts.push(new THREE.Vector3(
      Math.cos(a) * sunSize * 2.2,
      Math.sin(a) * sunSize * 2.2,
      0,
    ));
  }
  const stormRing = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(stormRingPts),
    stormRingMat,
  );
  overlayGroup.add(stormRing);

  // ── Spike builder ────────────────────────────────────────────────
  function buildSpike(theta, phi, length, color, alpha) {
    // Spike: a line from Sun surface outward
    const dir    = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi),
    );
    const origin = dir.clone().multiplyScalar(sunSize);
    const tip    = dir.clone().multiplyScalar(sunSize + length);
    const line   = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([origin, tip]),
      new THREE.LineBasicMaterial({
        color, transparent: true, opacity: alpha,
        blending: THREE.AdditiveBlending,
      }),
    );
    // Glow at tip
    const glowC = document.createElement('canvas'); glowC.width = glowC.height = 64;
    const gx    = glowC.getContext('2d'), cxg = 32;
    const gr2   = gx.createRadialGradient(cxg, cxg, 0, cxg, cxg, cxg);
    const hexStr = '#' + color.toString(16).padStart(6, '0');
    gr2.addColorStop(0, hexStr + 'cc'); gr2.addColorStop(1, 'transparent');
    gx.fillStyle = gr2; gx.fillRect(0, 0, 64, 64);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowC), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: alpha,
    }));
    glow.scale.set(sunSize * 0.8, sunSize * 0.8, 1);
    glow.position.copy(tip);
    const g = new THREE.Group(); g.add(line, glow);
    return g;
  }

  // Store a pseudo-random angle seeded by flare event_id / index
  function seededAngle(seed, salt) {
    const h = (seed * 2654435761 + salt * 1234567891) >>> 0;
    return (h % 10000) / 10000 * Math.PI * 2;
  }

  // ── update(flares) ───────────────────────────────────────────────
  function update(flares) {
    // Clear old spikes
    while (spikeGroup.children.length) spikeGroup.remove(spikeGroup.children[0]);

    const now = Date.now();
    let currentFlare = null;

    flares.forEach((flare, idx) => {
      const alpha = flareAlpha(flare);
      if (alpha < 0.01) return;

      const cls    = parseClass(flare.class_letter ?? flare['class'] ?? '');
      const color  = CLASS_COLOR[cls.letter] ?? CLASS_COLOR.A;
      const base   = CLASS_INTENSITY[cls.letter] ?? 0.1;
      const length = sunSize * (0.4 + base * cls.num * 0.25);

      // Deterministic but varied angles per flare
      const theta = seededAngle(idx + 1, 7);
      const phi   = seededAngle(idx + 1, 13) * 0.5 + Math.PI * 0.1;

      const spike = buildSpike(theta, phi, length, color, alpha * (0.6 + base * 0.4));
      spikeGroup.add(spike);

      // Track the most intense current flare
      const age_h = flareAge(flare) / 3600;
      if (age_h < 2) {
        const rank = CLASS_ORDER.indexOf(cls.letter) * 10 + cls.num;
        if (!currentFlare || rank > currentFlare.rank) {
          currentFlare = { rank, cls, color, flare };
        }
      }
    });

    // Pulse the corona based on current activity
    const pulse   = currentFlare ? 0.75 + CLASS_INTENSITY[currentFlare.cls.letter] * 0.5 : 0.55;
    corona.material.opacity = pulse;

    return currentFlare;
  }

  // ── updateKp(kData) ──────────────────────────────────────────────
  function updateKp(kData) {
    if (!Array.isArray(kData) || kData.length === 0) return 0;
    const latest = kData[kData.length - 1];
    const kp = parseFloat(latest.kp ?? latest.Kp ?? 0) || 0;
    stormRingMat.opacity = kp >= 5 ? Math.min(1, (kp - 4) * 0.25) : 0;
    return kp;
  }

  return { update, updateKp, corona, spikeGroup, stormRing };
}

// ── Summarise space weather for Jack ─────────────────────────────────
export function spaceWeatherSummary(flares, kp) {
  const recent = flares.filter(f => flareAge(f) / 3600 < 24);
  const active = flares.filter(f => {
    const age = flareAge(f) / 3600;
    return age > -0.5 && age < 2;
  });
  const biggest = recent.reduce((best, f) => {
    const cls = parseClass(f.class_letter ?? f['class'] ?? '');
    const rank = CLASS_ORDER.indexOf(cls.letter) * 10 + cls.num;
    if (!best || rank > best.rank) return { rank, cls, f };
    return best;
  }, null);

  return {
    active_flares : active.length,
    flares_24h    : recent.length,
    peak_class    : biggest ? biggest.cls.raw : 'none',
    kp_index      : kp,
    storm_level   : kp >= 9 ? 'G5 Extreme' : kp >= 8 ? 'G4 Severe' : kp >= 7 ? 'G3 Strong'
                  : kp >= 6 ? 'G2 Moderate' : kp >= 5 ? 'G1 Minor' : 'Quiet',
  };
}
