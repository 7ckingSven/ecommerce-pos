// ─── Search — disable Search button if input is empty ───
document.addEventListener('DOMContentLoaded', function () {
  const searchInput = document.getElementById('searchInput');
  const searchBtn   = document.querySelector('.search-btn');

  function checkSearch() {
    searchBtn.disabled = searchInput.value.trim() === '';
  }

  searchInput.addEventListener('input', checkSearch);

  // Search on Enter key
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && searchInput.value.trim() !== '') {
      searchBtn.click();
    }
  });

  checkSearch(); // run on page load
});

// ─── Cart count — only show badge when count > 0 ───
function updateCartCount(count) {
  const badge = document.querySelector('.cart-count');
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}