// Dev mode. Only switched on when you log in with the dev password.
// Everything you change is saved in THIS browser only, until you press Export
// and upload the exported files to GitHub.
(function () {
  "use strict";

  const CONSOLES = Object.assign(
    { snes: "SNES", nes: "NES", gba: "GBA", gb: "Game Boy", genesis: "Genesis", html5: "HTML5" },
    window.RETROLINK_CONSOLES || {}
  );
  const ROM_CONSOLES = ["snes", "nes", "gba", "gb", "genesis"];
  // File ending -> which console / kind of game it is
  const EXT = {
    sfc: "snes", smc: "snes", nes: "nes", gba: "gba", gb: "gb", gbc: "gb",
    md: "genesis", gen: "genesis", smd: "genesis", html: "html5", htm: "html5"
  };
  const WEB_LIMIT = 25 * 1024 * 1024;     // GitHub browser upload limit per file
  const HARD_LIMIT = 100 * 1024 * 1024;   // GitHub refuses bigger files (without Git LFS)

  const $ = function (id) { return document.getElementById(id); };

  let active = false;
  let wired = false;
  let memoryOnly = false;
  let state = blankState();
  const blobMap = {};     // key -> Blob (the real files)
  const blobUrls = {};    // key -> temporary address the page can use to show/play them

  function blankState() {
    return { added: [], edits: {}, removed: [], order: [], background: undefined, passwords: null };
  }

  // ---------- saving ----------
  function failStorage(e) {
    memoryOnly = true;
    status(e && e.name === "QuotaExceededError"
      ? "This browser has no room left to save that file. It will work until you close the page, so Export now."
      : "This browser can't save your changes (private window?). They will be lost when you close the page, so Export before leaving.", true);
  }
  async function save() {
    if (memoryOnly) return;
    try { await RetroStore.set("state", state); } catch (e) { failStorage(e); }
  }
  async function putBlob(key, blob) {
    blobMap[key] = blob;
    if (memoryOnly) return;
    try { await RetroStore.set("blob:" + key, blob); } catch (e) { failStorage(e); }
  }
  function urlFor(key) {
    if (!key || !blobMap[key]) return "";
    if (!blobUrls[key]) blobUrls[key] = URL.createObjectURL(blobMap[key]);
    return blobUrls[key];
  }
  function dropBlob(key) {
    if (!key) return;
    if (blobUrls[key]) { URL.revokeObjectURL(blobUrls[key]); delete blobUrls[key]; }
    delete blobMap[key];
    RetroStore.del("blob:" + key).catch(function () {});
  }
  function usedKeys() {
    const keys = [];
    state.added.forEach(function (a) { keys.push(a.fileKey, a.coverKey); });
    Object.keys(state.edits).forEach(function (id) { if (state.edits[id].coverKey) keys.push(state.edits[id].coverKey); });
    if (state.background && state.background.type === "image") keys.push(state.background.key);
    return keys.filter(Boolean);
  }
  async function load() {
    state = blankState();
    memoryOnly = false;
    try {
      const saved = await RetroStore.get("state");
      if (saved) state = Object.assign(blankState(), saved);
      const keys = usedKeys();
      for (let i = 0; i < keys.length; i++) {
        const b = await RetroStore.get("blob:" + keys[i]);
        if (b) blobMap[keys[i]] = b;
      }
    } catch (e) {
      memoryOnly = true;
      status("This browser can't save your changes (private window?). Export before leaving the page.", true);
    }
  }

  // ---------- the game list as dev mode sees it ----------
  function games() {
    const base = (window.RETROLINK_LIBRARY || [])
      .filter(function (g) { return state.removed.indexOf(g.id) === -1; })
      .map(function (g) {
        const e = state.edits[g.id] || {};
        return Object.assign({}, g, {
          title: e.title || g.title,
          console: g.type === "rom" && e.console ? e.console : g.console,
          cover: e.coverKey && blobMap[e.coverKey] ? urlFor(e.coverKey) : g.cover,
          _src: "base"
        });
      });
    const added = state.added.map(function (a) {
      return { id: a.id, title: a.title, type: a.type, console: a.console,
               cover: urlFor(a.coverKey), file: urlFor(a.fileKey), _src: "added" };
    });
    const all = base.concat(added);
    const pos = function (id) { const i = state.order.indexOf(id); return i === -1 ? 1e9 : i; };
    return all
      .map(function (g, i) { return [g, i]; })
      .sort(function (a, b) { return pos(a[0].id) - pos(b[0].id) || a[1] - b[1]; })
      .map(function (x) { return x[0]; });
  }

  function move(id, targetId, after) {
    const ids = games().map(function (g) { return g.id; });
    const from = ids.indexOf(id);
    if (from === -1 || id === targetId) return;
    ids.splice(from, 1);
    let to = targetId ? ids.indexOf(targetId) : ids.length;
    if (to === -1) to = ids.length;
    if (targetId && after) to += 1;
    ids.splice(to, 0, id);
    state.order = ids;
    save();
    refresh();
  }

  // ---------- background ----------
  function publishedBackground() {
    const b = (window.RETROLINK_SETTINGS || {}).background;
    if (!b) return null;
    if (b.type === "image") return { type: "image", url: b.file };
    return b;
  }
  function effectiveBackground() {
    const b = state.background;
    if (b === undefined) return publishedBackground();
    if (b.type === "none") return null;
    if (b.type === "color") return b;
    if (b.type === "image") return { type: "image", url: urlFor(b.key) };
    return null;
  }
  function applyTheme() {
    RetroTheme.apply(active ? effectiveBackground() : publishedBackground());
  }

  // ---------- pictures ----------
  function toBlob(canvas, quality) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, "image/jpeg", quality); });
  }
  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("That file isn't a picture this browser can read.")); };
      img.src = url;
    });
  }
  // Crop/scale any picture to the 4:5 icon shape
  async function iconFromFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const W = 400, H = 500;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const g = c.getContext("2d");
      const scale = Math.max(W / img.width, H / img.height);
      const w = img.width * scale, h = img.height * scale;
      g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
      g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      return await toBlob(c, 0.88);
    } finally { URL.revokeObjectURL(url); }
  }
  async function backgroundFromFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const scale = Math.min(1, 1920 / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return await toBlob(c, 0.85);
    } finally { URL.revokeObjectURL(url); }
  }
  // A made-up pixel-art icon so a new game never has a blank cover
  function makeCover(title, con, seed) {
    const W = 400, H = 500;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    let h = 0;
    (seed + title).split("").forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
    const rnd = function () { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    const hue = Math.floor(rnd() * 360);
    const c1 = "hsl(" + ((hue + 40) % 360) + " 85% 62%)";
    const c2 = "hsl(" + ((hue + 180) % 360) + " 75% 62%)";
    g.fillStyle = "hsl(" + hue + " 45% 14%)"; g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.18; g.fillStyle = c2;
    for (let i = 0; i < 34; i++) g.fillRect(0, 60 + i * 8, W, 4);
    g.globalAlpha = 1;
    const cell = 44, rows = 7;
    for (let y = 0; y < rows; y++) {
      const half = [rnd() < 0.55, rnd() < 0.55, rnd() < 0.55];
      const row = half.concat([half[1], half[0]]);
      row.forEach(function (on, x) {
        if (!on) return;
        g.fillStyle = (x + y) % 3 ? c1 : c2;
        g.fillRect((W - 5 * cell) / 2 + x * cell, 70 + (300 - rows * cell) / 2 + y * cell, cell, cell);
      });
    }
    g.fillStyle = "rgba(0,0,0,.72)"; g.fillRect(0, 388, W, 112);
    const mono = "ui-monospace, Menlo, Consolas, monospace";
    let size = 34, label = title;
    g.font = "bold " + size + "px " + mono;
    while (g.measureText(label).width > W - 48 && size > 16) { size -= 2; g.font = "bold " + size + "px " + mono; }
    while (g.measureText(label).width > W - 48 && label.length > 1) label = label.slice(0, -1);
    if (label !== title) label = label.slice(0, -1) + "\u2026";
    g.fillStyle = "#fff"; g.textBaseline = "alphabetic"; g.fillText(label, 24, 440);
    g.font = "20px " + mono; g.fillStyle = c1; g.fillText(CONSOLES[con] || con, 24, 474);
    g.strokeStyle = c1; g.lineWidth = 4; g.strokeRect(8, 8, W - 16, H - 16);
    return toBlob(c, 0.88);
  }

  // ---------- adding games ----------
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "game"; }
  function allIds() {
    return (window.RETROLINK_LIBRARY || []).map(function (g) { return g.id; })
      .concat(state.added.map(function (a) { return a.id; }));
  }
  function uniqueId(base) {
    const taken = allIds();
    let id = slug(base), n = 2;
    while (taken.indexOf(id) !== -1) id = slug(base) + "-" + n++;
    return id;
  }
  function mb(bytes) { return bytes < 1048576 ? Math.max(1, Math.round(bytes / 1024)) + " KB" : (bytes / 1048576).toFixed(1) + " MB"; }

  async function addFiles(fileList) {
    const files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    const skipped = [], warnings = [];
    let count = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const dot = f.name.lastIndexOf(".");
      const ext = dot === -1 ? "" : f.name.slice(dot + 1).toLowerCase();
      const con = EXT[ext];
      if (!con || f.size === 0) { skipped.push(f.name); continue; }
      const stem = dot === -1 ? f.name : f.name.slice(0, dot);
      const id = uniqueId(stem);
      const title = stem.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim() || id;
      const fileKey = "f-" + id, coverKey = "c-" + id + "-0";
      // Make sure a web game is treated as a web page even if the browser gave the file no type.
      await putBlob(fileKey, con === "html5" ? f.slice(0, f.size, "text/html") : f);
      await putBlob(coverKey, await makeCover(title, con, id));
      state.added.push({ id: id, title: title, type: con === "html5" ? "html5" : "rom",
                         console: con, ext: ext, fileKey: fileKey, coverKey: coverKey, size: f.size });
      if (f.size > HARD_LIMIT) warnings.push(f.name + " is over 100 MiB. GitHub will refuse it.");
      else if (f.size > WEB_LIMIT) warnings.push(f.name + " is over 25 MiB. GitHub's browser upload will refuse it.");
      count++;
    }
    await save();
    refresh();
    let msg = count ? "Added " + count + " game" + (count === 1 ? "" : "s") +
      ". Use a card's Edit button to set its name, console or icon." : "";
    if (skipped.length) msg += (msg ? " " : "") + "Skipped (not a supported file): " + skipped.join(", ") + ".";
    if (warnings.length) msg += " " + warnings.join(" ");
    status(msg, !count || warnings.length > 0);
  }

  // ---------- edit window ----------
  let editing = null, pendingCover = null;

  function fillConsoleSelect(selected) {
    const sel = $("edit-console");
    sel.textContent = "";
    ROM_CONSOLES.forEach(function (c) {
      const o = document.createElement("option");
      o.value = c; o.textContent = CONSOLES[c]; if (c === selected) o.selected = true;
      sel.appendChild(o);
    });
  }
  function edit(id) {
    const g = games().filter(function (x) { return x.id === id; })[0];
    if (!g) return;
    editing = g; pendingCover = null;
    $("edit-title").value = g.title;
    $("edit-icon").src = g.cover;
    if (g.type === "html5") {
      $("edit-console").textContent = "";
      const o = document.createElement("option"); o.textContent = "HTML5"; $("edit-console").appendChild(o);
      $("edit-console").disabled = true;
    } else {
      fillConsoleSelect(g.console);
      $("edit-console").disabled = false;
    }
    $("edit-dialog").showModal();
  }
  async function saveEdit() {
    const g = editing; if (!g) return;
    const title = $("edit-title").value.trim() || g.title;
    const con = $("edit-console").disabled ? g.console : $("edit-console").value;
    let coverKey = null;
    if (pendingCover) { coverKey = "c-" + g.id + "-" + Date.now(); await putBlob(coverKey, pendingCover); }
    if (g._src === "added") {
      const a = state.added.filter(function (x) { return x.id === g.id; })[0];
      a.title = title; a.console = con;
      if (coverKey) { dropBlob(a.coverKey); a.coverKey = coverKey; }
    } else {
      const e = state.edits[g.id] || (state.edits[g.id] = {});
      e.title = title;
      if (g.type === "rom") e.console = con;
      if (coverKey) { dropBlob(e.coverKey); e.coverKey = coverKey; }
    }
    await save();
    $("edit-dialog").close();
    editing = null;
    refresh();
    status("Saved changes to " + title + ".");
  }
  async function removeGame() {
    const g = editing; if (!g) return;
    const extra = g._src === "base" ? " (Its files stay in your repository. You can delete them on GitHub later.)" : "";
    if (!window.confirm("Remove " + g.title + " from the library?" + extra)) return;
    if (g._src === "added") {
      const a = state.added.filter(function (x) { return x.id === g.id; })[0];
      dropBlob(a.fileKey); dropBlob(a.coverKey);
      state.added = state.added.filter(function (x) { return x.id !== g.id; });
    } else {
      state.removed.push(g.id);
      if (state.edits[g.id]) { dropBlob(state.edits[g.id].coverKey); delete state.edits[g.id]; }
    }
    state.order = state.order.filter(function (x) { return x !== g.id; });
    await save();
    $("edit-dialog").close();
    editing = null;
    refresh();
    status("Removed " + g.title + ".");
  }

  // ---------- passwords ----------
  async function preparePasswords() {
    const nu = $("pw-user").value, nd = $("pw-dev").value;
    if (!nu && !nd) return status("Type a new password first.", true);
    if (nu && nd && nu === nd) return status("The visitor password and the dev password must be different.", true);
    if (nu && !nd && (await RetroAuth.checkPassword(nu)) === "dev")
      return status("That visitor password is the same as the dev password. Pick another.", true);
    if (nd && !nu && (await RetroAuth.checkPassword(nd)) === "user")
      return status("That dev password is the same as the visitor password. Pick another.", true);
    const next = state.passwords || {};
    if (nu) next.user = await RetroAuth.makeHash(nu);
    if (nd) next.dev = await RetroAuth.makeHash(nd);
    state.passwords = next;
    $("pw-user").value = ""; $("pw-dev").value = "";
    await save();
    updateSummary();
    status("Password change prepared. It starts working after you upload the exported js/config.js to GitHub.");
  }

  // ---------- export ----------
  function hasChanges() {
    return state.added.length || Object.keys(state.edits).length || state.removed.length ||
      state.order.length || state.background !== undefined || !!state.passwords;
  }
  function libraryText(list, bg) {
    return "// Generated by Retro Link dev mode on " + new Date().toISOString().slice(0, 10) + ".\n" +
      "window.RETROLINK_LIBRARY = [\n" + list.map(function (e) { return "  " + JSON.stringify(e); }).join(",\n") + "\n];\n\n" +
      "window.RETROLINK_CONSOLES = " + JSON.stringify(CONSOLES, null, 2) + ";\n\n" +
      "window.RETROLINK_SETTINGS = " + JSON.stringify({ background: bg }, null, 2) + ";\n";
  }
  function configText() {
    const c = window.RETROLINK_CONFIG, p = state.passwords || {};
    return "// RETROLINK settings.\n// Passwords are stored only as scrambled hashes, never as plain text.\n" +
      "window.RETROLINK_CONFIG = " + JSON.stringify({
        emulatorPath: c.emulatorPath,
        iterations: c.iterations,
        user: p.user || c.user,
        dev: p.dev || c.dev
      }, null, 2) + ";\n";
  }

  async function doExport() {
    if (!hasChanges()) return status("Nothing to export yet. Add or change something first.", true);
    const files = [], warnings = [];
    const list = games().map(function (g) {
      const entry = { id: g.id, title: g.title, type: g.type, console: g.console, cover: g.cover, file: g.file };
      if (g._src === "added") {
        const a = state.added.filter(function (x) { return x.id === g.id; })[0];
        entry.file = "games/" + a.id + "." + a.ext;
        entry.cover = "covers/" + a.id + ".jpg";
        files.push({ path: entry.file, data: blobMap[a.fileKey] });
        files.push({ path: entry.cover, data: blobMap[a.coverKey] });
        if (a.size > HARD_LIMIT) warnings.push(a.id + "." + a.ext + " (over 100 MiB: GitHub will refuse it)");
        else if (a.size > WEB_LIMIT) warnings.push(a.id + "." + a.ext + " (over 25 MiB: too big for browser upload)");
      } else {
        const e = state.edits[g.id];
        const orig = (window.RETROLINK_LIBRARY || []).filter(function (x) { return x.id === g.id; })[0];
        entry.file = orig.file;
        if (e && e.coverKey && blobMap[e.coverKey]) {
          entry.cover = "covers/" + g.id + ".jpg";
          files.push({ path: entry.cover, data: blobMap[e.coverKey] });
        } else entry.cover = orig.cover;
      }
      return entry;
    });

    let bg = (window.RETROLINK_SETTINGS || {}).background || null;
    if (state.background !== undefined) {
      const b = state.background;
      if (b.type === "color") bg = { type: "color", value: b.value };
      else if (b.type === "image" && blobMap[b.key]) {
        bg = { type: "image", file: "backgrounds/background.jpg" };
        files.push({ path: "backgrounds/background.jpg", data: blobMap[b.key] });
      } else bg = null;
    }
    files.unshift({ path: "js/library.js", data: libraryText(list, bg) });
    if (state.passwords) files.push({ path: "js/config.js", data: configText() });
    files.push({ path: "README-UPLOAD.txt", data:
      "How to publish these changes\r\n\r\n" +
      "1. Unzip this file.\r\n" +
      "2. Open your repository on github.com.\r\n" +
      "3. Click Add file, then Upload files.\r\n" +
      "4. Drag the folders from the unzipped folder (js, games, covers, backgrounds) into the page.\r\n" +
      "   Files with the same name are replaced. Nothing else is deleted.\r\n" +
      "5. Click Commit changes.\r\n" +
      "6. Wait a minute or two, then refresh your site (Cmd+Shift+R on a Mac).\r\n\r\n" +
      "Only upload games you have the right to share. The repository is public.\r\n" });

    const zip = await RetroZip.makeZip(files);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zip);
    a.download = "retrolink-update.zip";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    let msg = "Exported retrolink-update.zip (" + mb(zip.size) + "). Unzip it and follow README-UPLOAD.txt.";
    if (warnings.length) msg += " Too big for GitHub's browser upload: " + warnings.join(", ") + ".";
    status(msg, warnings.length > 0);
  }

  async function discardAll() {
    if (!window.confirm("Throw away every change you made in dev mode on this browser? Games you added here will be deleted from it.")) return;
    Object.keys(blobMap).forEach(dropBlob);
    state = blankState();
    try { await RetroStore.clear(); } catch (e) {}
    refresh();
    status("All local dev changes were discarded.");
  }

  // ---------- panel text ----------
  function status(text, bad) {
    const el = $("dev-status");
    if (!el) return;
    el.textContent = text || "";
    el.className = "dev-status" + (bad ? " bad" : "");
  }
  function updateSummary() {
    if (!$("dev-summary")) return;
    let bytes = 0;
    state.added.forEach(function (a) { bytes += a.size || 0; });
    const edits = Object.keys(state.edits).length + state.removed.length;
    const parts = [];
    parts.push(state.added.length + " new game" + (state.added.length === 1 ? "" : "s") + (state.added.length ? " (" + mb(bytes) + ")" : ""));
    if (edits) parts.push(edits + " edit" + (edits === 1 ? "" : "s") + " to existing games");
    if (state.background !== undefined) parts.push("new background");
    if (state.passwords) parts.push("new password" + (state.passwords.user && state.passwords.dev ? "s" : ""));
    if (state.order.length) parts.push("custom order");
    $("dev-summary").textContent = hasChanges()
      ? "Waiting to be exported: " + parts.join(", ") + "."
      : "No changes yet.";
    $("bg-note").textContent = state.background === undefined ? "" :
      state.background.type === "none" ? "Background removed (not published yet)." :
      "New background set (not published yet).";
  }
  function refresh() {
    RetroGrid.refresh();
    updateSummary();
    applyTheme();
  }

  // ---------- wiring (runs once) ----------
  function wire() {
    wired = true;
    $("dev-toggle").addEventListener("click", function () {
      const panel = $("dev-panel");
      panel.hidden = !panel.hidden;
      $("dev-toggle").setAttribute("aria-expanded", String(!panel.hidden));
    });
    $("pick-files").addEventListener("click", function () { $("file-input").click(); });
    $("file-input").addEventListener("change", function (e) { addFiles(e.target.files); e.target.value = ""; });

    // Drop files anywhere on the page
    let depth = 0;
    const hasFiles = function (e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") !== -1; };
    document.addEventListener("dragenter", function (e) {
      if (!active || !hasFiles(e)) return;
      e.preventDefault(); depth++; $("drop-overlay").hidden = false;
    });
    document.addEventListener("dragover", function (e) { if (active && hasFiles(e)) e.preventDefault(); });
    document.addEventListener("dragleave", function (e) {
      if (!active || !hasFiles(e)) return;
      depth = Math.max(0, depth - 1); if (!depth) $("drop-overlay").hidden = true;
    });
    document.addEventListener("drop", function (e) {
      if (!active || !hasFiles(e)) return;
      e.preventDefault(); depth = 0; $("drop-overlay").hidden = true;
      addFiles(e.dataTransfer.files);
    });

    // Background
    $("bg-color").addEventListener("input", function (e) {
      if (state.background && state.background.type === "image") dropBlob(state.background.key);
      state.background = { type: "color", value: e.target.value };
      save(); refresh();
    });
    $("bg-pick").addEventListener("click", function () { $("bg-file").click(); });
    $("bg-file").addEventListener("change", async function (e) {
      const f = e.target.files[0]; e.target.value = "";
      if (!f) return;
      try {
        const blob = await backgroundFromFile(f);
        if (state.background && state.background.type === "image") dropBlob(state.background.key);
        const key = "bg-" + Date.now();
        await putBlob(key, blob);
        state.background = { type: "image", key: key };
        await save(); refresh();
        status("Background set. The picture is darkened a little so text stays readable.");
      } catch (err) { status(err.message, true); }
    });
    $("bg-clear").addEventListener("click", function () {
      if (state.background && state.background.type === "image") dropBlob(state.background.key);
      state.background = { type: "none" };
      save(); refresh();
    });

    $("pw-save").addEventListener("click", preparePasswords);
    $("export-btn").addEventListener("click", doExport);
    $("discard-btn").addEventListener("click", discardAll);

    // Edit window
    $("edit-cancel").addEventListener("click", function () { $("edit-dialog").close(); editing = null; });
    $("edit-save").addEventListener("click", saveEdit);
    $("edit-remove").addEventListener("click", removeGame);
    $("edit-icon-pick").addEventListener("click", function () { $("edit-icon-file").click(); });
    $("edit-icon-file").addEventListener("change", async function (e) {
      const f = e.target.files[0]; e.target.value = "";
      if (!f) return;
      try {
        pendingCover = await iconFromFile(f);
        const u = URL.createObjectURL(pendingCover);
        $("edit-icon").onload = function () { URL.revokeObjectURL(u); };
        $("edit-icon").src = u;
      } catch (err) { status(err.message, true); }
    });
  }

  // ---------- public ----------
  window.RetroDev = {
    isActive: function () { return active; },
    games: games,
    move: move,
    edit: edit,
    start: async function (role) {
      if (role !== "dev") {
        active = false;
        $("dev-toggle").hidden = true; $("dev-panel").hidden = true;
        applyTheme();
        return;
      }
      await load();
      if (!wired) wire();
      active = true;
      $("dev-toggle").hidden = false;
      updateSummary();
      applyTheme();
    },
    stop: function () {
      active = false;
      $("dev-toggle").hidden = true;
      $("dev-panel").hidden = true;
      $("dev-toggle").setAttribute("aria-expanded", "false");
      $("drop-overlay").hidden = true;
      if ($("edit-dialog").open) $("edit-dialog").close();
      status("");
      Object.keys(blobUrls).forEach(function (k) { URL.revokeObjectURL(blobUrls[k]); delete blobUrls[k]; });
      Object.keys(blobMap).forEach(function (k) { delete blobMap[k]; });
      state = blankState();
      RetroTheme.clear();
    }
  };
})();
