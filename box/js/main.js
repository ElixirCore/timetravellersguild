/**
 * main.js v7 — CHRONOS red phonebox time machine entry point.
 * v7: planet selection + info sheet, double-tap to dial, booth→planet animation,
 *     story narration via SpeechSynthesis
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
  injectCelestialDestinations,
} from './destinations.js?v=3';
import { createOrrery, updateOrrery, ephemeris, gmst } from './orrery.js?v=1';
import { fmtBoxTime, isPresent } from './clock.js?v=1';
import { relativisticWhen } from './relativity.js?v=1';
import {
  fetchFlares, fetchKIndex,
  createSunOverlay, spaceWeatherSummary,
} from './spaceweather.js?v=1';

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

// ── Orrery ──────────────────────────────────────────────
// Scale 0.28, rotated into Y-up so the dial lies flat and
// planets orbit in the XZ plane beneath the booth.
const orreryState = createOrrery(scene, renderer, {
  scale : 0.28,
  offset: new THREE.Vector3(0, -0.15, 0),
});
orreryState.root.rotation.x = -Math.PI / 2;

// ── Temporal Shuttle ────────────────────────────────────
// Controls the orrery simulation time — same patent as Geocentric Chronometer № 13.
const LOG_MAX = 7.5;   // 10^7.5 ≈ one year per second at full throw
const X1_POS  = Math.round(Math.log10(2) / LOG_MAX * 1000);

let orrSimTime = Date.now();
let orrSpeed   = 1;
let orrLive    = true;

function leverToSpeed(v) {
  const t = v / 1000;
  if (Math.abs(t) < 0.018) return 0;
  return Math.sign(t) * (Math.pow(10, Math.abs(t) * LOG_MAX) - 1);
}

function fmtRate(s) {
  if (s === 0) return '· held ·';
  if (orrLive) return 'true time';
  const a = Math.abs(s), sg = s > 0 ? '+' : '−';
  if (Math.abs(a - 1) < 0.02) return s > 0 ? 'true rate' : '−1× withershins';
  if (a < 90) return `${sg}${a.toFixed(1)} s/s`;
  if (a < 5400) return `${sg}${(a / 60).toFixed(1)} min/s`;
  if (a < 129600) return `${sg}${(a / 3600).toFixed(1)} h/s`;
  if (a < 47336400) return `${sg}${(a / 86400).toFixed(1)} d/s`;
  return `${sg}${(a / 31557600).toFixed(1)} y/s`;
}

const leverEl = document.getElementById('lever');
const thRate  = document.getElementById('th-rate');
leverEl.value = X1_POS;

leverEl.addEventListener('input', () => {
  let v = +leverEl.value;
  if (Math.abs(v - X1_POS) < 16) { v = X1_POS; leverEl.value = v; }
  if (Math.abs(v + X1_POS) < 16) { v = -X1_POS; leverEl.value = v; }
  if (Math.abs(v) < 18) { v = 0; leverEl.value = 0; }
  orrLive  = false;
  orrSpeed = v === X1_POS ? 1 : v === -X1_POS ? -1 : leverToSpeed(v);
  thRate.textContent = fmtRate(orrSpeed);
});

document.getElementById('btn-now').addEventListener('click', () => {
  orrSimTime = Date.now();
  orrSpeed   = 1;
  orrLive    = true;
  leverEl.value = X1_POS;
  thRate.textContent = 'true time';
});

// Inject live solar-system destinations from ephemeris
{
  const eph0 = ephemeris(Date.now());
  injectCelestialDestinations(eph0);
}

// ── Planet hit targets ──────────────────────────────────
// Invisible enlarged spheres on each body group for raycasting.
// Sized generously — the visual spheres are tiny at scale=0.28.
const planetHitMeshes = [];
for (const b of orreryState.bodies) {
  const hitR = Math.max(b.size * 3.5, 0.9);
  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(hitR, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitMesh.position.z = b.tier;
  hitMesh.userData.bodyKey = b.key;
  b.group.add(hitMesh);
  planetHitMeshes.push(hitMesh);
}

// Booth base position (world) and lerp target — allow booth to move to planets
const tardisBasePos   = new THREE.Vector3(0, 0, 0);
const targetTardisPos = new THREE.Vector3(0, 0, 0);

// ── Planet sheet ────────────────────────────────────────
const BODY_META = {
  moon:    { glyph: '☾', color: '#d8d2c4' },
  mercury: { glyph: '☿', color: '#b98d5e' },
  venus:   { glyph: '♀', color: '#e3cf9e' },
  sun:     { glyph: '☉', color: '#d9a441' },
  mars:    { glyph: '♂', color: '#b3573f' },
  jupiter: { glyph: '♃', color: '#c2a075' },
  saturn:  { glyph: '♄', color: '#b8ab7d' },
  uranus:  { glyph: '♅', color: '#a8c4b0' },
  neptune: { glyph: '♆', color: '#8aa8b8' },
  pluto:   { glyph: '♇', color: '#b59a8a' },
};

const planetSheet    = document.getElementById('planet-sheet');
const psheetGlyph    = document.getElementById('psheet-glyph');
const psheetName     = document.getElementById('psheet-name');
const psheetEra      = document.getElementById('psheet-era');
const psheetDist     = document.getElementById('psheet-dist');
const psheetLight    = document.getElementById('psheet-light');
const psheetEcl      = document.getElementById('psheet-ecl');
const psheetGo       = document.getElementById('psheet-go');
document.getElementById('psheet-close').addEventListener('click', () => {
  planetSheet.hidden = true;
  selectedPlanet = null;
});

let selectedPlanet = null; // { key, time }

function showPlanetSheet(bodyKey) {
  const dests = getDestinations();
  const dest  = dests.find(d => d.celestial && d.bodyKey === bodyKey);
  const meta  = BODY_META[bodyKey] ?? { glyph: '★', color: '#f5e6d3' };

  psheetGlyph.textContent = meta.glyph;
  psheetGlyph.style.color = meta.color;
  psheetName.textContent  = dest ? dest.location : bodyKey;
  psheetEra.textContent   = dest ? dest.era : '—';
  psheetDist.textContent  = dest ? `${dest.distAU?.toFixed(3) ?? '—'} AU` : '—';
  psheetLight.textContent = dest ? dest.alt : '—';
  psheetEcl.textContent   = dest ? `${dest.eclLon ?? '—'}°` : '—';
  planetSheet.hidden = false;
}

psheetGo.addEventListener('click', () => {
  if (!selectedPlanet) return;
  const dests = getDestinations();
  const idx = dests.findIndex(d => d.celestial && d.bodyKey === selectedPlanet.key);
  if (idx >= 0) {
    planetSheet.hidden = true;
    selectedDestIndex = idx;
    setPendingDestination(idx);
    beginCall(dests[idx]);
    selectedPlanet = null;
  }
});

function handlePlanetTap(bodyKey) {
  const now = performance.now();
  if (selectedPlanet && selectedPlanet.key === bodyKey && now - selectedPlanet.time < 500) {
    // Double-tap → travel immediately
    planetSheet.hidden = true;
    const dests = getDestinations();
    const idx = dests.findIndex(d => d.celestial && d.bodyKey === bodyKey);
    if (idx >= 0) {
      selectedDestIndex = idx;
      setPendingDestination(idx);
      beginCall(dests[idx]);
    }
    selectedPlanet = null;
    return;
  }
  selectedPlanet = { key: bodyKey, time: now };
  showPlanetSheet(bodyKey);
}

// Sun overlay — find the Sun body group in the orrery
const sunBody = orreryState.bodies.find(b => b.key === 'sun');
const sunOverlay = sunBody
  ? createSunOverlay(sunBody.group, sunBody.size, sunBody.tier)
  : null;

// Fetch space weather and refresh every 5 minutes
let _flares = [], _kp = 0;
async function refreshSpaceWeather() {
  const [fl, kd] = await Promise.all([fetchFlares(), fetchKIndex()]);
  _flares = fl;
  if (sunOverlay) {
    sunOverlay.update(_flares);
    _kp = sunOverlay.updateKp(kd);
  }
}
refreshSpaceWeather();
setInterval(refreshSpaceWeather, 5 * 60 * 1000);

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
  const cur  = getCurrentDestination();
  const pend = getPendingDestination();
  const now  = Date.now();
  const clk  = fmtBoxTime(now);
  const eph  = ephemeris(orrSimTime);
  const D2R  = Math.PI / 180;
  const rev  = d => (d % 360 + 360) % 360;

  // Moon phase
  const moonElong = rev(eph.moon.lon - eph.sun.lon);
  const moonIllum = Math.round((1 - Math.cos(moonElong * D2R)) / 2 * 100);
  const moonPhase = moonElong < 22.5 ? 'New Moon'
    : moonElong < 67.5 ? 'Waxing Crescent' : moonElong < 112.5 ? 'First Quarter'
    : moonElong < 157.5 ? 'Waxing Gibbous' : moonElong < 202.5 ? 'Full Moon'
    : moonElong < 247.5 ? 'Waning Gibbous' : moonElong < 292.5 ? 'Last Quarter'
    : moonElong < 337.5 ? 'Waning Crescent' : 'New Moon';

  // Sidereal time at Greenwich
  const lst = Math.round(rev(gmst(now))) + '°';

  return {
    room  : "CHRONOS box — the Guild's red K6 relay booth (timetravellersguild.com/box)",
    caller: 'a traveller at the booth phone',
    dimension_now: {
      year: cur.year, location: cur.location, era: cur.era,
      lat: cur.lat, lon: cur.lon, alt: cur.alt,
    },
    dimension_dialling: pend
      ? { year: pend.year, location: pend.location, era: pend.era }
      : null,
    line_pct       : Math.round(line),
    calls_in_queue : Math.round(queue),
    doors          : animator.doorsOpen ? 'open' : 'closed',
    instrument_time: {
      date         : clk.isoDate,
      time         : clk.time,
      day          : clk.day,
      moon_phase   : moonPhase,
      moon_illum   : moonIllum + '%',
      sun_lon      : Math.round(eph.sun.lon) + '°',
      moon_lon     : Math.round(eph.moon.lon) + '°',
      sidereal_time: lst,
    },
    space_weather: spaceWeatherSummary(_flares, _kp),
    note: 'The traveller dials exchanges (eras/dimensions) on the booth phone. ' +
      'You are the Jack of whichever dimension the booth is currently in. ' +
      'instrument_time is live from the Geocentric Chronometer № 13. ' +
      'If the dimension_now has celestial:true, the booth is in the solar system — ' +
      'use the relativistic "when" data to describe the temporal displacement. ' +
      'YOU ARE THE NAVIGATOR. If the traveller asks to go somewhere, call the ' +
      'navigate client tool with the destination name — e.g. navigate("Mars") or ' +
      'navigate("Apollo 11") or navigate("Pompeii"). ' +
      'Available exchanges include all solar system bodies, key historical events, and fictional futures. ' +
      'Confirm the jump dramatically before executing. After a jump, the story terminal will show what awaits.',
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
  btnTravel.querySelector('.dial-main-label').textContent = on ? 'Hang Up' : 'Dial';
  if (!animator.isTraveling) setStatus(null, on ? 'JACK ON LINE' : 'STABLE');
}
setInterval(syncJackState, 1000);

function setDialLabel(text) {
  const el = btnTravel.querySelector('.dial-main-label');
  if (el) el.textContent = text;
}

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

// Update telemetry ΔT with relativistic lag for celestial destinations
function updateCelestialTelemetry() {
  const cur = getCurrentDestination();
  if (!cur.celestial) return;
  const rel = relativisticWhen(cur.distAU, cur.distAU, cur.bodyKey);
  telDt.textContent = rel.display.lightDelay;
  // Live lat/lon from current orrery time
  const eph0 = ephemeris(orrSimTime);
  const body = eph0[cur.bodyKey];
  if (body) {
    telLat.textContent = `${Math.round(body.lon)}° ecl`;
    telLon.textContent = `${body.dist.toFixed(3)} AU`;
    telAlt.textContent = rel.display.shapiro;
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
      beginCall(dest);
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
  btnTravel.querySelector('.dial-main-label').textContent = 'Dialling…';
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
        showStoryFor(arrived);

        // Animate booth to planet world position for celestial destinations
        if (arrived.celestial) {
          const b = orreryState.bodies.find(bd => bd.key === arrived.bodyKey);
          if (b) {
            const wp = new THREE.Vector3(0, 0, b.tier);
            b.group.localToWorld(wp);
            targetTardisPos.set(wp.x, 0, wp.z);
            // Move camera to orbit around the planet position
            const cx = wp.x + 0, cy = 1.1, cz = wp.z + 2.8;
            animateCameraTo(
              new THREE.Vector3(cx, cy, cz),
              new THREE.Vector3(wp.x, 0.3, wp.z),
              1400,
            );
          }
        } else {
          targetTardisPos.set(0, 0, 0);
          animateCameraTo(defaultCamPos.clone(), new THREE.Vector3(0, 0.4, 0), 1200);
        }
      }
      travelOverlay.hidden = true;
      btnTravel.classList.remove('traveling');
      btnTravel.querySelector('.dial-main-label').textContent = jackOnLine ? 'Hang Up' : 'Dial';
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
  btnDoors.querySelector('.knob-label').textContent = open ? 'Close' : 'Doors';
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
  btnInterior.querySelector('.knob-label').textContent = interiorView ? 'Ext' : 'View';

  if (!animator.doorsOpen) {
    animator.toggleDoors(doors);
    btnDoors.querySelector('.knob-label').textContent = 'Close';
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
  btnInterior.querySelector('.knob-label').textContent = 'View';
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

  // Check planets first
  const planetHits = raycaster.intersectObjects(planetHitMeshes, false);
  if (planetHits.length) {
    handlePlanetTap(planetHits[0].object.userData.bodyKey);
    return;
  }

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
    btnDoors.querySelector('.knob-label').textContent = open ? 'Close' : 'Doors';
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
let clockTick = 0;  // throttle the HUD time update to ~1 Hz

function tickClock() {
  const cur = getCurrentDestination();
  if (!isPresent(cur.era)) return;
  const t = fmtBoxTime(Date.now());
  timeValue.textContent = `${t.isoDate} — ${cur.location} · ${t.time}`;
}

function idleAnimations(time) {
  if (!animator.isTraveling) {
    tardis.position.x = tardisBasePos.x;
    tardis.position.y = tardisBasePos.y + Math.sin(time * 0.85) * 0.035;
    tardis.position.z = tardisBasePos.z;
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

// ── Story ───────────────────────────────────────────────
const storyPanel = document.getElementById('story-panel');
const storyLocEl = document.getElementById('story-loc');
const storyTextEl = document.getElementById('story-text');
document.getElementById('btn-story-close').addEventListener('click', () => {
  storyPanel.hidden = true;
  speechSynthesis.cancel();
});

const btnStorySpeak = document.getElementById('btn-story-speak');
btnStorySpeak.addEventListener('click', () => {
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    btnStorySpeak.classList.remove('speaking');
    return;
  }
  const text = storyTextEl.textContent;
  if (!text) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.88;
  utter.pitch = 1.15;
  // Prefer a female voice; fall back to any available
  const voices = speechSynthesis.getVoices();
  const female = voices.find(v => /female|woman|girl|zira|samantha|karen|moira|fiona|tessa|veena|ava|allison|susan|victoria|joanna|salli|kendra|kimberly|ivy|aria/i.test(v.name));
  if (female) utter.voice = female;
  btnStorySpeak.classList.add('speaking');
  utter.onend = () => btnStorySpeak.classList.remove('speaking');
  utter.onerror = () => btnStorySpeak.classList.remove('speaking');
  speechSynthesis.speak(utter);
});

async function fetchStory(dest) {
  const fd = new FormData();
  fd.append('dest', dest.location);
  fd.append('era', dest.era ?? '');
  fd.append('year', String(dest.year ?? ''));
  try {
    const res = await fetch('/box/story.php', { method: 'POST', body: fd });
    const data = await res.json();
    return data.story ?? null;
  } catch { return null; }
}

function typewriterShow(text, dest) {
  storyPanel.hidden = false;
  storyLocEl.textContent = `${dest.location} · ${dest.era}`;
  storyTextEl.textContent = '';
  storyTextEl.classList.remove('done');
  let i = 0;
  const SPEED = 18; // ms per character
  const tick = () => {
    // Write up to 4 chars per frame for snappier feel
    const batch = Math.min(4, text.length - i);
    storyTextEl.textContent += text.slice(i, i + batch);
    i += batch;
    if (i < text.length) setTimeout(tick, SPEED);
    else storyTextEl.classList.add('done');
  };
  tick();
}

function showStoryFor(dest) {
  // Fetch async; show panel as soon as text arrives
  fetchStory(dest).then(story => {
    if (story) typewriterShow(story, dest);
  });
}

// ── Jack navigation ─────────────────────────────────────
// ElevenLabs client tools can call window.jackNavigate('Mars') during
// a conversation. Register this as a client tool in jack-face.js config
// or call it from any JS context.
window.jackNavigate = function (locationQuery) {
  const dests = getDestinations();
  const q = String(locationQuery).toLowerCase().trim();
  let idx = dests.findIndex(d =>
    d.location.toLowerCase() === q ||
    d.location.toLowerCase().includes(q) ||
    d.era.toLowerCase().includes(q) ||
    String(d.year).toLowerCase().startsWith(q)
  );
  if (idx < 0) return { ok: false, error: `No destination matching "${locationQuery}"` };
  const dest = setPendingDestination(idx);
  if (!dest) return { ok: false, error: 'index out of range' };
  selectedDestIndex = idx;
  applyDestinationReadout(dest, false);
  timeValue.textContent = formatDestination(dest) + ' ◈ queued';
  beginCall(dest);
  return { ok: true, destination: dest.location, era: dest.era, year: dest.year };
};

function animate() {
  requestAnimationFrame(animate);
  const delta   = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // Smoothly move booth base toward target planet (or back to origin)
  tardisBasePos.lerp(targetTardisPos, 0.055);

  // Advance orrery simulation time
  if (orrLive) orrSimTime = Date.now();
  else orrSimTime = Math.max(-8.64e15, Math.min(8.64e15, orrSimTime + orrSpeed * 1000 * delta));

  controls.update();
  idleAnimations(elapsed);
  animator.update(delta);
  animateChrononField(chronons, elapsed);
  updateOrrery(orreryState, orrSimTime, delta);

  // Telemetry ΔT
  telDt.textContent = `${elapsed.toFixed(2)}s`;

  // Live clock / relativistic telemetry on the HUD (~1 Hz)
  clockTick += delta;
  if (clockTick > 1) {
    clockTick = 0;
    tickClock();
    updateCelestialTelemetry();
    thRate.textContent = fmtRate(orrSpeed);
  }

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
