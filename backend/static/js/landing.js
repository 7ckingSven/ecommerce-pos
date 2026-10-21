// ══════════════════════════════════════════════════════
// LANDING PAGE — Triple E & Fiel Collince
// Split out of landing.html's two inline <script> blocks.
// ══════════════════════════════════════════════════════

// ─── Legal Modals (Privacy / Terms / Cookie Policy) ────
const legalContent = {
  privacy: {
    title: 'Privacy Policy',
    content: `
      <h4 style="color:var(--g-700);margin-top:0;">1. Information We Collect</h4>
      <p>We collect personal information such as your name, email address, phone number, and delivery address when you register or place an order through TEFC E-Commerce.</p>
      <h4 style="color:var(--g-700);">2. How We Use Your Information</h4>
      <p>Your information is used to process orders, manage your account, send OTP verification codes, and communicate with you about your orders and our services.</p>
      <h4 style="color:var(--g-700);">3. Data Security</h4>
      <p>We take reasonable measures to protect your personal information from unauthorized access, use, or disclosure. Passwords are securely hashed and never stored in plain text.</p>
      <h4 style="color:var(--g-700);">4. Third-Party Services</h4>
      <p>We use Supabase for database management and GCash for payment processing. These services have their own privacy policies governing the use of your information.</p>
      <h4 style="color:var(--g-700);">5. Contact Us</h4>
      <p>If you have questions about this Privacy Policy, please contact us at tripleefielcollince@gmail.com.</p>
      <p style="color:var(--text-muted);font-size:11px;margin-top:1rem;">Last updated: 2026 · Triple E &amp; Fiel Collince General Merchandise</p>
    `
  },
  terms: {
    title: 'Terms & Conditions',
    content: `
      <h4 style="color:var(--g-700);margin-top:0;">1. Acceptance of Terms</h4>
      <p>By accessing and using TEFC E-Commerce, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our services.</p>
      <h4 style="color:var(--g-700);">2. Account Registration</h4>
      <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials.</p>
      <h4 style="color:var(--g-700);">3. Orders and Payments</h4>
      <p>All orders are subject to availability. We accept Cash and GCash payments. Orders are confirmed upon successful payment verification.</p>
      <h4 style="color:var(--g-700);">4. Cancellation Policy</h4>
      <p>Orders may be cancelled while in Pending status. Once an order is processing or out for delivery, cancellation may not be possible.</p>
      <h4 style="color:var(--g-700);">5. Limitation of Liability</h4>
      <p>TEFC E-Commerce shall not be liable for any indirect, incidental, or consequential damages arising from the use of our services.</p>
      <p style="color:var(--text-muted);font-size:11px;margin-top:1rem;">Last updated: 2026 · Triple E &amp; Fiel Collince General Merchandise</p>
    `
  },
  cookie: {
    title: 'Cookie Policy',
    content: `
      <h4 style="color:var(--g-700);margin-top:0;">1. What Are Cookies</h4>
      <p>Cookies are small text files stored on your device when you visit our website. They help us provide you with a better experience.</p>
      <h4 style="color:var(--g-700);">2. How We Use Cookies</h4>
      <p>We use session cookies to keep you logged in during your visit and to remember your preferences. We do not use tracking or advertising cookies.</p>
      <h4 style="color:var(--g-700);">3. Managing Cookies</h4>
      <p>You can control and delete cookies through your browser settings. Note that disabling cookies may affect the functionality of our website.</p>
      <h4 style="color:var(--g-700);">4. Session Cookies</h4>
      <p>Our session cookies are temporary and are deleted when you close your browser. They are essential for the proper functioning of our login system.</p>
      <p style="color:var(--text-muted);font-size:11px;margin-top:1rem;">Last updated: 2026 · Triple E &amp; Fiel Collince General Merchandise</p>
    `
  }
};

function openLegalModal(type) {
  const data = legalContent[type];
  document.getElementById('legalModalTitle').textContent   = data.title;
  document.getElementById('legalModalContent').innerHTML   = data.content;
  document.getElementById('legalModalOverlay').style.display = 'block';
  document.getElementById('legalModal').style.display        = 'block';
}

function closeLegalModal() {
  document.getElementById('legalModalOverlay').style.display = 'none';
  document.getElementById('legalModal').style.display        = 'none';
}

// ─── Slideshow ──────────────────────────────────────────
let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
const dots   = document.querySelectorAll('.slide-dot');
let autoTimer = null;

function goToSlide(n) {
  slides[currentSlide].classList.remove('active');
  dots[currentSlide].classList.remove('active');
  currentSlide = (n + slides.length) % slides.length;
  slides[currentSlide].classList.add('active');
  dots[currentSlide].classList.add('active');
}

function changeSlide(dir) {
  goToSlide(currentSlide + dir);
  resetAuto();
}

function startAuto() {
  autoTimer = setInterval(() => goToSlide(currentSlide + 1), 3000);
}

function resetAuto() {
  clearInterval(autoTimer);
  startAuto();
}

// Pause auto-advance while the visitor is reading a slide (mouse over
// the slideshow), resume once they move away — stops a slide changing
// mid-read.
const slideshowEl = document.getElementById('slideshow');
slideshowEl.addEventListener('mouseenter', () => clearInterval(autoTimer));
slideshowEl.addEventListener('mouseleave', startAuto);

startAuto();