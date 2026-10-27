(function () {
  const gate = document.getElementById("gate");
  const app = document.getElementById("app");
  const form = document.getElementById("gate-form");
  const input = document.getElementById("gate-input");
  const button = document.getElementById("gate-button");
  const message = document.getElementById("gate-message");
  const devBadge = document.getElementById("dev-badge");
  const logout = document.getElementById("logout");

  let failures = 0;

  function openGame(game) { RetroPlayer.open(game); }

  function showApp(role) {
    gate.hidden = true;
    app.hidden = false;
    devBadge.hidden = role !== "dev";
    function go() { RetroGrid.start(openGame); }
    RetroDev.start(role).then(go, go);   // dev mode loads its saved changes first
  }
  function showGate() {
    RetroDev.stop();
    RetroTheme.clear();
    app.hidden = true;
    gate.hidden = false;
    input.value = "";
    input.focus();
  }

  // Already logged in during this browser tab? Skip the password screen.
  const saved = RetroAuth.getRole();
  if (saved === "user" || saved === "dev") showApp(saved);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    message.textContent = "";
    if (!window.crypto || !crypto.subtle) {
      message.textContent = "This page must be opened over https:// or localhost.";
      return;
    }
    button.disabled = true;
    try {
      const role = await RetroAuth.checkPassword(input.value);
      if (role) {
        failures = 0;
        RetroAuth.setRole(role);
        input.value = "";
        showApp(role);
      } else {
        failures++;
        message.textContent = "Wrong password.";
        input.value = "";
        // Slow down guessing a little after repeated misses.
        if (failures >= 3) await new Promise(r => setTimeout(r, Math.min(failures, 10) * 500));
      }
    } catch (err) {
      message.textContent = "Something went wrong. Try again.";
    }
    button.disabled = false;
    input.focus();
  });

  logout.addEventListener("click", function () {
    RetroPlayer.close();
    RetroAuth.clearRole();
    showGate();
  });
})();
