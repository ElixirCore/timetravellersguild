/* INTERFACE v6 — the /interface2 sample mixer with FIELD TAP, LOOPSMITH and
   the pedal chain from v5, built as a Tree of Life with a tesseract at its
   heart. See README.md for the map. */
import { THREE, C } from './ui/gl.js';
import { load } from './state.js';
import { LAYOUT, Station, buildPaths } from './ui/tree.js';
import { createNav } from './ui/nav.js';
import { createGuide } from './ui/guide.js';
import { hud } from './ui/widgets.js';
import { glyphURL } from './ui/glyphs.js';
import {
  buildKeter, buildChokmah, buildBinah, buildPedalPair, buildPedalSingle, buildYesod, buildMalkuth,
} from './ui/stations.js';
import { buildTiferet } from './ui/tiferet.js';
import { ensureAudio, getCtx, nodes, levelOf } from './audio/engine.js';
import { slots, addTrack, firstFree, setSay } from './audio/tracks.js';
import { looperStatus, prepareLooper } from './audio/looper.js';
import { initFieldVoice } from './audio/field-voice.js';

const $ = (id) => document.getElementById(id);

load();

/* ---------- hud ---------- */
const statusEl = $('status');
function say(t, bad) {
  statusEl.textContent = t || '';
  statusEl.classList.toggle('bad', !!bad);
}
setSay(say);

const readout = $('readout');
const readImg = readout.querySelector('img');
const readText = readout.querySelector('span');
hud.readout = (glyph, text) => {
  const src = glyphURL(glyph, '#e8b93c');
  if (readImg.getAttribute('src') !== src) readImg.src = src;
  readText.textContent = text;
  readout.hidden = false;
};
hud.endReadout = () => { readout.hidden = true; };

const home = $('home');
home.querySelector('img').src = glyphURL('home');

/* ---------- scene ---------- */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(C.bg, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 2000);

const stations = {};
for (const key of Object.keys(LAYOUT)) stations[key] = new Station(scene, key);

let primed = false;
const nav = createNav({
  canvas, camera, stations,
  onFirstTouch: () => {
    ensureAudio();
    if (!primed) { primed = true; prepareLooper(); }
  },
});

const app = {
  say,
  fly: (key) => nav.go(key),
  setQuota: (used, cap) => keter.setQuota(used, cap),
  library: null,
  /* a clip from the library or the generator: into the chosen cell if it is
     empty, else the next free one; it starts playing, as in /interface2 */
  addClip(id, label) {
    const slot = firstFree(tiferet.focus());
    if (slot < 0) { say('eight tracks is plenty', true); return; }
    tiferet.setFocus(slot);
    addTrack(id, label, null, slot);
  },
};

const keter = buildKeter(stations.keter, app);
app.library = buildChokmah(stations.chokmah, app);
buildBinah(stations.binah, app);
buildPedalPair(stations.gevurah, ['drive', 'wah']);
buildPedalPair(stations.chesed, ['chorus', 'phaser']);
buildPedalSingle(stations.netzach, 'delay');
buildPedalSingle(stations.hod, 'reverb');
buildYesod(stations.yesod);
buildMalkuth(stations.malkuth, app);
const tiferet = buildTiferet(stations.tiferet, app);

/* live routes: what actually flows along each path */
const lv = {};
let clock = 0;
const paths = buildPaths(scene, [
  ['keter', 'chokmah', () => (keter.busy() ? 0.5 + 0.3 * Math.sin(clock * 6) : 0)],
  ['chokmah', 'tiferet', () => (slots.some((s) => s && s.loading) ? 0.8 : 0)],
  ['binah', 'tiferet', () => lv.field],
  ['tiferet', 'gevurah', () => lv.mix],
  ['gevurah', 'chesed', () => lv.wah],
  ['chesed', 'netzach', () => lv.phaser],
  ['netzach', 'hod', () => lv.delay],
  ['hod', 'malkuth', () => lv.reverb],
  ['hod', 'yesod', () => (['REC', 'DUB'].includes(looperStatus().st) ? lv.reverb : 0)],
  ['yesod', 'malkuth', () => lv.looper],
]);

function readLevels() {
  const m = nodes.meters;
  lv.field = levelOf(m?.field);
  lv.mix = levelOf(m?.mix);
  lv.looper = levelOf(m?.looper);
  for (const id of ['wah', 'phaser', 'delay', 'reverb']) lv[id] = levelOf(m?.pedals[id]);
}

home.addEventListener('click', () => nav.go(null));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.activeElement?.id !== 'prompt') nav.go(null);
});
nav.onChange((key) => { home.hidden = !key && !nav.zoomed; });
createGuide(nav, stations);

/* ---------- size ---------- */
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  nav.resize(w, h);
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
resize();
nav.snap();

/* ---------- run ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += dt;
  if (getCtx()) readLevels();
  else for (const k of ['field', 'mix', 'looper', 'wah', 'phaser', 'delay', 'reverb']) lv[k] = 0;
  for (const st of Object.values(stations)) st.update(dt, st.key === nav.focus, !!nav.focus && st.key !== nav.focus);
  paths.update(dt);
  nav.update(dt);
  nav.layoutDom(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

app.library.load();
initFieldVoice().catch(() => {});
