// The game screen: opens a game, fullscreen, and Back to library.
(function () {
  const library = document.getElementById("library");
  const player = document.getElementById("player");
  const stage = document.getElementById("stage");
  const titleEl = document.getElementById("player-title");
  const hintEl = document.getElementById("player-hint");
  const backBtn = document.getElementById("back");
  const fsBtn = document.getElementById("fs");

  // Library console name -> EmulatorJS core name
  const CORES = { snes: "snes", nes: "nes", gba: "gba", gb: "gb", genesis: "segaMD" };

  const canFullscreen = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  fsBtn.hidden = !canFullscreen;

  function note(text) {
    const p = document.createElement("p");
    p.className = "stage-note";
    p.textContent = text;
    stage.appendChild(p);
  }

  function frame(src, title) {
    const f = document.createElement("iframe");
    f.src = src;
    f.title = title;
    f.setAttribute("allow", "fullscreen; gamepad; autoplay");
    f.setAttribute("allowfullscreen", "");
    f.addEventListener("load", function () { f.focus(); });
    stage.appendChild(f);
  }

  function setHint(text) {
    hintEl.textContent = (text ? text + " " : "") + (canFullscreen ? "Press Esc to leave fullscreen." : "");
  }

  function open(game) {
    stage.textContent = "";
    titleEl.textContent = game.title;
    library.hidden = true;
    player.hidden = false;
    window.scrollTo(0, 0);

    if (!game.file) {
      setHint("");
      note(game.title + " is a placeholder. No game file has been added yet.");
    } else if (game.type === "html5") {
      setHint("Click inside the game if the keys do not respond.");
      frame(game.file, game.title);
    } else {
      const core = CORES[game.console];
      if (!core) {
        setHint("");
        note("The " + game.console + " console is not supported yet.");
      } else {
        setHint("Press Play Now to start. Use the controls menu in the emulator to see or change keys.");
        frame("play.html?core=" + encodeURIComponent(core) +
              "&game=" + encodeURIComponent(game.file).replace(/%2F/g, "/") +
              "&title=" + encodeURIComponent(game.title), game.title);
      }
    }
  }

  function close() {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    stage.textContent = "";     // removing the frame stops the game and its sound
    player.hidden = true;
    library.hidden = false;
  }

  function toggleFullscreen() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage);
      const f = stage.querySelector("iframe"); if (f) f.focus();
    }
  }

  backBtn.addEventListener("click", close);
  fsBtn.addEventListener("click", toggleFullscreen);

  window.RetroPlayer = { open: open, close: close };
})();
