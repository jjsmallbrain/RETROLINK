// The game list. Stage 4's Export button will generate a new version of this file.
//
// Each game:
//   id       unique name, no spaces
//   title    what people see
//   type     "rom" (plays in EmulatorJS) or "html5" (plays in a frame)
//   console  "snes", "nes", "gba", "gb", "genesis" or "html5" (decides the category)
//   cover    picture path, relative (no leading slash)
//   file     path to the game file. null = placeholder, nothing to play yet
//
// (This is a .js file, not .json, so the page also works when opened straight from your computer.)
window.RETROLINK_LIBRARY = [
  { id: "pixel-pirates", title: "Pixel Pirates", type: "rom",   console: "snes",    cover: "covers/pixel-pirates.svg", file: null },
  { id: "cosmo-courier", title: "Cosmo Courier", type: "rom",   console: "snes",    cover: "covers/cosmo-courier.svg", file: null },
  { id: "mossy-mines",   title: "Mossy Mines",   type: "rom",   console: "nes",     cover: "covers/mossy-mines.svg",   file: null },
  { id: "turbo-tadpole", title: "Turbo Tadpole", type: "rom",   console: "nes",     cover: "covers/turbo-tadpole.svg", file: null },
  { id: "dungeon-dash",  title: "Dungeon Dash",  type: "rom",   console: "gba",     cover: "covers/dungeon-dash.svg",  file: null },
  { id: "sky-sprinter",  title: "Sky Sprinter",  type: "rom",   console: "genesis", cover: "covers/sky-sprinter.svg",  file: null },
  { id: "neon-nibbler",  title: "Neon Nibbler",  type: "html5", console: "html5",   cover: "covers/neon-nibbler.svg",  file: "games/neon-nibbler/index.html" },
  { id: "block-bounce",  title: "Block Bounce",  type: "html5", console: "html5",   cover: "covers/block-bounce.svg",  file: null }
];

// Names shown on the category buttons.
window.RETROLINK_CONSOLES = {
  snes: "SNES", nes: "NES", gba: "GBA", gb: "Game Boy", genesis: "Genesis", html5: "HTML5"
};

// Site-wide settings. Dev mode's Export writes these too.
//   background: null, or { type: "color", value: "#112233" }, or { type: "image", file: "backgrounds/background.jpg" }
window.RETROLINK_SETTINGS = { background: null };
