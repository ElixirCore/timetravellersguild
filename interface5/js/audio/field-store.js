const DB_NAME = 'arpbuilder-field-v5';
const OLD_DB_NAME = 'arpbuilder-field-v1'; // v3/v4 pads: read once, never written by v5
const STORE = 'pads';

export function openNamedDb(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* v5 keeps its own copy of the pads so auto-capture can never overwrite the
   samples that the live v3/v4 rigs read. First run copies the old ones across. */
export async function migrateStore(oldName, newName) {
  try {
    const flag = `migrated:${newName}`;
    if (localStorage.getItem(flag)) return;
    const [oldDb, newDb] = await Promise.all([openNamedDb(oldName), openNamedDb(newName)]);
    const read = (db) => new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const keys = tx.objectStore(STORE).getAllKeys();
      const vals = tx.objectStore(STORE).getAll();
      tx.oncomplete = () => res(keys.result.map((k, i) => [k, vals.result[i]]));
      tx.onerror = () => rej(tx.error);
    });
    const existing = await read(newDb);
    if (!existing.length) {
      const entries = await read(oldDb);
      await new Promise((res, rej) => {
        const tx = newDb.transaction(STORE, 'readwrite');
        for (const [k, v] of entries) tx.objectStore(STORE).put(v, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    }
    localStorage.setItem(flag, '1');
    oldDb.close();
    newDb.close();
  } catch (e) { /* start empty */ }
}

export async function migrateFieldPads() {
  await migrateStore(OLD_DB_NAME, DB_NAME);
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
