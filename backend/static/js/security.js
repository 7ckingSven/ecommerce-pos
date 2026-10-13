// ══════════════════════════════════════════════════════
// SECURITY — 60-minute inactivity auto-logout
//          + one-session-per-user enforcement
// Triple E & Fiel Collins
//
// Include this script on every logged-in page (admin & staff
// dashboards).
//
// 1) Idle logout: tracks a shared "last activity" timestamp in
//    localStorage (so it's consistent across every tab of the same
//    browser) and redirects to /logout?reason=idle once 60 real
//    minutes have passed with no genuine user interaction.
//    Tab-switching / alt-tabbing / losing focus does NOT reset or
//    pause the timer — only real interaction does (mouse movement,
//    clicks, key presses, scrolling, touches).
//
// 2) One-session-per-user: periodically asks the server whether this
//    browser's session is still the account's active one. If the
//    same account has since logged in on another device/browser,
//    the server says so and this page is sent to
//    /logout?reason=session_superseded.
// ══════════════════════════════════════════════════════
(function () {
  var IDLE_LIMIT_MS     = 60 * 60 * 1000; // 60 minutes
  var CHECK_EVERY_MS    = 30 * 1000;      // poll every 30 seconds
  var LS_LAST_ACTIVE    = 'tefc_last_active_at';

  function markActive() {
    localStorage.setItem(LS_LAST_ACTIVE, String(Date.now()));
  }

  function checkIdle() {
    var lastActive = parseInt(localStorage.getItem(LS_LAST_ACTIVE), 10);
    if (!lastActive) {
      // No record yet (e.g. first load on this device) — start counting now.
      markActive();
      return;
    }
    if (Date.now() - lastActive >= IDLE_LIMIT_MS) {
      window.location.href = '/logout?reason=idle';
    }
  }

  function checkSessionStillActive() {
    fetch('/api/session/check', { credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 401) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            var reason = data && data.reason === 'session_superseded' ? 'session_superseded' : null;
            window.location.href = reason ? '/logout?reason=' + reason : '/login';
          });
        }
      })
      .catch(function () {
        // Network hiccup / offline — ignore, try again on the next tick.
      });
  }

  // Record activity right away so a fresh page load always starts a
  // full 60-minute window.
  markActive();

  // Only genuine interaction resets the idle clock — deliberately NOT
  // wired to visibilitychange/focus/blur, so switching tabs or
  // alt-tabbing away never pauses or resets the countdown.
  var ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  ACTIVITY_EVENTS.forEach(function (evt) {
    document.addEventListener(evt, markActive, { passive: true });
  });

  setInterval(checkIdle, CHECK_EVERY_MS);
  setInterval(checkSessionStillActive, CHECK_EVERY_MS);
  checkSessionStillActive();
})();