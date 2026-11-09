import { runtime } from '../state.js';

export const SCENE_NAMES = ['INTRO', 'VERSE', 'BUILD', 'OPEN', 'BREAK', 'RETURN'];
export const SCENE_COUNT = SCENE_NAMES.length;

const STORAGE_KEY = 'interface4-rig-scenes-v1';
const V3_KEY = 'interface3-rig-scenes-v1'; // read-only fallback

export function defaultBank() {
  return {
    version: 1,
    slots: SCENE_NAMES.map((name, id) => ({ id, name, snapshot: null })),
  };
}

export let sceneBank = defaultBank();

export function loadSceneBank() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(V3_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.slots) || parsed.slots.length !== SCENE_COUNT) return;
    sceneBank = {
      version: 1,
      slots: parsed.slots.map((slot, i) => ({
        id: i,
        name: slot?.name || SCENE_NAMES[i],
        snapshot: slot?.snapshot ?? null,
      })),
    };
  } catch { /* keep defaults */ }
}

export function saveSceneBank() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sceneBank));
  } catch { /* storage full */ }
}

export function getSlot(index) {
  return sceneBank.slots[index];
}

export function setActiveSlot(index) {
  runtime.sceneActiveSlot = index;
}

export function getActiveSlot() {
  return runtime.sceneActiveSlot ?? 0;
}
