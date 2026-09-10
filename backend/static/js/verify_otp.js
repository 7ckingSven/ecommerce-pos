// ══════════════════════════════════════════════════════
// VERIFY OTP PAGE — JavaScript
// ══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function () {

  // ── OTP input — digits only + enable/disable verify button ──
  const otpInput  = document.getElementById('otp');
  const verifyBtn = document.getElementById('verifyBtn');

  if (otpInput) {
    otpInput.addEventListener('input', function () {
      this.value = this.value.replace(/[^0-9]/g, '');
      if (verifyBtn) {
        verifyBtn.disabled = this.value.length !== 6;
      }
    });
    otpInput.focus();
  }

  // ── 5-minute OTP countdown ──
  let otpSeconds     = 5 * 60;
  const timerMin     = document.getElementById('timerMin');
  const timerSec     = document.getElementById('timerSec');
  const timerWrap    = document.getElementById('timerWrap');
  const timerExpired = document.getElementById('timerExpired');

  function updateTimer() {
    if (otpSeconds <= 0) {
      if (timerWrap)    timerWrap.style.display    = 'none';
      if (timerExpired) timerExpired.style.display = 'block';
      if (verifyBtn) {
        verifyBtn.disabled    = true;
        verifyBtn.textContent = 'OTP Expired';
      }
      clearInterval(otpInterval);
      return;
    }

    const m = Math.floor(otpSeconds / 60);
    const s = otpSeconds % 60;
    if (timerMin) timerMin.textContent = String(m).padStart(2, '0');
    if (timerSec) timerSec.textContent = String(s).padStart(2, '0');

    // Turn red in last 60 seconds
    if (otpSeconds <= 60) {
      const circles = document.querySelectorAll('.otp-timer-circle');
      circles.forEach(c => {
        c.style.background  = '#fef2f2';
        c.style.borderColor = '#fecaca';
      });
      if (timerMin) timerMin.style.color = '#dc2626';
      if (timerSec) timerSec.style.color = '#dc2626';
    }

    otpSeconds--;
  }

  updateTimer();
  const otpInterval = setInterval(updateTimer, 1000);

  // ── Resend OTP — 60 second cooldown ──
  const resendBtn      = document.getElementById('resendBtn');
  const resendCooldown = document.getElementById('resendCooldown');

  if (resendBtn) {
    resendBtn.addEventListener('click', function (e) {
      if (this.dataset.cooling === 'true') {
        e.preventDefault();
        return;
      }

      // Start 60s cooldown after click (allow navigation)
      let secs = 60;
      this.dataset.cooling   = 'true';
      this.style.display     = 'none';
      if (resendCooldown) {
        resendCooldown.style.display = 'inline';
        resendCooldown.textContent   = 'Resend in ' + secs + 's';
      }

      const resendTimer = setInterval(function () {
        secs--;
        if (secs <= 0) {
          clearInterval(resendTimer);
          resendBtn.style.display = 'inline';
          resendBtn.dataset.cooling = 'false';
          if (resendCooldown) resendCooldown.style.display = 'none';
        } else {
          if (resendCooldown) resendCooldown.textContent = 'Resend in ' + secs + 's';
        }
      }, 1000);
    });
  }

});