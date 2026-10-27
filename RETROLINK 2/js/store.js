// Tiny wrapper around IndexedDB (the browser's built-in storage for big files).
// Dev mode uses it to remember games you added until you Export them.
(function () {
  const DB = "retrolink-dev", STORE = "kv";
  let dbPromise;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error("IndexedDB is not available"));
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function run(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = function () { resolve(req && req.result); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  window.RetroStore = {
    get: function (k) { return run("readonly", function (s) { return s.get(k); }); },
    set: function (k, v) { return run("readwrite", function (s) { return s.put(v, k); }); },
    del: function (k) { return run("readwrite", function (s) { return s.delete(k); }); },
    clear: function () { return run("readwrite", function (s) { return s.clear(); }); }
  };
})();
