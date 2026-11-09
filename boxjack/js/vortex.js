/**
 * vortex.js — Chronon vortex, starfield, ground chronometer, energy rings.
 */
import * as THREE from 'three';

const PARTICLE_COUNT = 2800;
const VORTEX_RADIUS = 12;
const VORTEX_LENGTH = 42;

/**
 * Create the time vortex tunnel particle system (ember / crimson palette).
 */
export function createVortex() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const speeds = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const r = VORTEX_RADIUS * (0.35 + Math.random() * 0.65);
    const z = (Math.random() - 0.5) * VORTEX_LENGTH;

    positions[i3] = Math.cos(theta) * r;
    positions[i3 + 1] = Math.sin(theta) * r;
    positions[i3 + 2] = z;

    const choice = Math.random();
    if (choice < 0.45) {
      // Crimson
      colors[i3] = 0.85 + Math.random() * 0.15;
      colors[i3 + 1] = 0.12 + Math.random() * 0.15;
      colors[i3 + 2] = 0.08 + Math.random() * 0.1;
    } else if (choice < 0.75) {
      // Ember / gold
      colors[i3] = 0.95;
      colors[i3 + 1] = 0.45 + Math.random() * 0.35;
      colors[i3 + 2] = 0.1 + Math.random() * 0.15;
    } else if (choice < 0.9) {
      // Brass spark
      colors[i3] = 0.9;
      colors[i3 + 1] = 0.7 + Math.random() * 0.2;
      colors[i3 + 2] = 0.25;
    } else {
      // White-hot
      colors[i3] = 1;
      colors[i3 + 1] = 0.9 + Math.random() * 0.1;
      colors[i3 + 2] = 0.75;
    }

    speeds[i] = 0.55 + Math.random() * 1.6;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.13,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'vortex';
  points.visible = false;
  points.userData.speeds = speeds;
  points.userData.basePositions = new Float32Array(positions);
  return points;
}

export function animateVortex(vortex, time, intensity = 1) {
  if (!vortex.visible) return;

  const positions = vortex.geometry.attributes.position.array;
  const basePositions = vortex.userData.basePositions;
  const speeds = vortex.userData.speeds;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const speed = speeds[i];
    const bx = basePositions[i3];
    const by = basePositions[i3 + 1];
    const origAngle = Math.atan2(by, bx);
    const r = Math.sqrt(bx * bx + by * by) * (1 + Math.sin(time * 0.7 + i) * 0.02);

    const angle = origAngle + time * speed * intensity;
    positions[i3] = Math.cos(angle) * r;
    positions[i3 + 1] = Math.sin(angle) * r;

    let z = basePositions[i3 + 2] + time * speed * 2.2 * intensity;
    z = ((z + VORTEX_LENGTH / 2) % VORTEX_LENGTH) - VORTEX_LENGTH / 2;
    positions[i3 + 2] = z;
  }

  vortex.geometry.attributes.position.needsUpdate = true;
  vortex.rotation.z = time * 0.15 * intensity;
}

export function createStarfield() {
  const count = 1800;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 28 + Math.random() * 80;

    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);

    const warm = Math.random();
    colors[i3] = 0.85 + warm * 0.15;
    colors[i3 + 1] = 0.75 + warm * 0.2;
    colors[i3 + 2] = 0.65 + (1 - warm) * 0.3;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.09,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const stars = new THREE.Points(geometry, material);
  stars.name = 'starfield';
  return stars;
}

/**
 * Floating chronon motes around the booth.
 */
export function createChrononField() {
  const count = 400;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const a = Math.random() * Math.PI * 2;
    const r = 2.5 + Math.random() * 6;
    positions[i3] = Math.cos(a) * r;
    positions[i3 + 1] = -1.5 + Math.random() * 5;
    positions[i3 + 2] = Math.sin(a) * r;
    phases[i] = Math.random() * Math.PI * 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xff6a30,
    size: 0.06,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const field = new THREE.Points(geometry, material);
  field.name = 'chrononField';
  field.userData.phases = phases;
  field.userData.base = new Float32Array(positions);
  return field;
}

export function animateChrononField(field, time) {
  const pos = field.geometry.attributes.position.array;
  const base = field.userData.base;
  const phases = field.userData.phases;
  const n = phases.length;

  for (let i = 0; i < n; i++) {
    const i3 = i * 3;
    pos[i3] = base[i3] + Math.sin(time * 0.6 + phases[i]) * 0.15;
    pos[i3 + 1] = base[i3 + 1] + Math.sin(time * 0.9 + phases[i] * 1.3) * 0.35;
    pos[i3 + 2] = base[i3 + 2] + Math.cos(time * 0.5 + phases[i]) * 0.15;
  }
  field.geometry.attributes.position.needsUpdate = true;
}

/**
 * Ground plane with etched chronometer rings.
 */
export function createGround() {
  const group = new THREE.Group();
  group.name = 'ground';

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 72),
    new THREE.MeshStandardMaterial({
      color: 0x100606,
      roughness: 0.92,
      metalness: 0.08,
      transparent: true,
      opacity: 0.9,
    })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -2.05;
  disc.receiveShadow = true;
  group.add(disc);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xc9a227,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
  });

  for (let i = 1; i <= 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.2 * i, 1.2 * i + 0.03, 64),
      ringMat.clone()
    );
    ring.material.opacity = 0.28 - i * 0.04;
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.03;
    group.add(ring);
  }

  // Radial ticks
  const tickMat = new THREE.MeshBasicMaterial({
    color: 0xff6a30,
    transparent: true,
    opacity: 0.35,
  });
  for (let i = 0; i < 24; i++) {
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.01, i % 6 === 0 ? 0.55 : 0.28),
      tickMat
    );
    const a = (i / 24) * Math.PI * 2;
    tick.position.set(Math.cos(a) * 3.2, -2.02, Math.sin(a) * 3.2);
    tick.rotation.y = -a;
    group.add(tick);
  }

  return group;
}

/**
 * Energy halo rings that pulse during travel.
 */
export function createEnergyRings() {
  const group = new THREE.Group();
  group.name = 'energyRings';
  group.visible = false;

  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4 + i * 0.45, 0.02, 8, 64),
      new THREE.MeshBasicMaterial({
        color: i === 1 ? 0xc9a227 : 0xff4a30,
        transparent: true,
        opacity: 0.0,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.userData.phase = i * 0.8;
    group.add(ring);
  }

  return group;
}

export function animateEnergyRings(rings, time, active) {
  if (!rings.visible) return;
  rings.children.forEach((ring, i) => {
    const pulse = active ? 0.35 + Math.sin(time * 4 + ring.userData.phase) * 0.25 : 0;
    ring.material.opacity = Math.max(0, pulse);
    ring.scale.setScalar(1 + Math.sin(time * 2 + i) * 0.08);
    ring.rotation.z = time * (0.4 + i * 0.2);
  });
}
