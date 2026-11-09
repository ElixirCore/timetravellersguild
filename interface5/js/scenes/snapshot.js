import { captureSnapshot, applySnapshot, save, runtime } from '../state.js';
import { getSlot, saveSceneBank } from './bank.js';
import { snapshotsEqual } from './diff.js';
import { copyWorkingPadsToScene, applyScenePadsToWorking } from './field-scenes.js';
import { reloadFieldPadsFromStore } from '../audio/field-voice.js';
import { syncSeedLanesFromState } from '../audio/seed-voice.js';
import { applyStrips } from '../audio/context.js';
import { applyAllPedals } from '../audio/pedals.js';
import { applyStylusFx } from '../audio/stylus-fx.js';

export function isSceneDirty(slotIndex) {
  if (runtime.sceneRecalledSlot == null) return false;
  if (slotIndex !== runtime.sceneRecalledSlot) return false;
  const slot = getSlot(slotIndex);
  if (!slot?.snapshot) return false;
  return !snapshotsEqual(captureSnapshot(), slot.snapshot);
}

export async function saveToScene(slotIndex) {
  const snapshot = captureSnapshot();
  const slot = getSlot(slotIndex);
  slot.snapshot = snapshot;
  await copyWorkingPadsToScene(slotIndex);
  saveSceneBank();
  runtime.sceneRecalledSlot = slotIndex;
  save();
  return snapshot;
}

export async function recallScene(slotIndex, { force = false } = {}) {
  const slot = getSlot(slotIndex);
  if (!slot?.snapshot) return false;

  if (!force && isSceneDirty(runtime.sceneRecalledSlot ?? slotIndex)) {
    const name = slot.name || `SCENE ${slotIndex + 1}`;
    const ok = window.confirm('Unsaved changes to the current rig. Recall anyway?');
    if (!ok) return false;
  }

  applySnapshot(slot.snapshot);
  await applyScenePadsToWorking(slotIndex);
  await reloadFieldPadsFromStore();
  await syncSeedLanesFromState();
  applyStrips();
  applyAllPedals();
  applyStylusFx();
  runtime.sceneRecalledSlot = slotIndex;
  save();
  return true;
}

export function arpPreview(snapshot, length = 16) {
  const steps = snapshot?.arp?.steps ?? [];
  const len = snapshot?.arp?.length ?? length;
  return steps.slice(0, len).map((s) => (s?.on ? '●' : '·')).join('');
}

export function activeUnitCount(snapshot) {
  if (!snapshot) return 0;
  let n = 0;
  if (snapshot.arp && !snapshot.arp.mute) n++;
  if (snapshot.bass?.on) n++;
  if (snapshot.drums?.on && !snapshot.drums.mute) n++;
  if (snapshot.field?.on && !snapshot.field.mute) n++;
  if (snapshot.seed?.on && !snapshot.seed.mute) n++;
  if (snapshot.stylus?.on && !snapshot.stylus.mute) n++;
  return n;
}
