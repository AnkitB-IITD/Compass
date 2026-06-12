/* ============================================================
   db.js — Durable local storage on IndexedDB.

   Async, large, and not the first thing the OS evicts under
   storage pressure — important for a journal people trust.
   We also request persistent storage where supported.

   Object stores:
     entries  — check-ins + journal entries, keyed by id
     goals    — goals across all horizons, keyed by id
     insights — cached AI analyses, keyed by id
     meta     — settings, API key, onboarding flag, prefs

   Nothing else in the app touches IndexedDB directly.
   ============================================================ */

const DB_NAME = 'compass';
const DB_VERSION = 1;

let _dbp = null;

function open() {
  if (_dbp) return _dbp;
  _dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains('entries')) {
        const s = idb.createObjectStore('entries', { keyPath: 'id' });
        s.createIndex('byCreated', 'createdAt');
      }
      if (!idb.objectStoreNames.contains('goals')) {
        const s = idb.createObjectStore('goals', { keyPath: 'id' });
        s.createIndex('byHorizon', 'horizon');
      }
      if (!idb.objectStoreNames.contains('insights')) {
        const s = idb.createObjectStore('insights', { keyPath: 'id' });
        s.createIndex('byCreated', 'createdAt');
      }
      if (!idb.objectStoreNames.contains('meta')) {
        idb.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbp;
}

function tx(store, mode, fn) {
  return open().then((idb) => new Promise((resolve, reject) => {
    const t = idb.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    try { out = fn(s); } catch (err) { reject(err); return; }
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export function requestPersistence() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

/* ---- generic helpers ---- */

function getAll(store) {
  return tx(store, 'readonly', (s) => s.getAll());
}
function put(store, value) {
  return tx(store, 'readwrite', (s) => s.put(value)).then(() => value);
}
function del(store, id) {
  return tx(store, 'readwrite', (s) => s.delete(id));
}

/* ---- entries ---- */

export async function listEntries() {
  const all = await getAll('entries');
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
export function getEntry(id) {
  return tx('entries', 'readonly', (s) => s.get(id));
}
export function saveEntry(entry) { return put('entries', entry); }
export function deleteEntry(id) { return del('entries', id); }

/* ---- goals ---- */

export async function listGoals() {
  const all = await getAll('goals');
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
export function saveGoal(goal) { return put('goals', goal); }
export function deleteGoal(id) { return del('goals', id); }

/* ---- insights ---- */

export async function listInsights() {
  const all = await getAll('insights');
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
export function saveInsight(insight) { return put('insights', insight); }

/* ---- meta ---- */

export async function getMeta(key, fallback = null) {
  const row = await tx('meta', 'readonly', (s) => s.get(key));
  return row === undefined || row === null ? fallback : row.value;
}
export function setMeta(key, value) {
  return put('meta', { key, value });
}

/* ---- export / wipe ---- */

export async function exportAll() {
  const [entries, goals, insights] = await Promise.all([
    getAll('entries'), getAll('goals'), getAll('insights'),
  ]);
  return { app: 'compass', exportedAt: new Date().toISOString(), entries, goals, insights };
}

export async function wipeAll() {
  for (const store of ['entries', 'goals', 'insights', 'meta']) {
    await tx(store, 'readwrite', (s) => s.clear());
  }
}
