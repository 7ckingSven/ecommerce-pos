// ══════════════════════════════════════════════════════
// VERIFY OTP PAGE — JavaScript
// ══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  // OTP input should only contain digits
  const otpInput = document.getElementById('otpInput');
  if (otpInput) {
    otpInput.addEventListener('input', function(e) {
      this.value = this.value.replace(/[^0-9]/g, '');
    });
  }
});
