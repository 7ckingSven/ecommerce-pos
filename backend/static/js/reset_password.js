// ══════════════════════════════════════════════════════
// RESET PASSWORD PAGE — JavaScript
// ══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function () {

  // ── Toggle password visibility ──
  window.togglePass = function (id) {
    const el = document.getElementById(id);
    if (el) el.type = el.type === 'password' ? 'text' : 'password';
  };

  // ── Check password match ──
  const passInput    = document.getElementById('password');
  const confirmInput = document.getElementById('password_confirm');
  const mismatch     = document.getElementById('mismatch');

  function checkMatch() {
    if (!passInput || !confirmInput || !mismatch) return;
    const p1 = passInput.value;
    const p2 = confirmInput.value;
    mismatch.style.display = p2 && p1 !== p2 ? 'block' : 'none';
  }

  if (passInput)    passInput.addEventListener('input',   function () { checkStrength(this.value); checkMatch(); });
  if (confirmInput) confirmInput.addEventListener('input', checkMatch);

  // ── Password strength bar ──
  function checkStrength(val) {
    const bars  = [1, 2, 3, 4].map(i => document.getElementById('sb' + i));
    const label = document.getElementById('strengthLabel');
    if (!bars[0] || !label) return;

    const colors = ['#ef4444', '#f59e0b', '#22c55e', '#16a34a'];
    const levels = [
      val.length >= 8,
      /[A-Z]/.test(val),
      /[0-9]/.test(val),
      /[^A-Za-z0-9]/.test(val),
    ];
    const score = levels.filter(Boolean).length;
    const names = ['', 'Weak', 'Fair', 'Strong', 'Very Strong'];

    bars.forEach((b, i) => {
      if (b) b.style.background = i < score ? colors[score - 1] : 'var(--border)';
    });

    label.textContent = score > 0 ? names[score] : '';
    label.style.color = score > 0 ? colors[score - 1] : 'var(--text-muted)';
  }

  // ── Form submit — check passwords match ──
  const form = document.getElementById('resetForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      const p1 = passInput ? passInput.value : '';
      const p2 = confirmInput ? confirmInput.value : '';
      if (p1 !== p2) {
        e.preventDefault();
        alert('Passwords do not match.');
      }
    });
  }

});