/* RecStore: tiny IndexedDB wrapper for local recordings.
   put(key, {blob, ext, savedAt}) · get(key) · del(key) · keys() · all() */
const RecStore = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open("oido-recordings", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("recs", { keyPath: "key" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const store = db.transaction("recs", mode).objectStore("recs");
      const req = fn(store);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  };
  return {
    put: (key, rec) => run("readwrite", (s) => s.put({ ...rec, key })),
    get: async (key) => (await run("readonly", (s) => s.get(key))) || null,
    del: (key) => run("readwrite", (s) => s.delete(key)),
    keys: () => run("readonly", (s) => s.getAllKeys()),
    all: () => run("readonly", (s) => s.getAll()),
  };
})();
