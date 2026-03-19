const EYE_OPEN  = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
const EYE_SLASH = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';

function togglePassword(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  input.type     = input.type === 'password' ? 'text' : 'password';
  icon.innerHTML = input.type === 'text' ? EYE_OPEN : EYE_SLASH;
}

// ─── Forgot Password Modal ───
function openForgot(e) {
  e.preventDefault();
  document.body.classList.add('modal-open');
  document.getElementById('forgotOverlay').style.display = 'block';
  document.getElementById('forgotModal').style.display = 'block';
}

function closeForgot() {
  document.body.classList.remove('modal-open');
  document.getElementById('forgotOverlay').style.display = 'none';
  document.getElementById('forgotModal').style.display = 'none';
}

// ─── Staff Access Code Modal ───
function openAccessCode() {
  document.body.classList.add('modal-open');
  document.getElementById('accessCodeOverlay').style.display = 'block';
  document.getElementById('accessCodeModal').style.display = 'block';
  setTimeout(() => document.getElementById('accessCodeInput').focus(), 100);
}

function closeAccessCode() {
  document.body.classList.remove('modal-open');
  document.getElementById('accessCodeOverlay').style.display = 'none';
  document.getElementById('accessCodeModal').style.display = 'none';
  document.getElementById('accessCodeInput').value = '';
}

// ─── Escape key closes any open modal ───
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeForgot();
    closeAccessCode();
  }
});

// ─── Disable login button if inputs are empty ───
document.addEventListener('DOMContentLoaded', function () {
  const loginInput = document.querySelector('input[name="login_input"]');
  const passInput  = document.getElementById('customerPassword');
  const loginBtn   = document.querySelector('button[type="submit"]');
  const codeInput  = document.getElementById('accessCodeInput');
  const codeBtn    = document.getElementById('accessCodeSubmitBtn');

  function checkLogin() {
    loginBtn.disabled = loginInput.value.trim() === '' || passInput.value.trim() === '';
  }

  function checkAccessCode() {
    if (codeBtn) codeBtn.disabled = codeInput.value.trim() === '';
  }

  loginInput.addEventListener('input', checkLogin);
  passInput.addEventListener('input', checkLogin);
  if (codeInput) codeInput.addEventListener('input', checkAccessCode);

  checkLogin();
  if (codeInput) checkAccessCode();
});