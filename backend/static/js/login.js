// ══════════════════════════════════════════════════════
// LOGIN PAGE — Triple E & Fiel Collins
// ══════════════════════════════════════════════════════

const EYE_OPEN  = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
const EYE_SLASH = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';

// ─── Password Toggle ──────────────────────────────────
function togglePassword(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  if (!input || !icon) return;
  input.type     = input.type === 'password' ? 'text' : 'password';
  icon.innerHTML = input.type === 'text' ? EYE_OPEN : EYE_SLASH;
}

// ─── Active modal tracker ─────────────────────────────
// Tracks which overlay/modal pair is open so Escape closes the right one
let activeOverlay = null;
let activeModal   = null;

function openModal(overlayId, modalId) {
  // Close any currently open modal first
  if (activeModal) closeActiveModal();

  activeOverlay = document.getElementById(overlayId);
  activeModal   = document.getElementById(modalId);

  if (!activeOverlay || !activeModal) return;

  document.body.classList.add('modal-open');
  activeOverlay.style.display = 'block';
  activeModal.style.display   = 'block';
}

function closeActiveModal() {
  document.body.classList.remove('modal-open');
  if (activeOverlay) activeOverlay.style.display = 'none';
  if (activeModal)   activeModal.style.display   = 'none';
  activeOverlay = null;
  activeModal   = null;
}

// ─── Forgot Password Modal ────────────────────────────
function openForgot(e) {
  e.preventDefault();
  openModal('forgotOverlay', 'forgotModal');
}

function closeForgot() {
  closeActiveModal();
}

// ─── Escape key closes any open modal ─────────────────
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && activeModal) closeActiveModal();
});

// ─── Button disable logic ─────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const loginInput  = document.querySelector('input[name="login_input"]');
  const passInput   = document.getElementById('customerPassword');
  const loginBtn    = document.getElementById('loginSubmitBtn');

  // Login button — disabled until both fields have values, and always
  // disabled while a login lockout (see below) is in effect.
  function checkLogin() {
    if (!loginBtn) return;
    if (window.tefcLoginLocked) { loginBtn.disabled = true; return; }
    loginBtn.disabled =
      !loginInput || loginInput.value.trim() === '' ||
      !passInput  || passInput.value.trim()  === '';
  }
  window.tefcCheckLoginFields = checkLogin;

  if (loginInput) loginInput.addEventListener('input', checkLogin);
  if (passInput)  passInput.addEventListener('input',  checkLogin);

  // Run on load
  checkLogin();
});

// ══════════════════════════════════════════════════════
// LOGIN FAILED-ATTEMPT LOCKOUT — per device, no database involved.
// Tracked entirely in this browser's localStorage, so a device with no
// failed attempts of its own is never affected by another device's lockout.
// ══════════════════════════════════════════════════════
(function () {
  var MAX_ATTEMPTS     = 5;
  var LOCKOUT_MS        = 60 * 1000;       // 60-second lockout
  var FAILURE_WINDOW_MS = 15 * 60 * 1000;  // failures older than this don't carry over

  var LS_COUNT         = 'tefc_login_fail_count';
  var LS_FIRST_FAIL_AT = 'tefc_login_fail_first_at';
  var LS_LOCKOUT_END   = 'tefc_login_lockout_end';

  window.tefcLoginLocked = false;

  function getInt(key) {
    var v = parseInt(localStorage.getItem(key), 10);
    return isNaN(v) ? 0 : v;
  }

  function clearLockoutState() {
    localStorage.removeItem(LS_COUNT);
    localStorage.removeItem(LS_FIRST_FAIL_AT);
    localStorage.removeItem(LS_LOCKOUT_END);
  }

  var loginBtn        = document.getElementById('loginSubmitBtn');
  var attemptsWarnEl  = document.getElementById('loginAttemptsWarning');
  var countdownEl     = document.getElementById('loginLockoutCountdown');
  var lockoutOverlay  = document.getElementById('lockoutModalOverlay');
  var lockoutModal    = document.getElementById('lockoutModal');
  var lockoutCloseBtn = document.getElementById('lockoutModalCloseBtn');

  var countdownTimer = null;

  function showLockoutModal() {
    if (lockoutOverlay) lockoutOverlay.style.display = 'block';
    if (lockoutModal)   lockoutModal.style.display   = 'block';
  }
  // The modal's own Close button is the only thing wired to this — no
  // overlay onclick, no × button, no Escape handling.
  function hideLockoutModal() {
    if (lockoutOverlay) lockoutOverlay.style.display = 'none';
    if (lockoutModal)   lockoutModal.style.display   = 'none';
  }
  if (lockoutCloseBtn) lockoutCloseBtn.addEventListener('click', hideLockoutModal);

  function startCountdown() {
    window.tefcLoginLocked = true;
    if (loginBtn) loginBtn.disabled = true;
    if (attemptsWarnEl) attemptsWarnEl.style.display = 'none';
    if (countdownEl) countdownEl.style.display = 'block';

    function tick() {
      var end       = parseInt(localStorage.getItem(LS_LOCKOUT_END), 10);
      var remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      if (!end || remaining <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        clearLockoutState();
        window.tefcLoginLocked = false;
        if (countdownEl) { countdownEl.style.display = 'none'; countdownEl.textContent = ''; }
        if (typeof window.tefcCheckLoginFields === 'function') window.tefcCheckLoginFields();
        return;
      }
      if (countdownEl) countdownEl.textContent = 'Too many failed attempts. Try again in ' + remaining + 's';
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  // Returns true if an unexpired lockout from a previous page load is
  // still in effect (covers reload / hard-reload on the SAME device).
  function applyActiveLockoutIfAny() {
    var end = parseInt(localStorage.getItem(LS_LOCKOUT_END), 10);
    if (end && end > Date.now()) {
      startCountdown();
      return true;
    }
    if (end) clearLockoutState(); // a past lockout that has since expired
    return false;
  }

  function recordFailedAttempt() {
    var now         = Date.now();
    var firstFailAt = getInt(LS_FIRST_FAIL_AT);
    var count       = getInt(LS_COUNT);

    if (!firstFailAt || (now - firstFailAt) > FAILURE_WINDOW_MS) {
      count       = 0;
      firstFailAt = now;
      localStorage.setItem(LS_FIRST_FAIL_AT, String(firstFailAt));
    }
    count += 1;
    localStorage.setItem(LS_COUNT, String(count));

    var attemptsLeft = MAX_ATTEMPTS - count;

    if (attemptsLeft <= 0) {
      localStorage.setItem(LS_LOCKOUT_END, String(now + LOCKOUT_MS));
      showLockoutModal();
      startCountdown();
    } else if (attemptsLeft <= 3 && attemptsWarnEl) {
      attemptsWarnEl.textContent = attemptsLeft + ' attempt' + (attemptsLeft === 1 ? '' : 's') + ' left before your login gets temporarily locked.';
      attemptsWarnEl.style.display = 'block';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // An active lockout carried over from before a reload wins over
    // everything else.
    if (applyActiveLockoutIfAny()) return;

    // Only a flash tagged 'login_error' means an actual credential attempt
    // just failed (wrong password, unknown username, etc.) — a plain
    // 'error' flash can also mean an unrelated "please log in" redirect
    // (e.g. from visiting a protected page while logged out), which is
    // NOT a failed login attempt and must never count toward the lockout.
    // Flask's flash only shows once, right after the redirect, so a plain
    // refresh shows no flash and never double-counts or dodges the lockout.
    if (document.querySelector('.flash-msg[data-flash-category="login_error"]')) recordFailedAttempt();
  });
})();