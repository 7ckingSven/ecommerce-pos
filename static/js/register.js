const EYE_OPEN  = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
const EYE_SLASH = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';

const stepTitles = [
  { badge: 'Step 1 of 3', title: 'Personal Information',   sub: 'Please enter your full legal name and personal details.' },
  { badge: 'Step 2 of 3', title: 'Contact & Address',      sub: 'How can we reach you and where are you located?' },
  { badge: 'Step 3 of 3', title: 'Account Setup',          sub: 'Set up your login credentials to complete registration.' },
];

function goToStep(step) {
  // Hide all steps
  document.querySelectorAll('.form-step').forEach(s => s.style.display = 'none');
  document.getElementById('formStep' + step).style.display = 'block';

  // Update header text
  const t = stepTitles[step - 1];
  document.getElementById('stepBadge').textContent  = t.badge;
  document.getElementById('stepTitle').textContent  = t.title;
  document.getElementById('stepSub').textContent    = t.sub;

  // Update left panel step dots
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById('step' + i + 'dot');
    dot.classList.toggle('active', i === step);
    dot.classList.toggle('done', i < step);
  }

  // Scroll to top of card
  document.querySelector('.reg-right').scrollTo({ top: 0, behavior: 'smooth' });
}

function togglePassword(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  input.type = input.type === 'password' ? 'text' : 'password';
  icon.innerHTML = input.type === 'text' ? EYE_OPEN : EYE_SLASH;
}

// Password strength
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('regPassword').addEventListener('input', function () {
    const val   = this.value;
    const fill  = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    let score   = 0;
    if (val.length >= 8)              score++;
    if (/[A-Z]/.test(val))            score++;
    if (/[0-9]/.test(val))            score++;
    if (/[^A-Za-z0-9]/.test(val))     score++;

    const levels = [
      { pct: '0%',   color: 'transparent', text: 'Enter a password' },
      { pct: '25%',  color: '#ef4444',     text: 'Weak' },
      { pct: '50%',  color: '#f97316',     text: 'Fair' },
      { pct: '75%',  color: '#eab308',     text: 'Good' },
      { pct: '100%', color: '#22c55e',     text: 'Strong' },
    ];
    const lvl = val.length === 0 ? levels[0] : levels[score];
    fill.style.width       = lvl.pct;
    fill.style.background  = lvl.color;
    label.textContent      = lvl.text;
    label.style.color      = lvl.color === 'transparent' ? 'var(--text-light)' : lvl.color;
  });

  // Password match
  document.getElementById('regConfirmPassword').addEventListener('input', function () {
    const pass    = document.getElementById('regPassword').value;
    const hint    = document.getElementById('matchHint');
    if (this.value === '') {
      hint.textContent = '';
    } else if (this.value === pass) {
      hint.textContent  = 'Passwords match.';
      hint.style.color  = '#22c55e';
    } else {
      hint.textContent  = 'Passwords do not match.';
      hint.style.color  = '#ef4444';
    }
  });
});