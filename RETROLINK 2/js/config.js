// RETROLINK settings.
// Passwords are NOT stored here as plain text, only as scrambled "hashes".
// (Stage 4 will add a small tool that makes a new hash when you want to change a password.)
window.RETROLINK_CONFIG = {
  // Where EmulatorJS comes from. "stable" is the tested release channel.
  // To host it yourself later, change this to a path like "emulator/data/".
  emulatorPath: "https://cdn.emulatorjs.org/stable/data/",
  iterations: 200000,
  user: {
    salt: "7b6e92723d282958f1d6eaeb2c026553",
    hash: "dda312f8fdd672b0385d984c952a5f963e762d4ae2fe7146f06c373dede8ca54"
  },
  dev: {
    salt: "7eea822cf2e1547deecdb111557dabd8",
    hash: "40c8e40982a2b8646738d96593572774148ba076246fd286aef0e39e817b75a9"
  }
};
