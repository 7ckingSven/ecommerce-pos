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

  // Login button — disabled until both fields have values
  function checkLogin() {
    if (!loginBtn) return;
    loginBtn.disabled =
      !loginInput || loginInput.value.trim() === '' ||
      !passInput  || passInput.value.trim()  === '';
  }

  if (loginInput) loginInput.addEventListener('input', checkLogin);
  if (passInput)  passInput.addEventListener('input',  checkLogin);

  // Run on load
  checkLogin();
});