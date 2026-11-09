/* FIELD TAP pad store (v5). v8 keeps its own copy of the pads so nothing here
   can overwrite the samples the live v3-v7 rigs read. First run copies the
   v7 pads across, else v6's, else v5's, else the v3/v4 ones. */
const DB_NAME = 'interface8-field-v1';
const SEED_DBS = ['interface7-field-v1', 'interface6-field-v1', 'arpbuilder-field-v5', 'arpbuilder-field-v1']; // read once, never written
const STORE = 'pads';

export function openNamedDb(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readAll(db) {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const keys = tx.objectStore(STORE).getAllKeys();
    const vals = tx.objectStore(STORE).getAll();
    tx.oncomplete = () => res(keys.result.map((k, i) => [k, vals.result[i]]));
    tx.onerror = () => rej(tx.error);
  });
}

export async function migrateFieldPads() {
  try {
    const flag = `migrated:${DB_NAME}`;
    if (localStorage.getItem(flag)) return;
    const newDb = await openNamedDb(DB_NAME);
    if (!(await readAll(newDb)).length) {
      for (const name of SEED_DBS) {
        const oldDb = await openNamedDb(name);
        const entries = await readAll(oldDb);
        oldDb.close();
        if (!entries.length) continue;
        await new Promise((res, rej) => {
          const tx = newDb.transaction(STORE, 'readwrite');
          for (const [k, v] of entries) tx.objectStore(STORE).put(v, k);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
        break;
      }
    }
    localStorage.setItem(flag, '1');
    newDb.close();
  } catch (e) { /* start empty */ }
}

function openDb() {
  return openNamedDb(DB_NAME);
}

export async function saveFieldPad(index, sampleRate, data) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ sampleRate, data: Array.from(data) }, String(index));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadFieldPad(index) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(String(index));
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearFieldPad(index) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(String(index));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllFieldPads() {
  const out = [];
  for (let i = 0; i < 8; i++) {
    out.push(await loadFieldPad(i));
  }
  return out;
}
