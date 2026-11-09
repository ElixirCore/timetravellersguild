import { FIELD_PADS } from '../state.js';
import { loadAllFieldPads, saveFieldPad, clearFieldPad } from '../audio/field-store.js';

const DB_NAME = 'arpbuilder-field-scenes-v1';
const STORE = 'pads';

function padKey(slot, index) {
  return `${slot}:${index}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putPad(db, key, entry) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    if (entry) store.put(entry, key);
    else store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getPad(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function copyWorkingPadsToScene(slot) {
  const db = await openDb();
  const working = await loadAllFieldPads();
  for (let i = 0; i < FIELD_PADS; i++) {
    const key = padKey(slot, i);
    const entry = working[i];
    if (entry?.data?.length) await putPad(db, key, entry);
    else await putPad(db, key, null);
  }
}

export async function applyScenePadsToWorking(slot) {
  const db = await openDb();
  for (let i = 0; i < FIELD_PADS; i++) {
    const entry = await getPad(db, padKey(slot, i));
    if (entry?.data?.length) await saveFieldPad(i, entry.sampleRate, Float32Array.from(entry.data));
    else await clearFieldPad(i);
  }
}
