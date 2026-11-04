/**
 * main.js — CHRONOS red phonebox time machine entry point.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createTardis, createDoors } from './tardis.js?v=4';
import {
  createStarfield,
  createGround,
  createChrononField,
  animateChrononField,
} from './vortex.js?v=2';
import { AnimationController } from './animations.js?v=2';
import {
  getDestinations,
  getCurrentDestination,
  getPendingDestination,
  getRandomDestination,
  setPendingDestination,
  commitPendingDestination,
  scrambleDisplay,
  formatDestination,
} from './destinations.js?v=2';

// ── Renderer ────────────────────────────────────────────
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ── Scene ───────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0303);
scene.fog = new THREE.FogExp2(0x0a0303, 0.014);

// ── Camera ──────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 220);
const defaultCamPos = new THREE.Vector3(1.9, 1.1, 3.2);
camera.position.copy(defaultCamPos);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 1.0;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.82;
controls.target.set(0, 0.4, 0);
controls.update();

// Touch-friendly: slightly higher rotate speed on coarse pointers
if (window.matchMedia('(pointer: coarse)').matches) {
  controls.rotateSpeed = 0.85;
  controls.zoomSpeed = 0.9;
}

// ── Lighting ────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x3a1818, 0.55));

const keyLight = new THREE.DirectionalLight(0xffd0b0, 1.15);
keyLight.position.set(5, 9, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 22;
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -6;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xff6a40, 0.55);
rimLight.position.set(-5, 3, -4);
scene.add(rimLight);

const fill = new THREE.PointLight(0xc9a227, 0.45, 14);
fill.position.set(-2, 2, 3);
scene.add(fill);

const groundGlow = new THREE.PointLight(0xff3a20, 0.7, 12);
groundGlow.position.set(0, -1.4, 0);
scene.add(groundGlow);

// ── Scene graph ─────────────────────────────────────────
const tardis = createTardis();
scene.add(tardis);

const doors = createDoors(tardis);

const stars = createStarfield();
scene.add(stars);

const chronons = createChrononField();
scene.add(chronons);

const ground = createGround();
scene.add(ground);

const animator = new AnimationController();

// ── HUD refs ────────────────────────────────────────────
const btnTravel = document.getElementById('btn-travel');
const btnDoors = document.getElementById('btn-doors');
const btnReset = document.getElementById('btn-reset');
const btnLamp = document.getElementById('btn-lamp');
const btnInterior = document.getElementById('btn-interior');
const btnDest = document.getElementById('btn-dest');
const btnCloseDest = document.getElementById('btn-close-dest');
const timeValue = document.getElementById('time-value');
const eraValue = document.getElementById('era-value');
const eraChip = document.getElementById('era-chip');
const statusPill = document.getElementById('status-pill');
const statusText = document.getElementById('status-text');
const travelOverlay = document.getElementById('travel-overlay');
const destDrawer = document.getElementById('dest-drawer');
const destList = document.getElementById('dest-list');
const energyFill = document.getElementById('energy-fill');
const energyValue = document.getElementById('energy-value');
const paradoxFill = document.getElementById('paradox-fill');
const paradoxValue = document.getElementById('paradox-value');
const telDt = document.getElementById('tel-dt');
const telLat = document.getElementById('tel-lat');
const telLon = document.getElementById('tel-lon');
const telAlt = document.getElementById('tel-alt');

let line = 100;      // signal strength
let queue = 0;       // calls in queue
let interiorView = false;
let selectedDestIndex = 0;

// ── Jack on the line ────────────────────────────────────
// The booth phone gets through to Jack (the Guild's ElevenLabs voice agent,
// wired up by jack-face.js). He is multidimensional: window.jackRoomContext
// hands him the booth's live dimension/state at call start and as it changes.
let jackOnLine = false;

window.jackRoomContext = function () {
  const cur = getCurrentDestination();
  const pend = getPendingDestination();
  return {
    room: "CHRONOS box - the Guild's red K6 relay booth (timetravellersguild.com/box)",
    caller: 'a traveller at the booth phone',
    dimension_now: {
      year: cur.year, location: cur.location, era: cur.era,
      lat: cur.lat, lon: cur.lon, alt: cur.alt,
    },
    dimension_dialling: pend
      ? { year: pend.year, location: pend.location, era: pend.era }
      : null,
    line_pct: Math.round(line),
    calls_in_queue: Math.round(queue),
    doors: animator.doorsOpen ? 'open' : 'closed',
    note: 'The traveller dials exchanges (eras/dimensions) on the booth phone. ' +
      'When the dial gets through, you answer. You are the Jack of whichever ' +
      'dimension the booth is currently in; if the booth travels mid-call, ' +
      'the room state updates and you travel with it.',
  };
};

function jackWidgetStatus() {
  const el = document.querySelector('#jack-face span');
  return el ? el.textContent || '' : '';
}

function startJackCall() {
  if (!window.__jackFace || jackOnLine) return;
  try { window.__jackFace.start(); } catch (e) { /* face widget reports its own state */ }
}

function stopJackCall() {
  if (!window.__jackFace || !jackOnLine) return;
  try { window.__jackFace.end(); } catch (e) {}
}

// Keep the Dial button and status pill honest about the live call,
// whichever control (Dial button, booth phone, or the Jack face) toggled it.
function syncJackState() {
  const on = /WARMING|LISTENING|SPEAKING/i.test(jackWidgetStatus());
  if (on === jackOnLine) return;
  jackOnLine = on;
  btnTravel.querySelector('.btn-label').textContent = on ? 'Hang Up' : 'Dial';
  if (!animator.isTraveling) setStatus(null, on ? 'JACK ON LINE' : 'STABLE');
}
setInterval(syncJackState, 1000);

function setStatus(mode, label) {
  statusPill.classList.remove('warning', 'critical');
  if (mode) statusPill.classList.add(mode);
  statusText.textContent = label;
}

function updateGauges() {
  energyFill.style.height = `${Math.max(0, Math.min(100, line))}%`;
  energyValue.textContent = `${Math.round(line)}%`;
  paradoxFill.style.height = `${Math.max(0, Math.min(100, queue))}%`;
  paradoxValue.textContent = `${String(Math.round(queue)).padStart(2, '0')}`;
}

function applyDestinationReadout(dest, scramble = false) {
  eraValue.textContent = dest.era;
  eraChip.textContent = dest.era;
  telLat.textContent = dest.lat;
  telLon.textContent = dest.lon;
  telAlt.textContent = dest.alt;
  if (scramble) {
    scrambleDisplay(timeValue, dest, 2000);
  } else {
    timeValue.textContent = formatDestination(dest);
  }
}

function populateDestinations() {
  destList.innerHTML = '';
  getDestinations().forEach((dest, index) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dest-item' + (index === selectedDestIndex ? ' active' : '');
    btn.setAttribute('role', 'option');
    btn.dataset.index = String(index);
    btn.innerHTML = `
      <span class="d-year">${dest.year}</span>
      <span class="d-loc">${dest.location}</span>
      <span class="d-era">${dest.era}</span>
    `;
    btn.addEventListener('click', () => {
      selectedDestIndex = index;
      setPendingDestination(index);
      [...destList.querySelectorAll('.dest-item')].forEach((el) => el.classList.remove('active'));
      btn.classList.add('active');
      destDrawer.hidden = true;
      applyDestinationReadout(dest, false);
      timeValue.textContent = formatDestination(dest) + ' ◈ queued';
    });
    li.appendChild(btn);
    destList.appendChild(li);
  });
}

populateDestinations();
applyDestinationReadout(getCurrentDestination());
updateGauges();

function setControlsEnabled(enabled) {
  [btnTravel, btnDoors, btnLamp, btnInterior, btnDest].forEach((b) => {
    b.disabled = !enabled;
  });
}

function beginCall(dest) {
  if (animator.isTraveling) return;

  btnTravel.classList.add('traveling');
  btnTravel.querySelector('.btn-label').textContent = 'Dialling…';
  setControlsEnabled(false);
  travelOverlay.hidden = false;

  queue = Math.min(12, queue + 1);
  updateGauges();

  const phaseCopy = travelOverlay.querySelector('.vortex-copy');

  animator.dialCall(
    tardis,
    (phase) => {
      if (phase === 'dialling') {
        setStatus('warning', 'DIALLING');
        phaseCopy.textContent = 'DIALLING';
      } else if (phase === 'connected') {
        setStatus(null, 'CONNECTED');
        phaseCopy.textContent = 'CONNECTED';
        if (dest) scrambleDisplay(timeValue, dest, 1200);
        startJackCall();
      } else if (phase === 'stable') {
        setStatus(null, 'STABLE');
      }
    },
    () => {
      if (dest) {
        commitPendingDestination();
        const arrived = getCurrentDestination();
        applyDestinationReadout(arrived, false);
        timeValue.textContent = formatDestination(arrived);
      }
      travelOverlay.hidden = true;
      btnTravel.classList.remove('traveling');
      btnTravel.querySelector('.btn-label').textContent = jackOnLine ? 'Hang Up' : 'Dial';
      setControlsEnabled(true);
      queue = Math.max(0, queue - 1);
      updateGauges();
    }
  );
}

btnTravel.addEventListener('click', () => {
  if (jackOnLine) {
    stopJackCall();
    return;
  }
  let dest;
  if (timeValue.textContent.includes('queued')) {
    dest = setPendingDestination(selectedDestIndex);
  } else {
    dest = getRandomDestination();
    selectedDestIndex = getDestinations().indexOf(dest);
  }
  if (!dest) dest = getRandomDestination();
  beginCall(dest);
});

function setInteriorGlow(open) {
  const light = tardis.getObjectByName('interiorLight');
  if (light) light.intensity = open ? 1.4 : 0.55;
}

btnDoors.addEventListener('click', () => {
  const open = animator.toggleDoors(doors);
  btnDoors.querySelector('.btn-label').textContent = open ? 'Close Doors' : 'Open Doors';
  setInteriorGlow(open);
});

btnLamp.addEventListener('click', () => {
  animator.flashLamp(tardis, 8);
});

btnDest.addEventListener('click', () => {
  destDrawer.hidden = !destDrawer.hidden;
});

btnCloseDest.addEventListener('click', () => {
  destDrawer.hidden = true;
});

btnInterior.addEventListener('click', () => {
  interiorView = !interiorView;
  btnInterior.querySelector('.btn-label').textContent = interiorView ? 'Exterior' : 'Interior';

  if (!animator.doorsOpen) {
    animator.toggleDoors(doors);
    btnDoors.querySelector('.btn-label').textContent = 'Close Doors';
  }

  const target = interiorView
    ? new THREE.Vector3(0, 0.08, 0.72)
    : defaultCamPos.clone();
  const look = interiorView
    ? new THREE.Vector3(0, 0.0, -0.32)
    : new THREE.Vector3(0, 0.4, 0);

  animateCameraTo(target, look, 900);
});

btnReset.addEventListener('click', () => {
  interiorView = false;
  btnInterior.querySelector('.btn-label').textContent = 'Interior';
  animateCameraTo(defaultCamPos.clone(), new THREE.Vector3(0, 0.45, 0), 800);
});

function animateCameraTo(pos, target, duration) {
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const t0 = performance.now();

  const step = () => {
    const t = Math.min((performance.now() - t0) / duration, 1);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    camera.position.lerpVectors(startPos, pos, e);
    controls.target.lerpVectors(startTarget, target, e);
    controls.update();
    if (t < 1) requestAnimationFrame(step);
  };
  step();
}

// Click / tap booth to open doors or focus
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function onPointerHit(event) {
  if (animator.isTraveling) return;
  const rect = canvas.getBoundingClientRect();
  const clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
  const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(tardis, true);
  if (hits.length) {
    // Tapping the phone itself (body, dial or handset) dials/hangs up,
    // exactly like the Dial button. Anything else on the booth keeps the doors.
    const names = new Set();
    for (let o = hits[0].object; o && o !== scene; o = o.parent) {
      if (o.name) names.add(o.name);
    }
    if (names.has('dial') || names.has('phoneBody') || names.has('handset')) {
      btnTravel.click();
      return;
    }
    const open = animator.toggleDoors(doors);
    btnDoors.querySelector('.btn-label').textContent = open ? 'Close Doors' : 'Open Doors';
    setInteriorGlow(open);
    animator.flashLamp(tardis, 3);
  }
}

let pointerDown = null;
canvas.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener('pointerup', (e) => {
  if (!pointerDown) return;
  const dx = e.clientX - pointerDown.x;
  const dy = e.clientY - pointerDown.y;
  const dt = performance.now() - pointerDown.t;
  pointerDown = null;
  if (dt < 350 && dx * dx + dy * dy < 36) onPointerHit(e);
});

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ── Idle + render loop ──────────────────────────────────
const clock = new THREE.Clock();
let rechargeAcc = 0;

function idleAnimations(time) {
  if (!animator.isTraveling) {
    tardis.position.y = Math.sin(time * 0.85) * 0.035;
    tardis.rotation.y = Math.sin(time * 0.28) * 0.025;
  }

  const lamp = tardis.getObjectByName('lamp');
  const lampLight = tardis.getObjectByName('lampLight');
  if (lamp && !animator.isTraveling && !animator.lampFlashing) {
    lamp.material.emissiveIntensity = 0.55 + Math.sin(time * 2.1) * 0.22;
  }
  if (lampLight && !animator.isTraveling && !animator.lampFlashing) {
    lampLight.intensity = 1.8 + Math.sin(time * 2.1) * 0.55;
  }

  const dial = tardis.getObjectByName('dial');
  if (dial) dial.rotation.z = time * 0.4;

  stars.rotation.y = time * 0.012;
  stars.rotation.x = Math.sin(time * 0.04) * 0.02;
  ground.rotation.y = time * 0.02;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  controls.update();
  idleAnimations(elapsed);
  animator.update(delta);
  animateChrononField(chronons, elapsed);

  // Telemetry ΔT
  telDt.textContent = `${elapsed.toFixed(2)}s`;

  // Signal strength fluctuates gently when idle
  rechargeAcc += delta;
  if (!animator.isTraveling && rechargeAcc > 0.5) {
    rechargeAcc = 0;
    line = Math.min(100, Math.max(72, line + (Math.random() - 0.48) * 1.2));
    updateGauges();
  }

  renderer.render(scene, camera);
}

animate();
