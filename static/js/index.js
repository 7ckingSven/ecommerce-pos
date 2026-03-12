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