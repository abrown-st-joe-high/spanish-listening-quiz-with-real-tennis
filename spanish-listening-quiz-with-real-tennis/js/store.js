/* RecStore: tiny IndexedDB wrapper for local recordings.
   put(key, {blob, ext, savedAt}) · get(key) · del(key) · keys() · all() */
const RecStore = (() => {
  const NAME = "oido-recordings", STORE = "recs";
  let dbp = null;
  const openAt = (version) => new Promise((res, rej) => {
    const r = version ? indexedDB.open(NAME, version) : indexedDB.open(NAME);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: "key" }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("Database blocked: close other tabs of this site and retry."));
  });
  const open = () => dbp || (dbp = (async () => {
    let db = await openAt();
    if (!db.objectStoreNames.contains(STORE)) { const v = db.version + 1; db.close(); db = await openAt(v); }
    return db;
  })().catch((e) => { dbp = null; throw e; }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => res(req.result);
      tx.onerror = () => rej(tx.error || req.error);
      tx.onabort = () => rej(tx.error || new Error("Storage transaction aborted"));
    });
  };
  // Works with either schema: keys stored inside the record (keyPath "key") or
  // out-of-line keys, which an older version of this site may have created.
  const all = (s) => {
    const out = [], r = s.openCursor();
    r.onsuccess = () => {
      const c = r.result;
      if (c) { out.push({ ...c.value, key: c.key }); c.continue(); }
    };
    return { get result() { return out; } };
  };
  return {
    put: (key, rec) => run("readwrite", (s) => (s.keyPath ? s.put({ ...rec, key }) : s.put({ ...rec, key }, key))),
    get: async (key) => (await run("readonly", (s) => s.get(key))) || null,
    del: (key) => run("readwrite", (s) => s.delete(key)),
    keys: () => run("readonly", (s) => s.getAllKeys()),
    all: () => run("readonly", all),
  };
})();
