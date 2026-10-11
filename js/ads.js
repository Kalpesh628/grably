/* Grably — aggressive ad wiring (the snapyt-style stuff).
 * First click anywhere opens your ad network's popunder/smartlink in a new
 * tab, then cools down. Paste your network URL in js/config.js -> ads.popunderUrl.
 * Runs on the visitor's click gesture, which is exactly how these networks fire. */
(function () {
  "use strict";
  var ads = ((window.GRABLY || {}).ads || {});
  var url = (ads.popunderUrl || "").trim();
  if (!url) return;

  var cooldownMs = (ads.popunderCooldownMin || 30) * 60 * 1000;
  var KEY = "grably_pop";

  function armed() {
    try {
      var last = parseInt(localStorage.getItem(KEY) || "0", 10);
      return Date.now() - last > cooldownMs;
    } catch (e) { return true; }
  }

  document.addEventListener("pointerdown", function () {
    if (!armed()) return;
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
    window.open(url, "_blank", "noopener");
  }, { capture: true });
})();
