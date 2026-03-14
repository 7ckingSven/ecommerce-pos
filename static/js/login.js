const EYE_OPEN  = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
const EYE_SLASH = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';

function togglePassword(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  input.type     = input.type === 'password' ? 'text' : 'password';
  icon.innerHTML = input.type === 'text' ? EYE_OPEN : EYE_SLASH;
}

function openForgot(e) {
  e.preventDefault();
  document.body.classList.add('modal-open');
}

function closeForgot() {
  document.body.classList.remove('modal-open');
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeForgot();
});

// ─── Disable login button if email or password is empty ───
document.addEventListener('DOMContentLoaded', function () {
  const emailInput = document.querySelector('input[name="login_input"]');
  const passInput  = document.getElementById('customerPassword');
  const loginBtn   = document.querySelector('button[type="submit"]');

  function checkInputs() {
    loginBtn.disabled = emailInput.value.trim() === '' || passInput.value.trim() === '';
  }

  emailInput.addEventListener('input', checkInputs);
  passInput.addEventListener('input', checkInputs);
  checkInputs(); // run on page load
});