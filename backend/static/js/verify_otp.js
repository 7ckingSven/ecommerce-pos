// ══════════════════════════════════════════════════════
// VERIFY OTP PAGE — JavaScript
// ══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function () {

  // ── OTP input — digits only + enable/disable verify button ──
  const otpInput = document.getElementById('otp');
  const verifyBtn = document.getElementById('verifyBtn');

  let otpExpired = false;

  function syncVerifyBtn() {
    if (!otpInput || !verifyBtn) return;
    const clean = otpInput.value.replace(/[^0-9]/g, '');
    otpInput.value     = clean;
    verifyBtn.disabled = clean.length !== 6 || otpExpired;
  }

  if (otpInput) {
    otpInput.addEventListener('input',  syncVerifyBtn);
    otpInput.addEventListener('keyup',  syncVerifyBtn);
    otpInput.addEventListener('paste', function () {
      setTimeout(syncVerifyBtn, 0);
    });
    otpInput.focus();
  }

  // ── OTP countdown — inline in the hint text ──
  let otpSeconds = 5 * 60;
  let otpInterval;

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  function getTimerEl() {
    return document.getElementById('otpTimerText');
  }

  function getHintEl() {
    return document.getElementById('otpHint');
  }

  function updateTimer() {
    if (otpSeconds <= 0) {
      otpExpired = true;
      clearInterval(otpInterval);
      const hint = getHintEl();
      if (hint) {
        hint.innerHTML = '<span style="color:#dc2626;font-weight:500;">⚠ OTP has expired. Please request a new one.</span>';
      }
      if (verifyBtn) {
        verifyBtn.disabled    = true;
        verifyBtn.textContent = 'OTP Expired';
      }
      return;
    }

    const el = getTimerEl();
    if (el) {
      el.textContent = formatTime(otpSeconds);
      el.style.color = otpSeconds <= 60 ? '#dc2626' : '';
    }

    otpSeconds--;
  }

  function startOtpTimer(seconds) {
    otpExpired = false;
    otpSeconds = seconds;
    clearInterval(otpInterval);

    // Restore hint to default state with a fresh timer span
    const hint = getHintEl();
    if (hint) {
      hint.innerHTML = 'Check your inbox and spam folder. OTP expires in <span id="otpTimerText" style="font-weight:600;">05:00</span>.';
    }

    if (verifyBtn && verifyBtn.textContent === 'OTP Expired') {
      verifyBtn.textContent = 'Verify OTP →';
    }

    updateTimer();
    otpInterval = setInterval(updateTimer, 1000);
    syncVerifyBtn();
  }

  startOtpTimer(5 * 60);

  // ── Resend OTP — POST to /resend-otp, then 2-minute cooldown ──
  const resendBtn      = document.getElementById('resendBtn');
  const resendCooldown = document.getElementById('resendCooldown');
  let resendTimer;

  function startResendCooldown() {
    let secs = 2 * 60;
    if (resendBtn)      resendBtn.style.display      = 'none';
    if (resendCooldown) {
      resendCooldown.style.display = 'inline';
      resendCooldown.textContent   = 'Resend again in 2:00';
    }

    resendTimer = setInterval(function () {
      secs--;
      if (secs <= 0) {
        clearInterval(resendTimer);
        if (resendBtn) {
          resendBtn.style.display = 'inline';
          resendBtn.disabled      = false;
        }
        if (resendCooldown) resendCooldown.style.display = 'none';
      } else {
        if (resendCooldown) resendCooldown.textContent = 'Resend again in ' + formatTime(secs);
      }
    }, 1000);
  }

  if (resendBtn) {
    resendBtn.addEventListener('click', function () {
      resendBtn.disabled = true;

      fetch('/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.ok) {
            startOtpTimer(5 * 60);
            startResendCooldown();
          } else {
            alert(data.error || 'Failed to resend OTP. Please try again.');
            resendBtn.disabled = false;
          }
        })
        .catch(function () {
          alert('Network error. Please try again.');
          resendBtn.disabled = false;
        });
    });
  }

});