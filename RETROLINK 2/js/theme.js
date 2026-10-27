// Sets the page background after login. The password screen always stays black.
(function () {
  window.RetroTheme = {
    // bg: null, { type: "color", value: "#223344" } or { type: "image", url: "..." }
    apply: function (bg) {
      if (!bg) { document.body.style.background = ""; return; }
      if (bg.type === "color") {
        document.body.style.background = bg.value;
      } else if (bg.type === "image" && bg.url) {
        // A dark layer on top keeps the text readable on bright pictures.
        document.body.style.background =
          "linear-gradient(rgba(0,0,0,.6), rgba(0,0,0,.6)), url(" + JSON.stringify(bg.url) + ") center / cover fixed no-repeat";
      }
    },
    clear: function () { document.body.style.background = ""; }
  };
})();
