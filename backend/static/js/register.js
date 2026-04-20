// ─── Step Navigation ──────────────────────────────────
const stepTitles = [
  'Personal Information',
  'Contact & Address',
  'Account Setup'
];
const stepSubs = [
  'Please enter your full legal name and personal details.',
  'Enter your contact information and address.',
  'Create your login credentials.'
];

function goToStep(step) {
  // Validate current step before proceeding
  if (step > currentStep && !validateStep(currentStep)) return;

  // Hide all steps
  document.querySelectorAll('.form-step').forEach(s => s.style.display = 'none');

  // Show target step
  document.getElementById(`formStep${step}`).style.display = 'block';

  // Update step indicator dots
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`step${i}dot`);
    dot.classList.remove('active', 'done');
    if (i < step) dot.classList.add('done');
    if (i === step) dot.classList.add('active');
  }

  // Update badge and title
  document.getElementById('stepBadge').textContent  = `Step ${step} of 3`;
  document.getElementById('stepTitle').textContent  = stepTitles[step - 1];
  document.getElementById('stepSub').textContent    = stepSubs[step - 1];

  currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let currentStep = 1;

// ─── Step Validation ──────────────────────────────────
function validateStep(step) {
  if (step === 1) {
    const fname = document.querySelector('input[name="fname"]').value.trim();
    const lname = document.querySelector('input[name="lname"]').value.trim();
    if (!fname || !lname) {
      alert('Please enter your first and last name.');
      return false;
    }
  }
  if (step === 2) {
    const phone = document.querySelector('input[name="phone_number"]').value.trim();
    const email = document.querySelector('input[name="email"]').value.trim();
    if (!phone || !email) {
      alert('Please enter your phone number and email address.');
      return false;
    }
    if (phone.length !== 11 || !phone.startsWith('09')) {
      alert('Phone number must be 11 digits starting with 09.');
      return false;
    }
  }
  return true;
}

// ─── Password Toggle ──────────────────────────────────
function togglePassword(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  icon.innerHTML = isText
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

// ─── Password Strength ────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const passInput    = document.getElementById('regPassword');
  const confirmInput = document.getElementById('regConfirmPassword');
  const strengthFill = document.getElementById('strengthFill');
  const strengthLabel = document.getElementById('strengthLabel');
  const matchHint    = document.getElementById('matchHint');
  const submitBtn    = document.getElementById('submitBtn');
  const terms        = document.getElementById('agreeTerms');

  passInput.addEventListener('input', function () {
    const val      = passInput.value;
    let score      = 0;
    if (val.length >= 8)              score++;
    if (/[A-Z]/.test(val))           score++;
    if (/[0-9]/.test(val))           score++;
    if (/[^A-Za-z0-9]/.test(val))   score++;

    const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];
    const widths = ['10%', '25%', '50%', '75%', '100%'];

    strengthFill.style.width      = val.length === 0 ? '0%' : widths[score];
    strengthFill.style.background = val.length === 0 ? '' : colors[score];
    strengthLabel.textContent     = val.length === 0 ? 'Enter a password' : labels[score];

    checkMatch();
    checkSubmit();
  });

  confirmInput.addEventListener('input', function () {
    checkMatch();
    checkSubmit();
  });

  terms.addEventListener('change', checkSubmit);

  function checkMatch() {
    if (!confirmInput.value) {
      matchHint.textContent = '';
      matchHint.style.color = '';
      return;
    }
    if (passInput.value === confirmInput.value) {
      matchHint.textContent = '✓ Passwords match';
      matchHint.style.color = '#16a34a';
    } else {
      matchHint.textContent = '✗ Passwords do not match';
      matchHint.style.color = '#ef4444';
    }
  }

  function checkSubmit() {
    const valid = passInput.value.length >= 8
      && passInput.value === confirmInput.value
      && terms.checked;
    submitBtn.disabled = !valid;
  }
});