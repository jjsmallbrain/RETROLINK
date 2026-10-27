// Password check. Runs in the visitor's browser (GitHub Pages has no server).
// This keeps casual visitors out. It is not real security.
(function () {
  const cfg = window.RETROLINK_CONFIG;
  const enc = new TextEncoder();

  function hexToBytes(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  function bytesToHex(buf) {
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password, saltHex) {
    const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: cfg.iterations },
      key, 256
    );
    return bytesToHex(bits);
  }

  // Makes a new random salt + hash for a new password (used by dev mode's password tool).
  async function makeHash(password) {
    const saltHex = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    return { salt: saltHex, hash: await hashPassword(password, saltHex) };
  }

  // Returns "dev", "user", or null.
  async function checkPassword(password) {
    const [dev, user] = await Promise.all([
      hashPassword(password, cfg.dev.salt),
      hashPassword(password, cfg.user.salt)
    ]);
    if (dev === cfg.dev.hash) return "dev";
    if (user === cfg.user.hash) return "user";
    return null;
  }

  const KEY = "retrolink-role";
  function getRole() {
    try { return sessionStorage.getItem(KEY); } catch (e) { return null; }
  }
  function setRole(role) {
    try { sessionStorage.setItem(KEY, role); } catch (e) {}
  }
  function clearRole() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }

  window.RetroAuth = { checkPassword, makeHash, getRole, setRole, clearRole };
})();
