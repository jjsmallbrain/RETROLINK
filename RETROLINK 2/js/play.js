// Starts EmulatorJS for one game. Opened inside a frame by the library page.
// URL looks like: play.html?core=snes&game=games/example.sfc&title=Example
(function () {
  const msg = document.getElementById("msg");
  const params = new URLSearchParams(location.search);
  const core = params.get("core") || "";
  const game = params.get("game") || "";
  const title = params.get("title") || "";

  function fail(text) { msg.hidden = false; msg.textContent = text; }

  // Only these systems are allowed.
  const CORES = ["snes", "nes", "gba", "gb", "segaMD"];
  if (CORES.indexOf(core) === -1) return fail("This console is not supported yet.");

  // Only relative paths inside this site are allowed.
  const isLocalBlob = game.indexOf("blob:" + location.origin + "/") === 0;   // dev-mode preview only
  const safePath = isLocalBlob || (/^[A-Za-z0-9_\-./ ]+$/.test(game) && game.charAt(0) !== "/" && game.indexOf("..") === -1);
  if (!safePath) return fail("That game file path is not allowed.");

  const base = window.RETROLINK_CONFIG.emulatorPath;
  window.EJS_player = "#game";
  window.EJS_core = core;
  window.EJS_gameUrl = game;          // relative to this page, so it works under /RETROLINK/
  window.EJS_pathtodata = base;
  if (title) window.EJS_gameName = title;
  window.EJS_ready = function () { msg.hidden = true; };

  const s = document.createElement("script");
  s.src = base + "loader.js";
  s.onload = function () { msg.hidden = true; };
  s.onerror = function () {
    fail("Could not load the emulator. Your network may be blocking " + new URL(base).hostname + ", or you may be offline.");
  };
  document.body.appendChild(s);
})();
