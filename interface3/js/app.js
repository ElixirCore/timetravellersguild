import { load } from './state.js';
import { buildMasterUnit } from './ui/unit-master.js';
import { buildArpUnit } from './ui/unit-arp.js';
import { buildBassUnit } from './ui/unit-bass.js';
import { buildPedalboard } from './ui/unit-pedals.js';
import { buildLooperUnit } from './ui/unit-looper.js';
import { buildDrumUnit } from './ui/unit-drum.js';
import { buildFieldUnit } from './ui/unit-field.js';
import { buildSeedbedUnit } from './ui/unit-seedbed.js';
import { buildStylusUnit } from './ui/unit-stylus.js';
import { createRigRefresh } from './ui/rig-refresh.js';
import { initHud } from './ui/hud.js';
import { initCables, drawCables } from './ui/cables.js';
import { buildSceneUnit } from './ui/unit-scene.js';
import { initRigTips } from './ui/rig-tips.js';
import { initFieldVoice } from './audio/field-voice.js';

load();

let bass = null;
const arp = buildArpUnit({ onHarmonyChange: () => { bass?.refreshRail(); } });
const master = buildMasterUnit({
  onStop: () => {
    arp.rail.clearPlayhead();
    const pos = document.getElementById('lcd-pos');
    if (pos) pos.textContent = 'READY';
  },
});
bass = buildBassUnit();
const drums = buildDrumUnit();
const field = buildFieldUnit();
const seedbed = buildSeedbedUnit();
const stylus = buildStylusUnit();
const pedals = buildPedalboard();
buildLooperUnit();

const units = { master, arp, bass, drums, field, seedbed, stylus, pedals };
const refreshRig = createRigRefresh(units);
const scene = buildSceneUnit({ refreshRig });
units.scene = scene;

initFieldVoice().then(() => {
  field.refreshAll();
  drawCables();
  scene.refreshAll();
});
seedbed.syncLanes();

initHud({ arp, bass, drums, field, stylus });
initCables();
initRigTips();

