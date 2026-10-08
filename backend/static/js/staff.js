// ─── Skeleton Loading Helpers ────────────────────────
function skCell(widthClass) {
  return '<td><span class="skeleton sk-cell ' + (widthClass||'sk-cell-md') + '"></span></td>';
}
function skRow(cols) {
  var cells = '';
  cols.forEach(function(w){ cells += skCell(w); });
  return '<tr>' + cells + '</tr>';
}
function skTable(tbodyId, colWidths, rows) {
  var tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  rows = rows || 5;
  var html = '';
  for (var i = 0; i < rows; i++) html += skRow(colWidths);
  tbody.innerHTML = html;
}
function skStats(ids) {
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<span class="skeleton sk-val"></span>';
  });
}
// ─── Pagination ──────────────────────────────────────
const ITEMS_PER_PAGE = 10;
const SR_PAGE_SIZE   = 12;
let staffOrdersPage       = 1;
let staffInvPage          = 1;
let srPage                = 1;
let _srFilteredCache      = [];
let staffHistoryTypeFilterVal = '';
let staffHistoryPage = 1;
let allInvHistory    = [];
let staffStockSearchVal = '';
let staffStockLevelVal  = '';
let historySearchVal = '';

function paginate(arr, page) {
  return arr.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
}

function renderPager(containerId, total, currentPage, fnName) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  var s = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  var e = Math.min(currentPage * ITEMS_PER_PAGE, total);

  function btn(page, label, disabled) {
    return '<button '
      + (disabled ? 'disabled ' : '')
      + 'data-fn="' + fnName + '" data-page="' + page + '" '
      + 'style="height:30px;padding:0 10px;border-radius:6px;'
      + 'border:1.5px solid var(--border);background:var(--surface);'
      + 'color:var(--text-primary);font-size:12px;cursor:pointer;'
      + 'opacity:' + (disabled ? '0.4' : '1') + ';">'
      + label + '</button>';
  }

  function pageBtn(page, active) {
    return '<button '
      + 'data-fn="' + fnName + '" data-page="' + page + '" '
      + 'style="min-width:30px;height:30px;border-radius:6px;'
      + 'border:1.5px solid ' + (active ? 'var(--g-400)' : 'var(--border)') + ';'
      + 'background:' + (active ? 'var(--g-400)' : 'var(--surface)') + ';'
      + 'color:' + (active ? '#fff' : 'var(--text-primary)') + ';'
      + 'font-size:12px;font-weight:' + (active ? '700' : '400') + ';'
      + 'cursor:pointer;padding:0 6px;">'
      + page + '</button>';
  }

  var btns = '';
  for (var i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
      btns += pageBtn(i, i === currentPage);
    } else if (Math.abs(i - currentPage) === 2) {
      btns += '<span style="color:var(--text-muted);padding:0 2px;">...</span>';
    }
  }

  el.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;flex-wrap:wrap;gap:8px;">'
    + '<span style="font-size:12px;color:var(--text-muted);">Showing ' + s + ' - ' + e + ' of ' + total + '</span>'
    + '<div style="display:flex;align-items:center;gap:4px;">'
    + btn(currentPage - 1, 'Prev', currentPage === 1)
    + btns
    + btn(currentPage + 1, 'Next', currentPage === totalPages)
    + '</div></div>';

  // Attach click handlers directly to buttons
  el.querySelectorAll('button[data-fn]').forEach(function(b) {
    b.addEventListener('click', function() {
      var fn   = this.getAttribute('data-fn');
      var page = parseInt(this.getAttribute('data-page'));
      if (fn === 'changeInvPage')          { changeInvPage(page); }
      else if (fn === 'changeOrdersPage')  { changeOrdersPage(page); }
      else if (fn === 'changeStaffOrdersPage') { changeStaffOrdersPage(page); }
      else if (fn === 'changeStaffInvPage')    { changeStaffInvPage(page); }
      else if (window[fn]) { window[fn](page); }
    });
  });
}

function renderPagerSized(containerId, total, currentPage, pageSize, fnName) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  var s = (currentPage - 1) * pageSize + 1;
  var e = Math.min(currentPage * pageSize, total);

  function btn(page, label, disabled) {
    return '<button '
      + (disabled ? 'disabled ' : '')
      + 'data-fn="' + fnName + '" data-page="' + page + '" '
      + 'style="height:30px;padding:0 10px;border-radius:6px;'
      + 'border:1.5px solid var(--border);background:var(--surface);'
      + 'color:var(--text-primary);font-size:12px;cursor:pointer;'
      + 'opacity:' + (disabled ? '0.4' : '1') + ';">'
      + label + '</button>';
  }
  function pageBtn(page, active) {
    return '<button '
      + 'data-fn="' + fnName + '" data-page="' + page + '" '
      + 'style="min-width:30px;height:30px;border-radius:6px;'
      + 'border:1.5px solid ' + (active ? 'var(--g-400)' : 'var(--border)') + ';'
      + 'background:' + (active ? 'var(--g-400)' : 'var(--surface)') + ';'
      + 'color:' + (active ? '#fff' : 'var(--text-primary)') + ';'
      + 'font-size:12px;font-weight:' + (active ? '700' : '400') + ';'
      + 'cursor:pointer;padding:0 6px;">'
      + page + '</button>';
  }

  var btns = '';
  for (var i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
      btns += pageBtn(i, i === currentPage);
    } else if (Math.abs(i - currentPage) === 2) {
      btns += '<span style="color:var(--text-muted);padding:0 2px;">...</span>';
    }
  }

  el.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;flex-wrap:wrap;gap:8px;">'
    + '<span style="font-size:12px;color:var(--text-muted);">Showing ' + s + ' - ' + e + ' of ' + total + '</span>'
    + '<div style="display:flex;align-items:center;gap:4px;">'
    + btn(currentPage - 1, 'Prev', currentPage === 1)
    + btns
    + btn(currentPage + 1, 'Next', currentPage === totalPages)
    + '</div></div>';

  el.querySelectorAll('button[data-fn]').forEach(function(b) {
    b.addEventListener('click', function() {
      var fn   = this.getAttribute('data-fn');
      var page = parseInt(this.getAttribute('data-page'));
      if (window[fn]) { window[fn](page); }
    });
  });
}

function changeStaffOrdersPage(p) { staffOrdersPage = p; applyStaffOrderFilters(); }
function changeStaffInvPage(p)     { staffInvPage = p;     applyStaffStockFilters(); }
function changeStaffHistoryPage(p) { staffHistoryPage = p; renderInvHistory(allInvHistory); }
window.changeStaffHistoryPage = changeStaffHistoryPage;
window.changeStaffOrdersPage = changeStaffOrdersPage;
window.changeStaffInvPage    = changeStaffInvPage;

const pageTitles = {
  pos:       ['Point of Sale',    'Process walk-in customer orders'],
  inventory: ['Inventory',        'View branch stock levels'],
  orders:    ['Orders',           'Manage online customer orders'],
  requests:  ['Stock Requests',   'Request stock from admin'],
  summary:   ['Sales Summary',    'View sales performance'],
  profile:   ['My Profile',       'View and update your account information'],
};


// ─── Visibility-based Refresh ────────────────────────


// ─── Preserve expanded rows + filter states across refresh ─────────────────
function saveStaffExpandedRows() {
  const expanded = [];
  document.querySelectorAll('[id^="staffVarRow_"]').forEach(row => {
    if (row.style.display !== 'none') expanded.push(row.id);
  });
  return expanded;
}

function restoreStaffExpandedRows(expanded) {
  expanded.forEach(id => {
    const row = document.getElementById(id);
    if (!row) return;

    // id format: staffVarRow_<productId>
    const productId = id.replace('staffVarRow_', '');

    row.style.display = '';

    // Update arrow button
    const btn = row.previousElementSibling?.querySelector('.inv-expand-btn');
    if (btn) btn.textContent = '▼';

    // Re-fetch variant content (was loaded async — empty after DOM rebuild)
    const cont = row.querySelector('.staff-variant-content');
    if (cont) {
      cont.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Loading variants...</span>';
      const url = staffBranchId
        ? '/api/variant-stock/' + productId + '?branch_id=' + staffBranchId
        : '/api/variant-stock/' + productId;
      fetch(url)
        .then(r => r.json())
        .then(data => {
          if (!data.length) {
            cont.innerHTML = '<tr><td colspan="6" style="padding:8px 16px;font-size:12px;color:var(--text-muted);">No variant stock recorded yet.</td></tr>';
            return;
          }
          var chips = data.map(function(vs) {
            var opts  = Object.entries(vs.options || {}).map(function(e) { return e[0] + ': ' + e[1]; }).join(', ');
            var qty   = vs.quantity || 0;
            var color = qty === 0 ? '#ef4444' : qty <= 5 ? '#f59e0b' : 'var(--g-400)';
            var bg    = qty === 0 ? 'rgba(239,68,68,0.05)' : qty <= 5 ? 'rgba(245,158,11,0.05)' : 'rgba(22,163,74,0.05)';
            return '<div style="padding:6px 10px;border-radius:8px;border:1.5px solid ' + color + ';background:' + bg + ';font-size:12px;display:inline-block;margin:2px;">'
              + '<span style="color:var(--text-primary);font-weight:500;">' + opts + '</span>'
              + '<span style="margin-left:8px;font-weight:700;color:' + color + ';">' + qty + ' units</span>'
              + (qty === 0 ? ' ⚠️' : '')
              + '</div>';
          }).join('');
          cont.innerHTML = '<tr><td colspan="6" style="padding:8px 16px;">' + chips + '</td></tr>';
        })
        .catch(() => { cont.innerHTML = '<tr><td colspan="6" style="padding:8px 16px;color:#ef4444;font-size:12px;">Failed to load variant stock.</td></tr>'; });
    }
  });
}

function saveStaffFilterStates() {
  return {
    historyType:   document.getElementById('staffHistoryTypeFilter')?.value || '',
    orderType:     document.getElementById('staffOrderTypeFilter')?.value || '',
    orderStatus:   document.querySelector('#staffOrdersSection .filter-select')?.value || '',
  };
}

function restoreStaffFilterStates(states) {
  const histFilter = document.getElementById('staffHistoryTypeFilter');
  if (histFilter && states.historyType) {
    histFilter.value = states.historyType;
    if (typeof filterStaffHistoryType === 'function') filterStaffHistoryType(states.historyType);
  }
  const orderTypeFilter = document.getElementById('staffOrderTypeFilter');
  if (orderTypeFilter && states.orderType) {
    orderTypeFilter.value = states.orderType;
    if (typeof filterStaffOrderType === 'function') filterStaffOrderType(states.orderType);
  }
}

function forceRefreshSection(btn) {
  const section = localStorage.getItem('staff-section') || 'pos';
  if (!loaders[section]) return;

  // Spin + lock the ↻ button; stop after load or 5s max
  function stopBtn() {
    if (!btn) return;
    btn.classList.remove('spinning');
  }
  if (btn) {
    btn.classList.add('spinning');
    setTimeout(stopBtn, 5000);
  }

  const expandedRows = saveStaffExpandedRows();
  const filterStates = saveStaffFilterStates();
  const origRender   = window.renderInvHistory;
  window.renderInvHistory = function(data) {
    if (origRender) origRender(data);
    restoreStaffExpandedRows(expandedRows);
    restoreStaffFilterStates(filterStates);
    window.renderInvHistory = origRender;
    stopBtn();
  };
  invalidateSection(section);
  _loadedSections.add(section);
  lockSidebar();
  loaders[section]();
  setTimeout(unlockSidebar, 1000);
}

// Refresh current section when user returns to tab
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    const section = localStorage.getItem('staff-section') || 'pos';
    if (loaders[section]) {
      const expandedRows = saveStaffExpandedRows();
      const filterStates = saveStaffFilterStates();
      const origRender   = window.renderInvHistory;
      window.renderInvHistory = function(data) {
        if (origRender) origRender(data);
        restoreStaffExpandedRows(expandedRows);
        restoreStaffFilterStates(filterStates);
        window.renderInvHistory = origRender;
      };
      invalidateSection(section);
      _loadedSections.add(section);
      loaders[section]();
    }
  }
});

function showSection(name, el) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (el) {
    el.classList.add('active');
  } else {
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('onclick')?.includes("'" + name + "'")) item.classList.add('active');
    });
  }
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[name][0];
  document.getElementById('pageSub').textContent   = pageTitles[name][1];
  window.location.hash = name;
  localStorage.setItem('staff-section', name);
  // Auto-close sidebar on mobile when a nav item is tapped
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('mobile-open')) {
      sidebar.classList.remove('mobile-open');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (backdrop) backdrop.remove();
    }
  }
  // Profile sidebar active indicator
  const sidebarProfileBtn = document.getElementById('sidebarProfileBtn');
  if (sidebarProfileBtn) {
    if (name === 'profile') {
      sidebarProfileBtn.style.background = 'rgba(255,255,255,0.12)';
      sidebarProfileBtn.style.borderRadius = '8px';
    } else {
      sidebarProfileBtn.style.background = '';
    }
  }
  if (loaders[name] && !_loadedSections.has(name)) {
    _loadedSections.add(name);
    loaders[name]();
  }
}

var loaders = {
  pos:       loadPosProducts,
  inventory: loadInventory,
  orders:    loadOrders,
  summary:   loadSummary,
  requests:  loadRequests,
  profile:   loadProfile,
};

// ─── Section load-once cache ──────────────────────────
var _loadedSections = new Set();
function invalidateSection(name) { _loadedSections.delete(name); }
function invalidateAll() { _loadedSections.clear(); }


// ─── Button Loading Helper ────────────────────────────
function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn._originalText = btn.innerHTML;
    btn.disabled      = true;
    btn.style.opacity = '0.7';
    btn.innerHTML     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;animation:spin 1s linear infinite;vertical-align:middle;"><circle cx="12" cy="12" r="10" stroke-dasharray="40" stroke-dashoffset="20"/></svg> Processing...';
  } else {
    btn.disabled      = false;
    btn.style.opacity = '1';
    btn.innerHTML     = btn._originalText || 'Submit';
  }
}


// ─── Theme Toggle ─────────────────────────────────────
function toggleTheme() {
  const html     = document.documentElement;
  const current  = html.getAttribute('data-theme') || 'dark';
  const next     = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// Apply saved theme on load
(function() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
})();


// ─── Topbar Date ──────────────────────────────────────
function updateTopbarDate() {
  const el = document.getElementById('topbarDate');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}
updateTopbarDate();
setInterval(updateTopbarDate, 60000);


// ─── Sidebar Toggle ────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  if (window.innerWidth <= 768) {
    // Mobile: slide in/out via mobile-open; ensure collapsed doesn't fight width
    sidebar.classList.remove('collapsed');
    const isOpen = sidebar.classList.toggle('mobile-open');
    // Ensure/remove backdrop
    let backdrop = document.getElementById('sidebarBackdrop');
    if (isOpen) {
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'sidebarBackdrop';
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99;';
        backdrop.addEventListener('click', toggleSidebar);
        document.body.appendChild(backdrop);
      }
    } else {
      if (backdrop) backdrop.remove();
    }
  } else {
    // Desktop: collapse/expand
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
  }
}
window.toggleSidebar = toggleSidebar;

// Restore sidebar state on load
(function() {
  const sidebar   = document.getElementById('sidebar');
  const collapsed = localStorage.getItem('sidebarCollapsed');
  if (sidebar && collapsed === 'true' && window.innerWidth > 768) sidebar.classList.add('collapsed');
})();


// ─── Lock sidebar width during refresh to prevent icon shift ───────────────
function lockSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.width = sidebar.offsetWidth + 'px';
}
function unlockSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.style.width = '';
}

// ─── Toast ────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast show${type === 'error' ? ' error' : ''}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── Helpers ──────────────────────────────────────────
function badge(text) {
  const map = {
    active: 'green', inactive: 'gray', pending: 'yellow',
    processing: 'blue', completed: 'green', cancelled: 'red',
    online: 'blue', walk_in: 'green', paid: 'green', failed: 'red',
    gcash: 'blue', walk_in_cash: 'green', cash_on_delivery: 'yellow',
  };
  return `<span class="badge badge--${map[text] || 'gray'}">${text.replace(/_/g, ' ')}</span>`;
}

function peso(val) {
  return '₱' + Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

function shortId(id) {
  return id ? id.slice(0, 8).toUpperCase() : '—';
}

function offlineSyncTag(o) {
  return o.is_offline_sync
    ? ' <span title="Made while offline, synced once reconnected" style="display:inline-block;margin-top:3px;background:rgba(245,158,11,0.15);color:#b45309;border:1px solid rgba(245,158,11,0.4);border-radius:999px;font-size:10px;font-weight:600;padding:1px 6px;">⚡ Offline Sync</span>'
    : '';
}

// Supabase timestamp columns (created_at, updated_at, ...) come back with no
// 'Z'/UTC suffix. Parsing that naive string with plain `new Date()` makes the
// browser treat it as LOCAL time instead of UTC — on a PH machine (UTC+8)
// that silently shifts the real moment by 8 hours, which then shows up as a
// wrong clock time once reformatted (e.g. the Sales Summary time column).
// Always build Dates for display through this helper instead of `new Date(raw)`.
function toUtcDate(raw) {
  if (!raw) return null;
  const normalized = raw.toString().replace(/(\.\d{3})\d+/, '$1').replace(' ', 'T');
  const utcStr = normalized.endsWith('Z') || normalized.includes('+') ? normalized : normalized + 'Z';
  return new Date(utcStr);
}

// ══════════════════════════════════════════════════════
// GLOBAL STATE
// ══════════════════════════════════════════════════════
let posProducts     = [];
let orderItems      = [];
let selectedPayment = 'walk_in_cash';
let posDiscounts    = [];
let invProducts     = [];
let staffOrders     = [];
let allBranches     = [];

// ══════════════════════════════════════════════════════
// OFFLINE POS — walk-in sales keep working when the connection drops
// ══════════════════════════════════════════════════════
// navigator.onLine only reflects the network adapter, not whether the
// Flask backend is actually reachable, so connectivity is confirmed with
// a real request to the lightweight /ping route instead of trusting it.
let posIsOnline       = true;
let posSyncInProgress = false;
const OFFLINE_DB_NAME  = 'tefc_pos_offline';
const OFFLINE_DB_STORE = 'pendingOrders';

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OFFLINE_DB_STORE)) {
        db.createObjectStore(OFFLINE_DB_STORE, { keyPath: 'client_offline_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function addPendingOrder(order) {
  return openOfflineDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_DB_STORE, 'readwrite');
    tx.objectStore(OFFLINE_DB_STORE).put(order);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  }));
}

function getPendingOrders() {
  return openOfflineDB().then(db => new Promise((resolve, reject) => {
    const tx  = db.transaction(OFFLINE_DB_STORE, 'readonly');
    const req = tx.objectStore(OFFLINE_DB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  }));
}

function deletePendingOrder(clientOfflineId) {
  return openOfflineDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_DB_STORE, 'readwrite');
    tx.objectStore(OFFLINE_DB_STORE).delete(clientOfflineId);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  }));
}

function genOfflineId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : 'off_' + Date.now() + '_' + Math.random().toString(36).slice(2);
}

// Reduces the locally cached stock numbers (posProducts/invProducts only —
// the real database stock is untouched until the order syncs) so a second
// walk-in sale during the same outage doesn't oversell against stale,
// pre-outage figures.
function applyOfflineStockDeduction(cartItems, branchId) {
  cartItems.forEach(item => {
    [posProducts, invProducts].forEach(list => {
      const p = list.find(x => x.product_id === item.product_id);
      if (!p) return;
      if (item.selected_options && Object.keys(item.selected_options).length && p.variant_stock?.length) {
        const vs = p.variant_stock.find(v => v.branch_id === branchId && JSON.stringify(v.options) === JSON.stringify(item.selected_options));
        if (vs) vs.quantity = Math.max(Number(vs.quantity) - item.quantity, 0);
      }
      const bs = p.branch_stock?.find(b => b.branch_id === branchId);
      if (bs) bs.quantity = Math.max(Number(bs.quantity) - item.quantity, 0);
      p.quantity = Math.max(Number(p.quantity || 0) - item.quantity, 0);
    });
  });
}

async function updateOfflinePendingBadge() {
  let pending = [];
  try { pending = await getPendingOrders(); } catch (e) {}

  const banner = document.getElementById('posOfflineBanner');
  if (banner) {
    if (!posIsOnline || pending.length) {
      banner.style.display = 'flex';
      banner.classList.toggle('pos-offline-banner--syncing', posIsOnline && pending.length > 0);
      const textEl = document.getElementById('posOfflineBannerText');
      if (textEl) {
        textEl.textContent = !posIsOnline
          ? "You're offline — Cash sales will be saved and synced automatically once reconnected."
          : `Back online — syncing ${pending.length} queued order${pending.length !== 1 ? 's' : ''}...`;
      }
    } else {
      banner.style.display = 'none';
    }
  }
  const countEl = document.getElementById('posOfflinePendingCount');
  if (countEl) {
    countEl.textContent   = pending.length ? String(pending.length) : '';
    countEl.style.display = pending.length ? '' : 'none';
  }

  // GCash needs a live reference check — disable it while offline and
  // force the current selection back to Cash if GCash was active.
  const gcashBtn = document.querySelector('.pos-pay-btn[onclick*="gcash"]');
  if (gcashBtn) {
    gcashBtn.disabled      = !posIsOnline;
    gcashBtn.style.opacity = posIsOnline ? '' : '0.5';
    gcashBtn.style.cursor  = posIsOnline ? '' : 'not-allowed';
    if (!posIsOnline && selectedPayment === 'gcash') {
      selectedPayment = 'walk_in_cash';
      document.querySelectorAll('.pos-pay-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.pos-pay-btn[onclick*="walk_in_cash"]')?.classList.add('active');
      document.getElementById('posRefNo').style.display     = 'none';
      document.getElementById('posCashInput').style.display = 'flex';
      validateCheckoutButton();
    }
  }
}

async function checkConnectivity() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch('/ping', { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok || res.status === 204;
  } catch (e) {
    return false;
  }
}

async function refreshConnectivity() {
  const wasOffline = !posIsOnline;
  posIsOnline = await checkConnectivity();
  await updateOfflinePendingBadge();
  if (posIsOnline && wasOffline) syncPendingOrders();
}

// Replays queued offline sales to the server one at a time, oldest first,
// so stock gets deducted in the same order the walk-in sales actually
// happened. A sale the server rejects (e.g. real stock has since dropped
// further) stays in the queue for manual review instead of being dropped.
async function syncPendingOrders() {
  if (posSyncInProgress) return;
  posSyncInProgress = true;
  try {
    const pending = (await getPendingOrders()).sort((a, b) => a.queued_at - b.queued_at);
    let syncedCount = 0, failedCount = 0;
    for (const order of pending) {
      const { client_offline_id, queued_at, ...payload } = order;
      try {
        const res = await fetch('/api/staff/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          await deletePendingOrder(client_offline_id);
          syncedCount++;
        } else {
          failedCount++;
        }
      } catch (e) {
        // Connection dropped again mid-sync — stop here; the rest stay
        // queued for the next reconnect instead of firing out of order.
        break;
      }
    }
    if (syncedCount) {
      invalidateSection('pos');       loadPosProducts();
      invalidateSection('orders');    loadOrders();
      invalidateSection('inventory'); loadInventory();
      invalidateSection('summary');   loadSummary();
      showToast(`${syncedCount} offline sale${syncedCount !== 1 ? 's' : ''} synced successfully.`);
    }
    if (failedCount) {
      showToast(`${failedCount} offline sale${failedCount !== 1 ? 's' : ''} need review — stock may have changed.`, 'error');
    }
  } finally {
    posSyncInProgress = false;
    await updateOfflinePendingBadge();
  }
}

function startConnectivityWatch() {
  refreshConnectivity();
  setInterval(refreshConnectivity, 15000);
  window.addEventListener('online',  refreshConnectivity);
  window.addEventListener('offline', refreshConnectivity);
}

// ══════════════════════════════════════════════════════
// BRANCHES
// ══════════════════════════════════════════════════════
// Staff's own branch — loaded once on init
let staffBranchId   = null;
let staffBranchName = null;

async function loadBranches() {
  try {
    // Load all branches for stock modals
    const res   = await fetch('/api/staff/branches');
    allBranches = await res.json();

    // Auto-detect this staff's branch
    await loadStaffBranch();

    populateBranchSelects();
  } catch (e) { console.error('Branches error:', e); }
}

async function loadStaffBranch() {
  try {
    const res  = await fetch('/api/staff/my-branch');
    const data = await res.json();
    if (data.branch_id) {
      staffBranchId   = data.branch_id;
      staffBranchName = data.branch_name;
      window.staffFname = data.fname || '';
      window.staffLname = data.lname || '';

      // Set hidden input for POS
      const input = document.getElementById('posBranch');
      if (input) input.value = staffBranchId;

      // Show branch name in POS display
      const display = document.getElementById('posBranchDisplay');
      if (display) display.textContent = `Branch: ${staffBranchName}`;

      // Show branch name in sidebar
      const sidebarBranch = document.getElementById('sidebarBranchName');
      if (sidebarBranch) sidebarBranch.textContent = staffBranchName;
    } else {
      const display = document.getElementById('posBranchDisplay');
      if (display) display.textContent = 'No branch assigned — contact admin';
    }
  } catch (e) {
    console.error('Staff branch error:', e);
  }
}

function populateBranchSelects() {
  const options = `<option value="">Select branch</option>` +
    allBranches.map(b => `<option value="${b.branch_id}">${b.branch_name}</option>`).join('');

  // POS branch — hidden, already set by loadStaffBranch
  const posBranch = document.getElementById('posBranch');
  if (posBranch && !posBranch.value) posBranch.value = staffBranchId || '';

  // Stock modal branch selects
  ['stockFromBranch', 'stockToBranch'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = options;
      // Default to_branch to staff's own branch
      if (id === 'stockToBranch' && staffBranchId) el.value = staffBranchId;
    }
  });
}

// ══════════════════════════════════════════════════════
// POS
// ══════════════════════════════════════════════════════
async function loadPosProducts() {
  // ── Skeleton ──
  var posGrid = document.getElementById('posProducts');
  if (posGrid) {
    var skCards = '';
    for (var i = 0; i < 8; i++) {
      skCards += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;">' +
        '<div class="skeleton" style="width:100%;height:120px;border-radius:0;"></div>' +
        '<div style="padding:10px;display:flex;flex-direction:column;gap:6px;">' +
        '<span class="skeleton sk-cell sk-cell-full" style="height:13px;"></span>' +
        '<span class="skeleton sk-cell sk-cell-sm" style="height:12px;"></span>' +
        '</div></div>';
    }
    posGrid.innerHTML = skCards;
    posGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;';
  }
  // ─────────────
  try {
    const res   = await fetch('/api/products');
    const rawAll = await res.json();
    const all    = Array.isArray(rawAll) ? rawAll : [];
    // Filter to only show products for this branch
    posProducts = all.filter(p => {
      if (!staffBranchId) return true;
      const bs = (p.branch_stock || []).find(b => b.branch_id === staffBranchId);
      return bs !== undefined;
    });
    renderPosProducts(posProducts);
    populateCategories(posProducts);
  } catch (e) { console.error('POS products error:', e); }
}

async function loadPosDiscounts() {
  try {
    const res  = await fetch('/api/staff/discounts');
    const data = await res.json();
    const now  = new Date();
    posDiscounts = Array.isArray(data)
      ? data.filter(d => {
          if (d.ends_at && new Date(d.ends_at) < now) return false;
          return true;
        })
      : [];

    // Update hidden native select (for updateTotal / checkout compatibility)
    const sel = document.getElementById('posDiscount');
    if (sel) {
      sel.innerHTML = '<option value="">— No Discount —</option>' +
        posDiscounts.map(d =>
          `<option value="${d.discount_id}" data-pct="${d.percentage}">${d.discount_name} (${d.percentage}% off)</option>`
        ).join('');
    }

    // Update custom dropdown menu
    const menu = document.getElementById('posDiscountMenu');
    if (menu) {
      menu.innerHTML = `<div class="pos-discount-option pos-discount-option-none active" data-value="" data-pct="0" onclick="selectDiscount(this)">
        <span class="pos-discount-opt-name">No Discount</span>
      </div>` +
      posDiscounts.map(d => `
        <div class="pos-discount-option" data-value="${d.discount_id}" data-pct="${d.percentage}" onclick="selectDiscount(this)">
          <div class="pos-discount-opt-left">
            <span class="pos-discount-opt-name">${d.discount_name}</span>
            <span class="pos-discount-opt-sub">Order discount</span>
          </div>
          <span class="pos-discount-badge">${d.percentage}% off</span>
        </div>`).join('');
    }
  } catch (e) { console.error('POS discounts error:', e); }
}

function toggleDiscountDropdown() {
  const menu    = document.getElementById('posDiscountMenu');
  const chevron = document.getElementById('posDiscountChevron');
  const wrap    = document.getElementById('posDiscountWrap');
  const open    = menu.classList.toggle('open');
  chevron.style.transform = open ? 'rotate(180deg)' : '';
  wrap.classList.toggle('open', open);
  if (open) {
    // Close on outside click
    setTimeout(() => document.addEventListener('click', closeDiscountOnOutside, { once: true }), 0);
  }
}

function closeDiscountOnOutside(e) {
  const wrap = document.getElementById('posDiscountWrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('posDiscountMenu').classList.remove('open');
    document.getElementById('posDiscountChevron').style.transform = '';
    wrap.classList.remove('open');
  } else if (wrap && wrap.contains(e.target)) {
    // Re-attach if click was inside but not on an option
    setTimeout(() => document.addEventListener('click', closeDiscountOnOutside, { once: true }), 0);
  }
}

function selectDiscount(el) {
  const value = el.dataset.value;
  const pct   = el.dataset.pct;
  const name  = el.querySelector('.pos-discount-opt-name').textContent;

  // Update active state in menu
  document.querySelectorAll('.pos-discount-option').forEach(o => o.classList.remove('active'));
  el.classList.add('active');

  // Update trigger label
  const label = document.getElementById('posDiscountLabel');
  if (value === '') {
    label.textContent = 'No Discount';
    label.style.color = '';
  } else {
    label.textContent = `${name} — ${pct}% off`;
    label.style.color = 'var(--g-400)';
  }

  // Sync hidden select
  const sel = document.getElementById('posDiscount');
  if (sel) { sel.value = value; }

  // Close dropdown
  document.getElementById('posDiscountMenu').classList.remove('open');
  document.getElementById('posDiscountChevron').style.transform = '';
  document.getElementById('posDiscountWrap').classList.remove('open');

  updateTotal();
}

function populateCategories(products) {
  const cats = [...new Set(products.map(p => p.category).filter(c => c != null && c !== ''))].sort();
  const wrap = document.getElementById('posCats');
  wrap.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'pos-cat active';
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', function() { filterPosCategory('', this); });
  wrap.appendChild(allBtn);

  cats.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'pos-cat';
    btn.textContent = c;
    btn.addEventListener('click', function() { filterPosCategory(c, this); });
    wrap.appendChild(btn);
  });
}

function filterPosCategory(cat, el) {
  document.querySelectorAll('#posCats .pos-cat').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const filtered = cat ? posProducts.filter(p => p.category === cat) : posProducts.slice();
  renderPosProducts(filtered);
}

function searchProducts(q) {
  const filtered = posProducts.filter(p =>
    p.product_name.toLowerCase().includes(q.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(q.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(q.toLowerCase())
  );
  renderPosProducts(filtered);
}

function renderPosProducts(products) {
  const wrap = document.getElementById('posProducts');
  if (!products.length) {
    wrap.innerHTML = '<div class="table-empty" style="grid-column:1/-1;">No products found</div>';
    return;
  }
  wrap.innerHTML = products.map(p => {
    // Get branch-specific stock
    const branchStock = (p.branch_stock || []).find(b => b.branch_id === staffBranchId);
    const stockQty    = branchStock ? branchStock.quantity : p.quantity || 0;
    // Compute display price with discount if applicable
    const disc          = p.discount;
    const discountedPx  = disc ? p.price * (1 - disc.percentage / 100) : null;
    const priceDisplay  = discountedPx !== null
      ? `<div class="pos-product-price" style="text-decoration:line-through;color:var(--text-muted);font-size:11px;">${peso(p.price)}</div>
         <div class="pos-product-price" style="color:var(--g-400);">${peso(discountedPx)}</div>
         <div style="font-size:10px;color:var(--g-400);">${disc.discount_name} −${disc.percentage}%</div>`
      : `<div class="pos-product-price">${peso(p.price)}</div>`;

    const effectivePrice = discountedPx !== null ? discountedPx : p.price;

    return `
      <div class="pos-product-card${stockQty <= 0 ? ' out-of-stock' : ''}"
           onclick="${stockQty > 0 ? `selectPosProduct('${p.product_id}')` : ''}">
        ${p.image_url
          ? `<img src="${p.image_url}" class="pos-product-img" alt="${p.product_name}"/>`
          : `<div class="pos-product-img-placeholder">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
             </div>`
        }
        <div class="pos-product-name">${p.product_name}</div>
        ${priceDisplay}
        <div class="pos-product-stock">${stockQty <= 0 ? '⚠️ Out of stock' : `Stock: ${stockQty}`}</div>
      </div>`;
  }).join('');
}

function addToOrder(productId, name, price, maxStock, selectedOptions = {}, discountMeta = {}) {
  const existing = orderItems.find(i => i.product_id === productId && JSON.stringify(i.selected_options||{}) === JSON.stringify(selectedOptions));
  if (existing) {
    if (existing.quantity >= maxStock) {
      showToast(`Only ${maxStock} units available.`, 'error');
      return;
    }
    existing.quantity++;
  } else {
    orderItems.push({
      product_id:     productId,
      name,
      price,
      quantity:       1,
      max:            maxStock,
      selected_options: selectedOptions,
      original_price: discountMeta.original_price || null,
      discount_name:  discountMeta.discount_name  || null,
      discount_pct:   discountMeta.discount_pct   || null,
    });
  }
  renderOrderItems();
  updateTotal();
}

function updateQty(productId, delta) {
  const item = orderItems.find(i => i.product_id === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    orderItems = orderItems.filter(i => i.product_id !== productId);
  } else if (item.quantity > item.max) {
    item.quantity = item.max;
    showToast(`Maximum stock is ${item.max}.`, 'error');
  }
  renderOrderItems();
  updateTotal();
}

function removeFromOrder(productId) {
  orderItems = orderItems.filter(i => i.product_id !== productId);
  renderOrderItems();
  updateTotal();
}

function renderOrderItems() {
  const wrap = document.getElementById('posOrderItems');
  if (!orderItems.length) {
    wrap.innerHTML = `
      <div class="pos-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px;color:var(--text-muted);"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
        <p>No items added yet</p>
        <span>Search and click a product to add</span>
      </div>`;
    validateCheckoutButton();
    return;
  }
  wrap.innerHTML = orderItems.map(item => `
    <div class="pos-order-item">
      <div class="pos-order-item-name" title="${item.name}">${item.name}</div>
      <div class="pos-qty-ctrl">
        <button class="pos-qty-btn" onclick="updateQty('${item.product_id}', -1)">−</button>
        <span class="pos-qty-val">${item.quantity}</span>
        <button class="pos-qty-btn" onclick="updateQty('${item.product_id}', 1)">+</button>
      </div>
      <div class="pos-order-item-price">${peso(item.price * item.quantity)}</div>
      <button class="pos-remove-btn" onclick="removeFromOrder('${item.product_id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');
  validateCheckoutButton();
}


// ─── POS Variant Modal ─────────────────────────────────
let posCurrentProduct = null;
let posSelectedVariants = {};

function selectPosProduct(productId) {
  const p = posProducts.find(pr => pr.product_id === productId);
  if (!p) return;
  const disc          = p.discount;
  const effectivePrice = disc ? p.price * (1 - disc.percentage / 100) : p.price;
  posCurrentProduct   = { ...p, effectivePrice };
  posSelectedVariants = {};

  const groups = p.option_groups || [];
  if (!groups.length) {
    addToOrder(p.product_id, p.product_name, effectivePrice, p.quantity, {}, {
      original_price: disc ? p.price : null,
      discount_name:  disc ? disc.discount_name : null,
      discount_pct:   disc ? disc.percentage    : null,
    });
    return;
  }

  const modalHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1rem 0.75rem;border-bottom:1px solid var(--border);margin-bottom:1rem;">
      <div>
        <strong style="font-size:14px;">${p.product_name}</strong>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Select variant to add to order</div>
      </div>
      <button onclick="closeGenericModal()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px;line-height:1;font-size:20px;" title="Close">&times;</button>
    </div>
    <div style="padding:0 1rem 1rem;">
    ${groups.map(g => `
      <div style="margin-bottom:12px;">
        <label style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:4px;display:block;">${g.label}</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;" id="posVarGroup_${g.label.replace(/\s/g,'_')}">
          ${(g.choices || []).map(c => `
            <button type="button"
              onclick="selectPosVariantOpt('${g.label}', '${c}', this)"
              style="padding:6px 12px;border-radius:6px;border:1.5px solid var(--border);
                     background:var(--surface);color:var(--text-primary);font-size:12px;cursor:pointer;">
              ${c}
            </button>
          `).join('')}
        </div>
      </div>
    `).join('')}
    <div id="posVarStock" style="font-size:12px;color:var(--text-muted);margin-bottom:12px;min-height:18px;"></div>
    <button onclick="confirmPosVariant()" class="btn btn-solid-green" style="width:100%;">Add to Order</button>
    </div>
  `;
  showGenericModal(modalHtml);
}

function selectPosVariantOpt(label, value, btn) {
  posSelectedVariants[label] = value;
  const group = document.getElementById('posVarGroup_' + label.replace(/\s/g, '_'));
  if (group) {
    group.querySelectorAll('button').forEach(b => {
      b.style.background  = 'var(--surface)';
      b.style.borderColor = 'var(--border)';
      b.style.color       = 'var(--text-primary)';
      b.style.fontWeight  = '400';
    });
    btn.style.background  = 'var(--g-400)';
    btn.style.borderColor = 'var(--g-400)';
    btn.style.color       = '#fff';
    btn.style.fontWeight  = '700';
  }
  checkPosVariantStock();
}

async function checkPosVariantStock() {
  if (!posCurrentProduct) return;
  const groups = posCurrentProduct.option_groups || [];
  if (Object.keys(posSelectedVariants).length < groups.length) return;

  const stockEl = document.getElementById('posVarStock');
  if (!stockEl) return;
  stockEl.textContent = 'Checking stock...';

  try {
    const res  = await fetch('/api/variant-stock/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: posCurrentProduct.product_id,
        branch_id:  staffBranchId,
        options:    posSelectedVariants,
      }),
    });
    const data = await res.json();
    const qty  = data.quantity || 0;
    stockEl.textContent = qty > 0 ? `✅ ${qty} units available` : '❌ Out of stock for this variant';
    stockEl.style.color = qty > 0 ? 'var(--g-400)' : '#ef4444';
  } catch (e) {
    stockEl.textContent = '';
  }
}

async function confirmPosVariant() {
  if (!posCurrentProduct) return;
  const groups = posCurrentProduct.option_groups || [];

  for (const g of groups) {
    if (!posSelectedVariants[g.label]) {
      showToast(`Please select a ${g.label}.`, 'error');
      return;
    }
  }

  // Check available variant stock
  let availableStock = 0;
  try {
    const res  = await fetch('/api/variant-stock/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: posCurrentProduct.product_id,
        branch_id:  staffBranchId,
        options:    posSelectedVariants,
      }),
    });
    const data = await res.json();
    availableStock = data.quantity || 0;
    if (availableStock <= 0) {
      showToast('This variant is out of stock!', 'error');
      return;
    }
  } catch (e) {}

  const variantLabel = Object.entries(posSelectedVariants).map(([k,v]) => `${k}: ${v}`).join(', ');
  const disc2 = posCurrentProduct.discount;
  addToOrder(
    posCurrentProduct.product_id,
    `${posCurrentProduct.product_name} (${variantLabel})`,
    posCurrentProduct.effectivePrice,
    availableStock || posCurrentProduct.quantity,
    { ...posSelectedVariants },
    {
      original_price: disc2 ? posCurrentProduct.price : null,
      discount_name:  disc2 ? disc2.discount_name     : null,
      discount_pct:   disc2 ? disc2.percentage        : null,
    }
  );
  posSelectedVariants = {};
  closeGenericModal();
}

window.selectPosProduct      = selectPosProduct;
window.selectPosVariantOpt   = selectPosVariantOpt;
window.confirmPosVariant     = confirmPosVariant;

function updateTotal() {
  // Subtotal = sum of discounted item prices
  const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);

  // Product savings = sum of (original - discounted) per item
  const prodSavings = orderItems.reduce((s, i) => {
    if (i.original_price && i.original_price > i.price) {
      return s + (i.original_price - i.price) * i.quantity;
    }
    return s;
  }, 0);

  // Order-level discount
  const sel = document.getElementById('posDiscount');
  const selectedOpt = sel?.options[sel.selectedIndex];
  const orderDiscPct = selectedOpt?.dataset?.pct ? parseFloat(selectedOpt.dataset.pct) : 0;
  const orderDiscAmt = subtotal * (orderDiscPct / 100);

  const finalTotal = subtotal - orderDiscAmt;

  document.getElementById('posSubtotal').textContent = peso(subtotal);

  // Product savings row
  const prodRow = document.getElementById('posProdDiscountRow');
  if (prodSavings > 0) {
    document.getElementById('posProdDiscountLabel').textContent = 'Product Savings';
    document.getElementById('posProdDiscountAmt').textContent   = `−${peso(prodSavings)}`;
    prodRow.style.display = '';
  } else {
    prodRow.style.display = 'none';
  }

  // Order discount row
  const orderRow = document.getElementById('posOrderDiscountRow');
  if (orderDiscPct > 0) {
    document.getElementById('posOrderDiscountLabel').textContent = `${selectedOpt.text.split('(')[0].trim()} (${orderDiscPct}%)`;
    document.getElementById('posOrderDiscountAmt').textContent   = `−${peso(orderDiscAmt)}`;
    orderRow.style.display = '';
  } else {
    orderRow.style.display = 'none';
  }

  document.getElementById('posTotal').textContent = peso(finalTotal);
  computeChange();
}

function clearOrder() {
  orderItems = [];
  renderOrderItems();
  updateTotal();
  document.getElementById('posCustomer').value     = '';
  document.getElementById('posDiscount').value     = '';
  // Reset custom discount dropdown
  const _dLabel = document.getElementById('posDiscountLabel');
  if (_dLabel) { _dLabel.textContent = 'No Discount'; _dLabel.style.color = ''; }
  document.querySelectorAll('.pos-discount-option').forEach(o => o.classList.remove('active'));
  const _dNone = document.querySelector('.pos-discount-option-none');
  if (_dNone) _dNone.classList.add('active');
  document.getElementById('posCashReceived').value = '';
  document.getElementById('posChange').value        = '';
  document.getElementById('posGcashRef').value      = '';

  // Reset payment method back to default (walk_in_cash)
  selectedPayment = 'walk_in_cash';
  document.querySelectorAll('.pos-pay-btn').forEach(b => b.classList.remove('active'));
  const defaultBtn = document.querySelector('.pos-pay-btn[onclick*="walk_in_cash"]');
  if (defaultBtn) defaultBtn.classList.add('active');
  document.getElementById('posRefNo').style.display     = 'none';
  document.getElementById('posCashInput').style.display = 'flex';
}

function confirmClearOrder() {
  if (!orderItems.length) return; // nothing to clear
  showGenericModal(`
    <div style="padding:1.5rem;text-align:center;">
      <h3 style="margin:0 0 .5rem;">Clear Order?</h3>
      <p style="margin:0 0 1.25rem;color:var(--text-muted);font-size:14px;">
        This will remove all ${orderItems.length} item${orderItems.length !== 1 ? 's' : ''} from the current order.<br>This action cannot be undone.
      </p>
      <div style="display:flex;gap:.75rem;justify-content:center;">
        <button class="btn btn-outline" onclick="closeGenericModal()">Cancel</button>
        <button class="btn btn-solid-red" onclick="closeGenericModal();clearOrder();">Yes, Clear</button>
      </div>
    </div>
  `);
}

function selectPayment(method, el) {
  selectedPayment = method;
  document.querySelectorAll('.pos-pay-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('posRefNo').style.display     = method === 'gcash' ? 'flex' : 'none';
  document.getElementById('posCashInput').style.display = method === 'walk_in_cash' ? 'flex' : 'none';
  validateCheckoutButton();
}

function computeChange() {
  const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const sel      = document.getElementById('posDiscount');
  const discPct  = sel?.options[sel.selectedIndex]?.dataset?.pct ? parseFloat(sel.options[sel.selectedIndex].dataset.pct) : 0;
  const total    = subtotal - (subtotal * discPct / 100);
  const received = parseFloat(document.getElementById('posCashReceived').value) || 0;
  const change   = received - total;
  const input    = document.getElementById('posChange');
  input.value       = change >= 0 ? peso(change) : '—';
  input.style.color = change >= 0 ? 'var(--g-400)' : '#ef4444';
  validateCheckoutButton();
}

// ─── Checkout button validation ───────────────────────
// Disables Process Order unless the cart has items AND the
// selected payment method has valid, sufficient input.
function validateCheckoutButton() {
  const btn = document.getElementById('processOrderBtn');
  if (!btn) return;

  if (!orderItems.length) {
    btn.disabled = true;
    return;
  }

  if (selectedPayment === 'walk_in_cash') {
    const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const sel      = document.getElementById('posDiscount');
    const discPct  = sel?.options[sel.selectedIndex]?.dataset?.pct ? parseFloat(sel.options[sel.selectedIndex].dataset.pct) : 0;
    const total    = subtotal - (subtotal * discPct / 100);
    const received = parseFloat(document.getElementById('posCashReceived').value) || 0;
    btn.disabled = !(received > 0 && received >= total);
  } else if (selectedPayment === 'gcash') {
    const refNo = (document.getElementById('posGcashRef').value || '').trim();
    btn.disabled = !/^\d{13}$/.test(refNo);
  } else {
    btn.disabled = false;
  }
}

async function processOrder() {
  if (!orderItems.length) return;
  const processBtn = document.getElementById('processOrderBtn');
  setButtonLoading(processBtn, true);

  // Branch is auto-detected from staff profile
  const branchId = staffBranchId || document.getElementById('posBranch').value;
  if (!branchId) {
    setButtonLoading(processBtn, false);
    showToast('Branch not assigned. Please contact admin.', 'error');
    return;
  }

  const refNo = document.getElementById('posGcashRef').value.trim().replace(/\s/g, '');
  // GCash needs a live reference check — not available offline. The pay
  // button is already disabled in this case (updateOfflinePendingBadge),
  // this is just a safety net against a stale click.
  if (!posIsOnline && selectedPayment === 'gcash') {
    setButtonLoading(processBtn, false);
    showToast('GCash is unavailable offline — switch to Cash.', 'error');
    return;
  }
  if (selectedPayment === 'gcash') {
    if (!refNo) {
      showToast('Please enter GCash reference number.', 'error');
      return;
    }
    if (!/^\d{13}$/.test(refNo)) {
      showToast('GCash reference number must be exactly 13 digits.', 'error');
      return;
    }
  }

  if (selectedPayment === 'walk_in_cash') {
    const _sub  = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const _dSel = document.getElementById('posDiscount');
    const _dPct = _dSel?.options[_dSel.selectedIndex]?.dataset?.pct ? parseFloat(_dSel.options[_dSel.selectedIndex].dataset.pct) : 0;
    const _tot  = _sub - (_sub * _dPct / 100);
    const received = parseFloat(document.getElementById('posCashReceived').value) || 0;
    if (received < _tot) {
      showToast('Cash received is less than total amount.', 'error');
      return;
    }
  }

  const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const quantity = orderItems.reduce((s, i) => s + i.quantity, 0);
  const discSel  = document.getElementById('posDiscount');
  const discOpt  = discSel?.options[discSel.selectedIndex];
  const discPct  = discOpt?.dataset?.pct ? parseFloat(discOpt.dataset.pct) : 0;
  const discId   = discSel?.value || null;
  const discName = discPct > 0 ? discOpt.text.split('(')[0].trim() : null;
  const discAmt  = subtotal * (discPct / 100);
  const total    = subtotal - discAmt;

  const orderPayload = {
    order_type:      'walk_in',
    quantity,
    total,
    ref_no:          refNo || null,
    payment_method:  selectedPayment,
    branch_id:       branchId,
    cart_items:      orderItems.map(i => ({
      product_id:       i.product_id,
      quantity:         i.quantity,
      price:            i.price,
      selected_options: i.selected_options || {},
    })),
    customer_name:   document.getElementById('posCustomer').value.trim(),
    discount_id:     discId,
    discount_name:   discName,
    discount_pct:    discPct || null,
    discount_amount: discAmt || null,
  };

  // Snapshot receipt data BEFORE clearing the order (shared by both the
  // online and offline-queued paths below).
  const receiptItems    = [...orderItems];
  const receiptReceived = parseFloat(document.getElementById('posCashReceived').value) || 0;
  const receiptPayment  = selectedPayment;
  const receiptRefNo    = document.getElementById('posGcashRef').value;
  const receiptCustomer = document.getElementById('posCustomer')?.value?.trim() || '';
  const receiptDiscount = { id: discId, name: discName, pct: discPct, amount: discAmt };

  // ── Offline: queue the sale locally instead of hitting the server ──
  if (!posIsOnline) {
    try {
      await addPendingOrder({
        ...orderPayload,
        is_offline_sync:    true,
        client_offline_id: genOfflineId(),
        queued_at:          Date.now(),
      });
      applyOfflineStockDeduction(orderPayload.cart_items, branchId);
      await updateOfflinePendingBadge();
      setButtonLoading(processBtn, false);
      clearOrder();
      renderPosProducts(posProducts); // reflect optimistic stock deduction
      renderInvProducts(invProducts);
      showToast('Offline — sale saved, will sync once reconnected.');
      showReceipt({ order_id: 'OFFLINE-' + Date.now(), total }, receiptItems, receiptReceived, receiptPayment, receiptRefNo, receiptCustomer, receiptDiscount);
    } catch (e) {
      setButtonLoading(processBtn, false);
      showToast('Could not save offline sale on this device.', 'error');
    }
    return;
  }

  try {
    const res = await fetch('/api/staff/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });

    const data = await res.json();
    if (res.ok) {
      setButtonLoading(processBtn, false);
      clearOrder();
      invalidateSection('pos'); loadPosProducts();
      loadPosDiscounts();
      invalidateSection('orders'); loadOrders();
      invalidateSection('summary'); loadSummary();
      showToast('Order processed successfully!');
      showReceipt(data, receiptItems, receiptReceived, receiptPayment, receiptRefNo, receiptCustomer, receiptDiscount);
    } else {
      setButtonLoading(processBtn, false);
      showToast(data.error || 'Failed to process order.', 'error');
    }
  } catch (e) {
    // The 15s connectivity poll hasn't caught up yet — the connection just
    // dropped mid-click, so fall back to the offline queue instead of
    // losing the sale.
    try {
      await addPendingOrder({
        ...orderPayload,
        is_offline_sync:    true,
        client_offline_id: genOfflineId(),
        queued_at:          Date.now(),
      });
      applyOfflineStockDeduction(orderPayload.cart_items, branchId);
      posIsOnline = false;
      await updateOfflinePendingBadge();
      setButtonLoading(processBtn, false);
      clearOrder();
      renderPosProducts(posProducts);
      renderInvProducts(invProducts);
      showToast('Connection lost — sale saved offline, will sync once reconnected.');
      showReceipt({ order_id: 'OFFLINE-' + Date.now(), total }, receiptItems, receiptReceived, receiptPayment, receiptRefNo, receiptCustomer, receiptDiscount);
    } catch (e2) {
      setButtonLoading(processBtn, false);
      showToast('Error processing order.', 'error');
    }
  }
}

// ─── Receipt ──────────────────────────────────────────
function showReceipt(data, items, received, payment, refNo, customerName = '', orderDiscount = {}) {
  // Use passed parameters (captured before clearOrder)
  items    = items    || orderItems;
  received = received !== undefined ? received : parseFloat(document.getElementById('posCashReceived').value) || 0;
  payment  = payment  || selectedPayment;
  refNo    = refNo    || document.getElementById('posGcashRef').value;

  const subtotal    = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const prodSavings = items.reduce((s, i) => {
    if (i.original_price && i.original_price > i.price) return s + (i.original_price - i.price) * i.quantity;
    return s;
  }, 0);
  const orderDiscAmt = orderDiscount?.amount || 0;
  const total        = Number(data.total) || (subtotal - orderDiscAmt);
  const change       = received - total;
  const now       = new Date();

  // VAT Inclusive (12%) breakdown
  const VAT_RATE  = 0.12;
  const vatAmount = total * VAT_RATE;
  const baseAmt   = total - vatAmount;

  // Get staff and customer name for receipt
  const staffFullName  = (window.staffFname || '') + ' ' + (window.staffLname || '');
  const customerInput  = customerName || '';

  // Get branch name for receipt
  const branchId   = staffBranchId || document.getElementById('posBranch').value;
  const branchName = staffBranchName || allBranches.find(b => b.branch_id === branchId)?.branch_name || '';

  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt-header">
      <strong>Triple E & Fiel Collince</strong><br>
      <span>General Merchandise</span><br>
      ${branchName ? `<span>${branchName} Branch</span><br>` : ''}
      <span>Koronadal City, South Cotabato</span><br>
      <span style="font-size:11px;color:var(--text-muted);">${now.toLocaleString('en-PH')}</span>
    </div>
    ${String(data.order_id || '').startsWith('OFFLINE-') ? `
    <div style="text-align:center;background:#fef3c7;color:#92400e;border:1px solid #fbbf24;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;margin-bottom:6px;">
      ⚠ OFFLINE SALE — PENDING SYNC
    </div>` : ''}
    <hr class="receipt-divider"/>
    <div style="margin-bottom:0.5rem;font-size:11px;">
      <div class="receipt-row">
        <span>Cashier</span>
        <span>${staffFullName.trim() || '—'}</span>
      </div>
      ${customerInput ? `<div class="receipt-row"><span>Customer</span><span>${customerInput}</span></div>` : '<div class="receipt-row"><span>Customer</span><span>Walk-in</span></div>'}
    </div>
    <hr class="receipt-divider"/>
    <div style="margin-bottom:0.5rem;">
      ${items.map(i => {
        const hasDiscount = i.original_price && i.original_price > i.price;
        const origSubtotal = (i.original_price || i.price) * i.quantity;
        const discSubtotal = i.price * i.quantity;
        const discAmt      = origSubtotal - discSubtotal;
        return `
        <div class="receipt-row">
          <span>${i.name} x${i.quantity}</span>
          <span>${hasDiscount
            ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:10px;margin-right:4px;">${peso(origSubtotal)}</span>${peso(discSubtotal)}`
            : peso(discSubtotal)
          }</span>
        </div>
        ${hasDiscount ? `
        <div class="receipt-row" style="font-size:10px;color:var(--g-400);padding-left:8px;">
          <span>${i.discount_name || 'Discount'} (−${i.discount_pct || 0}%)</span>
          <span>−${peso(discAmt)}</span>
        </div>` : ''}`;
      }).join('')}
    </div>
    <hr class="receipt-divider"/>
    <div class="receipt-row">
      <span>Subtotal</span>
      <span>${peso(subtotal)}</span>
    </div>
    ${prodSavings > 0 ? `
    <div class="receipt-row" style="color:var(--g-400);font-size:11px;">
      <span>Product Savings</span>
      <span>−${peso(prodSavings)}</span>
    </div>` : ''}
    ${orderDiscAmt > 0 ? `
    <div class="receipt-row" style="color:var(--g-400);font-size:11px;">
      <span>${orderDiscount.name || 'Order Discount'} (${orderDiscount.pct}%)</span>
      <span>−${peso(orderDiscAmt)}</span>
    </div>` : ''}
    <hr class="receipt-divider"/>
    <div class="receipt-row">
      <span>VATable Sales</span>
      <span>${peso(baseAmt)}</span>
    </div>
    <div class="receipt-row">
      <span>VAT Amount (12%)</span>
      <span>${peso(vatAmount)}</span>
    </div>
    <hr class="receipt-divider"/>
    <div class="receipt-row receipt-total">
      <span>Total Sales (VAT Inc.)</span>
      <span>${peso(total)}</span>
    </div>
    ${payment === 'walk_in_cash' ? `
      <div class="receipt-row">
        <span>Cash Received</span>
        <span>${peso(received)}</span>
      </div>
      <div class="receipt-row">
        <span>Change</span>
        <span>${peso(Math.max(change, 0))}</span>
      </div>` : ''}
    ${payment === 'gcash' ? `
      <div class="receipt-row">
        <span>GCash Ref</span>
        <span>${refNo}</span>
      </div>` : ''}
    <hr class="receipt-divider"/>
    <div class="receipt-footer">
      Order ID: ${shortId(data.order_id)}<br>
      Payment: ${payment.replace(/_/g, ' ').toUpperCase()}<br>
      Thank you for shopping!
    </div>`;

  document.getElementById('receiptModalOverlay').style.display = 'block';
  document.getElementById('receiptModal').style.display = 'block';
}

function closeReceiptModal() {
  document.getElementById('receiptModalOverlay').style.display = 'none';
  document.getElementById('receiptModal').style.display = 'none';
  clearOrder();
}

function printReceipt() {
  const content = document.getElementById('receiptContent').innerHTML;
  const win     = window.open('', '_blank', 'width=400,height=600');
  win.document.write(`
    <html><head><title>Receipt</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; }
      .receipt-row { display: flex; justify-content: space-between; }
      hr { border: none; border-top: 1px dashed #ccc; margin: 6px 0; }
      .receipt-header { text-align: center; margin-bottom: 10px; }
      .receipt-total { font-weight: bold; font-size: 14px; }
      .receipt-footer { text-align: center; margin-top: 10px; color: #666; }
    </style>
    </head><body>${content}</body></html>`);
  win.document.close();
  win.print();
}

// ══════════════════════════════════════════════════════
// INVENTORY
// ══════════════════════════════════════════════════════

function getStaffMovementType(i) {
  const note = (i.note || '').toLowerCase();
  const qty  = Number(i.quantity_added);
  // Checked first — a cancelled order's note also contains "order #", which
  // would otherwise be misread as a Sale below.
  if (note.includes('[cancelled]')) return 'cancelled';
  if (note.includes('sale') || note.includes('order #')) return 'sale';
  if (note.includes('transfer') || (i.from_branch_id && i.to_branch_id)) return 'transfer';
  if (note.includes('[loss]') || note.includes('[damaged]') || note.includes('adjustment')) return 'adjustment';
  if (qty > 0) return 'restock';
  if (qty < 0) return 'deduction';
  return 'other';
}

function filterStaffHistoryType(val) {
  staffHistoryTypeFilterVal = val;
  staffHistoryPage = 1;
  renderInvHistory(allInvHistory);
}
window.filterStaffHistoryType = filterStaffHistoryType;

function renderInvHistory(data) {
  // Only update master when no filters are active (called from loadInventory)
  if (!staffHistoryTypeFilterVal && !historySearchVal) allInvHistory = data;
  const filteredHist = staffHistoryTypeFilterVal
    ? data.filter(i => getStaffMovementType(i) === staffHistoryTypeFilterVal)
    : data;
  const paged = paginate(filteredHist, staffHistoryPage);
  document.getElementById('invHistoryBody').innerHTML = paged.length
    ? paged.map(i => `
          <tr>
            <td>
              ${i.product?.product_name || '—'}
              ${i.variant_options && Object.keys(i.variant_options).length > 0
                ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + Object.entries(i.variant_options).map(function(e){return e[0]+': '+e[1];}).join(', ') + '</div>'
                : ''}
            </td>
            <td><strong style="color:${Number(i.quantity_added) >= 0 ? 'var(--g-400)' : '#ef4444'};">
              ${Number(i.quantity_added) >= 0 ? '+' : ''}${i.quantity_added}
            </strong></td>
            <td>${i.quantity_before}</td>
            <td>${i.quantity_after}</td>
            <td>${i.from_branch?.branch_name || '—'}</td>
            <td>${i.to_branch?.branch_name   || '—'}</td>
            <td>${new Date(i.date).toLocaleDateString('en-PH', { month:'long', day:'numeric', year:'numeric' })}</td>
            <td style="max-width:200px;font-size:12px;">
              ${(() => {
                const note = (i.note || '').toLowerCase();
                const qty  = Number(i.quantity_added);
                if (note.includes('[cancelled]'))
                  return '<span style="background:rgba(239,68,68,0.1);color:#ef4444;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700;margin-right:4px;">✕ Cancelled</span>';
                if (note.includes('sale') || note.includes('order #'))
                  return '<span style="background:rgba(245,158,11,0.1);color:#f59e0b;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700;margin-right:4px;">🛒 Sale</span>';
                if (note.includes('po received') || note.includes('restock') || qty > 0)
                  return '<span style="background:rgba(22,163,74,0.1);color:var(--g-400);border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700;margin-right:4px;">↑ Restock</span>';
                return '';
              })()}
              ${i.note || '—'}
            </td>
          </tr>`).join('')
    : '<tr><td colspan="8" class="table-empty">No inventory records yet</td></tr>';
  renderPager('staffHistoryPagination', filteredHist.length, staffHistoryPage, 'changeStaffHistoryPage');
}

async function loadInventory() {
  // ── Skeleton ──
  skStats(['invTotalProducts','invLowStock','invCriticalStock','invOutOfStock','invRecentRestocks']);
  skTable('invProductsBody', ['sk-cell-sm','sk-cell-full','sk-cell-md','sk-cell-sm',
                              'sk-cell-sm','sk-cell-sm','sk-cell-sm','sk-cell-sm'], 8);
  skTable('invHistoryBody',  ['sk-cell-sm','sk-cell-full','sk-cell-md','sk-cell-sm',
                              'sk-cell-sm','sk-cell-sm','sk-cell-sm','sk-cell-sm','sk-cell-full'], 6);
  // ─────────────
  // Save expanded variant rows before DOM rebuild
  const expandedRows = saveStaffExpandedRows();

  try {
    // Sequential requests to avoid WinError 10035
    const prodRes        = await fetch('/api/products');
    const allInvProdsRaw = await prodRes.json();
    const allInvProds    = Array.isArray(allInvProdsRaw) ? allInvProdsRaw : [];
    // Filter to this branch only
    invProducts = allInvProds.filter(p => {
      if (!staffBranchId) return true;
      const bs = (p.branch_stock || []).find(b => b.branch_id === staffBranchId);
      return bs !== undefined;
    });
    const invRes    = await fetch('/api/staff/inventory');
    const invDataRaw = await invRes.json();
    const invData   = Array.isArray(invDataRaw) ? invDataRaw : [];

    // Stats — two-tier: critical (≤5) and low (6–10), using branch stock AND
    // variant stock (see staffStockInfo below) so a single low/critical/
    // out-of-stock variant trips the alert even when the branch's aggregate
    // total still looks healthy.
    const criticalCount = invProducts.filter(p => staffStockInfo(p).level === 'critical').length;
    const lowCount      = invProducts.filter(p => staffStockInfo(p).level === 'low').length;
    const outCount      = invProducts.filter(p => staffStockInfo(p).level === 'out').length;
    document.getElementById('invTotalProducts').textContent = invProducts.length;
    document.getElementById('invLowStock').textContent      = lowCount;
    document.getElementById('invOutOfStock').textContent    = outCount;
    const critEl = document.getElementById('invCriticalStock');
    if (critEl) critEl.textContent = criticalCount;

    // Stock alert banner — red for critical, amber for low stock only
    const banner    = document.getElementById('staffLowStockBanner');
    const bannerTxt = document.getElementById('staffLowStockText');
    const totalAlert = criticalCount + lowCount;
    if (banner && totalAlert > 0) {
      banner.style.display = 'flex';
      if (criticalCount > 0) {
        banner.style.background = 'rgba(239,68,68,0.1)';
        banner.style.border     = '1px solid rgba(239,68,68,0.3)';
        bannerTxt.style.color   = '#ef4444';
        banner.querySelector('svg').style.stroke = '#ef4444';
        bannerTxt.textContent = `🔴 ${criticalCount} product${criticalCount > 1 ? 's are' : ' is'} at critical stock level (≤5 units)!`
          + (lowCount > 0 ? ` · ${lowCount} more running low.` : '');
      } else {
        banner.style.background = 'rgba(245,158,11,0.1)';
        banner.style.border     = '1px solid rgba(245,158,11,0.3)';
        bannerTxt.style.color   = '#f59e0b';
        banner.querySelector('svg').style.stroke = '#f59e0b';
        bannerTxt.textContent = `🟡 ${lowCount} product${lowCount > 1 ? 's are' : ' is'} running low on stock (6–10 units).`;
      }
    } else if (banner) {
      banner.style.display = 'none';
    }

    // Update inventory nav badge (critical + low + out of stock)
    const invBadge = document.getElementById('invLowStockBadge');
    if (invBadge) {
      const badgeCount = criticalCount + lowCount + outCount;
      invBadge.textContent   = badgeCount > 99 ? '99+' : badgeCount;
      invBadge.style.display = badgeCount > 0 ? 'inline-block' : 'none';
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    document.getElementById('invRecentRestocks').textContent = invData.filter(i => new Date(i.date) >= oneWeekAgo).length;

    applyStaffStockFilters();

    // History — read nested branch names from FK join
    renderInvHistory(invData);

    // Restore expanded variant rows after DOM rebuild
    restoreStaffExpandedRows(expandedRows);

  } catch (e) { console.error('Inventory error:', e); }
}


// ─── Variant Stock Expandable Rows (Staff) ─────────────
let expandedStaffProductIds = new Set();

async function toggleStaffVariantRow(productId, btnEl) {
  const expandRow = document.getElementById('staffVarRow_' + productId);
  if (!expandRow) return;

  if (expandedStaffProductIds.has(productId)) {
    expandedStaffProductIds.delete(productId);
    expandRow.style.display = 'none';
    if (btnEl) btnEl.textContent = '▶';
    return;
  }

  expandedStaffProductIds.add(productId);
  if (btnEl) btnEl.textContent = '▼';
  expandRow.style.display = '';
  expandRow.querySelector('.staff-variant-content').innerHTML =
    '<tr><td colspan="6" style="padding:8px 16px;font-size:12px;color:var(--text-muted);">Loading variants...</td></tr>';

  try {
    var url = '/api/variant-stock/' + productId;
    if (staffBranchId) url += '?branch_id=' + staffBranchId;
    const res  = await fetch(url);
    const data = await res.json();

    if (!data.length) {
      expandRow.querySelector('.staff-variant-content').innerHTML =
        '<tr><td colspan="6" style="padding:8px 16px;font-size:12px;color:var(--text-muted);">No variant stock recorded yet.</td></tr>';
      return;
    }

    var chips = data.map(function(vs) {
      var opts  = Object.entries(vs.options || {}).map(function(e) { return e[0] + ': ' + e[1]; }).join(', ');
      var qty   = vs.quantity || 0;
      var color = qty === 0 ? '#ef4444' : qty <= 5 ? '#f59e0b' : 'var(--g-400)';
      var bg    = qty === 0 ? 'rgba(239,68,68,0.05)' : qty <= 5 ? 'rgba(245,158,11,0.05)' : 'rgba(22,163,74,0.05)';
      return '<div style="padding:6px 10px;border-radius:8px;border:1.5px solid ' + color + ';background:' + bg + ';font-size:12px;display:inline-block;margin:2px;">'
        + '<span style="color:var(--text-primary);font-weight:500;">' + opts + '</span>'
        + '<span style="margin-left:8px;font-weight:700;color:' + color + ';">' + qty + ' units</span>'
        + (qty === 0 ? ' ⚠️' : '')
        + '</div>';
    }).join('');

    expandRow.querySelector('.staff-variant-content').innerHTML =
      '<tr><td colspan="6" style="padding:8px 16px;">' + chips + '</td></tr>';
  } catch (e) {
    expandRow.querySelector('.staff-variant-content').innerHTML =
      '<tr><td colspan="6" style="padding:8px 16px;color:#ef4444;font-size:12px;">Failed to load variant stock.</td></tr>';
  }
}
window.toggleStaffVariantRow = toggleStaffVariantRow;

function renderInvProducts(products) {
  const paged = paginate(products, staffInvPage);
  document.getElementById('invProductsBody').innerHTML = paged.length
    ? paged.map(p => {
        const { qty, level, variantDriven } = staffStockInfo(p);
        const levelColor = level === 'out' ? '#ef4444' : (level === 'critical' || level === 'low') ? '#eab308' : 'var(--g-400)';
        const variantNote = variantDriven ? ' <span style="font-size:10px;opacity:0.75;">(variant)</span>' : '';
        return `
        <tr>
          <td>
            ${p.image_url
              ? `<img src="${p.image_urls?.length ? p.image_urls[0] : p.image_url}" class="product-img-cell" style="width:32px;height:32px;" alt="${p.product_name}"/>`
              : `<div class="product-img-placeholder" style="width:32px;height:32px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`
            }
          </td>
          <td style='cursor:pointer;' onclick="toggleStaffVariantRow('${p.product_id}', this.querySelector('.staff-expand-btn'))"><span class='staff-expand-btn' style='margin-right:6px;font-size:11px;color:var(--text-muted);'>▶</span><strong>${p.product_name}</strong></td>
          <td>${p.brand || '—'}</td>
          <td>${p.category}</td>
          <td>${peso(p.price)}</td>
          <td>
            <span style="color:${levelColor};font-weight:600;">
              ${qty}
            </span>${variantNote}
          </td>
          <td>${level === 'out'
            ? '<span class="badge badge--red">Out of Stock</span>'
            : level === 'critical'
              ? '<span class="badge badge--red">Critical Level</span>'
              : level === 'low'
                ? '<span class="badge badge--yellow">Low Stock</span>'
                : '<span class="badge badge--green">In Stock</span>'
          }</td>
          <td>
            <button class="btn-icon" onclick="event.stopPropagation();viewStaffProductDetails('${p.product_id}')" title="View Product Details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        </tr>
        <tr id="staffVarRow_${p.product_id}" style="display:none;background:var(--surface);">
          <td colspan="8" style="padding:0;">
            <div class="staff-variant-content" style="padding:8px 16px;"></div>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="8" class="table-empty">No products found</td></tr>';
  renderPager('staffInvPagination', products.length, staffInvPage, 'changeStaffInvPage');
}

/* ── Read-only Product Details modal (Staff) ───────────── */
function viewStaffProductDetails(productId) {
  const p = invProducts.find(pr => pr.product_id === productId);
  if (!p) return;

  const { qty, level, variantDriven } = staffStockInfo(p);
  const stockColor = level === 'out' ? '#ef4444' : (level === 'critical' || level === 'low') ? '#eab308' : 'var(--g-400)';
  const imgHtml = p.image_url
    ? `<img src="${p.image_urls?.length ? p.image_urls[0] : p.image_url}" style="width:80px;height:80px;border-radius:10px;object-fit:cover;background:var(--surface-2);flex-shrink:0;" alt="${p.product_name}"/>`
    : `<div class="product-img-placeholder" style="width:80px;height:80px;border-radius:10px;flex-shrink:0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;

  const groups = p.option_groups || [];
  const variantsHtml = groups.length
    ? `<div style="margin-top:12px;">
         <label class="form-label" style="font-size:11px;">Available Variants</label>
         <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
           ${groups.map(g => `
             <div style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-size:12px;">
               <strong>${g.label}:</strong> ${(g.choices || []).join(', ') || '—'}
             </div>`).join('')}
         </div>
       </div>`
    : '';

  showGenericModal(`
    <div style="padding:1rem 1rem 0.75rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
      <strong style="font-size:15px;">Product Details</strong>
      <button onclick="closeGenericModal()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:20px;line-height:1;">&times;</button>
    </div>
    <div style="padding:1rem;">
      <div style="display:flex;gap:14px;margin-bottom:14px;">
        ${imgHtml}
        <div style="min-width:0;">
          <div style="font-size:16px;font-weight:700;color:var(--text);">${p.product_name}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${p.brand || '—'} • ${p.category || '—'}</div>
          <div style="margin-top:6px;">${badge(p.status)}</div>
        </div>
      </div>
      <div class="form-row-2" style="margin-bottom:10px;">
        <div>
          <label class="form-label" style="font-size:11px;">Price</label>
          <div style="font-weight:700;font-size:14px;color:var(--text);">${peso(p.price)}</div>
        </div>
        <div>
          <label class="form-label" style="font-size:11px;">Stock (this branch)</label>
          <div style="font-weight:700;font-size:14px;color:${stockColor};">${qty} units${variantDriven ? ' <span style="font-size:11px;font-weight:500;opacity:0.75;">(a variant is low)</span>' : ''}</div>
        </div>
      </div>
      ${p.description ? `
        <div style="margin-bottom:10px;">
          <label class="form-label" style="font-size:11px;">Description</label>
          <div style="font-size:13px;color:var(--text-muted);margin-top:2px;">${p.description}</div>
        </div>` : ''}
      ${variantsHtml}
    </div>
  `);
}
window.viewStaffProductDetails = viewStaffProductDetails;

function filterInventorySearch(q) {
  const filtered = invProducts.filter(p =>
    p.product_name.toLowerCase().includes(q.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(q.toLowerCase()) ||
    p.category.toLowerCase().includes(q.toLowerCase())
  );
  renderInvProducts(filtered);
}

function filterHistorySearch(q) {
  historySearchVal = (q || '').toLowerCase().trim();
  staffHistoryPage = 1;
  const base = historySearchVal
    ? allInvHistory.filter(i =>
        (i.product?.product_name || '').toLowerCase().includes(historySearchVal) ||
        (i.note || '').toLowerCase().includes(historySearchVal)
      )
    : allInvHistory;
  renderInvHistory(base);
}
window.filterHistorySearch = filterHistorySearch;

function staffBQty(p) {
  const bs = (p.branch_stock || []).find(b => b.branch_id === staffBranchId);
  return bs ? Number(bs.quantity) : Number(p.quantity || 0);
}

// Variant-aware stock check for this staff member's branch. Returns the raw
// branch quantity (for display) plus the WORST alert level found across
// either the branch's aggregate total or any individual variant_stock row
// for that branch — so a single low/critical/out-of-stock variant surfaces
// the alert even when the aggregate total still looks fine. `variantDriven`
// flags that case so the UI can note it instead of showing a confusing
// "low stock" badge next to a healthy-looking number.
function staffStockInfo(p) {
  const qty = staffBQty(p);
  const vsRows = (p.variant_stock || []).filter(v => !staffBranchId || v.branch_id === staffBranchId);
  const levelOf = q => {
    q = Number(q);
    if (q === 0) return 'out';
    if (q > 0 && q <= 5) return 'critical';
    if (q > 0 && q <= 10) return 'low';
    return 'ok';
  };
  const rank = { out: 3, critical: 2, low: 1, ok: 0 };

  let level = levelOf(qty);
  let variantDriven = false;
  vsRows.forEach(v => {
    const l = levelOf(v.quantity);
    if (rank[l] > rank[level]) { level = l; variantDriven = true; }
  });

  return { qty, level, variantDriven };
}

// Applies the stock-level filter AND the search filter TOGETHER, so picking
// a level and then searching (or vice versa) no longer wipes out the other.
function applyStaffStockFilters() {
  let filtered = invProducts;

  if (staffStockLevelVal === 'critical_stock') {
    filtered = filtered.filter(p => staffStockInfo(p).level === 'critical');
  } else if (staffStockLevelVal === 'low_stock') {
    // Show both tiers — critical first, then low
    const critical = filtered.filter(p => staffStockInfo(p).level === 'critical');
    const low      = filtered.filter(p => staffStockInfo(p).level === 'low');
    filtered = [...critical, ...low];
  } else if (staffStockLevelVal === 'out_of_stock') {
    filtered = filtered.filter(p => staffStockInfo(p).level === 'out');
  }

  if (staffStockSearchVal) {
    filtered = filtered.filter(p => p.product_name.toLowerCase().includes(staffStockSearchVal));
  }

  renderInvProducts(filtered);
}

function filterStaffStockSearch(q) {
  staffStockSearchVal = (q || '').toLowerCase().trim();
  staffInvPage = 1;
  applyStaffStockFilters();
}
window.filterStaffStockSearch = filterStaffStockSearch;

function filterStaffInventoryType(type) {
  staffStockLevelVal = type || '';
  staffInvPage = 1;
  applyStaffStockFilters();
}
window.filterStaffInventoryType = filterStaffInventoryType;

function updateOrdersBadge(orders) {
  const badge   = document.getElementById('ordersBadge');
  if (!badge) return;
  // Count pending online orders from customers
  const pending = orders.filter(o =>
    o.status === 'pending' && o.order_type === 'online'
  ).length;
  if (pending > 0) {
    badge.textContent    = pending > 99 ? '99+' : pending;
    badge.style.display  = 'inline-block';
  } else {
    badge.style.display  = 'none';
  }
}

// Orders only move forward one step at a time: pending -> processing -> out_for_delivery -> completed.
// Completed/cancelled orders are terminal and the dropdown locks.
const ORDER_STATUS_FLOW   = { pending: 'processing', processing: 'out_for_delivery', out_for_delivery: 'completed' };
const ORDER_STATUS_LABELS = { pending: 'Pending', processing: 'Processing', out_for_delivery: 'Out for Delivery', completed: 'Completed', cancelled: 'Cancelled' };

// Orders list hierarchy — active orders (pending/processing/out for delivery)
// always float above Completed/Cancelled, and within the same tier the
// order that's been waiting longest (oldest created_at) shows first (FIFO),
// so staff/admin naturally work the oldest pending order first.
const ORDER_STATUS_PRIORITY = { pending: 1, processing: 2, out_for_delivery: 3, completed: 4, cancelled: 4 };
const ORDER_DONE_TIER = 4; // completed/cancelled
function sortOrdersHierarchy(orders) {
  return [...orders].sort((a, b) => {
    const pa = ORDER_STATUS_PRIORITY[a.status] ?? 5;
    const pb = ORDER_STATUS_PRIORITY[b.status] ?? 5;
    if (pa !== pb) return pa - pb;
    const da = new Date(a.created_at || a.date || 0).getTime();
    const db = new Date(b.created_at || b.date || 0).getTime();
    // Active tiers (pending/processing/out for delivery): oldest first (FIFO).
    // Done tier (completed/cancelled): newest first, so the oldest sinks to the very bottom.
    return pa === ORDER_DONE_TIER ? db - da : da - db;
  });
}

function orderStatusSelectHtml(orderId, status, updateFnName) {
  const locked = status === 'completed' || status === 'cancelled';
  const next   = ORDER_STATUS_FLOW[status];
  const options = `<option value="${status}" selected>${ORDER_STATUS_LABELS[status] || status}</option>`
    + (next ? `<option value="${next}">${ORDER_STATUS_LABELS[next]}</option>` : '');
  return `<select class="filter-select" style="font-size:11px;padding:4px 8px;" ${locked ? 'disabled' : ''}
      onchange="${updateFnName}('${orderId}', this.value)">${options}</select>`;
}

function renderStaffOrders(orders) {
  const paged = paginate(orders, staffOrdersPage);
  document.getElementById('staffOrdersBody').innerHTML = paged.length
    ? paged.map(o => `
        <tr>
          <td><code style="font-family:'JetBrains Mono',monospace;font-size:11px;">${shortId(o.order_id)}</code></td>
          <td>${o.customer ? `${o.customer.fname} ${o.customer.lname}` : 'Walk-in'}</td>
          <td>${badge(o.order_type)}${offlineSyncTag(o)}</td>
          <td>${o.order_item?.length || 0} item(s)</td>
          <td>${peso(o.total)}</td>
          <td>${o.payment?.payment_method ? badge(o.payment.payment_method) : (Array.isArray(o.payment) && o.payment[0] ? badge(o.payment[0].payment_method) : '—')}</td>
          <td>${(() => {
            const raw = o.created_at || o.date || null;
            if (!raw) return '—';
            // Trim microseconds (Supabase returns 6 decimal places; JS only handles 3)
            const normalized = raw.toString().replace(/(\.\d{3})\d+/, '$1').replace(' ', 'T');
            const utcStr = normalized.endsWith('Z') || normalized.includes('+') ? normalized : normalized + 'Z';
            const d = new Date(new Date(utcStr).getTime() + 8 * 60 * 60 * 1000);
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const date = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
            const h = d.getUTCHours(), m = d.getUTCMinutes();
            const time = `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`;
            return `<span style="display:block;font-size:12px;">${date}</span><span style="display:block;font-size:11px;color:var(--text-muted);">${time}</span>`;
          })()}</td>
          <td>${badge(o.status)}</td>
          <td style="display:flex;gap:6px;align-items:center;">
            ${orderStatusSelectHtml(o.order_id, o.status, 'updateOrderStatus')}
            <button class="btn-icon" onclick="viewStaffOrderItems(${JSON.stringify(o).replace(/"/g, '&quot;')})" title="View Items">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="9" class="table-empty">No orders yet</td></tr>';
  renderPager('staffOrdersPagination', orders.length, staffOrdersPage, 'changeStaffOrdersPage');
}

// ─── View Staff Order Items Modal ─────────────────────

// ─── Generic Modal ────────────────────────────────────
function showGenericModal(html) {
  const overlay = document.getElementById('genericModalOverlay');
  const modal   = document.getElementById('genericModal');
  const cont    = document.getElementById('genericModalContent');
  if (!overlay || !modal || !cont) return;
  cont.innerHTML        = html;
  overlay.style.display = 'block';
  modal.style.display   = 'block';
  document.body.style.overflow = 'hidden';
}

function closeGenericModal() {
  const overlay = document.getElementById('genericModalOverlay');
  const modal   = document.getElementById('genericModal');
  if (overlay) overlay.style.display = 'none';
  if (modal)   modal.style.display   = 'none';
  document.body.style.overflow = '';
}

function viewStaffOrderItems(order) {
  const items    = order.order_item || [];
  const customer = order.customer ? `${order.customer.fname} ${order.customer.lname}` : 'Walk-in';
  const branchObj = Array.isArray(order.branch) ? order.branch[0] : order.branch;
  const branch   = branchObj?.branch_name || order.branch_name || staffBranchName || '—';

  // Parse delivery address
  const addrParts  = (order.address || '').split('|');
  const addrString = addrParts.length > 1
    ? [addrParts[0], addrParts[1], addrParts[2], addrParts[3]].filter(Boolean).join(', ')
    : order.address || '';
  const addrNote   = order.address_note || '';

  const itemsHtml = items.length
    ? items.map(i => {
        const opts = i.selected_options && Object.keys(i.selected_options).length > 0
          ? Object.entries(i.selected_options).map(([k,v]) =>
              '<span style="background:rgba(22,163,74,0.1);color:#16a34a;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600;">' + k + ': ' + v + '</span>'
            ).join(' ')
          : '';
        const imgUrl = i.product?.image_url;
        const imgHtml = imgUrl
          ? '<img src="' + imgUrl + '" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;" alt="' + (i.product?.product_name || '') + '"/>'
          : '<div style="width:44px;height:44px;border-radius:8px;background:var(--surface-2);flex-shrink:0;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>';
        const optsHtml = opts
          ? '<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;">' + opts + '</div>'
          : '';
        return '<div style="padding:10px 0;border-bottom:1px solid var(--border);">'
          + '<div style="display:flex;gap:10px;align-items:flex-start;">'
          + imgHtml
          + '<div style="flex:1;">'
          + '<div style="font-size:13px;font-weight:600;">' + (i.product?.product_name || '—') + '</div>'
          + optsHtml
          + '</div>'
          + '<div style="text-align:right;flex-shrink:0;">'
          + '<div style="font-size:13px;font-weight:700;">₱' + Number(i.price * i.qty).toFixed(2) + '</div>'
          + '<div style="font-size:11px;color:var(--text-muted);">x' + i.qty + ' @ ₱' + Number(i.price).toFixed(2) + '</div>'
          + '</div></div></div>';
      }).join('')
    : '<p style="color:var(--text-muted);text-align:center;">No items</p>';

  const shippingHtml = order.shipping_fee != null
    ? '<span style="margin-left:8px;color:var(--text-muted);">· Shipping: ' + (Number(order.shipping_fee) === 0 ? 'FREE' : peso(order.shipping_fee)) + '</span>'
    : '';

  const addrHtml = (order.order_type === 'online')
    ? '<div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:10px 12px;margin-bottom:1rem;font-size:12px;">'
      + '<div style="color:var(--text-muted);margin-bottom:2px;">Delivery Address</div>'
      + '<strong>' + (addrString && addrString.trim() ? addrString : 'No address provided') + '</strong>'
      + shippingHtml
      + '</div>'
    : '';

  showGenericModal(
    '<div style="padding:1.5rem;">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;">'
    + '<div><h3 style="margin:0;font-size:16px;">Order Details</h3>'
    + '<p style="margin:4px 0 0;font-size:12px;color:var(--text-muted);">#' + shortId(order.order_id) + '</p></div>'
    + '<button onclick="closeGenericModal()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:18px;">✕</button>'
    + '</div>'
    + '<div style="background:var(--surface-2);border-radius:8px;padding:12px;margin-bottom:1rem;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">'
    + '<div><span style="color:var(--text-muted);">Customer</span><br/><strong>' + customer + '</strong></div>'
    + '<div><span style="color:var(--text-muted);">Branch</span><br/><strong>' + branch + '</strong></div>'
    + '<div><span style="color:var(--text-muted);">Served By</span><br/><strong>' + ((() => { const s = Array.isArray(order.staff) ? order.staff[0] : order.staff; return s ? s.fname + ' ' + s.lname : '—'; })()) + '</strong></div>'
    + '<div><span style="color:var(--text-muted);">Type</span><br/>' + badge(order.order_type) + '</div>'
    + '<div><span style="color:var(--text-muted);">Status</span><br/>' + badge(order.status) + '</div>'
    + '</div>'
    + (order.payment && order.payment.payment_method === 'gcash'
      ? '<div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:8px;padding:10px 12px;margin-bottom:1rem;font-size:12px;"><div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:600;">GCash Payment Details</div>'
        + (order.payment.ref_no ? '<div style="margin-bottom:4px;">Ref No: <strong>' + order.payment.ref_no + '</strong></div>' : '')
        + (order.payment.sender_number ? '<div style="margin-bottom:4px;">Sender: <strong>' + order.payment.sender_number + '</strong></div>' : '')
        + (order.payment.receipt_image_url ? '<div><a href="' + order.payment.receipt_image_url + '" target="_blank" style="color:#3b82f6;font-size:12px;">View Receipt</a></div>' : '')
        + '</div>'
      : '')
    + addrHtml
    + '<div style="margin-bottom:0.5rem;font-size:12px;font-weight:600;color:var(--text-muted);">ITEMS ORDERED</div>'
    + itemsHtml
    + '<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">'
    + '<span style="font-weight:700;">Grand Total</span>'
    + '<span style="font-weight:700;color:#16a34a;font-size:16px;">₱' + Number(order.total).toFixed(2) + '</span>'
    + '</div></div>'
  );
}


async function loadOrders() {
  // ── Skeleton ──
  skTable('staffOrdersBody', ['sk-cell-sm','sk-cell-md','sk-cell-full','sk-cell-sm',
                              'sk-cell-sm','sk-cell-sm','sk-cell-sm','sk-cell-sm','sk-cell-sm'], 8);
  // ─────────────
  try {
    const res  = await fetch('/api/staff/orders?limit=50');
    const data = await res.json();
    // Sort newest first using created_at timestamp
    staffOrders = data.sort((a, b) => {
      const da = new Date(a.created_at || a.date || 0);
      const db = new Date(b.created_at || b.date || 0);
      return db - da;
    });
    populateStaffOrderYearFilter(staffOrders);
    populateStaffOrderDayOptions();
    applyStaffOrderFilters();
    updateOrdersBadge(staffOrders);
  } catch (e) { console.error('Orders error:', e); }
}

function updateOrdersBadge(orders) {
  const badge   = document.getElementById('ordersBadge');
  if (!badge) return;
  // Count pending online orders from customers
  const pending = orders.filter(o =>
    o.status === 'pending' && o.order_type === 'online'
  ).length;
  if (pending > 0) {
    badge.textContent    = pending > 99 ? '99+' : pending;
    badge.style.display  = 'inline-block';
  } else {
    badge.style.display  = 'none';
  }
}

function renderStaffOrders(orders) {
  const paged = paginate(orders, staffOrdersPage);
  document.getElementById('staffOrdersBody').innerHTML = paged.length
    ? paged.map(o => `
        <tr>
          <td><code style="font-family:'JetBrains Mono',monospace;font-size:11px;">${shortId(o.order_id)}</code></td>
          <td>${o.customer ? `${o.customer.fname} ${o.customer.lname}` : 'Walk-in'}</td>
          <td>${badge(o.order_type)}${offlineSyncTag(o)}</td>
          <td>${o.order_item?.length || 0} item(s)</td>
          <td>${peso(o.total)}</td>
          <td>${o.payment?.payment_method ? badge(o.payment.payment_method) : (Array.isArray(o.payment) && o.payment[0] ? badge(o.payment[0].payment_method) : '—')}</td>
          <td>${(() => {
            const raw = o.created_at || o.date || null;
            if (!raw) return '—';
            // Trim microseconds (Supabase returns 6 decimal places; JS only handles 3)
            const normalized = raw.toString().replace(/(\.\d{3})\d+/, '$1').replace(' ', 'T');
            const utcStr = normalized.endsWith('Z') || normalized.includes('+') ? normalized : normalized + 'Z';
            const d = new Date(new Date(utcStr).getTime() + 8 * 60 * 60 * 1000);
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const date = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
            const h = d.getUTCHours(), m = d.getUTCMinutes();
            const time = `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`;
            return `<span style="display:block;font-size:12px;">${date}</span><span style="display:block;font-size:11px;color:var(--text-muted);">${time}</span>`;
          })()}</td>
          <td>${badge(o.status)}</td>
          <td style="display:flex;gap:6px;align-items:center;">
            ${orderStatusSelectHtml(o.order_id, o.status, 'updateOrderStatus')}
            <button class="btn-icon" onclick="viewStaffOrderItems(${JSON.stringify(o).replace(/"/g, '&quot;')})" title="View Items">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="9" class="table-empty">No orders yet</td></tr>';
  renderPager('staffOrdersPagination', orders.length, staffOrdersPage, 'changeStaffOrdersPage');
}

// ─── View Staff Order Items Modal ─────────────────────

// ─── Generic Modal ────────────────────────────────────
function showGenericModal(html) {
  const overlay = document.getElementById('genericModalOverlay');
  const modal   = document.getElementById('genericModal');
  const cont    = document.getElementById('genericModalContent');
  if (!overlay || !modal || !cont) return;
  cont.innerHTML        = html;
  overlay.style.display = 'block';
  modal.style.display   = 'block';
  document.body.style.overflow = 'hidden';
}

function closeGenericModal() {
  const overlay = document.getElementById('genericModalOverlay');
  const modal   = document.getElementById('genericModal');
  if (overlay) overlay.style.display = 'none';
  if (modal)   modal.style.display   = 'none';
  document.body.style.overflow = '';
}

function viewStaffOrderItems(order) {
  const items    = order.order_item || [];
  const customer = order.customer ? `${order.customer.fname} ${order.customer.lname}` : 'Walk-in';
  const branchObj = Array.isArray(order.branch) ? order.branch[0] : order.branch;
  const branch   = branchObj?.branch_name || order.branch_name || staffBranchName || '—';

  // Parse delivery address
  const addrParts  = (order.address || '').split('|');
  const addrString = addrParts.length > 1
    ? [addrParts[0], addrParts[1], addrParts[2], addrParts[3]].filter(Boolean).join(', ')
    : order.address || '';
  const addrNote   = order.address_note || '';

  const itemsHtml = items.length
    ? items.map(i => {
        const opts = i.selected_options && Object.keys(i.selected_options).length > 0
          ? Object.entries(i.selected_options).map(([k,v]) =>
              '<span style="background:rgba(22,163,74,0.1);color:#16a34a;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600;">' + k + ': ' + v + '</span>'
            ).join(' ')
          : '';
        const imgUrl = i.product?.image_url;
        const imgHtml = imgUrl
          ? '<img src="' + imgUrl + '" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;" alt="' + (i.product?.product_name || '') + '"/>'
          : '<div style="width:44px;height:44px;border-radius:8px;background:var(--surface-2);flex-shrink:0;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>';
        const optsHtml = opts
          ? '<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;">' + opts + '</div>'
          : '';
        return '<div style="padding:10px 0;border-bottom:1px solid var(--border);">'
          + '<div style="display:flex;gap:10px;align-items:flex-start;">'
          + imgHtml
          + '<div style="flex:1;">'
          + '<div style="font-size:13px;font-weight:600;">' + (i.product?.product_name || '—') + '</div>'
          + optsHtml
          + '</div>'
          + '<div style="text-align:right;flex-shrink:0;">'
          + '<div style="font-size:13px;font-weight:700;">₱' + Number(i.price * i.qty).toFixed(2) + '</div>'
          + '<div style="font-size:11px;color:var(--text-muted);">x' + i.qty + ' @ ₱' + Number(i.price).toFixed(2) + '</div>'
          + '</div></div></div>';
      }).join('')
    : '<p style="color:var(--text-muted);text-align:center;">No items</p>';

  const shippingHtml = order.shipping_fee != null
    ? '<span style="margin-left:8px;color:var(--text-muted);">· Shipping: ' + (Number(order.shipping_fee) === 0 ? 'FREE' : peso(order.shipping_fee)) + '</span>'
    : '';

  const addrHtml = (order.order_type === 'online')
    ? '<div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:10px 12px;margin-bottom:1rem;font-size:12px;">'
      + '<div style="color:var(--text-muted);margin-bottom:2px;">Delivery Address</div>'
      + '<strong>' + (addrString && addrString.trim() ? addrString : 'No address provided') + '</strong>'
      + shippingHtml
      + '</div>'
    : '';

  showGenericModal(
    '<div style="padding:1.5rem;">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;">'
    + '<div><h3 style="margin:0;font-size:16px;">Order Details</h3>'
    + '<p style="margin:4px 0 0;font-size:12px;color:var(--text-muted);">#' + shortId(order.order_id) + '</p></div>'
    + '<button onclick="closeGenericModal()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:18px;">✕</button>'
    + '</div>'
    + '<div style="background:var(--surface-2);border-radius:8px;padding:12px;margin-bottom:1rem;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">'
    + '<div><span style="color:var(--text-muted);">Customer</span><br/><strong>' + customer + '</strong></div>'
    + '<div><span style="color:var(--text-muted);">Branch</span><br/><strong>' + branch + '</strong></div>'
    + '<div><span style="color:var(--text-muted);">Served By</span><br/><strong>' + ((() => { const s = Array.isArray(order.staff) ? order.staff[0] : order.staff; return s ? s.fname + ' ' + s.lname : '—'; })()) + '</strong></div>'
    + '<div><span style="color:var(--text-muted);">Type</span><br/>' + badge(order.order_type) + '</div>'
    + '<div><span style="color:var(--text-muted);">Status</span><br/>' + badge(order.status) + '</div>'
    + '</div>'
    + (order.payment && order.payment.payment_method === 'gcash'
      ? '<div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:8px;padding:10px 12px;margin-bottom:1rem;font-size:12px;"><div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:600;">GCash Payment Details</div>'
        + (order.payment.ref_no ? '<div style="margin-bottom:4px;">Ref No: <strong>' + order.payment.ref_no + '</strong></div>' : '')
        + (order.payment.sender_number ? '<div style="margin-bottom:4px;">Sender: <strong>' + order.payment.sender_number + '</strong></div>' : '')
        + (order.payment.receipt_image_url ? '<div><a href="' + order.payment.receipt_image_url + '" target="_blank" style="color:#3b82f6;font-size:12px;">View Receipt</a></div>' : '')
        + '</div>'
      : '')
    + addrHtml
    + '<div style="margin-bottom:0.5rem;font-size:12px;font-weight:600;color:var(--text-muted);">ITEMS ORDERED</div>'
    + itemsHtml
    + '<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">'
    + '<span style="font-weight:700;">Grand Total</span>'
    + '<span style="font-weight:700;color:#16a34a;font-size:16px;">₱' + Number(order.total).toFixed(2) + '</span>'
    + '</div></div>'
  );
}


let staffOrderTypeFilter   = '';
let staffOrderStatusFilter = '';
let staffOrderSearchText   = '';
let staffOrderYearFilter   = '';
let staffOrderMonthFilter  = '';
let staffOrderDayFilter    = '';

function filterStaffOrderType(type) {
  staffOrderTypeFilter = type;
  staffOrdersPage = 1;
  applyStaffOrderFilters();
}

function filterStaffOrders(status) {
  staffOrderStatusFilter = status;
  staffOrdersPage = 1;
  applyStaffOrderFilters();
}

function filterStaffOrderSearch(val) {
  staffOrderSearchText = val.toLowerCase();
  staffOrdersPage = 1;
  applyStaffOrderFilters();
}
window.filterStaffOrderSearch = filterStaffOrderSearch;

// ─── Date (Year / Month / Day) Filter ─────────────────
// Uses the same +8h (PH time) normalization as the Date column in
// renderStaffOrders(), so the filter matches what's shown on screen.
function getStaffOrderDateParts(o) {
  const raw = o.created_at || o.date || null;
  if (!raw) return null;
  const normalized = raw.toString().replace(/(\.\d{3})\d+/, '$1').replace(' ', 'T');
  const utcStr = normalized.endsWith('Z') || normalized.includes('+') ? normalized : normalized + 'Z';
  const d = new Date(new Date(utcStr).getTime() + 8 * 60 * 60 * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function populateStaffOrderYearFilter(orders) {
  const sel = document.getElementById('staffOrderYearFilter');
  if (!sel) return;
  const years = [...new Set(orders.map(o => getStaffOrderDateParts(o)?.year).filter(Boolean))].sort((a, b) => b - a);
  const current = sel.value;
  sel.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  if (years.map(String).includes(current)) sel.value = current;
}

// Number of days to list for the Day dropdown, given the current
// Year/Month selection — accounts for 30/31-day months and leap Februaries.
function staffDaysInMonthFor(year, month) {
  if (!month) return 31; // no month chosen yet — show the generic max
  const m = parseInt(month, 10);
  if (m === 2) {
    if (year) {
      const y = parseInt(year, 10);
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
      return isLeap ? 29 : 28;
    }
    return 29; // year unknown — stay permissive for Feb
  }
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

function populateStaffOrderDayOptions() {
  const sel = document.getElementById('staffOrderDayFilter');
  if (!sel) return;
  const max     = staffDaysInMonthFor(staffOrderYearFilter, staffOrderMonthFilter);
  const current = sel.value;
  let opts = '<option value="">All Days</option>';
  for (let d = 1; d <= max; d++) opts += `<option value="${String(d).padStart(2, '0')}">${d}</option>`;
  sel.innerHTML = opts;
  if (current && parseInt(current, 10) <= max) {
    sel.value = current;
  } else {
    sel.value = '';
    staffOrderDayFilter = '';
  }
}

function filterStaffOrderYear(year) {
  staffOrderYearFilter = year;
  populateStaffOrderDayOptions();
  staffOrdersPage = 1;
  applyStaffOrderFilters();
}
window.filterStaffOrderYear = filterStaffOrderYear;

function filterStaffOrderMonth(month) {
  staffOrderMonthFilter = month;
  populateStaffOrderDayOptions();
  staffOrdersPage = 1;
  applyStaffOrderFilters();
}
window.filterStaffOrderMonth = filterStaffOrderMonth;

function filterStaffOrderDay(day) {
  staffOrderDayFilter = day;
  staffOrdersPage = 1;
  applyStaffOrderFilters();
}
window.filterStaffOrderDay = filterStaffOrderDay;

// Clears every Orders filter: search, type, status, year, month, day.
function clearStaffOrderFilters() {
  staffOrderTypeFilter   = '';
  staffOrderStatusFilter = '';
  staffOrderSearchText   = '';
  staffOrderYearFilter   = '';
  staffOrderMonthFilter  = '';
  staffOrderDayFilter    = '';

  const typeSel   = document.getElementById('staffOrderTypeFilter');
  const statusSel = document.getElementById('staffOrderStatusFilter');
  const yearSel   = document.getElementById('staffOrderYearFilter');
  const monthSel  = document.getElementById('staffOrderMonthFilter');
  const searchBox = document.getElementById('staffOrderSearchInput');
  if (typeSel)   typeSel.value   = '';
  if (statusSel) statusSel.value = '';
  if (yearSel)   yearSel.value   = '';
  if (monthSel)  monthSel.value  = '';
  if (searchBox) searchBox.value = '';
  populateStaffOrderDayOptions();

  staffOrdersPage = 1;
  applyStaffOrderFilters();
}
window.clearStaffOrderFilters = clearStaffOrderFilters;

// Greys out / disables the Clear Filters button when no filter is active.
function updateStaffClearFiltersState() {
  const btn = document.getElementById('staffClearFiltersBtn');
  if (!btn) return;
  const anyActive = !!(staffOrderTypeFilter || staffOrderStatusFilter || staffOrderSearchText ||
                       staffOrderYearFilter || staffOrderMonthFilter || staffOrderDayFilter);
  btn.disabled = !anyActive;
  btn.style.opacity = anyActive ? '1' : '0.5';
  btn.style.cursor  = anyActive ? 'pointer' : 'not-allowed';
}

function applyStaffOrderFilters() {
  updateStaffClearFiltersState();
  let filtered = staffOrders;
  if (staffOrderTypeFilter)   filtered = filtered.filter(o => o.order_type === staffOrderTypeFilter);
  if (staffOrderStatusFilter) filtered = filtered.filter(o => o.status === staffOrderStatusFilter);
  if (staffOrderYearFilter) {
    filtered = filtered.filter(o => String(getStaffOrderDateParts(o)?.year) === staffOrderYearFilter);
  }
  if (staffOrderMonthFilter) {
    filtered = filtered.filter(o => String(getStaffOrderDateParts(o)?.month).padStart(2, '0') === staffOrderMonthFilter);
  }
  if (staffOrderDayFilter) {
    filtered = filtered.filter(o => String(getStaffOrderDateParts(o)?.day).padStart(2, '0') === staffOrderDayFilter);
  }
  if (staffOrderSearchText) {
    filtered = filtered.filter(o => {
      const customer = o.customer ? (o.customer.fname + ' ' + o.customer.lname).toLowerCase() : 'walk-in';
      const orderId  = (o.order_id || '').toLowerCase();
      const status   = (o.status || '').toLowerCase();
      const type     = (o.order_type || '').toLowerCase();
      return customer.includes(staffOrderSearchText)
          || orderId.includes(staffOrderSearchText)
          || status.includes(staffOrderSearchText)
          || type.includes(staffOrderSearchText);
    });
  }
  renderStaffOrders(sortOrdersHierarchy(filtered));
}
window.filterStaffOrderType = filterStaffOrderType;

async function updateOrderStatus(id, status) {
  try {
    const res = await fetch(`/api/staff/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { showToast('Order status updated!'); loadOrders(); }
    else showToast('Failed to update status.', 'error');
  } catch (e) { showToast('Error updating status.', 'error'); }
}

// ══════════════════════════════════════════════════════
// SALES SUMMARY
// ══════════════════════════════════════════════════════
let allSummaryOrders = []; // store all orders for date filtering

async function loadSummary() {
  // ── Skeleton ──
  skStats(['summaryToday','summaryOrders','summaryWalkin','summaryOnline']);
  skTable('summaryTodayBody', ['sk-cell-sm','sk-cell-full','sk-cell-md',
                               'sk-cell-sm','sk-cell-sm','sk-cell-sm'], 6);
  // ─────────────
  try {
    const res = await fetch('/api/staff/orders?limit=1000');
    const raw = await res.json();
    allSummaryOrders = Array.isArray(raw) ? raw : [];

    // Default both pickers to today
    const today  = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const fromEl = document.getElementById('summaryDateFrom');
    const toEl   = document.getElementById('summaryDateTo');
    if (fromEl && !fromEl.value) fromEl.value = today;
    if (toEl   && !toEl.value)   toEl.value   = today;

    renderSummaryForRange(fromEl?.value || today, toEl?.value || today);
  } catch (e) { console.error('Summary error:', e); }
}

function renderSummaryForRange(fromStr, toStr) {
  const today    = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const isSingle = fromStr === toStr;
  const isToday  = isSingle && fromStr === today;

  const fmtDate    = d => new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' });
  const rangeLabel = isToday ? 'Today' : isSingle ? fmtDate(fromStr) : `${fmtDate(fromStr)} – ${fmtDate(toStr)}`;

  const summaryLabelEl = document.getElementById('summaryLabel');
  const tableTitleEl   = document.getElementById('summaryTableTitle');
  const dateRangeLbl   = document.getElementById('summaryDateLabel');
  if (summaryLabelEl) summaryLabelEl.textContent = isToday ? "Today's Sales"        : `Sales (${rangeLabel})`;
  if (tableTitleEl)   tableTitleEl.textContent   = isToday ? "Today's Transactions" : `Transactions (${rangeLabel})`;
  if (dateRangeLbl)   dateRangeLbl.textContent   = rangeLabel;

  // Filter orders within range — PH timezone
  const filtered = allSummaryOrders.filter(o => {
    const raw = o.created_at || o.date || null;
    if (!raw) return false;
    const localDate = new Date(raw).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    return localDate >= fromStr && localDate <= toStr;
  });

  const allValid = filtered.filter(o => o.status !== 'cancelled');
  const total    = allValid.reduce((s, o) => s + Number(o.total || 0), 0);

  document.getElementById('summaryToday').textContent  = peso(total);
  document.getElementById('summaryOrders').textContent = allValid.length;
  document.getElementById('summaryWalkin').textContent = allValid.filter(o => o.order_type === 'walk_in').length;
  document.getElementById('summaryOnline').textContent = allValid.filter(o => o.order_type === 'online').length;

  document.getElementById('summaryTodayBody').innerHTML = filtered.length
    ? filtered.map(o => `
        <tr>
          <td><code style="font-family:'JetBrains Mono',monospace;font-size:11px;">${shortId(o.order_id)}</code></td>
          <td>${o.customer ? `${o.customer.fname} ${o.customer.lname}` : 'Walk-in'}</td>
          <td>${badge(o.order_type)}${offlineSyncTag(o)}</td>
          <td>${o.payment?.payment_method ? badge(o.payment.payment_method) : (Array.isArray(o.payment) && o.payment[0] ? badge(o.payment[0].payment_method) : '—')}</td>
          <td>${peso(o.total)}</td>
          <td>${o.created_at ? toUtcDate(o.created_at).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Manila' }) : '—'}</td>
          <td>${badge(o.status)}</td>
        </tr>`).join('')
    : `<tr><td colspan="7" class="table-empty">No transactions for ${rangeLabel}</td></tr>`;
}

async function applyDateRangeFilter() {
  const fromEl = document.getElementById('summaryDateFrom');
  const toEl   = document.getElementById('summaryDateTo');
  if (!fromEl?.value || !toEl?.value) return;
  if (fromEl.value > toEl.value) toEl.value = fromEl.value;
  try {
    const res = await fetch('/api/staff/orders?limit=1000');
    const raw = await res.json();
    allSummaryOrders = Array.isArray(raw) ? raw : [];
  } catch (e) { console.error('Summary fetch error:', e); }
  renderSummaryForRange(fromEl.value, toEl.value);
}

function resetSummaryDate() {
  const today  = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const fromEl = document.getElementById('summaryDateFrom');
  const toEl   = document.getElementById('summaryDateTo');
  if (fromEl) fromEl.value = today;
  if (toEl)   toEl.value   = today;
  renderSummaryForRange(today, today);
}

// ─── Init ─────────────────────────────────────────────
// ─── STOCK REQUESTS ───────────────────────────────────

async function loadRequests() {
  // ── Skeleton ──
  skTable('requestsBody', ['sk-cell-full','sk-cell-sm','sk-cell-sm','sk-cell-sm',
                           'sk-cell-md','sk-cell-sm','sk-cell-full'], 6);
  // ─────────────
  try {
    const res  = await fetch('/api/staff/stock-requests');
    const data = await res.json();

    // Handle error response
    if (!Array.isArray(data)) {
      console.error('Stock requests error:', data);
      document.getElementById('requestsBody').innerHTML =
        '<tr><td colspan="7" class="table-empty">Failed to load requests. Try again.</td></tr>';
      return;
    }

    // Update badge
    const pending = data.filter(r => r.status === 'pending').length;
    const badge   = document.getElementById('reqBadge');
    if (badge) {
      badge.textContent   = pending;
      badge.style.display = pending > 0 ? 'inline' : 'none';
    }

    _srFilteredCache = data;
    renderRequestsPage();

  } catch (e) { console.error('Requests error:', e); }
}

function renderRequestsPage() {
  const start  = (srPage - 1) * SR_PAGE_SIZE;
  const paged  = _srFilteredCache.slice(start, start + SR_PAGE_SIZE);
  document.getElementById('requestsBody').innerHTML = paged.length
    ? paged.map(r => {
        const statusColors = { pending:'yellow', approved:'green', rejected:'red' };
        const statusColor  = statusColors[r.status] || 'gray';
        return `
        <tr>
          <td>
            <strong>${r.product?.product_name || '—'}</strong>
            ${r.variant_options && Object.keys(r.variant_options).length > 0
              ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + Object.entries(r.variant_options).map(function(e){return e[0]+': '+e[1];}).join(', ') + '</div>'
              : ''}
          </td>
          <td>${r.product?.quantity ?? '—'} units</td>
          <td>${r.quantity_needed} units</td>
          <td><span class="badge badge--${statusColor}">${r.status}</span></td>
          <td style="font-size:12px;">${r.note || '—'}</td>
          <td style="font-size:12px;color:${r.status === 'rejected' ? '#ef4444' : 'inherit'};">${r.admin_note || '—'}</td>
          <td>${(() => {
            const raw = r.created_at;
            if (!raw) return '—';
            const normalized = raw.toString().replace(/(\.\d{3})\d+/, '$1').replace(' ', 'T');
            const utcStr = normalized.endsWith('Z') || normalized.includes('+') ? normalized : normalized + 'Z';
            const d = new Date(new Date(utcStr).getTime() + 8 * 60 * 60 * 1000);
            const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            const date = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
            const h = d.getUTCHours(), m = d.getUTCMinutes();
            const time = `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`;
            return `<span style="display:block;font-size:12px;">${date}</span><span style="display:block;font-size:11px;color:var(--text-muted);">${time}</span>`;
          })()}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="table-empty">No stock requests yet</td></tr>';
  renderPagerSized('staffReqPagination', _srFilteredCache.length, srPage, SR_PAGE_SIZE, 'changeSrPage');
}
function changeSrPage(page) { srPage = page; renderRequestsPage(); }
window.changeSrPage = changeSrPage;


async function openRequestModal(btn) {
  btn = btn || document.querySelector('[onclick^="openRequestModal"]');
  setButtonLoading(btn, true);
  try {
    if (!invProducts.length) { invalidateSection('inventory'); await loadInventory(); }

    // Clear and add first product row
    document.getElementById('reqItems').innerHTML = '';
    reqRowCount = 0;
    document.getElementById('reqNote').value = '';
    addReqItemRow();
    _setReqBtn(false);

    // Live check — item row inputs (event delegation)
    document.getElementById('reqItems')?.addEventListener('input',  _reqUpdateBtn);
    document.getElementById('reqItems')?.addEventListener('change', _reqUpdateBtn);

    document.getElementById('requestModalOverlay')?.classList.add('open');
    document.getElementById('requestModal')?.classList.add('open');
  } finally {
    setButtonLoading(btn, false);
  }
}

function closeRequestModal() {
  document.getElementById('requestModalOverlay')?.classList.remove('open');
  document.getElementById('requestModal')?.classList.remove('open');
  document.getElementById('requestForm')?.reset();
  document.getElementById('reqItems').innerHTML = '';
  reqRowCount = 0;
  _setReqBtn(false);
}

/* ── Stock Request rows (mirrors Admin's Add Stock multi-item pattern) ──── */
let reqRowCount = 0;

function buildReqProductAutocomplete(container, { inputId, hiddenId, onSelect }) {
  function stockLabel(p) {
    const branchStock = p.branch_stock?.find(bs => bs.branch_id === staffBranchId);
    const stock = branchStock ? branchStock.quantity : p.quantity || 0;
    return `Stock: ${stock}`;
  }

  const input  = container.querySelector(`#${inputId}`);
  const hidden = container.querySelector(`#${hiddenId}`);
  if (!input || !hidden) return;

  // Fixed-position list appended to body — escapes modal overflow clipping
  const list = document.createElement('div');
  list.style.cssText = [
    'display:none',
    'position:fixed',
    'background:var(--card-bg)',
    'border:1px solid var(--border)',
    'border-radius:8px',
    'z-index:9999',
    'max-height:200px',
    'overflow-y:auto',
    'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
  ].join(';');
  document.body.appendChild(list);

  function positionList() {
    const rect = input.getBoundingClientRect();
    list.style.top   = (rect.bottom + 2) + 'px';
    list.style.left  = rect.left + 'px';
    list.style.width = rect.width + 'px';
  }

  function showSuggestions(q) {
    const term = (q || '').toLowerCase().trim();
    list.innerHTML = '';
    if (!term) { list.style.display = 'none'; return; }
    const matches = invProducts.filter(p =>
      (p.product_name || '').toLowerCase().includes(term)
    ).slice(0, 10);
    if (!matches.length) {
      list.innerHTML = `<div style="padding:8px 12px;font-size:12px;color:var(--text-muted);">No products found</div>`;
      positionList();
      list.style.display = 'block';
      return;
    }
    matches.forEach(p => {
      const item = document.createElement('div');
      item.className = 'ac-item';
      item.style.cssText = 'padding:7px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border);background:var(--card-bg);';
      item.innerHTML = `<span style="font-weight:500;">${p.product_name}</span><span style="font-size:11px;color:var(--text-muted);margin-left:6px;">${stockLabel(p)}</span>`;
      item.addEventListener('mousedown', e => { e.preventDefault(); selectProduct(p); });
      list.appendChild(item);
    });
    positionList();
    list.style.display = 'block';
  }

  function selectProduct(p) {
    hidden.value = p.product_id;
    input.value  = p.product_name;
    list.style.display = 'none';
    const clearBtn = container.querySelector('.ac-clear');
    if (clearBtn) clearBtn.style.display = 'inline-flex';
    input.readOnly = true;
    input.style.background = 'var(--surface)';
    if (onSelect) onSelect(p);
  }

  function clearSelection() {
    hidden.value = '';
    input.value  = '';
    input.readOnly = false;
    input.style.background = '';
    list.style.display = 'none';
    const clearBtn = container.querySelector('.ac-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    if (onSelect) onSelect(null);
  }

  input.addEventListener('input',  () => showSuggestions(input.value));
  input.addEventListener('focus',  () => { if (!input.readOnly) showSuggestions(input.value); });
  input.addEventListener('blur',   () => setTimeout(() => { list.style.display = 'none'; }, 150));
  input.closest('.modal')?.addEventListener('scroll', positionList);

  const clearBtn = container.querySelector('.ac-clear');
  if (clearBtn) clearBtn.addEventListener('click', clearSelection);

  container._acClear = () => { clearSelection(); list.remove(); };
}

function reqProductAcHTML(inputId, hiddenId) {
  return `
    <div style="display:flex;align-items:center;gap:4px;">
      <input id="${inputId}" type="text" class="form-input" placeholder="Type to search product..." autocomplete="off"
        style="flex:1;" />
      <button type="button" class="ac-clear" title="Clear"
        style="display:none;align-items:center;justify-content:center;width:26px;height:26px;border:none;background:#ef4444;color:#fff;border-radius:6px;cursor:pointer;font-size:14px;flex-shrink:0;">×</button>
    </div>
    <input id="${hiddenId}" type="hidden" required />`;
}

function addReqItemRow() {
  reqRowCount++;
  const rowId  = 'reqRow_' + reqRowCount;
  const wrap   = document.getElementById('reqItems');
  const row    = document.createElement('div');
  row.id       = rowId;
  row.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;position:relative;';

  const inputId  = `reqInput_${reqRowCount}`;
  const hiddenId = `reqHidden_${reqRowCount}`;

  row.innerHTML = `
    ${reqRowCount > 1 ? `<button type="button" onclick="this.parentElement.remove();_reqUpdateBtn();" style="position:absolute;top:8px;right:8px;background:#ef4444;color:#fff;border:none;border-radius:6px;width:22px;height:22px;cursor:pointer;font-size:14px;line-height:1;">×</button>` : ''}
    <div class="form-group" style="margin-bottom:8px;">
      <label class="form-label" style="font-size:11px;">Product <span class="req">*</span></label>
      ${reqProductAcHTML(inputId, hiddenId)}
    </div>
    <div class="req-variant-wrap" style="display:none;margin-bottom:8px;">
      <label class="form-label" style="font-size:11px;">Variant <span style="font-size:10px;color:var(--text-muted);">(optional)</span></label>
      <div class="req-variant-selects" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
    </div>
    <div class="form-row-2" style="margin:0;">
      <div class="form-group" style="margin:0;">
        <label class="form-label" style="font-size:11px;">Quantity Needed <span class="req">*</span></label>
        <input type="number" class="form-input req-qty" min="1" required placeholder="e.g. 20"/>
      </div>
      <div class="form-group" style="margin:0;">
        <label class="form-label" style="font-size:11px;">Current Stock</label>
        <input type="text" class="form-input req-current-stock" disabled placeholder="Select product first"/>
      </div>
    </div>
  `;
  wrap.appendChild(row);

  buildReqProductAutocomplete(row, {
    inputId, hiddenId,
    onSelect: (p) => {
      loadReqRowVariantsByProduct(p, rowId);
      const stockEl = row.querySelector('.req-current-stock');
      if (stockEl) {
        if (p) {
          const branchStock = p.branch_stock?.find(bs => bs.branch_id === staffBranchId);
          const stock = branchStock ? branchStock.quantity : p.quantity || 0;
          stockEl.value = `${stock} units`;
        } else {
          stockEl.value = '';
        }
      }
      _reqUpdateBtn();
    },
  });
}
window.addReqItemRow = addReqItemRow;

function loadReqRowVariantsByProduct(product, rowId) {
  const row  = document.getElementById(rowId);
  const wrap = row.querySelector('.req-variant-wrap');
  const cont = row.querySelector('.req-variant-selects');
  if (!product) { wrap.style.display = 'none'; cont.innerHTML = ''; return; }
  const groups = product.option_groups || [];
  if (!groups.length) { wrap.style.display = 'none'; cont.innerHTML = ''; return; }
  wrap.style.display = 'block';
  cont.innerHTML = groups.map(g => `
    <div style="flex:1;min-width:100px;">
      <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:2px;">${g.label}</label>
      <select class="form-input form-select req-variant-opt" data-label="${g.label}" style="font-size:11px;padding:4px 6px;">
        <option value="">Any</option>
        ${(g.choices||[]).map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
  `).join('');
}

function _setReqBtn(enabled) {
  const btn = document.getElementById('reqSubmitBtn');
  if (!btn) return;
  btn.disabled      = !enabled;
  btn.style.opacity = enabled ? '1' : '0.45';
  btn.style.cursor  = enabled ? 'pointer' : 'not-allowed';
}

function _reqUpdateBtn() {
  const rows = document.querySelectorAll('#reqItems > div');
  if (!rows.length) { _setReqBtn(false); return; }
  const allValid = Array.from(rows).every(row => {
    const hidden = row.querySelector('input[type="hidden"]');
    const qty    = row.querySelector('.req-qty');
    return hidden?.value && qty?.value && parseInt(qty.value) >= 1;
  });
  _setReqBtn(allValid);
}

async function submitRequest(e) {
  e.preventDefault();
  const reqBtn = e.submitter || document.querySelector('#requestForm button[type="submit"]');
  setButtonLoading(reqBtn, true);

  const note = document.getElementById('reqNote').value;
  const rows = document.querySelectorAll('#reqItems > div');

  if (!rows.length) {
    showToast('Please add at least one product.', 'error');
    setButtonLoading(reqBtn, false);
    return;
  }

  const items = [];
  let hasError = false;
  rows.forEach(function(row) {
    const hiddenInput = row.querySelector('input[type="hidden"]');
    const qtyInput     = row.querySelector('.req-qty');
    const productId    = hiddenInput?.value;
    const qty          = parseInt(qtyInput?.value || '0');

    if (!productId || qty <= 0) { hasError = true; return; }

    const variantOpts = {};
    row.querySelectorAll('.req-variant-opt').forEach(function(vs) {
      if (vs.value) variantOpts[vs.dataset.label] = vs.value;
    });

    items.push({
      product_id:      productId,
      quantity_needed: qty,
      variant_options: Object.keys(variantOpts).length ? variantOpts : null,
    });
  });

  if (hasError || !items.length) {
    showToast('Please fill in all product rows correctly.', 'error');
    setButtonLoading(reqBtn, false);
    return;
  }

  try {
    let allOk = true;
    for (const item of items) {
      const res = await fetch('/api/staff/stock-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id:      item.product_id,
          quantity_needed: item.quantity_needed,
          note:            note,
          branch_id:       staffBranchId,
          variant_options: item.variant_options,
        }),
      });
      if (!res.ok) allOk = false;
    }
    if (allOk) {
      showToast(`${items.length} stock request${items.length !== 1 ? 's' : ''} submitted!`);
      closeRequestModal();
      invalidateSection('requests'); loadRequests();
    } else {
      showToast('Some requests failed to submit. Please check.', 'error');
    }
  } catch (err) {
    showToast('Error submitting request.', 'error');
  } finally {
    setButtonLoading(reqBtn, false);
  }
}


document.addEventListener('DOMContentLoaded', async () => {
  await loadBranches();
  _loadedSections.add('pos'); await loadPosProducts();
  await loadPosDiscounts();
  startConnectivityWatch();

  // Restore last section from URL hash or localStorage
  const hash    = window.location.hash.replace('#', '');
  const saved   = localStorage.getItem('staff-section');
  const section = hash || saved || 'pos';
  const valid   = Object.keys(pageTitles);
  showSection(valid.includes(section) ? section : 'pos', null);

  // Restore open modal if any
  const openModal = localStorage.getItem('staff-open-modal');
  if (openModal) {
    localStorage.removeItem('staff-open-modal');
  }
});

window.addEventListener('beforeunload', function () {
  if (document.getElementById('stockModal')?.classList.contains('open'))
    localStorage.setItem('staff-open-modal', 'stock');
  else
    localStorage.removeItem('staff-open-modal');
});
(function() {
  const style = document.createElement('style');
  style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
})();


// ══════════════════════════════════════════════════════
// PROFILE MODULE
// ══════════════════════════════════════════════════════

let _profOrigInfo = {};

// ── Inline field error helpers ────────────────────────
function _profSetFieldError(inputId, msg) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.style.borderColor = msg ? '#ef4444' : '';
  let hint = document.getElementById(inputId + '_err');
  // Append outside the position:relative wrapper so icons don't shift
  const container = input.parentNode.classList.contains('form-group')
    ? input.parentNode
    : (input.parentNode.parentNode || input.parentNode);
  if (msg) {
    if (!hint) {
      hint = document.createElement('span');
      hint.id        = inputId + '_err';
      hint.className = 'field-hint';
      hint.style.cssText = 'color:#ef4444;margin-top:3px;display:block;';
      container.appendChild(hint);
    }
    hint.textContent = msg;
  } else if (hint) {
    hint.textContent = '';
    input.style.borderColor = '';
  }
}

function _profClearErrors() {
  ['profFname','profLname','profUsername','profEmail','profPhone','profCurrentPw','profNewPw','profConfirmPw'].forEach(id => {
    _profSetFieldError(id, '');
  });
}

// Returns true if all currently-entered values pass validation (no errors)
function _profValidate() {
  const fname     = document.getElementById('profFname').value.trim();
  const lname     = document.getElementById('profLname').value.trim();
  const username  = document.getElementById('profUsername').value.trim();
  const email     = document.getElementById('profEmail').value.trim();
  const phone     = document.getElementById('profPhone').value.trim();
  const currentPw = document.getElementById('profCurrentPw').value;
  const newPw     = document.getElementById('profNewPw').value;
  const confirmPw = document.getElementById('profConfirmPw').value;
  const changingPw = !!(currentPw || newPw || confirmPw);

  let valid = true;

  _profSetFieldError('profFname',    !fname    ? 'First name is required.' : '');
  _profSetFieldError('profLname',    !lname    ? 'Last name is required.'  : '');
  _profSetFieldError('profUsername', !username ? 'Username is required.'   : '');

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  _profSetFieldError('profEmail', !email ? 'Email is required.' : !emailOk ? 'Enter a valid email address.' : '');

  const phoneOk = /^09\d{9}$/.test(phone);
  _profSetFieldError('profPhone', !phone ? 'Phone number is required.' : !phoneOk ? 'Must be 09XXXXXXXXX (11 digits).' : '');

  if (!fname || !lname || !username || !email || !emailOk || !phone || !phoneOk) valid = false;

  if (changingPw) {
    _profSetFieldError('profCurrentPw', !currentPw ? 'Current password is required.' : '');
    _profSetFieldError('profNewPw',
      !newPw            ? 'New password is required.' :
      newPw.length < 8  ? 'Must be at least 8 characters.' : '');
    _profSetFieldError('profConfirmPw',
      !confirmPw           ? 'Please confirm your new password.' :
      confirmPw !== newPw  ? 'Passwords do not match.' : '');
    if (!currentPw || !newPw || newPw.length < 8 || confirmPw !== newPw) valid = false;
  } else {
    _profSetFieldError('profCurrentPw', '');
    _profSetFieldError('profNewPw',     '');
    _profSetFieldError('profConfirmPw', '');
  }

  return valid;
}

async function loadProfile() {
  // ── Skeleton ──
  ['profFname','profMi','profLname','profUsername','profEmail','profPhone'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.value = ''; el.placeholder = 'Loading...'; }
  });
  // ─────────────
  try {
    const res  = await fetch('/auth/profile');
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Failed to load profile.', 'error'); return; }

    document.getElementById('profFname').value    = data.fname        || '';
    document.getElementById('profMi').value       = data.mi           || '';
    document.getElementById('profLname').value    = data.lname        || '';
    document.getElementById('profUsername').value = data.username     || '';
    document.getElementById('profEmail').value    = data.email        || '';
    document.getElementById('profPhone').value    = data.phone_number || '';
    document.getElementById('profCurrentPw').value = '';
    document.getElementById('profNewPw').value     = '';
    document.getElementById('profConfirmPw').value = '';

    _profOrigInfo = {
      fname: data.fname || '', mi: data.mi || '', lname: data.lname || '',
      username: data.username || '', email: data.email || '',
      phone_number: data.phone_number || '',
    };

    _profClearErrors();

    ['profFname','profMi','profLname','profUsername','profEmail','profPhone','profCurrentPw','profNewPw','profConfirmPw'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.oninput = checkProfDirty;
    });

    _setProfSaveBtn(false);
  } catch (e) {
    showToast('Error loading profile.', 'error');
  }
}

function checkProfDirty() {
  const infoDirty =
    document.getElementById('profFname').value    !== _profOrigInfo.fname ||
    document.getElementById('profMi').value       !== _profOrigInfo.mi ||
    document.getElementById('profLname').value    !== _profOrigInfo.lname ||
    document.getElementById('profUsername').value !== _profOrigInfo.username ||
    document.getElementById('profEmail').value    !== _profOrigInfo.email ||
    document.getElementById('profPhone').value    !== _profOrigInfo.phone_number;
  const pwDirty = !!(
    document.getElementById('profCurrentPw').value ||
    document.getElementById('profNewPw').value ||
    document.getElementById('profConfirmPw').value
  );
  const dirty = infoDirty || pwDirty;

  // Run inline validation whenever there are changes; clear errors when pristine
  if (dirty) {
    const valid = _profValidate();
    _setProfSaveBtn(valid);
  } else {
    _profClearErrors();
    _setProfSaveBtn(false);
  }
}

function _setProfSaveBtn(enabled) {
  const btn = document.getElementById('profSaveBtn');
  if (!btn) return;
  btn.disabled      = !enabled;
  btn.style.opacity = enabled ? '1' : '0.5';
  btn.style.cursor  = enabled ? 'pointer' : 'not-allowed';
}

async function saveProfile() {
  const btn        = document.getElementById('profSaveBtn');
  const fname      = document.getElementById('profFname').value.trim();
  const mi         = document.getElementById('profMi').value.trim();
  const lname      = document.getElementById('profLname').value.trim();
  const username   = document.getElementById('profUsername').value.trim();
  const email      = document.getElementById('profEmail').value.trim();
  const phone      = document.getElementById('profPhone').value.trim();
  const currentPw  = document.getElementById('profCurrentPw').value;
  const newPw      = document.getElementById('profNewPw').value;
  const confirmPw  = document.getElementById('profConfirmPw').value;
  const changingPw = !!(currentPw || newPw || confirmPw);

  // Final validation guard (button should already be disabled on error, but safety net)
  if (!_profValidate()) return;

  setButtonLoading(btn, true);
  try {
    const infoRes  = await fetch('/auth/profile', {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'info', fname, mi, lname, username, email, phone_number: phone }),
    });
    const infoData = await infoRes.json();
    if (!infoRes.ok) { showToast(infoData.error || 'Failed to save profile.', 'error'); return; }

    if (changingPw) {
      const pwRes  = await fetch('/auth/profile', {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action: 'password', current_password: currentPw, new_password: newPw, confirm_password: confirmPw }),
      });
      const pwData = await pwRes.json();
      if (!pwRes.ok) { showToast(pwData.error || 'Failed to change password.', 'error'); return; }
    }

    showToast(changingPw ? 'Profile and password updated!' : 'Profile updated successfully!');
    _profOrigInfo = { fname, mi, lname, username, email, phone_number: phone };
    document.getElementById('profCurrentPw').value = '';
    document.getElementById('profNewPw').value     = '';
    document.getElementById('profConfirmPw').value = '';
    _profClearErrors();
    _setProfSaveBtn(false);
  } catch (e) {
    showToast('Error saving profile.', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

function togglePwVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.innerHTML = isHidden
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
}