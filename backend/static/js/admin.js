// ─── Skeleton Loading Helpers ────────────────────────
/**
 * skRow(cols)  — returns one <tr> with skeleton cells.
 * skStatCard(id) — replaces stat-value + stat-sub with shimmer spans.
 * skTable(tbodyId, cols, rows=5) — fills a tbody with skeleton rows.
 * skStats(ids) — replaces an array of element IDs with shimmer values.
 * clearSk(el) — removes the skeleton class from an element.
 */
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
function skStatIcon(id) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = '<span class="skeleton sk-icon"></span>';
}
// ─── Pagination ──────────────────────────────────────
const ITEMS_PER_PAGE = 10;
const PROD_PAGE_SIZE = 12;
let productsPage         = 1;
let _prodFilteredCache   = [];
const DISC_PAGE_SIZE = 5;
let discountsPage        = 1;
let _discFilteredCache   = [];
const USER_PAGE_SIZE = 12;
let usersPage            = 1;
let _userFilteredCache   = [];
let invPage              = 1;
let ordersPage           = 1;
let inventoryTypeFilterVal = '';
let inventoryBranchFilter  = '';
let branchStockPage   = 1;
let allBranchProducts = [];
let branchStockSearchVal  = '';
let branchStockLevelVal   = '';

function paginate(arr, page) {
  return arr.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
}


// ─── Custom Pager (same design as renderPager, custom page size) ────────────
function renderPagerCustom(containerId, total, currentPage, pageSize, fnName) {
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
      if (window[fn]) window[fn](page);
    });
  });
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

function changeInvPage(p)         { invPage = p;         renderInventory(allInventory); }
function changeOrdersPage(p)      { ordersPage = p;      applyAdminOrderFilters(); }
function changeBranchStockPage(p) {
  branchStockPage = p;
  const wrap = document.getElementById('branchStockSummary');
  if (wrap) wrap.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:16px;color:var(--text-muted);font-size:13px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;animation:spin 1s linear infinite;flex-shrink:0;"><circle cx="12" cy="12" r="10" stroke-dasharray="40" stroke-dashoffset="20"/></svg>Loading...</div>';
  setTimeout(function() { updateBranchStockSummary(allBranchProducts); }, 50);
}
window.changeBranchStockPage = changeBranchStockPage;
window.changeInvPage    = changeInvPage;
window.changeOrdersPage = changeOrdersPage;

var pageTitles = {
  overview:        ['Dashboard',         'Dashboard summary & recent activity'],
  products:        ['Products',          'Manage product catalog and details'],
  inventory:       ['Inventory',         'Manage stock levels and movements'],
  orders:          ['Orders',            'Manage online customer orders'],
  purchase_orders: ['Purchase Orders',   'Manage purchase orders & stock requests'],
  sales:           ['Sales Reports',     'View analytics and generate sales reports'],
  discounts:       ['Discounts',         'Manage product discounts'],
  users:           ['User Management',   'Manage admin and staff accounts'],
  profile:         ['My Profile',        'View and update your account information'],
};


// ─── Visibility-based Refresh ────────────────────────


// ─── Preserve expanded rows + filter states across refresh ─────────────────
function saveExpandedRows() {
  const expanded = [];
  document.querySelectorAll('[id^="invVarRow_"]').forEach(row => {
    if (row.style.display !== 'none') expanded.push(row.id);
  });
  document.querySelectorAll('[id^="branchStockRow_"]').forEach(row => {
    if (row.style.display !== 'none') expanded.push(row.id);
  });
  return expanded;
}

function restoreExpandedRows(expanded) {
  expanded.forEach(id => {
    const row = document.getElementById(id);
    if (!row) return;

    // id format: invVarRow_<productId>_<branchId>
    const parts     = id.split('_');
    const productId = parts[1];
    const branchId  = parts[2];

    row.style.display = '';

    // Update arrow button text
    const btn = row.previousElementSibling?.querySelector('.inv-expand-btn');
    if (btn) btn.textContent = '▼';

    // Re-fetch variant content (was loaded async — empty after DOM rebuild)
    const cont = row.querySelector('.inv-variant-content');
    if (cont) {
      cont.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Loading variants...</span>';
      fetch('/api/variant-stock/' + productId + '?branch_id=' + branchId)
        .then(r => r.json())
        .then(data => {
          if (!data.length) {
            cont.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">No variant stock recorded yet.</span>';
            return;
          }
          cont.innerHTML = data.map(vs => {
            const opts  = Object.entries(vs.options || {}).map(e => e[0] + ': ' + e[1]).join(', ');
            const qty   = vs.quantity || 0;
            const color = qty === 0 ? '#ef4444' : qty <= 5 ? '#f59e0b' : 'var(--g-400)';
            const bg    = qty === 0 ? 'rgba(239,68,68,0.05)' : qty <= 5 ? 'rgba(245,158,11,0.05)' : 'rgba(22,163,74,0.05)';
            return '<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;padding:3px 8px;border-radius:4px;background:' + bg + ';border:1px solid ' + color + ';margin:2px;">'
              + '<span style="color:var(--text-muted);">' + opts + '</span>'
              + '<strong style="color:' + color + ';">' + qty + '</strong>'
              + '</span>';
          }).join('');
        })
        .catch(() => { cont.innerHTML = '<span style="font-size:12px;color:#ef4444;">Failed to load variants.</span>'; });
    }
  });
}

function saveFilterStates() {
  return {
    inventoryType:    document.getElementById('inventoryTypeFilter')?.value || '',
    adminOrderType:   document.getElementById('adminOrderTypeFilter')?.value || '',
    adminOrderStatus: document.getElementById('adminOrderStatusFilter')?.value || '',
    invSearch:        document.querySelector('.search-input')?.value || '',
  };
}

function restoreFilterStates(states) {
  const invFilter = document.getElementById('inventoryTypeFilter');
  if (invFilter && states.inventoryType) {
    invFilter.value = states.inventoryType;
    filterInventoryType(states.inventoryType);
  }
  const orderType = document.getElementById('adminOrderTypeFilter');
  if (orderType && states.adminOrderType) {
    orderType.value = states.adminOrderType;
  }
  const orderStatus = document.getElementById('adminOrderStatusFilter');
  if (orderStatus && states.adminOrderStatus) {
    orderStatus.value = states.adminOrderStatus;
    if (states.adminOrderType || states.adminOrderStatus) applyAdminOrderFilters();
  }
}

function forceRefreshSection(btn) {
  const section = localStorage.getItem('admin-section') || 'overview';
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

  const expandedRows  = saveExpandedRows();
  const filterStates  = saveFilterStates();
  const origInventory = renderInventory;
  const origOrders    = renderOrders;
  window.renderInventory = function(data) {
    origInventory(data);
    restoreExpandedRows(expandedRows);
    restoreFilterStates(filterStates);
    window.renderInventory = origInventory;
    stopBtn();
  };
  window.renderOrders = function(data) {
    origOrders(data);
    restoreFilterStates(filterStates);
    window.renderOrders = origOrders;
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
    const section = localStorage.getItem('admin-section') || 'overview';
    if (loaders[section]) {
      const expandedRows  = saveExpandedRows();
      const filterStates  = saveFilterStates();
      const origInventory = renderInventory;
      const origOrders    = renderOrders;
      window.renderInventory = function(data) {
        origInventory(data);
        restoreExpandedRows(expandedRows);
        restoreFilterStates(filterStates);
        window.renderInventory = origInventory;
      };
      window.renderOrders = function(data) {
        origOrders(data);
        restoreFilterStates(filterStates);
        window.renderOrders = origOrders;
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
  localStorage.setItem('admin-section', name);
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
    btn.innerHTML     = btn._originalText || 'Save';
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
function badge(text, type) {
  const map = {
    active: 'green', inactive: 'gray',
    pending: 'yellow', processing: 'blue',
    completed: 'green', cancelled: 'red',
    online: 'blue', walk_in: 'green',
    paid: 'green', failed: 'red',
    admin: 'blue', staff: 'green', customer: 'gray',
    gcash: 'blue', walk_in_cash: 'green', cash_on_delivery: 'yellow',
  };
  const label = text === 'out_for_delivery' ? 'Out for Delivery' : text.replace(/_/g, ' ');
  return `<span class="badge badge--${map[text] || 'gray'}">${label}</span>`;
}

function peso(val) {
  return '₱' + Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

function shortId(id) {
  return id ? id.slice(0, 8).toUpperCase() : '—';
}

// ══════════════════════════════════════════════════════
// GLOBAL STATE
// ══════════════════════════════════════════════════════
let allProducts  = [];
let allOrders    = [];
let allUsers     = [];
let allDiscounts = [];
let allBranches  = [];

// ══════════════════════════════════════════════════════
// DATA LOADERS
// ══════════════════════════════════════════════════════
var loaders = {
  overview:  loadOverview,
  products:  loadProducts,
  inventory: loadInventory,
  orders:    loadOrders,
  sales:     loadSales,
  discounts: loadDiscounts,
  users:          loadUsers,
  purchase_orders: loadPurchaseOrders,
  profile:         loadProfile,
};

// ─── Section load-once cache ──────────────────────────
// Tracks which sections have already fetched their data.
// Call invalidateSection(name) after any mutation so the
// next visit re-fetches fresh data.
var _loadedSections = new Set();
function invalidateSection(name) { _loadedSections.delete(name); }
function invalidateAll() { _loadedSections.clear(); }

// ─── BRANCHES (shared utility) ────────────────────────
async function loadBranches() {
  try {
    const res   = await fetch('/api/admin/branches');
    allBranches = await res.json();
    return allBranches;
  } catch (e) {
    console.error('Branches error:', e);
    return [];
  }
}

function populateBranchSelects(...selectIds) {
  selectIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML  = `<option value="">Select branch</option>` +
      allBranches.map(b => `<option value="${b.branch_id}">${b.branch_name}</option>`).join('');
    if (current) el.value = current;
  });
}

// ─── OVERVIEW ─────────────────────────────────────────
async function loadOverview() {
  // ── Skeleton ──
  skStats(['statProducts','statOrders','statSales','statSalesTripleE','statSalesFielCollince',
           'statLowStock','statCriticalStock','statPending','statTodayRevenue','statOutOfStock',
           'statActiveDiscounts','statPendingRequests']);
  skTable('topSellingBody',    ['sk-cell-full','sk-cell-sm','sk-cell-sm'], 4);
  skTable('leastSellingBody',  ['sk-cell-full','sk-cell-sm','sk-cell-sm'], 4);
  skTable('pendingRequestsBody',['sk-cell-full','sk-cell-md','sk-cell-sm','sk-cell-md'], 4);
  skTable('recentOrdersBody',  ['sk-cell-sm','sk-cell-full','sk-cell-sm','sk-cell-sm','sk-cell-sm'], 5);
  skTable('lowStockBody',      ['sk-cell-full','sk-cell-md','sk-cell-sm','sk-cell-sm'], 5);
  // ─────────────
  try {
    const [products, orders, payments, stockRequests, discounts] = await Promise.all([
      fetch('/api/admin/products').then(r => r.json()),
      fetch('/api/admin/orders?limit=80').then(r => r.json()),
      fetch('/api/admin/payments').then(r => r.json()),
      fetch('/api/admin/stock-requests').then(r => r.json()),
      fetch('/api/admin/discounts').then(r => r.json()),
    ]);

    // ── Existing stats ──────────────────────────────────
    const activeProducts = products.filter(p => p.status === 'active');
    document.getElementById('statProducts').textContent = activeProducts.length;
    document.getElementById('statOrders').textContent   = orders.length;

    const totalSales = payments.reduce((s, p) => s + Number(p.total || 0), 0);

    // ── Branch Sales ────────────────────────────────────
    // Get branch IDs from allBranches
    const tripleEBranch     = allBranches.find(b => b.branch_name.toLowerCase().includes('triple'));
    const fielCollinceBranch = allBranches.find(b => b.branch_name.toLowerCase().includes('fiel') || b.branch_name.toLowerCase().includes('collince'));

    const completedOrders = Array.isArray(orders) ? orders.filter(o => o.status === 'completed') : [];
    const salesTripleE     = completedOrders
      .filter(o => tripleEBranch && o.branch_id === tripleEBranch.branch_id)
      .reduce((s, o) => s + Number(o.total || 0), 0);
    const salesFielCollince = completedOrders
      .filter(o => fielCollinceBranch && o.branch_id === fielCollinceBranch.branch_id)
      .reduce((s, o) => s + Number(o.total || 0), 0);

    const teEl  = document.getElementById('statSalesTripleE');
    const fcEl  = document.getElementById('statSalesFielCollince');
    if (teEl)  teEl.textContent  = '₱' + salesTripleE.toLocaleString('en-PH', { minimumFractionDigits: 2 });
    if (fcEl)  fcEl.textContent  = '₱' + salesFielCollince.toLocaleString('en-PH', { minimumFractionDigits: 2 });
    document.getElementById('statSales').textContent = peso(totalSales);

    const getTotal = p => p.branch_stock?.length
      ? p.branch_stock.reduce((s, bs) => s + Number(bs.quantity), 0)
      : Number(p.quantity);

    // Per-branch stock checks — two-tier threshold
    // Critical: any branch has 1–5 units
    // Low Stock: any branch has 6–10 units (but NOT critical)
    const hasAnyBranchCritical = p => p.branch_stock?.some(bs => Number(bs.quantity) > 0 && Number(bs.quantity) <= 5);
    const hasAnyBranchLow      = p => !hasAnyBranchCritical(p) && p.branch_stock?.some(bs => Number(bs.quantity) > 0 && Number(bs.quantity) <= 10);
    const hasAnyBranchZero     = p => p.branch_stock?.some(bs => Number(bs.quantity) === 0);

    const criticalStock = activeProducts.filter(p => hasAnyBranchCritical(p));
    const lowStock      = activeProducts.filter(p => hasAnyBranchLow(p));
    const outOfStock    = activeProducts.filter(p => hasAnyBranchZero(p));

    document.getElementById('statLowStock').textContent = lowStock.length;
    const critEl = document.getElementById('statCriticalStock');
    if (critEl) critEl.textContent = criticalStock.length;

    // Update inventory nav badge (critical + low stock warning)
    const invBadge = document.getElementById('invLowStockBadge');
    if (invBadge) {
      const totalLow = criticalStock.length + lowStock.length + outOfStock.length;
      invBadge.textContent   = totalLow > 99 ? '99+' : totalLow;
      invBadge.style.display = totalLow > 0 ? 'inline-block' : 'none';
    }

    // ── New stats ───────────────────────────────────────
    // Pending orders
    const pendingOrders = orders.filter(o => o.status === 'pending' && o.order_type === 'online');
    document.getElementById('statPending').textContent = pendingOrders.length;

    // Today's revenue
    const today       = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => (o.created_at || o.date || '').startsWith(today));
    const todayRev    = todayOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    document.getElementById('statTodayRevenue').textContent = peso(todayRev);

    // Out of stock
    document.getElementById('statOutOfStock').textContent = outOfStock.length;

    // Active discounts
    const now             = new Date();
    const activeDiscounts = discounts.filter(d => {
      const end   = d.ends_at   ? new Date(d.ends_at)   : null;
      const start = d.starts_at ? new Date(d.starts_at) : null;
      if (end && now > end) return false;
      if (start && now < start) return false;
      return true;
    });
    document.getElementById('statActiveDiscounts').textContent = activeDiscounts.length;

    // Pending stock requests
    const pendingReqs = (stockRequests || []).filter(r => r.status === 'pending');
    document.getElementById('statPendingRequests').textContent = pendingReqs.length;

    // Update orders nav badge
    const ordersBadge = document.getElementById('adminOrdersBadge');
    if (ordersBadge) {
      ordersBadge.textContent   = pendingOrders.length > 99 ? '99+' : pendingOrders.length;
      ordersBadge.style.display = pendingOrders.length > 0 ? 'inline-block' : 'none';
    }

    // Update PO nav badge
    const poBadge = document.getElementById('poRequestBadge');
    if (poBadge) {
      poBadge.textContent   = pendingReqs.length;
      poBadge.style.display = pendingReqs.length > 0 ? 'inline' : 'none';
    }

    // ── Recent Orders table ─────────────────────────────
    document.getElementById('recentOrdersBody').innerHTML = orders.slice(0, 5).length
      ? orders.slice(0, 5).map(o => `
          <tr>
            <td><code style="font-family:'JetBrains Mono',monospace;font-size:11px;">${shortId(o.order_id)}</code></td>
            <td>${o.customer ? `${o.customer.fname} ${o.customer.lname}` : 'Walk-in'}</td>
            <td>${badge(o.order_type)}</td>
            <td>${peso(o.total)}</td>
            <td>${badge(o.status)}</td>
          </tr>`).join('')
      : '<tr><td colspan="5" class="table-empty">No orders yet</td></tr>';

    // ── Stock Alert table (Critical first, then Low Stock) ─
    const alertProducts = [
      ...criticalStock.map(p => ({ ...p, _alertLevel: 'critical' })),
      ...lowStock.map(p => ({ ...p, _alertLevel: 'low' })),
    ];
    document.getElementById('lowStockBody').innerHTML = alertProducts.length
      ? alertProducts.map(p => {
          const branchBreakdown = p.branch_stock?.length
            ? p.branch_stock.map(bs => `${bs.branch?.branch_name || 'Branch'}: ${bs.quantity}`).join(' / ')
            : `${getTotal(p)}`;
          const isCritical = p._alertLevel === 'critical';
          const levelBadge = isCritical
            ? '<span style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.4);border-radius:999px;font-size:11px;padding:2px 8px;font-weight:600;">🔴 Critical</span>'
            : '<span style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.4);border-radius:999px;font-size:11px;padding:2px 8px;font-weight:600;">🟡 Low Stock</span>';
          return `<tr>
            <td>${p.product_name}</td>
            <td>${p.category}</td>
            <td><span style="color:${isCritical ? '#ef4444' : '#f59e0b'};font-weight:600;">${branchBreakdown}</span></td>
            <td>${levelBadge}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="4" class="table-empty">All products have sufficient stock ✓</td></tr>';

    // ── Top Selling Products table ──────────────────────
    const sorted = [...activeProducts].sort((a, b) => Number(b.total_sold || 0) - Number(a.total_sold || 0));
    document.getElementById('topSellingBody').innerHTML = sorted.slice(0, 5).length
      ? sorted.slice(0, 5).map(p => `
          <tr>
            <td><strong>${p.product_name}</strong></td>
            <td>${p.category || '—'}</td>
            <td><span style="font-weight:700;color:var(--g-400);">${Number(p.total_sold || 0).toLocaleString()} sold</span></td>
          </tr>`).join('')
      : '<tr><td colspan="3" class="table-empty">No sales data yet</td></tr>';

    // ── Least Selling Products ──────────────────────────
    const leastSorted = [...activeProducts]
      .filter(p => Number(p.total_sold || 0) >= 0)
      .sort((a, b) => Number(a.total_sold || 0) - Number(b.total_sold || 0));
    document.getElementById('leastSellingBody').innerHTML = leastSorted.slice(0, 5).length
      ? leastSorted.slice(0, 5).map(p => `
          <tr>
            <td><strong>${p.product_name}</strong></td>
            <td>${p.category || '—'}</td>
            <td><span style="font-weight:700;color:${Number(p.total_sold || 0) === 0 ? '#ef4444' : '#f59e0b'};">${Number(p.total_sold || 0).toLocaleString()} sold</span></td>
          </tr>`).join('')
      : '<tr><td colspan="3" class="table-empty">No sales data yet</td></tr>';

    // ── Pending Stock Requests table ────────────────────
    document.getElementById('pendingRequestsBody').innerHTML = pendingReqs.length
      ? pendingReqs.slice(0, 5).map(r => `
          <tr>
            <td>
            <strong>${r.product?.product_name || '—'}</strong>
            ${r.variant_options && Object.keys(r.variant_options).length > 0
              ? '<div style="font-size:11px;color:var(--text-muted);">' + Object.entries(r.variant_options).map(function(e){return e[0]+': '+e[1];}).join(', ') + '</div>'
              : ''}
          </td>
            <td>${r.branch?.branch_name || '—'}</td>
            <td>${r.quantity_requested}</td>
            <td>${r.staff ? `${r.staff.fname} ${r.staff.lname}` : '—'}</td>
          </tr>`).join('')
      : '<tr><td colspan="4" class="table-empty">No pending requests ✓</td></tr>';

  } catch (e) { console.error('Overview error:', e); }
}

// ─── PRODUCTS ─────────────────────────────────────────
async function loadProducts() {
  // ── Skeleton ──
  skTable('productsBody', ['sk-cell-sm','sk-cell-full','sk-cell-md','sk-cell-md',
                           'sk-cell-sm','sk-cell-sm','sk-cell-sm','sk-cell-sm','sk-cell-sm'], 8);
  // ─────────────
  try {
    const [prodRes, discRes] = await Promise.all([
      fetch('/api/admin/products'),
      fetch('/api/admin/discounts'),
    ]);
    allProducts  = await prodRes.json();
    allDiscounts = await discRes.json();

    renderProducts(allProducts);

    // Category filter
    const categories = [...new Set(allProducts.map(p => p.category))];
    const sel        = document.getElementById('categoryFilter');
    sel.innerHTML    = '<option value="">All Categories</option>' +
      categories.map(c => `<option value="${c}">${c}</option>`).join('');
    const datalist = document.getElementById('categoryList');
    if (datalist) datalist.innerHTML = categories.map(c => `<option value="${c}">`).join('');

    // Populate brand datalist
    const brands = [...new Set(
      allProducts.map(p => p.brand?.trim()).filter(Boolean)
    )].sort();
    const brandList = document.getElementById('brandList');
    if (brandList) brandList.innerHTML = brands.map(b => `<option value="${b}">`).join('');

    // Populate brand filter dropdown in toolbar
    const brandFilter = document.getElementById('brandFilter');
    if (brandFilter) {
      brandFilter.innerHTML = '<option value="">All Brands</option>' +
        brands.map(b => `<option value="${b}">${b}</option>`).join('');
    }

    // Populate branch filter dropdown in products toolbar
    const branchSel = document.getElementById('productBranchFilter');
    if (branchSel) {
      const branchMap = {};
      allProducts.forEach(p => {
        (p.branch_stock || []).forEach(bs => {
          if (bs.branch_id && bs.branch?.branch_name)
            branchMap[bs.branch_id] = bs.branch.branch_name;
        });
      });
      branchSel.innerHTML = '<option value="">All Branches</option>' +
        Object.entries(branchMap).map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
    }

  } catch (e) { console.error('Products error:', e); }
}


// ─── Variant Stock Expandable Rows ────────────────────
let expandedProductIds = new Set();

async function toggleVariantRow(productId, btnEl) {
  const expandRow = document.getElementById('variantRow_' + productId);
  if (!expandRow) return;

  if (expandedProductIds.has(productId)) {
    expandedProductIds.delete(productId);
    expandRow.style.display = 'none';
    if (btnEl) btnEl.textContent = '▶';
    return;
  }

  expandedProductIds.add(productId);
  if (btnEl) btnEl.textContent = '▼';
  expandRow.style.display = '';
  expandRow.querySelector('.variant-stock-content').innerHTML =
    '<tr><td colspan="7" style="padding:8px 16px;font-size:12px;color:var(--text-muted);">Loading variants...</td></tr>';

  try {
    const res  = await fetch('/api/variant-stock/' + productId);
    const data = await res.json();

    if (!data.length) {
      expandRow.querySelector('.variant-stock-content').innerHTML =
        '<tr><td colspan="7" style="padding:8px 16px;font-size:12px;color:var(--text-muted);">No variant stock recorded yet.</td></tr>';
      return;
    }

    // Group by branch
    const byBranch = {};
    data.forEach(function(vs) {
      const b = allBranches.find(function(b) { return b.branch_id === vs.branch_id; });
      const bName = b ? b.branch_name : vs.branch_id;
      if (!byBranch[bName]) byBranch[bName] = [];
      byBranch[bName].push(vs);
    });

    var html = '';
    Object.keys(byBranch).forEach(function(branch) {
      var items = byBranch[branch];
      var chips = items.map(function(vs) {
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
      html += '<tr><td colspan="7" style="padding:4px 16px 2px;font-size:11px;font-weight:700;color:var(--text-muted);">📦 ' + branch + '</td></tr>'
            + '<tr><td colspan="7" style="padding:4px 16px 12px;">' + chips + '</td></tr>';
    });

    expandRow.querySelector('.variant-stock-content').innerHTML = html;
  } catch (e) {
    expandRow.querySelector('.variant-stock-content').innerHTML =
      '<tr><td colspan="7" style="padding:8px 16px;color:#ef4444;font-size:12px;">Failed to load variant stock.</td></tr>';
  }
}
window.toggleVariantRow = toggleVariantRow;

function renderProducts(products) {
  _prodFilteredCache = products;
  const start  = (productsPage - 1) * PROD_PAGE_SIZE;
  const paged  = products.slice(start, start + PROD_PAGE_SIZE);
  document.getElementById('productsBody').innerHTML = paged.length
    ? paged.map(p => {
        return `
          <tr style='cursor:pointer;' onclick="toggleVariantRow('${p.product_id}', this.querySelector('.expand-btn'))">
            <td>
              ${p.image_url
                ? `<img src="${p.image_urls?.length ? p.image_urls[0] : p.image_url}" class="product-img-cell" alt="${p.product_name}"/>`
                : `<div class="product-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`
              }
            </td>
            <td><span class='expand-btn' style='margin-right:6px;font-size:11px;color:var(--text-muted);'>▶</span><strong>${p.product_name}</strong></td>
            <td>${p.brand || '—'}</td>
            <td>${p.category}</td>
            <td>${peso(p.price)}</td>
            <td>${badge(p.status)}</td>
            <td style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${p.created_at ? new Date(p.created_at).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }) + '<br><span style="font-size:11px;">' + new Date(p.created_at).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Manila' }) + '</span>' : '—'}</td>
            <td style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }) + '<br><span style="font-size:11px;">' + new Date(p.updated_at).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Manila' }) + '</span>' : '—'}</td>
            <td>
              <div style="display:flex;gap:6px;">
                <button class="btn-icon" onclick="event.stopPropagation();editProduct('${p.product_id}')" title="Edit">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-icon"
                  ${(() => { const totalStock = (p.branch_stock || []).reduce((s, b) => s + Number(b.quantity || 0), 0); const noStock = totalStock === 0; return noStock ? 'disabled title="No stock available" style="opacity:0.35;cursor:not-allowed;"' : `style="color:${p.status === 'active' ? '#ef4444' : '#16a34a'}" title="${p.status === 'active' ? 'Deactivate' : 'Activate'}"`; })()}
                  onclick="event.stopPropagation();openProductToggleModal('${p.product_id}', '${p.product_name.replace(/'/g, "\\'")}', '${p.status}', ${(p.branch_stock || []).reduce((s, b) => s + Number(b.quantity || 0), 0)})">
                  ${p.status === 'active'
                    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
                    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><polyline points="20 6 9 17 4 12"/></svg>`
                  }
                </button>
              </div>
            </td>
          </tr>
          <tr id="variantRow_${p.product_id}" style="display:none;background:var(--surface);"><td colspan="9" style="padding:0;"><table style="width:100%;"><tbody class="variant-stock-content"></tbody></table></td></tr>`;
      }).join('')
    : '<tr><td colspan="7" class="table-empty">No products found</td></tr>';
  renderPagerCustom('productsPagination', products.length, productsPage, PROD_PAGE_SIZE, 'changeProductsPage');
}

function changeProductsPage(page) {
  productsPage = page;
  renderProducts(_prodFilteredCache);
}
window.changeProductsPage = changeProductsPage;

function filterProducts(q) {
  productsPage = 1;
  const filtered = allProducts.filter(p =>
    p.product_name.toLowerCase().includes(q.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(q.toLowerCase())
  );
  renderProducts(filtered);
}

function filterByCategory(cat) {
  productsPage = 1;
  const brand = document.getElementById('brandFilter')?.value || '';
  let filtered = cat
    ? allProducts.filter(p => p.category?.trim().toUpperCase() === cat.trim().toUpperCase())
    : allProducts;
  if (brand) filtered = filtered.filter(p => p.brand?.trim() === brand.trim());
  renderProducts(filtered);
}

function filterByBrand(brand) {
  productsPage = 1;
  const cat = document.getElementById('categoryFilter')?.value || '';
  let filtered = brand
    ? allProducts.filter(p => p.brand?.trim() === brand.trim())
    : allProducts;
  if (cat) filtered = filtered.filter(p => p.category?.trim().toUpperCase() === cat.trim().toUpperCase());
  renderProducts(filtered);
}

// Product Modal
function openProductModal(product = null) {
  document.getElementById('productModalTitle').textContent = product ? 'Edit Product' : 'Add Product';
  document.getElementById('productId').value    = product?.product_id || '';
  document.getElementById('pName').value        = product?.product_name || '';
  document.getElementById('pBrand').value       = product?.brand || '';
  document.getElementById('pCategory').value    = product?.category || '';
  document.getElementById('pPrice').value       = product?.price || '';
  // Stock managed via Inventory — not set in product modal
  const status = product?.status || 'inactive';
  document.getElementById('pStatus').value = status;
  // Update status badge display
  const dot  = document.getElementById('pStatusDot');
  const txt  = document.getElementById('pStatusText');
  const disp = document.getElementById('pStatusDisplay');
  if (dot && txt && disp) {
    const isActive = status === 'active';
    dot.style.background     = isActive ? 'var(--g-400)' : '#ef4444';
    txt.style.color          = isActive ? 'var(--g-400)' : '#ef4444';
    txt.textContent          = isActive ? 'Active' : 'Inactive';
    disp.style.background    = isActive ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)';
    disp.style.borderColor   = isActive ? 'rgba(22,163,74,0.2)' : 'rgba(239,68,68,0.2)';
  }
  document.getElementById('pDescription').value = product?.description || '';

  // Populate discount dropdown
  // Discount managed via Discount modal — not in product creation

  // Clear new image previews
  const previewWrap = document.getElementById('imagePreviewsWrap');
  if (previewWrap) previewWrap.innerHTML = '';
  const pImagesEl = document.getElementById('pImages');
  if (pImagesEl) pImagesEl.value = '';

  // Show existing images when editing
  const existingWrap = document.getElementById('existingImagesWrap');
  const existingInput = document.getElementById('pExistingImages');
  if (existingWrap && existingInput) {
    // Collect existing image URLs — image_urls array or fallback to single image_url
    const existingUrls = product?.image_urls?.length
      ? product.image_urls
      : product?.image_url ? [product.image_url] : [];
    existingInput.value = JSON.stringify(existingUrls);
    renderExistingImages(existingUrls);
  }

  // Available At
  // available_at removed — branch stock controls visibility

  // Option Groups — load existing
  optionGroups = [];
  if (product?.option_groups?.length) {
    optionGroups = JSON.parse(JSON.stringify(product.option_groups)); // deep copy
  }
  renderOptionGroups();

  // Net Weight + Unit
  const netWeightEl   = document.getElementById('pNetWeight');
  const netWeightUnit = document.getElementById('pNetWeightUnit');
  if (netWeightEl)   netWeightEl.value   = product?.net_weight      || '';
  if (netWeightUnit) netWeightUnit.value = product?.net_weight_unit || 'kg';

  _prodUpdateSaveBtn();
  document.getElementById('productModalOverlay').classList.add('open');
  document.getElementById('productModal').classList.add('open');
}

// ── Product Modal Inline Validation ──────────────────────
function _prodSetFieldError(inputId, msg) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.style.borderColor = msg ? '#ef4444' : '';
  const container = input.parentNode.classList.contains('form-group')
    ? input.parentNode
    : (input.parentNode.parentNode || input.parentNode);
  let hint = document.getElementById(inputId + '_perr');
  if (msg) {
    if (!hint) {
      hint = document.createElement('span');
      hint.id        = inputId + '_perr';
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

function _prodClearErrors() {
  ['pName','pBrand','pCategory','pPrice','pNetWeight'].forEach(id => _prodSetFieldError(id, ''));
}

function _prodUpdateSaveBtn() {
  const btn = document.getElementById('productSubmitBtn');
  if (!btn) return;
  const allFilled = ['pName','pBrand','pCategory','pPrice','pNetWeight'].every(id => {
    const v = (document.getElementById(id)?.value || '').trim();
    return v !== '';
  });
  btn.disabled = !allFilled;
  btn.style.opacity = allFilled ? '1' : '0.45';
  btn.style.cursor  = allFilled ? 'pointer' : 'not-allowed';
}

function _prodCheckField(id) {
  const val = (document.getElementById(id)?.value || '').trim();
  switch (id) {
    case 'pName':      _prodSetFieldError(id, !val ? 'Product name is required.' : ''); break;
    case 'pBrand':     _prodSetFieldError(id, !val ? 'Brand is required.' : ''); break;
    case 'pCategory':  _prodSetFieldError(id, !val ? 'Category is required.' : ''); break;
    case 'pPrice': {
      const v = parseFloat(document.getElementById(id)?.value);
      _prodSetFieldError(id, !document.getElementById(id)?.value ? 'Price is required.' : isNaN(v) || v <= 0 ? 'Price must be greater than 0.' : '');
      break;
    }
    case 'pNetWeight': {
      const v = parseFloat(document.getElementById(id)?.value);
      _prodSetFieldError(id, !document.getElementById(id)?.value ? 'Net weight is required.' : isNaN(v) || v <= 0 ? 'Must be greater than 0.' : '');
      break;
    }
  }
  _prodUpdateSaveBtn();
}

function _prodValidate() {
  ['pName','pBrand','pCategory','pPrice','pNetWeight'].forEach(id => _prodCheckField(id));
  return !['pName','pBrand','pCategory','pPrice','pNetWeight'].some(id => {
    const hint = document.getElementById(id + '_perr');
    return hint && hint.textContent;
  });
}

function closeProductModal() {
  document.getElementById('productModalOverlay').classList.remove('open');
  document.getElementById('productModal').classList.remove('open');
  document.getElementById('productForm').reset();
  _prodClearErrors();
  const saveBtn = document.getElementById('productSubmitBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.45'; saveBtn.style.cursor = 'not-allowed'; }
  const previewWrap = document.getElementById('imagePreviewsWrap');
  if (previewWrap) previewWrap.innerHTML = '';
  const existingWrap = document.getElementById('existingImagesWrap');
  if (existingWrap) existingWrap.innerHTML = '';
  const pImagesEl = document.getElementById('pImages');
  if (pImagesEl) pImagesEl.value = '';
  const existingInput = document.getElementById('pExistingImages');
  if (existingInput) existingInput.value = '[]';
  optionGroups = [];
  selectedImageFiles = [];
  const ogWrap = document.getElementById('optionGroupsWrap');
  if (ogWrap) ogWrap.innerHTML = '';
  const ogEl = document.getElementById('pOptionGroups');
  if (ogEl) ogEl.value = '[]';
  const nwEl     = document.getElementById('pNetWeight');
  if (nwEl) nwEl.value = '';
  const nwUnitEl = document.getElementById('pNetWeightUnit');
  if (nwUnitEl) nwUnitEl.value = 'kg';
  const previewWrapEl = document.getElementById('imagePreviewsWrap');
  if (previewWrapEl) previewWrapEl.innerHTML = '';
}

// ─── Variant Chip Functions ───────────────────────────

// ─── Option Group Functions ───────────────────────────

let optionGroups = [];

function renderOptionGroups() {
  const wrap = document.getElementById('optionGroupsWrap');
  if (!wrap) return;
  wrap.innerHTML = optionGroups.map((g, gi) => `
    <div style="border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--surface-1);margin-bottom:4px;">
      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
        <input
          type="text"
          class="form-input"
          placeholder="Group label (e.g. Size, Color)"
          value="${g.label}"
          oninput="updateGroupLabel(${gi}, this.value)"
          style="flex:1;"
        />
        <button type="button" onclick="removeOptionGroup(${gi})"
          style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;white-space:nowrap;">
          Remove
        </button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;min-height:28px;">
        ${g.choices.map((c, ci) => `
          <span onclick="removeChoice(${gi}, ${ci})" style="
            display:inline-flex;align-items:center;gap:4px;
            background:rgba(22,163,74,0.12);color:#16a34a;
            border:1px solid rgba(22,163,74,0.3);
            border-radius:999px;padding:4px 10px;font-size:12px;
            font-weight:600;cursor:pointer;"
            title="Click to remove">
            ${c} &times;
          </span>`).join('')}
      </div>
      <div style="display:flex;gap:8px;">
        <input
          type="text"
          class="form-input"
          placeholder="Add choice (e.g. XS, Red...)"
          id="choiceInput_${gi}"
          style="flex:1;font-size:13px;"
          onkeydown="if(event.key==='Enter'){event.preventDefault();addChoice(${gi});}"
        />
        <button type="button" onclick="addChoice(${gi})"
          class="btn btn-cancel" style="white-space:nowrap;font-size:12px;">
          + Add
        </button>
      </div>
    </div>
  `).join('');
  const el = document.getElementById('pOptionGroups');
  if (el) el.value = JSON.stringify(optionGroups);
}

function addOptionGroup() {
  optionGroups.push({ label: '', choices: [] });
  renderOptionGroups();
}

function removeOptionGroup(gi) {
  optionGroups.splice(gi, 1);
  renderOptionGroups();
}

function updateGroupLabel(gi, val) {
  optionGroups[gi].label = val;
  const el = document.getElementById('pOptionGroups');
  if (el) el.value = JSON.stringify(optionGroups);
}

function addChoice(gi) {
  const input = document.getElementById(`choiceInput_${gi}`);
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  if (!optionGroups[gi].choices.includes(val)) {
    optionGroups[gi].choices.push(val);
    renderOptionGroups();
  }
  input.value = '';
}

function removeChoice(gi, ci) {
  optionGroups[gi].choices.splice(ci, 1);
  renderOptionGroups();
}

// Legacy variant functions — kept for compatibility
function renderVariantChips(variants) {}
function addVariantChip() {}
function removeVariantChip(index) {}


async function editProduct(id) {
  const product = allProducts.find(p => p.product_id === id);
  if (product) openProductModal(product);
}

// ─── Product Toggle Modal ─────────────────────────────
let _toggleProductId     = null;
let _toggleProductStatus = null;

function openProductToggleModal(id, name, status, totalStock) {
  if (totalStock === 0) return;
  _toggleProductId     = id;
  _toggleProductStatus = status;
  const isActive = status === 'active';
  document.getElementById('productToggleModalTitle').textContent =
    isActive ? 'Deactivate Product' : 'Activate Product';
  document.getElementById('productToggleModalDesc').innerHTML = isActive
    ? `Deactivate <strong>${name}</strong>? This product will no longer be visible to staff in POS and inventory.`
    : `Activate <strong>${name}</strong>? This product will become visible in POS and inventory.`;
  const btn = document.getElementById('productToggleConfirmBtn');
  btn.textContent = isActive ? 'Deactivate' : 'Activate';
  btn.style.background   = isActive ? '#ef4444' : '#16a34a';
  btn.style.color        = '#fff';
  btn.style.borderColor  = isActive ? '#ef4444' : '#16a34a';
  document.getElementById('productToggleModalOverlay').classList.add('open');
  document.getElementById('productToggleModal').classList.add('open');
}

function closeProductToggleModal() {
  document.getElementById('productToggleModalOverlay').classList.remove('open');
  document.getElementById('productToggleModal').classList.remove('open');
  _toggleProductId = _toggleProductStatus = null;
}

async function confirmProductToggle() {
  if (!_toggleProductId) return;
  const isActive = _toggleProductStatus === 'active';
  try {
    let res;
    if (isActive) {
      // Deactivate — existing DELETE endpoint
      res = await fetch(`/api/admin/products/${_toggleProductId}`, { method: 'DELETE' });
    } else {
      // Activate — PATCH with new status
      res = await fetch(`/api/admin/products/${_toggleProductId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });
    }
    if (res.ok) {
      showToast(isActive ? 'Product deactivated.' : 'Product activated.');
      closeProductToggleModal();
      invalidateSection('products'); loadProducts();
    } else {
      showToast(isActive ? 'Failed to deactivate product.' : 'Failed to activate product.', 'error');
    }
  } catch (e) { showToast('Error.', 'error'); }
}
window.openProductToggleModal  = openProductToggleModal;
window.closeProductToggleModal = closeProductToggleModal;
window.confirmProductToggle    = confirmProductToggle;

async function submitProduct(e) {
  e.preventDefault();
  const submitBtn = e.submitter || document.querySelector('#productForm button[type="submit"]');

  // ── Inline validation ─────────────────────────────────
  if (!_prodValidate()) return;
  // ──────────────────────────────────────────────────────

  setButtonLoading(submitBtn, true);
  const id       = document.getElementById('productId').value;
  const formData = new FormData();
  formData.append('product_name',  document.getElementById('pName').value);
  formData.append('brand',         document.getElementById('pBrand').value);
  formData.append('category',      document.getElementById('pCategory').value);
  formData.append('price',         document.getElementById('pPrice').value);
  formData.append('quantity',      '0'); // Stock managed via Inventory

  // Multiple images — use selectedImageFiles array (supports removal)
  selectedImageFiles.forEach(file => {
    formData.append('images', file);
  });
  // Keep existing images not removed
  const existingInput = document.getElementById('pExistingImages');
  if (existingInput) formData.append('existing_images', existingInput.value);
  formData.append('status',        document.getElementById('pStatus').value);
  formData.append('description',   document.getElementById('pDescription').value);
  formData.append('discount_id', ''); // managed via Discount modal
  // available_at removed — not needed anymore
  const ogEl2 = document.getElementById('pOptionGroups');
  formData.append('option_groups', ogEl2 ? ogEl2.value : '[]');
  const nwEl2   = document.getElementById('pNetWeight');
  const nwUnit2 = document.getElementById('pNetWeightUnit');
  formData.append('net_weight',      nwEl2   ? (nwEl2.value   || '0')  : '0');
  formData.append('net_weight_unit', nwUnit2 ? (nwUnit2.value || 'kg') : 'kg');
  // pImage removed — using pImages (multiple) via selectedImageFiles array

  try {
    const url    = id ? `/api/admin/products/${id}` : '/api/admin/products';
    const method = id ? 'PUT' : 'POST';
    const res    = await fetch(url, { method, body: formData });
    if (res.ok) {
      showToast(id ? 'Product updated!' : 'Product added!');
      closeProductModal();
      invalidateSection('products'); loadProducts();
    } else {
      const data = await res.json();
      showToast(data.error || 'Failed to save product.', 'error');
    }
  } catch (e) { showToast('Error saving product.', 'error'); }
  finally { setButtonLoading(submitBtn, false); }
}

// Image preview
// ─── Multiple Image Functions ─────────────────────────

// Track selected new image files separately so we can remove individually
let selectedImageFiles = [];

function previewImages(input) {
  const existingCount = JSON.parse(document.getElementById('pExistingImages')?.value || '[]').length;
  const maxNew        = 20 - existingCount;
  const newFiles      = Array.from(input.files).slice(0, maxNew);

  // Merge with already selected files (avoid duplicates by name)
  newFiles.forEach(f => {
    if (!selectedImageFiles.find(sf => sf.name === f.name && sf.size === f.size)) {
      selectedImageFiles.push(f);
    }
  });

  // Trim to max
  if (selectedImageFiles.length > maxNew) selectedImageFiles = selectedImageFiles.slice(0, maxNew);

  renderNewImagePreviews();

  // Reset file input so same file can be re-added after removal
  input.value = '';
}

function renderNewImagePreviews() {
  const wrap          = document.getElementById('imagePreviewsWrap');
  const existingCount = JSON.parse(document.getElementById('pExistingImages')?.value || '[]').length;
  if (!wrap) return;
  wrap.innerHTML = '';

  selectedImageFiles.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = e => {
      const div       = document.createElement('div');
      div.style.cssText = 'position:relative;width:80px;height:80px;flex-shrink:0;';
      const isMain    = idx === 0 && existingCount === 0;
      div.innerHTML   = `
        <img src="${e.target.result}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:2px solid var(--border);" />
        ${isMain ? '<span style="position:absolute;bottom:2px;left:2px;background:rgba(22,163,74,0.9);color:#fff;font-size:9px;padding:1px 4px;border-radius:4px;">Main</span>' : ''}
        <button type="button" onclick="removeNewImage(${idx})"
          style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;border:none;cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,0.3);">
          &times;
        </button>
      `;
      wrap.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

function removeNewImage(idx) {
  selectedImageFiles.splice(idx, 1);
  renderNewImagePreviews();
}

function renderExistingImages(urls) {
  const wrap = document.getElementById('existingImagesWrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  urls.forEach((url, idx) => {
    const div = document.createElement('div');
    div.style.cssText = 'position:relative;width:80px;height:80px;';
    div.innerHTML = `
      <img src="${url}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:2px solid var(--border);" onerror="this.src=''" />
      ${idx === 0 ? '<span style="position:absolute;bottom:2px;left:2px;background:rgba(22,163,74,0.9);color:#fff;font-size:9px;padding:1px 4px;border-radius:4px;">Main</span>' : ''}
      <button onclick="removeExistingImage(${idx})" type="button" style="position:absolute;top:2px;right:2px;background:rgba(239,68,68,0.9);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">&times;</button>
    `;
    wrap.appendChild(div);
  });
}

function removeExistingImage(idx) {
  const input   = document.getElementById('pExistingImages');
  const current = JSON.parse(input?.value || '[]');
  current.splice(idx, 1);
  input.value = JSON.stringify(current);
  renderExistingImages(current);
}



// ─── INVENTORY ────────────────────────────────────────
// Store all inventory records globally for filtering
let allInventory = [];


// ─── Branch Stock Summary in Inventory ───────────────
function updateBranchStockSummary(products) {
  allBranchProducts = products; // store for pagination
  const wrap = document.getElementById('branchStockSummary');
  if (!wrap) return;

  // Group by branch — store product_id for variant lookup
  const branchMap = {};
  products.forEach(p => {
    (p.branch_stock || []).forEach(bs => {
      const name     = bs.branch?.branch_name || 'Unknown';
      const branchId = bs.branch_id;
      if (!branchMap[name]) branchMap[name] = { branch_id: branchId, items: [] };
      branchMap[name].items.push({
        product_id:   p.product_id,
        product_name: p.product_name,
        quantity:     bs.quantity,
        image_url:    p.image_url,
        image_urls:   p.image_urls,
        option_groups: p.option_groups || [],
      });
    });
  });

  if (!Object.keys(branchMap).length) {
    if (allBranchProducts.length > 0) {
      wrap.innerHTML = '<div style="display:flex;align-items:center;gap:10px;padding:16px;color:var(--text-muted);font-size:13px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;animation:spin 1s linear infinite;flex-shrink:0;"><circle cx="12" cy="12" r="10" stroke-dasharray="40" stroke-dashoffset="20"/></svg>Loading branch stock...</div>';
    } else {
      wrap.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No branch stock data found.</p>';
    }
    return;
  }

  var html = '<div class="branch-stock-grid">';
  Object.keys(branchMap).forEach(function(branch) {
    var branchId  = branchMap[branch].branch_id;
    var allItems  = branchMap[branch].items.filter(i => {
      const q = Number(i.quantity);
      if (branchStockLevelVal === 'critical_stock' && !(q > 0 && q <= 5))  return false;
      if (branchStockLevelVal === 'low_stock'      && !(q > 5 && q <= 10)) return false;
      if (branchStockLevelVal === 'out_of_stock'   && q !== 0)             return false;
      if (branchStockSearchVal && !i.product_name.toLowerCase().includes(branchStockSearchVal)) return false;
      return true;
    });
    var items     = allItems.slice((branchStockPage - 1) * ITEMS_PER_PAGE, branchStockPage * ITEMS_PER_PAGE);
    var rows     = items.map(function(i) {
      var imgHtml = i.image_url
        ? '<img src="' + (i.image_urls?.length ? i.image_urls[0] : i.image_url) + '" class="product-img-cell" style="width:32px;height:32px;" alt="' + i.product_name + '"/>'
        : '<div class="product-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>';
      const bq     = Number(i.quantity);
      var qtyClass = bq === 0 ? 'out-stock' : bq <= 5 ? 'low-stock' : 'in-stock';
      var badge    = bq === 0
        ? '<span class="badge badge--red">Out of Stock</span>'
        : bq <= 5
          ? '<span class="badge badge--red">Critical Level</span>'
          : bq <= 10
            ? '<span class="badge badge--yellow">Low Stock</span>'
            : '<span class="badge badge--green">In Stock</span>';
      var hasVariants = i.option_groups && i.option_groups.length > 0;
      var expandBtn   = hasVariants
        ? '<span class="inv-expand-btn" style="margin-left:6px;font-size:10px;color:var(--text-muted);cursor:pointer;" onclick="toggleInvVariantRow(\'' + i.product_id + '\',\'' + branchId + '\',this)">▶</span>'
        : '';
      return '<tr style="cursor:' + (hasVariants ? 'pointer' : 'default') + ';" '
        + (hasVariants ? 'onclick="toggleInvVariantRow(\'' + i.product_id + '\',\'' + branchId + '\',this.querySelector(\'.inv-expand-btn\'))"' : '')
        + '>'
        + '<td><div style="display:flex;align-items:center;gap:8px;">' + imgHtml
        + '<span style="font-size:12px;font-weight:600;">' + i.product_name + '</span>'
        + expandBtn + '</div></td>'
        + '<td style="text-align:center;"><span class="branch-stock-qty ' + qtyClass + '">' + i.quantity + '</span></td>'
        + '<td>' + badge + '</td>'
        + '</tr>'
        + '<tr id="invVarRow_' + i.product_id + '_' + branchId + '" style="display:none;background:var(--surface);">'
        + '<td colspan="3" style="padding:0;"><div class="inv-variant-content" style="padding:8px 16px;"></div></td>'
        + '</tr>';
    }).join('');

    html += '<div class="branch-stock-card">'
      + '<div class="branch-stock-header"><span> </span>'
      + '<span class="branch-stock-name">' + branch + '</span>'
      + '<span class="branch-stock-count">' + allItems.length + ' items</span></div>'
      + '<table class="data-table" style="margin:0;">'
      + '<thead><tr><th>Product</th><th style="text-align:center;">Stock</th><th>Status</th></tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table></div>';
  });
  html += '</div>';
  wrap.innerHTML = html;

  // Pagination — use filtered count
  var maxItems = 0;
  Object.keys(branchMap).forEach(function(b) {
    var filteredLen = branchMap[b].items.filter(i => {
      const q = Number(i.quantity);
      if (branchStockLevelVal === 'critical_stock' && !(q > 0 && q <= 5))  return false;
      if (branchStockLevelVal === 'low_stock'      && !(q > 5 && q <= 10)) return false;
      if (branchStockLevelVal === 'out_of_stock'   && q !== 0)             return false;
      if (branchStockSearchVal && !i.product_name.toLowerCase().includes(branchStockSearchVal)) return false;
      return true;
    }).length;
    if (filteredLen > maxItems) maxItems = filteredLen;
  });
  var pagerEl = document.getElementById('branchStockPagination');
  if (!pagerEl) {
    pagerEl = document.createElement('div');
    pagerEl.id = 'branchStockPagination';
    pagerEl.style.cssText = 'padding:0 1rem;margin-top:8px;';
    wrap.after(pagerEl);
  }
  renderPager('branchStockPagination', maxItems, branchStockPage, 'changeBranchStockPage');
}

async function toggleInvVariantRow(productId, branchId, btnEl) {
  const rowId  = 'invVarRow_' + productId + '_' + branchId;
  const row    = document.getElementById(rowId);
  if (!row) return;

  if (row.style.display !== 'none') {
    row.style.display = 'none';
    if (btnEl) btnEl.textContent = '▶';
    return;
  }

  row.style.display = '';
  if (btnEl) btnEl.textContent = '▼';

  const cont = row.querySelector('.inv-variant-content');
  cont.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Loading variants...</span>';

  try {
    const res  = await fetch('/api/variant-stock/' + productId + '?branch_id=' + branchId);
    const data = await res.json();

    if (!data.length) {
      cont.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">No variant stock recorded yet.</span>';
      return;
    }

    var chips = data.map(function(vs) {
      var opts  = Object.entries(vs.options || {}).map(function(e) { return e[0] + ': ' + e[1]; }).join(', ');
      var qty   = vs.quantity || 0;
      var color = qty === 0 ? '#ef4444' : qty <= 5 ? '#f59e0b' : 'var(--g-400)';
      var bg    = qty === 0 ? 'rgba(239,68,68,0.05)' : qty <= 5 ? 'rgba(245,158,11,0.05)' : 'rgba(22,163,74,0.05)';
      return '<div style="padding:5px 10px;border-radius:8px;border:1.5px solid ' + color + ';background:' + bg + ';font-size:12px;display:inline-block;margin:2px;">'
        + '<span style="font-weight:500;">' + opts + '</span>'
        + '<span style="margin-left:8px;font-weight:700;color:' + color + ';">' + qty + ' units</span>'
        + (qty === 0 ? ' ⚠️' : '') + '</div>';
    }).join('');

    cont.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + chips + '</div>';
  } catch (e) {
    cont.innerHTML = '<span style="font-size:12px;color:#ef4444;">Failed to load variants.</span>';
  }
}
window.toggleInvVariantRow = toggleInvVariantRow;

async function loadInventory() {
  // ── Skeleton ──
  skStats(['invStatRestock','invStatTransfer','invStatAdjust','invStatNet']);
  document.getElementById('branchStockSummary').innerHTML =
    '<div style="padding:1rem;display:flex;flex-direction:column;gap:10px;">' +
    '<span class="skeleton sk-block" style="width:60%;height:14px;"></span>' +
    '<span class="skeleton sk-block" style="width:80%;height:14px;"></span>' +
    '<span class="skeleton sk-block" style="width:50%;height:14px;"></span>' +
    '</div>';
  skTable('inventoryBody', ['sk-cell-sm','sk-cell-full','sk-cell-md','sk-cell-sm',
                            'sk-cell-sm','sk-cell-sm','sk-cell-md','sk-cell-md',
                            'sk-cell-sm','sk-cell-full'], 8);
  // ─────────────
  try {
    const [invRes, prodRes] = await Promise.all([
      fetch('/api/admin/inventory'),
      fetch('/api/admin/products'),
    ]);
    allInventory    = await invRes.json();
    const products  = await prodRes.json();

    // Update branch stock summary with products that have branch_stock
    updateBranchStockSummary(products);


    // Check low stock per branch — two-tier: critical (≤5) and low (6–10)
    const getBranchTotal   = p => p.branch_stock?.length
      ? p.branch_stock.reduce((s, bs) => s + Number(bs.quantity), 0)
      : Number(p.quantity);
    const hasCritBranch    = p => p.branch_stock?.some(bs => Number(bs.quantity) > 0 && Number(bs.quantity) <= 5);
    const hasLowBranch     = p => !hasCritBranch(p) && p.branch_stock?.some(bs => Number(bs.quantity) > 0 && Number(bs.quantity) <= 10);
    const criticalInv      = products.filter(p => p.status === 'active' && hasCritBranch(p));
    const lowInv           = products.filter(p => p.status === 'active' && hasLowBranch(p));
    const banner           = document.getElementById('lowStockBanner');
    const bannerText       = document.getElementById('lowStockBannerText');
    const bannerBtn        = document.getElementById('lowStockBannerBtn');
    const totalAlert       = criticalInv.length + lowInv.length;

    if (totalAlert > 0 && banner) {
      banner.style.display = 'flex';
      if (criticalInv.length > 0) {
        // Critical takes priority — red banner
        banner.style.background = 'rgba(239,68,68,0.1)';
        banner.style.border     = '1px solid rgba(239,68,68,0.3)';
        bannerText.style.color  = '#ef4444';
        if (bannerBtn) bannerBtn.style.color = '#ef4444';
        banner.querySelector('svg').style.stroke = '#ef4444';
        bannerText.textContent = `🔴 ${criticalInv.length} product${criticalInv.length > 1 ? 's are' : ' is'} at critical stock level (≤5 units)!`
          + (lowInv.length > 0 ? ` · ${lowInv.length} more running low.` : '');
      } else {
        // Only low stock — amber banner
        banner.style.background = 'rgba(245,158,11,0.1)';
        banner.style.border     = '1px solid rgba(245,158,11,0.3)';
        bannerText.style.color  = '#f59e0b';
        if (bannerBtn) bannerBtn.style.color = '#f59e0b';
        banner.querySelector('svg').style.stroke = '#f59e0b';
        bannerText.textContent = `🟡 ${lowInv.length} product${lowInv.length > 1 ? 's are' : ' is'} running low on stock (6–10 units).`;
      }

      // Also update nav badge
      const navInv = document.getElementById('navInventory');
      if (navInv && !navInv.querySelector('.nav-badge')) {
        const badge = document.createElement('span');
        badge.className   = 'nav-badge';
        badge.textContent = totalAlert;
        badge.style.cssText = 'background:#ef4444;color:#fff;border-radius:999px;font-size:10px;padding:1px 6px;margin-left:auto;font-weight:700;';
        navInv.appendChild(badge);
      } else if (navInv) {
        const b = navInv.querySelector('.nav-badge');
        if (b) b.textContent = totalAlert;
      }
    } else if (banner) {
      banner.style.display = 'none';
    }

    renderInventory(allInventory);
  } catch (e) { console.error('Inventory error:', e); }
}

function getMovementType(i) {
  const note = (i.note || '').toLowerCase();
  const qty  = Number(i.quantity_added);
  if (note.includes('[loss]') || note.includes('[stolen]') || note.includes('[damaged]') || note.includes('[expired]') || note.includes('[other]') || note.includes('adjustment'))
    return { label: 'Adjustment', color: '#ef4444', icon: '↓', bg: 'rgba(239,68,68,0.1)' };
  if (note.includes('transfer') || (i.from_branch_id && i.to_branch_id))
    return { label: 'Transfer', color: '#3b82f6', icon: '⇄', bg: 'rgba(59,130,246,0.1)' };
  if (note.includes('sale') || note.includes('order #') || note.includes('sold'))
    return { label: 'Sale', color: '#f59e0b', icon: '🛒', bg: 'rgba(245,158,11,0.1)' };
  if (qty > 0)
    return { label: 'Restock', color: 'var(--g-400)', icon: '↑', bg: 'rgba(22,163,74,0.1)' };
  if (qty < 0)
    return { label: 'Deduction', color: '#ef4444', icon: '↓', bg: 'rgba(239,68,68,0.1)' };
  return { label: 'Other', color: '#9ca3af', icon: '•', bg: 'rgba(107,114,128,0.1)' };
}

async function filterInventoryType(val, el) {
  if (val === 'low_stock' || val === 'critical_stock') {
    // Show products by stock level tier
    try {
      const res      = await fetch('/api/admin/products');
      const products = await res.json();
      const getBranchTotalF  = p => p.branch_stock?.length
        ? p.branch_stock.reduce((s, bs) => s + Number(bs.quantity), 0)
        : Number(p.quantity);
      const hasCritBranchF   = p => p.branch_stock?.some(bs => Number(bs.quantity) > 0 && Number(bs.quantity) <= 5);
      const hasLowBranchF    = p => !hasCritBranchF(p) && p.branch_stock?.some(bs => Number(bs.quantity) > 0 && Number(bs.quantity) <= 10);

      let filtered;
      let headerHtml;
      if (val === 'critical_stock') {
        filtered   = products.filter(p => p.status === 'active' && hasCritBranchF(p));
        headerHtml = `<tr><td colspan="9" style="padding:1rem;"><strong style="color:#ef4444;">🔴 Critical Level Products (≤ 5 units) — Urgent Restock Needed</strong></td></tr>`;
      } else {
        // low_stock shows both tiers, critical first
        const critical = products.filter(p => p.status === 'active' && hasCritBranchF(p));
        const low      = products.filter(p => p.status === 'active' && hasLowBranchF(p));
        filtered   = [...critical, ...low];
        headerHtml = `<tr><td colspan="9" style="padding:1rem;"><strong style="color:#f59e0b;">⚠️ Stock Alert — ${critical.length} Critical (≤5) · ${low.length} Low Stock (6–10)</strong></td></tr>`;
      }

      document.getElementById('inventoryBody').innerHTML = filtered.length
        ? headerHtml + filtered.map(p => {
            const isCrit = hasCritBranchF(p);
            const color  = isCrit ? '#ef4444' : '#f59e0b';
            const bg     = isCrit ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)';
            const branchBreakdown = p.branch_stock?.length
              ? p.branch_stock.map(bs => `${bs.branch?.branch_name || 'Branch'}: ${bs.quantity}`).join(', ')
              : `${getBranchTotalF(p)} units`;
            return `
            <tr style="background:${bg};">
              <td><span class='expand-btn' style='margin-right:6px;font-size:11px;color:var(--text-muted);'>▶</span><strong>${p.product_name}</strong></td>
              <td>—</td>
              <td colspan="2"><span style="color:${color};font-weight:700;">${branchBreakdown} remaining</span></td>
              <td>${p.category}</td>
              <td colspan="4">—</td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="9" class="table-empty">✅ All products have sufficient stock</td></tr>';
    } catch (e) { console.error('Stock filter error:', e); }
    return;
  }
  inventoryTypeFilterVal = val;
  invPage = 1;
  applyInventoryFilters();
}
window.filterInventoryType = filterInventoryType;

function renderInventory(data) {
  // Only update master when called from loadInventory (full dataset)
  if (!inventorySearchVal && !inventoryTypeFilterVal) allInventory = data;
  const filteredInv = data;
  const paged = paginate(filteredInv, invPage);
  // Update stats
  const restocks    = data.filter(i => getMovementType(i).label === 'Restock');
  const transfers   = data.filter(i => getMovementType(i).label === 'Transfer');
  const adjustments = data.filter(i => getMovementType(i).label === 'Adjustment');
  const totalRestock  = restocks.reduce((s,i)    => s + Math.abs(Number(i.quantity_added)), 0);
  const totalTransfer = transfers.reduce((s,i)   => s + Math.abs(Number(i.quantity_added)), 0);
  const totalAdjust   = adjustments.reduce((s,i) => s + Math.abs(Number(i.quantity_added)), 0);
  const netChange     = data.reduce((s,i)        => s + Number(i.quantity_added), 0);

  const el = id => document.getElementById(id);
  if (el('invStatRestock'))  el('invStatRestock').textContent  = `+${totalRestock} units`;
  if (el('invStatTransfer')) el('invStatTransfer').textContent = `${totalTransfer} units`;
  if (el('invStatAdjust'))   el('invStatAdjust').textContent   = `-${totalAdjust} units`;
  if (el('invStatNet'))      el('invStatNet').textContent      = `${netChange >= 0 ? '+' : ''}${netChange} units`;
  if (el('invRecordCount'))  el('invRecordCount').textContent  = `${data.length} record${data.length !== 1 ? 's' : ''}`;

  // Render table
  document.getElementById('inventoryBody').innerHTML = paged.length
    ? paged.map(i => {
        const type = getMovementType(i);
        const qty  = Number(i.quantity_added);
        const qtyDisplay = qty >= 0
          ? `<strong style="color:var(--g-400);">+${qty}</strong>`
          : `<strong style="color:#ef4444;">${qty}</strong>`;
        return `
        <tr>
          <td><span style="background:${type.bg};color:${type.color};border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;white-space:nowrap;">${type.icon} ${type.label}</span></td>
          <td>
            <strong>${i.product?.product_name || '—'}</strong>
            ${i.variant_options && Object.keys(i.variant_options).length > 0
              ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + Object.entries(i.variant_options).map(function(e){return e[0]+': '+e[1];}).join(', ') + '</div>'
              : ''}
          </td>
          <td>${i.staff ? `${i.staff.fname} ${i.staff.lname}` : '—'}</td>
          <td>${qtyDisplay}</td>
          <td>${i.quantity_before}</td>
          <td>${i.quantity_after}</td>
          <td>${i.from_branch?.branch_name || '—'}</td>
          <td>${i.to_branch?.branch_name   || '—'}</td>
          <td>${(() => {
            const raw = i.date || null;
            if (!raw) return '—';
            // i.date is a date-only field (no time) — parse as local date to avoid timezone shift
            const [y, mo, day] = raw.toString().split('T')[0].split('-').map(Number);
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return `${months[mo - 1]} ${day}, ${y}`;
          })()}</td>
          <td style="max-width:200px;font-size:12px;">${i.note || '—'}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="10" class="table-empty">No inventory records found</td></tr>';
  renderPager('invPagination', filteredInv.length, invPage, 'changeInvPage');
}

let inventorySearchVal = '';
function filterInventorySearch(q) {
  inventorySearchVal = (q || '').toLowerCase().trim();
  invPage = 1;
  applyInventoryFilters();
}

function applyInventoryFilters() {
  let filtered = allInventory;
  if (inventorySearchVal) {
    filtered = filtered.filter(i =>
      (i.product?.product_name || '').toLowerCase().includes(inventorySearchVal) ||
      (i.note || '').toLowerCase().includes(inventorySearchVal)
    );
  }
  if (inventoryTypeFilterVal) {
    filtered = filtered.filter(i =>
      getMovementType(i).label.toLowerCase().includes(inventoryTypeFilterVal)
    );
  }
  renderInventory(filtered);
}

function filterByBranch(branchId) {
  inventoryBranchFilter = branchId;
  productsPage = 1;
  if (!branchId) {
    renderProducts(allProducts);
    return;
  }
  const filtered = allProducts.filter(p =>
    (p.branch_stock || []).some(bs => bs.branch_id === branchId)
  );
  renderProducts(filtered);
}
window.filterByBranch = filterByBranch;

function filterBranchStock(q) {
  branchStockSearchVal = (q || '').toLowerCase().trim();
  branchStockPage = 1;
  updateBranchStockSummary(allBranchProducts);
}
window.filterBranchStock = filterBranchStock;

function filterBranchStockLevel(val) {
  branchStockLevelVal = val || '';
  branchStockPage = 1;
  updateBranchStockSummary(allBranchProducts);
}
window.filterBranchStockLevel = filterBranchStockLevel;



// ─── ADD STOCK Modal ─────────────────────────────────

async function openAddStockModal() {
  if (!allProducts.length) { invalidateSection('products'); await loadProducts(); }
  if (!allBranches.length) await loadBranches();

  // Populate branch select
  const branchSel = document.getElementById('addStockBranch');
  if (branchSel) branchSel.innerHTML = '<option value="">Select branch</option>' +
    allBranches.map(b => `<option value="${b.branch_id}">${b.branch_name}</option>`).join('') +
    '<option value="both">📦 Both Branches</option>';

  // Clear and add first product row
  document.getElementById('addStockItems').innerHTML = '';
  document.getElementById('addStockNote').value = '';
  addStockItemRow();

  _setInvBtn('addStockSubmitBtn', false);
  // Live check — branch change + item row inputs (event delegation)
  document.getElementById('addStockBranch')?.addEventListener('change', _addStockUpdateBtn);
  document.getElementById('addStockItems')?.addEventListener('input',  _addStockUpdateBtn);
  document.getElementById('addStockItems')?.addEventListener('change', _addStockUpdateBtn);
  document.getElementById('addStockModalOverlay')?.classList.add('open');
  document.getElementById('addStockModal')?.classList.add('open');
}

let addStockRowCount = 0;

/* ── Shared autocomplete helper ──────────────────────────────────────────── */
function buildProductAutocomplete(container, { inputId, hiddenId, listId, onSelect }) {
  function stockLabel(p) {
    return p.branch_stock?.length
      ? p.branch_stock.map(b => `${b.branch?.branch_name||'Branch'}: ${b.quantity}`).join(' | ')
      : `Stock: ${p.quantity}`;
  }

  const input  = container.querySelector(`#${inputId}`);
  const hidden = container.querySelector(`#${hiddenId}`);
  if (!input || !hidden) return;

  // Create a FIXED-position list appended to body — escapes all overflow clipping
  const list = document.createElement('div');
  list.id = listId;
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
    const matches = allProducts.filter(p =>
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
    input.dataset.selectedId = p.product_id;
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
    input.dataset.selectedId = '';
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
  // Reposition if user scrolls inside the modal while list is open
  input.closest('.modal')?.addEventListener('scroll', positionList);

  const clearBtn = container.querySelector('.ac-clear');
  if (clearBtn) clearBtn.addEventListener('click', clearSelection);

  // Expose clearSelection + cleanup so modal close can reset and remove the body-appended list
  container._acClear = () => {
    clearSelection();
    list.remove();
  };
}

/* HTML template for an autocomplete product field */
function productAcHTML(inputId, hiddenId) {
  return `
    <div style="display:flex;align-items:center;gap:4px;">
      <input id="${inputId}" type="text" class="form-input" placeholder="Type to search product..." autocomplete="off"
        style="flex:1;" />
      <button type="button" class="ac-clear" title="Clear"
        style="display:none;align-items:center;justify-content:center;width:26px;height:26px;border:none;background:#ef4444;color:#fff;border-radius:6px;cursor:pointer;font-size:14px;flex-shrink:0;">×</button>
    </div>
    <input id="${hiddenId}" type="hidden" required />`;
}

/* ── Add Stock rows ──────────────────────────────────────────────────────── */
function addStockItemRow() {
  addStockRowCount++;
  const rowId  = 'addStockRow_' + addStockRowCount;
  const wrap   = document.getElementById('addStockItems');
  const row    = document.createElement('div');
  row.id       = rowId;
  row.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;position:relative;';

  const inputId  = `asInput_${addStockRowCount}`;
  const hiddenId = `asHidden_${addStockRowCount}`;
  const listId   = `asList_${addStockRowCount}`;

  row.innerHTML = `
    ${addStockRowCount > 1 ? `<button type="button" onclick="this.parentElement.remove();_addStockUpdateBtn();" style="position:absolute;top:8px;right:8px;background:#ef4444;color:#fff;border:none;border-radius:6px;width:22px;height:22px;cursor:pointer;font-size:14px;line-height:1;">×</button>` : ''}
    <div class="form-group" style="margin-bottom:8px;">
      <label class="form-label" style="font-size:11px;">Product <span class="req">*</span></label>
      ${productAcHTML(inputId, hiddenId)}
    </div>
    <div class="add-stock-variant-wrap" style="display:none;margin-bottom:8px;">
      <label class="form-label" style="font-size:11px;">Variant <span style="font-size:10px;color:var(--text-muted);">(optional)</span></label>
      <div class="add-stock-variant-selects" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
    </div>
    <div class="form-group" style="margin:0;">
      <label class="form-label" style="font-size:11px;">Quantity <span class="req">*</span></label>
      <input type="number" class="form-input add-stock-qty" min="1" required placeholder="e.g. 10"/>
    </div>
  `;
  wrap.appendChild(row);

  buildProductAutocomplete(row, {
    inputId, hiddenId, listId: `asList_${addStockRowCount}`,
    onSelect: (p) => { loadRowVariantsByProduct(p, rowId); _addStockUpdateBtn(); },
  });
}

function loadRowVariantsByProduct(product, rowId) {
  const row  = document.getElementById(rowId);
  const wrap = row.querySelector('.add-stock-variant-wrap');
  const cont = row.querySelector('.add-stock-variant-selects');
  if (!product) { wrap.style.display = 'none'; cont.innerHTML = ''; return; }
  const groups = product.option_groups || [];
  if (!groups.length) { wrap.style.display = 'none'; cont.innerHTML = ''; return; }
  wrap.style.display = 'block';
  cont.innerHTML = groups.map(g => `
    <div style="flex:1;min-width:100px;">
      <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:2px;">${g.label}</label>
      <select class="form-input form-select add-stock-variant-opt" data-label="${g.label}" style="font-size:11px;padding:4px 6px;">
        <option value="">Any</option>
        ${(g.choices||[]).map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
  `).join('');
}
window.addStockItemRow = addStockItemRow;

// ── Inventory modal save-button guards ───────────────────
function _setInvBtn(id, enabled) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled        = !enabled;
  btn.style.opacity   = enabled ? '1' : '0.45';
  btn.style.cursor    = enabled ? 'pointer' : 'not-allowed';
}

function _addStockUpdateBtn() {
  const branch  = (document.getElementById('addStockBranch')?.value || '').trim();
  if (!branch) { _setInvBtn('addStockSubmitBtn', false); return; }
  const rows = document.querySelectorAll('#addStockItems > div');
  if (!rows.length) { _setInvBtn('addStockSubmitBtn', false); return; }
  const allValid = Array.from(rows).every(row => {
    const hidden = row.querySelector('input[type="hidden"]');
    const qty    = row.querySelector('.add-stock-qty');
    return hidden?.value && qty?.value && parseInt(qty.value) >= 1;
  });
  _setInvBtn('addStockSubmitBtn', allValid);
}

function _transferUpdateBtn() {
  const product = (document.getElementById('transferProduct')?.value || '').trim();
  const qty     = (document.getElementById('transferQty')?.value || '').trim();
  const from    = (document.getElementById('transferFrom')?.value || '').trim();
  const to      = (document.getElementById('transferTo')?.value || '').trim();
  _setInvBtn('transferSubmitBtn', !!(product && qty && parseInt(qty) >= 1 && from && to));
}

function _adjustUpdateBtn() {
  const product = (document.getElementById('adjustProduct')?.value || '').trim();
  const qty     = (document.getElementById('adjustQty')?.value || '').trim();
  const reason  = (document.getElementById('adjustReason')?.value || '').trim();
  const branch  = (document.getElementById('adjustBranch')?.value || '').trim();
  _setInvBtn('adjustSubmitBtn', !!(product && qty && parseInt(qty) >= 1 && reason && branch));
}

function closeAddStockModal() {
  document.getElementById('addStockModalOverlay')?.classList.remove('open');
  document.getElementById('addStockModal')?.classList.remove('open');
  document.getElementById('addStockForm')?.reset();
  document.getElementById('addStockItems').innerHTML = '';
  addStockRowCount = 0;
  _setInvBtn('addStockSubmitBtn', false);
}


function loadAddStockVariants(productId) {
  const wrap = document.getElementById('addStockVariantWrap');
  const cont = document.getElementById('addStockVariantSelects');
  if (!productId) { wrap.style.display = 'none'; cont.innerHTML = ''; return; }

  const product = allProducts?.find(p => p.product_id === productId);
  const groups  = product?.option_groups || [];

  if (!groups.length) { wrap.style.display = 'none'; cont.innerHTML = ''; return; }

  wrap.style.display = 'block';
  cont.innerHTML = groups.map(g => `
    <div style="flex:1;min-width:120px;">
      <label style="font-size:11px;color:var(--text-muted);margin-bottom:4px;display:block;">${g.label}</label>
      <select id="variantOpt_${g.label.replace(/\s/g,'_')}" class="form-input form-select" style="font-size:12px;">
        <option value="">All (no variant)</option>
        ${(g.choices || []).map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
  `).join('');
}

function getSelectedVariantOptions() {
  const cont   = document.getElementById('addStockVariantSelects');
  if (!cont) return {};
  const selects = cont.querySelectorAll('select');
  const opts    = {};
  selects.forEach(sel => {
    const label = sel.id.replace('variantOpt_', '').replace(/_/g, ' ');
    if (sel.value) opts[label] = sel.value;
  });
  return Object.keys(opts).length > 0 ? opts : {};
}

async function submitAddStock(e) {
  e.preventDefault();
  const addStockBtn = e.submitter || document.querySelector('#addStockForm button[type="submit"]');
  setButtonLoading(addStockBtn, true);

  const branchVal = document.getElementById('addStockBranch').value;
  const note      = document.getElementById('addStockNote').value || 'Stock added';

  if (!branchVal) {
    showToast('Please select a branch.', 'error');
    setButtonLoading(addStockBtn, false);
    return;
  }

  // Collect all product rows
  const rows = document.querySelectorAll('#addStockItems > div');
  if (!rows.length) {
    showToast('Please add at least one product.', 'error');
    setButtonLoading(addStockBtn, false);
    return;
  }

  const items = [];
  let hasError = false;
  rows.forEach(function(row) {
    const hiddenInput = row.querySelector('input[type="hidden"]');
    const qtySel      = row.querySelector('.add-stock-qty');
    const productId   = hiddenInput?.value;
    const qty         = parseInt(qtySel?.value || '0');

    if (!productId || qty <= 0) { hasError = true; return; }

    // Get variant options
    const variantOpts = {};
    row.querySelectorAll('.add-stock-variant-opt').forEach(function(vs) {
      if (vs.value) variantOpts[vs.dataset.label] = vs.value;
    });

    items.push({
      product_id:      productId,
      quantity:        qty,
      variant_options: Object.keys(variantOpts).length ? variantOpts : null,
    });
  });

  if (hasError || !items.length) {
    showToast('Please fill in all product rows correctly.', 'error');
    setButtonLoading(addStockBtn, false);
    return;
  }

  // Send requests for each item
  const branchIds = branchVal === 'both'
    ? allBranches.map(b => b.branch_id)
    : [branchVal];

  try {
    let allOk = true;
    for (const item of items) {
      for (const bId of branchIds) {
        const res = await fetch('/api/admin/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id:      item.product_id,
            quantity:        item.quantity,
            to_branch_id:    bId,
            note:            note,
            type:            'restock',
            variant_options: item.variant_options,
          }),
        });
        if (!res.ok) { allOk = false; }
      }
    }
    if (allOk) {
      const msg = branchVal === 'both'
        ? `${items.length} product(s) added to both branches!`
        : `${items.length} product(s) added successfully!`;
      showToast(msg);
      closeAddStockModal();
      invalidateSection('inventory'); invalidateSection('products'); loadInventory(); loadProducts();
    } else {
      showToast('Some items failed to add. Please check.', 'error');
    }
  } catch (err) {
    showToast('Error adding stock.', 'error');
  } finally {
    setButtonLoading(addStockBtn, false);
  }
}
async function openTransferModal() {
  if (!allProducts.length) { invalidateSection('products'); await loadProducts(); }
  if (!allBranches.length) await loadBranches();

  // Replace product select with autocomplete
  const prodWrap = document.getElementById('transferProductWrap');
  if (prodWrap) {
    prodWrap.innerHTML = productAcHTML('transferProductInput', 'transferProduct');
    buildProductAutocomplete(prodWrap, {
      inputId:  'transferProductInput',
      hiddenId: 'transferProduct',
      listId:   'transferProductList',
      onSelect: (p) => { loadTransferVariants(p ? p.product_id : ''); _transferUpdateBtn(); },
    });
  }

  const opts = '<option value="">Select branch</option>' +
    allBranches.map(b => `<option value="${b.branch_id}">${b.branch_name}</option>`).join('');
  const fromEl = document.getElementById('transferFrom');
  const toEl   = document.getElementById('transferTo');
  if (fromEl) fromEl.innerHTML = opts;
  if (toEl)   toEl.innerHTML   = opts;

  _setInvBtn('transferSubmitBtn', false);
  document.getElementById('transferQty')?.addEventListener('input',  _transferUpdateBtn);
  document.getElementById('transferFrom')?.addEventListener('change', _transferUpdateBtn);
  document.getElementById('transferTo')?.addEventListener('change',   _transferUpdateBtn);
  document.getElementById('transferModalOverlay')?.classList.add('open');
  document.getElementById('transferModal')?.classList.add('open');
}

function closeTransferModal() {
  document.getElementById('transferModalOverlay')?.classList.remove('open');
  document.getElementById('transferModal')?.classList.remove('open');
  document.getElementById('transferForm')?.reset();
  const tvw = document.getElementById('transferVariantWrap'); if (tvw) tvw.style.display = 'none';
  // Reset autocomplete
  const prodWrap = document.getElementById('transferProductWrap');
  if (prodWrap?._acClear) prodWrap._acClear();
  _setInvBtn('transferSubmitBtn', false);
}


function loadTransferVariants(productId) {
  const wrap = document.getElementById('transferVariantWrap');
  const cont = document.getElementById('transferVariantSelects');
  if (!productId) { wrap.style.display = 'none'; cont.innerHTML = ''; return; }
  const product = allProducts?.find(p => p.product_id === productId);
  const groups  = product?.option_groups || [];
  if (!groups.length) { wrap.style.display = 'none'; cont.innerHTML = ''; return; }
  wrap.style.display = 'block';
  cont.innerHTML = groups.map(g => `
    <div style="flex:1;min-width:120px;">
      <label style="font-size:11px;color:var(--text-muted);margin-bottom:4px;display:block;">${g.label}</label>
      <select id="transferVariantOpt_${g.label.replace(/\s/g,'_')}" class="form-input form-select" style="font-size:12px;">
        <option value="">All (no variant)</option>
        ${(g.choices || []).map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
  `).join('');
}

function getTransferVariantOptions() {
  const cont = document.getElementById('transferVariantSelects');
  if (!cont) return {};
  const opts = {};
  cont.querySelectorAll('select').forEach(sel => {
    const label = sel.id.replace('transferVariantOpt_', '').replace(/_/g, ' ');
    if (sel.value) opts[label] = sel.value;
  });
  return Object.keys(opts).length > 0 ? opts : {};
}

function loadAdjustVariants(productId) {
  const wrap = document.getElementById('adjustVariantWrap');
  const cont = document.getElementById('adjustVariantSelects');
  if (!productId) { wrap.style.display = 'none'; cont.innerHTML = ''; return; }
  const product = allProducts?.find(p => p.product_id === productId);
  const groups  = product?.option_groups || [];
  if (!groups.length) { wrap.style.display = 'none'; cont.innerHTML = ''; return; }
  wrap.style.display = 'block';
  cont.innerHTML = groups.map(g => `
    <div style="flex:1;min-width:120px;">
      <label style="font-size:11px;color:var(--text-muted);margin-bottom:4px;display:block;">${g.label}</label>
      <select id="adjustVariantOpt_${g.label.replace(/\s/g,'_')}" class="form-input form-select" style="font-size:12px;">
        <option value="">All (no variant)</option>
        ${(g.choices || []).map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
  `).join('');
}

function getAdjustVariantOptions() {
  const cont = document.getElementById('adjustVariantSelects');
  if (!cont) return {};
  const opts = {};
  cont.querySelectorAll('select').forEach(sel => {
    const label = sel.id.replace('adjustVariantOpt_', '').replace(/_/g, ' ');
    if (sel.value) opts[label] = sel.value;
  });
  return Object.keys(opts).length > 0 ? opts : {};
}

async function submitTransfer(e) {
  e.preventDefault();
  const fromId = document.getElementById('transferFrom').value;
  const toId   = document.getElementById('transferTo').value;
  if (fromId === toId) { showToast('From and To branch must be different.', 'error'); return; }
  const transferVariantOpts = getTransferVariantOptions();
  const data = {
    product_id:      document.getElementById('transferProduct').value,
    quantity:        parseInt(document.getElementById('transferQty').value),
    from_branch_id:  fromId,
    to_branch_id:    toId,
    variant_options: Object.keys(transferVariantOpts).length ? transferVariantOpts : null,
    note:           document.getElementById('transferNote').value || 'Stock transfer',
    type:           'transfer',
  };
  try {
    const res = await fetch('/api/admin/inventory', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      showToast('Stock transferred successfully!');
      closeTransferModal();
      invalidateSection('inventory'); invalidateSection('products'); loadInventory(); loadProducts();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to transfer stock.', 'error');
    }
  } catch (e) { showToast('Error transferring stock.', 'error'); }
}

// ─── ADJUST STOCK Modal ───────────────────────────────

async function openAdjustModal() {
  if (!allProducts.length) { invalidateSection('products'); await loadProducts(); }
  if (!allBranches.length) await loadBranches();

  // Replace product select with autocomplete
  const prodWrap = document.getElementById('adjustProductWrap');
  if (prodWrap) {
    prodWrap.innerHTML = productAcHTML('adjustProductInput', 'adjustProduct');
    buildProductAutocomplete(prodWrap, {
      inputId:  'adjustProductInput',
      hiddenId: 'adjustProduct',
      listId:   'adjustProductList',
      onSelect: (p) => { loadAdjustVariants(p ? p.product_id : ''); _adjustUpdateBtn(); },
    });
  }

  const branchSel = document.getElementById('adjustBranch');
  if (branchSel) branchSel.innerHTML = '<option value="">Select branch</option>' +
    allBranches.map(b => `<option value="${b.branch_id}">${b.branch_name}</option>`).join('') +
    '<option value="both">📦 Both Branches</option>';

  _setInvBtn('adjustSubmitBtn', false);
  document.getElementById('adjustQty')?.addEventListener('input',    _adjustUpdateBtn);
  document.getElementById('adjustReason')?.addEventListener('change', _adjustUpdateBtn);
  document.getElementById('adjustBranch')?.addEventListener('change', _adjustUpdateBtn);
  document.getElementById('adjustModalOverlay')?.classList.add('open');
  document.getElementById('adjustModal')?.classList.add('open');
}

function closeAdjustModal() {
  document.getElementById('adjustModalOverlay')?.classList.remove('open');
  document.getElementById('adjustModal')?.classList.remove('open');
  document.getElementById('adjustForm')?.reset();
  const avw = document.getElementById('adjustVariantWrap'); if (avw) avw.style.display = 'none';
  // Reset autocomplete
  const prodWrap = document.getElementById('adjustProductWrap');
  if (prodWrap?._acClear) prodWrap._acClear();
  _setInvBtn('adjustSubmitBtn', false);
}

async function submitAdjust(e) {
  e.preventDefault();
  const productId       = document.getElementById('adjustProduct').value;
  const qty             = parseInt(document.getElementById('adjustQty').value);
  const reason          = document.getElementById('adjustReason').value;
  const branchId        = document.getElementById('adjustBranch').value;
  const note            = document.getElementById('adjustNote').value;
  const adjustVariantOpts = getAdjustVariantOptions();

  // Find current stock — check branch-level stock if branchId is set
  const product = allProducts.find(p => p.product_id === productId);
  if (!product) { showToast('Product not found.', 'error'); return; }
  const branchStock = branchId && product.branch_stock?.length
    ? product.branch_stock.find(bs => bs.branch_id === branchId)
    : null;
  const availableQty = branchStock ? branchStock.quantity : product.quantity;
  if (qty > availableQty) {
    showToast(`Cannot deduct ${qty} — only ${availableQty} units in stock for this branch.`, 'error');
    return;
  }

  const data = {
    product_id:      productId,
    quantity:        -qty,
    to_branch_id:    branchId,
    note:            `[${reason.toUpperCase()}] ${note || reason}`,
    type:            'adjustment',
    variant_options: Object.keys(adjustVariantOpts).length ? adjustVariantOpts : null,
  };

  try {
    const res = await fetch('/api/admin/inventory', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      showToast(`Stock adjusted — ${qty} unit(s) deducted (${reason}).`);
      closeAdjustModal();
      invalidateSection('inventory'); invalidateSection('products'); loadInventory(); loadProducts();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to adjust stock.', 'error');
    }
  } catch (e) { showToast('Error adjusting stock.', 'error'); }
}

// Legacy aliases
function openInventoryModal() { openAddStockModal(); }
function closeInventoryModal() { closeAddStockModal(); }

// ─── ORDERS ───────────────────────────────────────────
async function loadOrders() {
  // ── Skeleton ──
  skTable('ordersBody', ['sk-cell-sm','sk-cell-full','sk-cell-md','sk-cell-sm',
                         'sk-cell-sm','sk-cell-sm','sk-cell-sm','sk-cell-sm','sk-cell-sm'], 8);
  // ─────────────
  try {
    const res  = await fetch('/api/admin/orders?limit=80');
    const data = await res.json();
    const parseTs = ts => {
      if (!ts) return 0;
      const normalized = ts.toString().replace(/(\.\d{3})\d+/, '$1').replace(' ', 'T');
      const utcStr = normalized.endsWith('Z') || normalized.includes('+') ? normalized : normalized + 'Z';
      return new Date(utcStr).getTime() || 0;
    };
    allOrders  = data.sort((a, b) => {
      const da = parseTs(a.created_at || a.date);
      const db = parseTs(b.created_at || b.date);
      return db - da;
    });
    populateOrderYearFilter(allOrders);
    populateOrderDayOptions();
    applyAdminOrderFilters();
    updateAdminOrdersBadge(allOrders);
  } catch (e) { console.error('Orders error:', e); }
}

function updateAdminOrdersBadge(orders) {
  const badge   = document.getElementById('adminOrdersBadge');
  if (!badge) return;
  const pending = orders.filter(o => o.status === 'pending' && o.order_type === 'online').length;
  if (pending > 0) {
    badge.textContent  = pending > 99 ? '99+' : pending;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}


// ─── View Order Items Modal ───────────────────────────

// ─── Generic Modal ────────────────────────────────────
function showModal(html) {
  const overlay = document.getElementById('genericModalOverlay');
  const modal   = document.getElementById('genericModal');
  const content = document.getElementById('genericModalContent');
  if (!overlay || !modal || !content) return;
  content.innerHTML  = html;
  overlay.style.display = 'block';
  modal.style.display   = 'block';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.getElementById('genericModalOverlay');
  const modal   = document.getElementById('genericModal');
  if (overlay) overlay.style.display = 'none';
  if (modal)   modal.style.display   = 'none';
  document.body.style.overflow = '';
}

function viewOrderItems(order) {
  const items    = order.order_item || [];
  const customer = order.customer ? `${order.customer.fname} ${order.customer.lname}` : 'Walk-in';
  const branchObj = Array.isArray(order.branch) ? order.branch[0] : order.branch;
  const branch   = branchObj?.branch_name || order.branch_name || '—';

  // Parse delivery address
  const addrParts  = (order.address || '').split('|');
  const addrString = addrParts.length > 1
    ? [addrParts[0], addrParts[1], addrParts[2], addrParts[3]].filter(Boolean).join(', ')
    : order.address || '—';

  const itemsHtml = items.length
    ? items.map(i => {
        const opts = i.selected_options && Object.keys(i.selected_options).length > 0
          ? Object.entries(i.selected_options).map(([k,v]) =>
              `<span style="background:rgba(22,163,74,0.1);color:#16a34a;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600;">${k}: ${v}</span>`
            ).join(' ')
          : '';
        const imgUrl = i.product?.image_url;
        return `
          <div style="padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="display:flex;gap:10px;align-items:flex-start;">
              ${imgUrl
                ? `<img src="${imgUrl}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;" alt="${i.product?.product_name}"/>`
                : `<div style="width:44px;height:44px;border-radius:8px;background:var(--surface-2);flex-shrink:0;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>`}
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${i.product?.product_name || '—'}</div>
                ${opts ? `<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;">${opts}</div>` : ''}
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:13px;font-weight:700;">₱${Number(i.price * i.qty).toFixed(2)}</div>
                <div style="font-size:11px;color:var(--text-muted);">x${i.qty} @ ₱${Number(i.price).toFixed(2)}</div>
              </div>
            </div>
          </div>`;
      }).join('')
    : '<p style="color:var(--text-muted);text-align:center;">No items found</p>';

  showModal(`
    <div style="padding:1.5rem;max-height:80vh;overflow-y:auto;">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;">
        <div>
          <h3 style="margin:0;font-size:16px;">Order Details</h3>
          <p style="margin:4px 0 0;font-size:12px;color:var(--text-muted);">#${shortId(order.order_id)}</p>
        </div>
        <button onclick="closeModal()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:18px;">✕</button>
      </div>

      <!-- Order Info -->
      <div style="background:var(--surface-2);border-radius:8px;padding:12px;margin-bottom:1rem;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
        <div><span style="color:var(--text-muted);">Customer</span><br/><strong>${customer}</strong></div>
        <div><span style="color:var(--text-muted);">Branch</span><br/><strong>${branch}</strong></div>
        <div><span style="color:var(--text-muted);">Served By</span><br/><strong>${(() => { const s = Array.isArray(order.staff) ? order.staff[0] : order.staff; return s ? `${s.fname} ${s.lname}` : '—'; })()}</strong></div>
        <div><span style="color:var(--text-muted);">Type</span><br/>${badge(order.order_type)}</div>
        <div><span style="color:var(--text-muted);">Status</span><br/>${badge(order.status)}</div>
        <div><span style="color:var(--text-muted);">Payment</span><br/>${order.payment?.payment_method ? badge(order.payment.payment_method) : '—'}</div>
        ${order.payment?.payment_method === 'gcash' ? `
        <div style="grid-column:1/-1;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);border-radius:8px;padding:10px 12px;margin-top:4px;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:600;">GCASH PAYMENT DETAILS</div>
          ${order.payment.ref_no ? `<div style="font-size:12px;margin-bottom:4px;"><span style="color:var(--text-muted);"># Ref No:</span> <strong>${order.payment.ref_no}</strong></div>` : ''}
          ${order.payment.sender_number ? `<div style="font-size:12px;margin-bottom:4px;"><span style="color:var(--text-muted);">📱 Sender No:</span> <strong>${order.payment.sender_number}</strong></div>` : ''}
          ${order.payment.receipt_image_url ? `<div style="margin-top:8px;"><a href="${order.payment.receipt_image_url}" target="_blank" style="color:#3b82f6;font-size:12px;font-weight:600;">View Receipt Image</a></div>` : ''}
          ${!order.payment.ref_no && !order.payment.sender_number && !order.payment.receipt_image_url ? '<div style="font-size:12px;color:var(--text-muted);">No GCash details provided</div>' : ''}
        </div>` : ''}
        <div><span style="color:var(--text-muted);">Date</span><br/><strong>${(() => {
            const raw = order.created_at || order.date || null; // prefer created_at (timestamptz) over date (date-only)
            if (!raw) return '—';
            const normalized = raw.toString().replace(/(\.\d{3})\d+/, '$1').replace(' ', 'T');
            const utcStr = normalized.endsWith('Z') || normalized.includes('+') ? normalized : normalized + 'Z';
            const d = new Date(new Date(utcStr).getTime() + 8 * 60 * 60 * 1000);
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const date = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
            const h = d.getUTCHours(), m = d.getUTCMinutes();
            const time = `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`;
            return `${date} ${time}`;
          })()}</strong></div>
      </div>

      <!-- Delivery Address (online orders only) -->
      ${order.order_type === 'online' ? `
        <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:10px 12px;margin-bottom:1rem;font-size:12px;">
          <div style="color:var(--text-muted);margin-bottom:2px;">Delivery Address</div>
          <strong>${addrString && addrString.trim() ? addrString : 'No address provided'}</strong>
          ${order.address_note ? `<div style="color:var(--text-muted);margin-top:4px;font-size:11px;">📍 ${order.address_note}</div>` : ''}
          ${order.shipping_fee != null ? `<span style="margin-left:8px;color:var(--text-muted);">· Shipping: ${Number(order.shipping_fee) === 0 ? 'FREE' : peso(order.shipping_fee)}</span>` : ''}
        </div>` : ''}

      <!-- Items -->
      <div style="margin-bottom:0.5rem;font-size:12px;font-weight:600;color:var(--text-muted);">ITEMS ORDERED</div>
      ${itemsHtml}

      <!-- Total -->
      <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;">Grand Total</span>
        <span style="font-weight:700;color:#16a34a;font-size:16px;">₱${Number(order.total).toFixed(2)}</span>
      </div>
    </div>
  `);
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

function renderOrders(orders) {
  const paged = paginate(orders, ordersPage);
  document.getElementById('ordersBody').innerHTML = paged.length
    ? paged.map(o => `
        <tr>
          <td><code style="font-family:'JetBrains Mono',monospace;font-size:11px;">${shortId(o.order_id)}</code></td>
          <td>${o.customer ? `${o.customer.fname} ${o.customer.lname}` : 'Walk-in'}</td>
          <td>${(() => { const s = Array.isArray(o.staff) ? o.staff[0] : o.staff; return s ? `${s.fname} ${s.lname}` : '—'; })()}</td>
          <td>${badge(o.order_type)}</td>
          <td>${peso(o.total)}</td>
          <td>${o.payment?.payment_method ? badge(o.payment.payment_method) : (Array.isArray(o.payment) && o.payment[0] ? badge(o.payment[0].payment_method) : '—')}</td>
          <td>${(() => {
            const raw = o.created_at || o.date || null; // prefer created_at (timestamptz) over date (date-only)
            if (!raw) return '—';
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
            <button class="btn-icon" onclick="viewOrderItems(${JSON.stringify(o).replace(/"/g, '&quot;')})" title="View Items">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="9" class="table-empty">No orders yet</td></tr>';
  renderPager('ordersPagination', orders.length, ordersPage, 'changeOrdersPage');
}

async function updateOrderStatus(id, status) {
  try {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { showToast('Order status updated!'); loadOrders(); }
    else showToast('Failed to update status.', 'error');
  } catch (e) { showToast('Error updating status.', 'error'); }
}

let adminOrderTypeFilter   = '';
let adminOrderStatusFilter = '';
let adminOrderSearchText   = '';
let adminOrderYearFilter   = '';
let adminOrderMonthFilter  = '';
let adminOrderDayFilter    = '';

function filterOrders(type) {
  adminOrderTypeFilter = type;
  ordersPage = 1;
  applyAdminOrderFilters();
}

function filterOrderStatus(status) {
  adminOrderStatusFilter = status;
  ordersPage = 1;
  applyAdminOrderFilters();
}

function filterOrderSearch(val) {
  adminOrderSearchText = val.toLowerCase();
  ordersPage = 1;
  applyAdminOrderFilters();
}
window.filterOrderSearch = filterOrderSearch;

// ─── Date (Year / Month / Day) Filter ─────────────────
// Uses the same +8h (PH time) normalization as the Date column in
// renderOrders(), so the filter matches what's shown on screen.
function getOrderDateParts(o) {
  const raw = o.created_at || o.date || null;
  if (!raw) return null;
  const normalized = raw.toString().replace(/(\.\d{3})\d+/, '$1').replace(' ', 'T');
  const utcStr = normalized.endsWith('Z') || normalized.includes('+') ? normalized : normalized + 'Z';
  const d = new Date(new Date(utcStr).getTime() + 8 * 60 * 60 * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function populateOrderYearFilter(orders) {
  const sel = document.getElementById('adminOrderYearFilter');
  if (!sel) return;
  const years = [...new Set(orders.map(o => getOrderDateParts(o)?.year).filter(Boolean))].sort((a, b) => b - a);
  const current = sel.value;
  sel.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  if (years.map(String).includes(current)) sel.value = current;
}

// Number of days to list for the Day dropdown, given the current
// Year/Month selection — accounts for 30/31-day months and leap Februaries.
function daysInMonthFor(year, month) {
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

function populateOrderDayOptions() {
  const sel = document.getElementById('adminOrderDayFilter');
  if (!sel) return;
  const max     = daysInMonthFor(adminOrderYearFilter, adminOrderMonthFilter);
  const current = sel.value;
  let opts = '<option value="">All Days</option>';
  for (let d = 1; d <= max; d++) opts += `<option value="${String(d).padStart(2, '0')}">${d}</option>`;
  sel.innerHTML = opts;
  if (current && parseInt(current, 10) <= max) {
    sel.value = current;
  } else {
    sel.value = '';
    adminOrderDayFilter = '';
  }
}

function filterOrderYear(year) {
  adminOrderYearFilter = year;
  populateOrderDayOptions();
  ordersPage = 1;
  applyAdminOrderFilters();
}
window.filterOrderYear = filterOrderYear;

function filterOrderMonth(month) {
  adminOrderMonthFilter = month;
  populateOrderDayOptions();
  ordersPage = 1;
  applyAdminOrderFilters();
}
window.filterOrderMonth = filterOrderMonth;

function filterOrderDay(day) {
  adminOrderDayFilter = day;
  ordersPage = 1;
  applyAdminOrderFilters();
}
window.filterOrderDay = filterOrderDay;

// Clears every Orders filter: search, type, status, year, month, day.
function clearAdminOrderFilters() {
  adminOrderTypeFilter   = '';
  adminOrderStatusFilter = '';
  adminOrderSearchText   = '';
  adminOrderYearFilter   = '';
  adminOrderMonthFilter  = '';
  adminOrderDayFilter    = '';

  const typeSel   = document.getElementById('adminOrderTypeFilter');
  const statusSel = document.getElementById('adminOrderStatusFilter');
  const yearSel   = document.getElementById('adminOrderYearFilter');
  const monthSel  = document.getElementById('adminOrderMonthFilter');
  const searchBox = document.getElementById('orderSearchInput');
  if (typeSel)   typeSel.value   = '';
  if (statusSel) statusSel.value = '';
  if (yearSel)   yearSel.value   = '';
  if (monthSel)  monthSel.value  = '';
  if (searchBox) searchBox.value = '';
  populateOrderDayOptions();

  ordersPage = 1;
  applyAdminOrderFilters();
}
window.clearAdminOrderFilters = clearAdminOrderFilters;

// Greys out / disables the Clear Filters button when no filter is active.
function updateAdminClearFiltersState() {
  const btn = document.getElementById('adminClearFiltersBtn');
  if (!btn) return;
  const anyActive = !!(adminOrderTypeFilter || adminOrderStatusFilter || adminOrderSearchText ||
                       adminOrderYearFilter || adminOrderMonthFilter || adminOrderDayFilter);
  btn.disabled = !anyActive;
  btn.style.opacity = anyActive ? '1' : '0.5';
  btn.style.cursor  = anyActive ? 'pointer' : 'not-allowed';
}

function applyAdminOrderFilters() {
  updateAdminClearFiltersState();
  let filtered = allOrders;
  if (adminOrderTypeFilter)   filtered = filtered.filter(o => o.order_type === adminOrderTypeFilter);
  if (adminOrderStatusFilter) filtered = filtered.filter(o => o.status === adminOrderStatusFilter);
  if (adminOrderYearFilter) {
    filtered = filtered.filter(o => String(getOrderDateParts(o)?.year) === adminOrderYearFilter);
  }
  if (adminOrderMonthFilter) {
    filtered = filtered.filter(o => String(getOrderDateParts(o)?.month).padStart(2, '0') === adminOrderMonthFilter);
  }
  if (adminOrderDayFilter) {
    filtered = filtered.filter(o => String(getOrderDateParts(o)?.day).padStart(2, '0') === adminOrderDayFilter);
  }
  if (adminOrderSearchText) {
    filtered = filtered.filter(o => {
      const customer = o.customer ? (o.customer.fname + ' ' + o.customer.lname).toLowerCase() : 'walk-in';
      const orderId  = (o.order_id || '').toLowerCase();
      const status   = (o.status || '').toLowerCase();
      const type     = (o.order_type || '').toLowerCase();
      return customer.includes(adminOrderSearchText)
          || orderId.includes(adminOrderSearchText)
          || status.includes(adminOrderSearchText)
          || type.includes(adminOrderSearchText);
    });
  }
  renderOrders(sortOrdersHierarchy(filtered));
}

// ─── SALES REPORTS ────────────────────────────────────
// ─── Chart instances ─────────────────────────────────
let revenueChartInst = null;
let paymentChartInst = null;
let branchChartInst  = null;


// ─── Sales Filter Functions ───────────────────────────
let allSalesOrders = []; // Store all orders for filtering

function filterSalesOrders(orders) {
  let completed = orders.filter(o => o.status === 'completed');
  // Apply branch filter
  if (currentSalesBranchFilter && currentSalesBranchFilter !== 'all') {
    completed = completed.filter(o => o.branch_id === currentSalesBranchFilter);
  }
  renderSalesData(completed, orders);
}

function applySalesQuickFilter(val) {
  // Reset other filters
  document.getElementById('salesMonthFilter').value = '';
  document.getElementById('salesDateFrom').value    = '';
  document.getElementById('salesDateTo').value      = '';

  const now   = new Date();
  let from    = null;
  let to      = new Date();
  let label   = '';

  if (val === 'today') {
    from  = new Date(now.toDateString());
    label = 'Today';
  } else if (val === 'this_week') {
    from  = new Date(now); from.setDate(now.getDate() - now.getDay());
    label = 'This Week';
  } else if (val === 'last_week') {
    from  = new Date(now); from.setDate(now.getDate() - now.getDay() - 7);
    to    = new Date(now); to.setDate(now.getDate() - now.getDay() - 1);
    label = 'Last Week';
  } else if (val === 'this_month') {
    from  = new Date(now.getFullYear(), now.getMonth(), 1);
    label = now.toLocaleString('en-PH', { month: 'long', year: 'numeric' });
  } else if (val === 'last_month') {
    from  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to    = new Date(now.getFullYear(), now.getMonth(), 0);
    label = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('en-PH', { month: 'long', year: 'numeric' });
  } else {
    document.getElementById('salesFilterLabel').textContent = '';
    filterSalesOrders(allSalesOrders);
    return;
  }

  document.getElementById('salesFilterLabel').textContent = `Showing: ${label}`;
  const filtered = allSalesOrders.filter(o => {
    const d = new Date(o.date || o.created_at || 0);
    return d >= from && d <= to;
  });
  filterSalesOrders(filtered);
}

function applySalesMonthFilter(month) {
  // Reset other filters
  document.getElementById('salesQuickFilter').value = 'all';
  document.getElementById('salesDateFrom').value    = '';
  document.getElementById('salesDateTo').value      = '';

  if (!month) { document.getElementById('salesFilterLabel').textContent = ''; filterSalesOrders(allSalesOrders); return; }

  const now      = new Date();
  const filtered = allSalesOrders.filter(o => {
    const d = new Date(o.date || o.created_at || 0);
    return d.getMonth() + 1 === parseInt(month);
  });
  const monthName = new Date(now.getFullYear(), parseInt(month) - 1, 1)
    .toLocaleString('en-PH', { month: 'long' });
  document.getElementById('salesFilterLabel').textContent = `Showing: ${monthName}`;
  filterSalesOrders(filtered);
}

function applySalesDateRange() {
  const from = document.getElementById('salesDateFrom').value;
  const to   = document.getElementById('salesDateTo').value;
  if (!from && !to) return;

  // Reset other filters
  document.getElementById('salesQuickFilter').value  = 'all';
  document.getElementById('salesMonthFilter').value  = '';

  const fromDate = from ? new Date(from) : new Date(0);
  const toDate   = to   ? new Date(to + 'T23:59:59') : new Date();

  const filtered = allSalesOrders.filter(o => {
    const d = new Date(o.date || o.created_at || 0);
    return d >= fromDate && d <= toDate;
  });
  document.getElementById('salesFilterLabel').textContent =
    `Showing: ${from || '—'} to ${to || '—'}`;
  filterSalesOrders(filtered);
}

let currentSalesBranchFilter = 'all';

function applySalesBranchFilter(val) {
  currentSalesBranchFilter = val;
  filterSalesOrders(allSalesOrders);
}

function resetSalesFilter() {
  document.getElementById('salesQuickFilter').value   = 'all';
  document.getElementById('salesMonthFilter').value   = '';
  document.getElementById('salesDateFrom').value       = '';
  document.getElementById('salesDateTo').value         = '';
  document.getElementById('salesBranchFilter').value  = 'all';
  document.getElementById('salesFilterLabel').textContent = '';
  currentSalesBranchFilter = 'all';
  filterSalesOrders(allSalesOrders);
}


function renderSalesData(completed, allOrders) {
  const total  = completed.reduce((s, o) => s + Number(o.total || 0), 0);
  const online = completed.filter(o => o.order_type === 'online').reduce((s, o) => s + Number(o.total || 0), 0);
  const walkin = completed.filter(o => o.order_type === 'walk_in').reduce((s, o) => s + Number(o.total || 0), 0);

  document.getElementById('salesTotal').textContent  = peso(total);
  document.getElementById('salesOnline').textContent = peso(online);
  document.getElementById('salesWalkin').textContent = peso(walkin);

  // Branch stats
  const teId = allBranches.find(b => b.branch_name?.toLowerCase().includes('triple'))?.branch_id;
  const fcId = allBranches.find(b => b.branch_name?.toLowerCase().includes('fiel') || b.branch_name?.toLowerCase().includes('collince'))?.branch_id;

  function branchStats(id) {
    const b = completed.filter(o => o.branch_id === id);
    return { revenue: b.reduce((s,o)=>s+Number(o.total||0),0), orders:b.length,
             walkin:b.filter(o=>o.order_type==='walk_in').length, online:b.filter(o=>o.order_type==='online').length };
  }

  // Check if any orders have branch_id assigned
  const hasBranchData = completed.some(o => o.branch_id);
  const allWalkin     = completed.filter(o => o.order_type === 'walk_in');

  let te, fc;
  if (hasBranchData) {
    te = branchStats(teId);
    fc = branchStats(fcId);
  } else {
    // No branch assigned yet — show walk-in under Triple E (default POS branch)
    te = { revenue: allWalkin.reduce((s,o)=>s+Number(o.total||0),0), orders: allWalkin.length,
           walkin: allWalkin.length, online: 0 };
    fc = { revenue: 0, orders: 0, walkin: 0, online: 0 };
  }

  document.getElementById('branchTE_revenue').textContent = peso(te.revenue);
  document.getElementById('branchTE_orders').textContent  = te.orders;
  document.getElementById('branchTE_walkin').textContent  = te.walkin;
  document.getElementById('branchTE_online').textContent  = te.online;
  document.getElementById('branchFC_revenue').textContent = peso(fc.revenue);
  document.getElementById('branchFC_orders').textContent  = fc.orders;
  document.getElementById('branchFC_walkin').textContent  = fc.walkin;
  document.getElementById('branchFC_online').textContent  = fc.online;

  // Branch chart
  const branchCtx = document.getElementById('branchChart')?.getContext('2d');
  if (branchCtx) {
    if (branchChartInst) branchChartInst.destroy();
    branchChartInst = new Chart(branchCtx, {
      type: 'bar',
      data: {
        labels: ['Triple E', 'Fiel Collince'],
        datasets: [{ label: 'Revenue (₱)', data: [te.revenue, fc.revenue],
          backgroundColor: ['rgba(22,163,74,0.7)','rgba(59,130,246,0.7)'],
          borderColor: ['rgba(22,163,74,1)','rgba(59,130,246,1)'],
          borderWidth: 2, borderRadius: 6 }]
      },
      options: { responsive:true, maintainAspectRatio:true,
        plugins:{legend:{display:false}},
        scales:{ y:{ beginAtZero:true, ticks:{callback:v=>'₱'+v.toLocaleString()} } } }
    });
  }

  // Revenue by day (last 7 days from filtered data)
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    last7.push(d.toISOString().split('T')[0]);
  }
  const dailyRevenue = last7.map(day =>
    completed.filter(o => (o.date||o.created_at||'').startsWith(day))
             .reduce((s,o)=>s+Number(o.total||0),0)
  );
  const revCtx = document.getElementById('revenueChart')?.getContext('2d');
  if (revCtx) {
    if (revenueChartInst) revenueChartInst.destroy();
    revenueChartInst = new Chart(revCtx, {
      type: 'line',
      data: {
        labels: last7.map(d=>new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric'})),
        datasets: [{ label:'Revenue', data:dailyRevenue,
          borderColor:'rgba(22,163,74,1)', backgroundColor:'rgba(22,163,74,0.1)',
          borderWidth:2, tension:0.4, fill:true, pointRadius:4 }]
      },
      options: { responsive:true, plugins:{legend:{display:false}},
        scales:{ y:{beginAtZero:true, ticks:{callback:v=>'₱'+v.toLocaleString()}} } }
    });
  }

  // Payment method donut chart
  const methods = {};
  completed.forEach(o => {
    // payment can be object or array — handle both cases
    let pay = o.payment;
    if (Array.isArray(pay)) pay = pay[0];
    // Try multiple sources for payment method
    const pm = pay?.payment_method
            || o.payment_method
            || (o.order_type === 'walk_in' ? 'walk_in_cash' : null);
    if (!pm) return; // skip if no payment method found
    if (!methods[pm]) methods[pm] = { count:0, total:0 };
    methods[pm].count++;
    methods[pm].total += Number(o.total || 0);
  });
  const payCtx = document.getElementById('paymentChart')?.getContext('2d');
  if (payCtx && Object.keys(methods).length > 0) {
    if (paymentChartInst) paymentChartInst.destroy();
    paymentChartInst = new Chart(payCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(methods).map(m=>m.replace(/_/g,' ').toUpperCase()),
        datasets: [{ data: Object.values(methods).map(v=>v.total),
          backgroundColor:['rgba(22,163,74,0.7)','rgba(59,130,246,0.7)','rgba(234,179,8,0.7)'],
          borderWidth:2 }]
      },
      options: { responsive:true, maintainAspectRatio:true,
        cutout: '70%',
        plugins:{ legend:{ position:'bottom', labels:{ boxWidth:12, font:{ size:11 } } } } }
    });
  }

  // Payment breakdown table
  document.getElementById('paymentBreakdownBody').innerHTML = Object.entries(methods).length
    ? Object.entries(methods).map(([m,v])=>
        `<tr><td>${badge(m)}</td><td>${v.count}</td><td>${peso(v.total)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="table-empty">No payment data yet</td></tr>';

  // Top products
  const productSales = {};
  completed.forEach(o => {
    (o.order_item||[]).forEach(item => {
      const name = item.product?.product_name || item.product_id;
      if (!productSales[name]) productSales[name] = {units:0, revenue:0};
      productSales[name].units   += Number(item.qty||item.quantity||0);
      productSales[name].revenue += Number(item.price||0)*Number(item.qty||item.quantity||0);
    });
  });
  const allSorted = Object.entries(productSales).sort((a,b) => b[1].units - a[1].units);
  const top   = allSorted.slice(0, 5);
  const least = allSorted.slice(-5).reverse();

  document.getElementById('topProductsBody').innerHTML = top.length
    ? top.map(([name,v]) => `<tr><td>${name}</td><td>${v.units}</td><td>${peso(v.revenue)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="table-empty">No sales data yet</td></tr>';

  // Least Selling
  const leastEl = document.getElementById('leastProductsBody');
  if (leastEl) {
    leastEl.innerHTML = least.length
      ? least.map(([name,v]) => `<tr>
          <td>${name}</td>
          <td><span style="color:${v.units === 0 ? '#ef4444' : '#f59e0b'};font-weight:700;">${v.units}</span></td>
          <td>${peso(v.revenue)}</td>
        </tr>`).join('')
      : '<tr><td colspan="3" class="table-empty">No sales data yet</td></tr>';
  }
}


// ─── Print / PDF Sales Report ──────────────────────────────────────────────
function printSalesReport() {
  const filterLabel = document.getElementById('salesFilterLabel')?.textContent || 'All Time';
  const now         = new Date().toLocaleDateString('en-PH', { timeZone:'Asia/Manila', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });

  // Gather stats
  const totalEl   = document.getElementById('salesTotal')?.textContent   || '₱0.00';
  const onlineEl  = document.getElementById('salesOnline')?.textContent  || '₱0.00';
  const walkinEl  = document.getElementById('salesWalkin')?.textContent  || '₱0.00';
  const teRev     = document.getElementById('branchTE_revenue')?.textContent || '₱0.00';
  const teOrders  = document.getElementById('branchTE_orders')?.textContent  || '0';
  const teWalkin  = document.getElementById('branchTE_walkin')?.textContent  || '0';
  const teOnline  = document.getElementById('branchTE_online')?.textContent  || '0';
  const fcRev     = document.getElementById('branchFC_revenue')?.textContent || '₱0.00';
  const fcOrders  = document.getElementById('branchFC_orders')?.textContent  || '0';
  const fcWalkin  = document.getElementById('branchFC_walkin')?.textContent  || '0';
  const fcOnline  = document.getElementById('branchFC_online')?.textContent  || '0';

  // Top products
  const topRows   = document.getElementById('topProductsBody')?.innerHTML   || '';
  const leastRows = document.getElementById('leastProductsBody')?.innerHTML || '';

  // Payment breakdown
  const payRows   = document.getElementById('paymentBreakdownBody')?.innerHTML || '';

  const printWin = window.open('', '_blank', 'width=900,height=700');
  printWin.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Sales Report — TEFC E-Commerce</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; background: #fff; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #16a34a; padding-bottom: 16px; }
    .header h1 { font-size: 22px; font-weight: 800; color: #14532d; }
    .header h2 { font-size: 14px; font-weight: 600; color: #166534; margin-top: 4px; }
    .header p  { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .badge-green { background: #dcfce7; color: #14532d; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 700; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 13px; font-weight: 700; color: #14532d; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #dcfce7; padding-bottom: 6px; margin-bottom: 10px; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
    .stat-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center; }
    .stat-box .val { font-size: 18px; font-weight: 800; color: #14532d; }
    .stat-box .lbl { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .branch-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .branch-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; }
    .branch-name { font-size: 13px; font-weight: 700; color: #14532d; margin-bottom: 8px; }
    .branch-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; border-bottom: 1px dashed #dcfce7; }
    .branch-row:last-child { border: none; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #14532d; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; }
    td { padding: 6px 10px; border-bottom: 1px solid #f0fdf4; }
    tr:nth-child(even) td { background: #f9fafb; }
    .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    @media print {
      body { padding: 16px; }
      button { display: none; }
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>TEFC E-Commerce</h1>
    <h2>Triple E &amp; Fiel Collince General Merchandise</h2>
    <p>SALES REPORT &nbsp;|&nbsp; <span class="badge-green">${filterLabel}</span></p>
    <p style="margin-top:6px;">Generated: ${now}</p>
  </div>

  <!-- Overview -->
  <div class="section">
    <div class="section-title">Sales Overview</div>
    <div class="stat-grid">
      <div class="stat-box"><div class="val">${totalEl}</div><div class="lbl">Total Revenue</div></div>
      <div class="stat-box"><div class="val">${onlineEl}</div><div class="lbl">Online Sales</div></div>
      <div class="stat-box"><div class="val">${walkinEl}</div><div class="lbl">Walk-in Sales</div></div>
    </div>
  </div>

  <!-- Branch Breakdown -->
  <div class="section">
    <div class="section-title">Branch Sales Breakdown</div>
    <div class="branch-grid">
      <div class="branch-box">
        <div class="branch-name">Triple E</div>
        <div class="branch-row"><span>Total Revenue</span><span><b>${teRev}</b></span></div>
        <div class="branch-row"><span>Total Orders</span><span>${teOrders}</span></div>
        <div class="branch-row"><span>Walk-in Orders</span><span>${teWalkin}</span></div>
        <div class="branch-row"><span>Online Orders</span><span>${teOnline}</span></div>
      </div>
      <div class="branch-box">
        <div class="branch-name">Fiel Collince</div>
        <div class="branch-row"><span>Total Revenue</span><span><b>${fcRev}</b></span></div>
        <div class="branch-row"><span>Total Orders</span><span>${fcOrders}</span></div>
        <div class="branch-row"><span>Walk-in Orders</span><span>${fcWalkin}</span></div>
        <div class="branch-row"><span>Online Orders</span><span>${fcOnline}</span></div>
      </div>
    </div>
  </div>

  <!-- Top Selling -->
  <div class="section">
    <div class="section-title">Top Selling Products</div>
    <table>
      <thead><tr><th>Product</th><th>Units Sold</th><th>Revenue</th></tr></thead>
      <tbody>${topRows}</tbody>
    </table>
  </div>

  <!-- Least Selling -->
  <div class="section">
    <div class="section-title">Least Selling Products</div>
    <table>
      <thead><tr><th>Product</th><th>Units Sold</th><th>Revenue</th></tr></thead>
      <tbody>${leastRows}</tbody>
    </table>
  </div>

  <!-- Payment Breakdown -->
  <div class="section">
    <div class="section-title">Payment Method Breakdown</div>
    <table>
      <thead><tr><th>Payment Method</th><th>Transactions</th><th>Total Amount</th></tr></thead>
      <tbody>${payRows}</tbody>
    </table>
  </div>

  <div class="footer">
    <p>Triple E &amp; Fiel Collince General Merchandise &mdash; TEFC E-Commerce &amp; POS System</p>
    <p>This report is system-generated and reflects data based on the selected filter period.</p>
    <p style="margin-top:8px;">
      <button onclick="window.print()" style="background:#16a34a;color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;margin-right:8px;">🖨️ Print</button>
      <button onclick="window.close()" style="background:#f3f4f6;color:#111;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;">✕ Close</button>
    </p>
  </div>

</body>
</html>
  `);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => printWin.print(), 500);
}
window.printSalesReport = printSalesReport;

// ─── Export Sales Report as Excel ─────────────────────────────────────────
function exportSalesExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Excel library not loaded. Please refresh and try again.'); return;
  }

  const filterLabel = document.getElementById('salesFilterLabel')?.textContent || 'All Time';
  const branchSel   = document.getElementById('salesBranchFilter');
  const branchLabel = branchSel?.selectedOptions[0]?.text || 'All Branches';
  const now         = new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' });

  // ── Sheet 1: Sales Summary ──────────────────────────
  const summaryData = [
    ['TEFC E-Commerce — Sales Report'],
    ['Triple E & Fiel Collince General Merchandise'],
    ['Generated:', now],
    ['Filter Period:', filterLabel || 'All Time'],
    ['Branch:', branchLabel],
    [],
    ['SALES OVERVIEW'],
    ['Metric', 'Value'],
    ['Total Revenue',  document.getElementById('salesTotal')?.textContent  || ''],
    ['Online Sales',   document.getElementById('salesOnline')?.textContent || ''],
    ['Walk-in Sales',  document.getElementById('salesWalkin')?.textContent || ''],
    ['Total Customers',document.getElementById('salesCustomers')?.textContent || ''],
    [],
    ['BRANCH BREAKDOWN'],
    ['Branch', 'Revenue', 'Total Orders', 'Walk-in', 'Online'],
    [
      'Triple E',
      document.getElementById('branchTE_revenue')?.textContent || '',
      document.getElementById('branchTE_orders')?.textContent  || '',
      document.getElementById('branchTE_walkin')?.textContent  || '',
      document.getElementById('branchTE_online')?.textContent  || '',
    ],
    [
      'Fiel Collince',
      document.getElementById('branchFC_revenue')?.textContent || '',
      document.getElementById('branchFC_orders')?.textContent  || '',
      document.getElementById('branchFC_walkin')?.textContent  || '',
      document.getElementById('branchFC_online')?.textContent  || '',
    ],
  ];

  // ── Sheet 2: Top Products ───────────────────────────
  const topRows   = [];
  const topTbody  = document.getElementById('topProductsBody');
  if (topTbody) {
    topRows.push(['Product', 'Units Sold', 'Revenue']);
    topTbody.querySelectorAll('tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 3) topRows.push([cells[0].textContent, cells[1].textContent, cells[2].textContent]);
    });
  }

  // ── Sheet 3: Least Selling ──────────────────────────
  const leastRows  = [];
  const leastTbody = document.getElementById('leastProductsBody');
  if (leastTbody) {
    leastRows.push(['Product', 'Units Sold', 'Revenue']);
    leastTbody.querySelectorAll('tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 3) leastRows.push([cells[0].textContent, cells[1].textContent, cells[2].textContent]);
    });
  }

  // ── Sheet 4: Payment Breakdown ──────────────────────
  const payRows  = [];
  const payTbody = document.getElementById('paymentBreakdownBody');
  if (payTbody) {
    payRows.push(['Payment Method', 'Transactions', 'Total Amount']);
    payTbody.querySelectorAll('tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 3) payRows.push([cells[0].textContent.trim(), cells[1].textContent, cells[2].textContent]);
    });
  }

  // ── Build workbook ──────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData),   'Summary');
  if (topRows.length)   XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(topRows),   'Top Products');
  if (leastRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(leastRows), 'Least Selling');
  if (payRows.length)   XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(payRows),   'Payment Breakdown');

  const fileName = `TEFC_Sales_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
window.exportSalesExcel = exportSalesExcel;

async function loadSales() {
  // ── Skeleton ──
  skStats(['salesTotal','salesOnline','salesWalkin','salesCustomers']);
  skStats(['branchTE_revenue','branchTE_orders','branchTE_walkin','branchTE_online',
           'branchFC_revenue','branchFC_orders','branchFC_walkin','branchFC_online']);
  skTable('paymentBreakdownBody', ['sk-cell-full','sk-cell-sm','sk-cell-sm'], 5);
  skTable('topProductsBody',      ['sk-cell-full','sk-cell-sm','sk-cell-sm'], 5);
  skTable('leastProductsBody',    ['sk-cell-full','sk-cell-sm','sk-cell-sm'], 5);
  // ─────────────
  try {
    const [orders, customers] = await Promise.all([
      fetch('/api/admin/orders?limit=500').then(r => r.json()),
      fetch('/api/admin/customers').then(r => r.json()),
    ]);

    allSalesOrders = orders;
    document.getElementById('salesCustomers').textContent = customers.length;

    // Populate branch filter dropdown from allBranches
    const branchSel = document.getElementById('salesBranchFilter');
    if (branchSel && allBranches.length) {
      branchSel.innerHTML = '<option value="all">All Branches</option>' +
        allBranches.map(b => `<option value="${b.branch_id}">${b.branch_name}</option>`).join('');
      branchSel.value = currentSalesBranchFilter;
    }

    // Default: show all completed orders
    filterSalesOrders(allSalesOrders);

  } catch (e) { console.error('Sales error:', e); }
}

// ══════════════════════════════════════════════════════
// DISCOUNTS
// ══════════════════════════════════════════════════════
let currentAssignDiscountId = null;
let assignProductState      = []; // { product_id, product_name, checked }

async function loadDiscounts() {
  // ── Skeleton ──
  skTable('discountsBody',          ['sk-cell-full','sk-cell-md','sk-cell-full','sk-cell-sm'], 5);
  skTable('discountedProductsBody', ['sk-cell-full','sk-cell-sm','sk-cell-sm','sk-cell-sm','sk-cell-sm'], 5);
  // ─────────────
  try {
    const [discRes, prodRes] = await Promise.all([
      fetch('/api/admin/discounts'),
      fetch('/api/admin/products'),
    ]);
    allDiscounts = await discRes.json();
    allProducts  = await prodRes.json();

    renderDiscounts(allDiscounts);
    loadDiscountedProducts();
  } catch (e) { console.error('Discounts error:', e); }
}


// ─── Discount Status Helper ───────────────────────────
function getDiscountStatus(d) {
  const now   = new Date();
  const start = d.starts_at ? new Date(d.starts_at) : null;
  const end   = d.ends_at   ? new Date(d.ends_at)   : null;

  if (end && now > end) return { label: '⛔ Ended',   color: '#ef4444', class: 'badge--red',    ended: true  };
  if (start && now < start) {
    const diff  = start - now;
    const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const label = days > 0 ? `⏰ Starts in ${days}d ${hours}h` : `⏰ Starts in ${hours}h`;
    return { label, color: '#f59e0b', class: 'badge--yellow', ended: false };
  }
  if (end) {
    const diff  = end - now;
    const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    let label;
    if (days > 0)       label = `⏳ ${days}d ${hours}h left`;
    else if (hours > 0) label = `⏳ ${hours}h ${mins}m left`;
    else                label = `⏳ ${mins}m left`;
    return { label, color: '#16a34a', class: 'badge--green', ended: false };
  }
  return { label: '✅ Active', color: '#16a34a', class: 'badge--green', ended: false };
}

function renderDiscounts(discounts) {
  _discFilteredCache = discounts;
  const discStart = (discountsPage - 1) * DISC_PAGE_SIZE;
  const discPaged = discounts.slice(discStart, discStart + DISC_PAGE_SIZE);
  document.getElementById('discountsBody').innerHTML = discPaged.length
    ? discPaged.map(d => {
        const assignedProducts = allProducts.filter(p => p.discount_id === d.discount_id);
        const assignedCount    = assignedProducts.length;
        const previewNames     = assignedProducts.slice(0, 3).map(p => p.product_name).join(', ');
        const hasMore          = assignedCount > 3;
        const status = getDiscountStatus(d);
        return `
          <tr style="${status.ended ? 'opacity:0.6;' : ''}">
            <td>
              <strong>${d.discount_name}</strong>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                Created ${new Date(d.created_at).toLocaleDateString('en-PH')}
              </div>
              ${d.starts_at ? `<div style="font-size:11px;color:var(--text-muted);">Starts: ${new Date(d.starts_at).toLocaleDateString('en-PH', {month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>` : ''}
              ${d.ends_at   ? `<div style="font-size:11px;color:var(--text-muted);">Ends: ${new Date(d.ends_at).toLocaleDateString('en-PH', {month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>` : ''}
            </td>
            <td>
              <span style="font-size:20px;font-weight:700;color:${status.ended ? '#ef4444' : 'var(--g-400)'};">${d.percentage}%</span>
              <div style="font-size:11px;color:var(--text-muted);">off original price</div>
              <span class="badge ${status.class}" style="margin-top:4px;display:inline-block;">${status.label}</span>
            </td>
            <td>
              <div style="display:flex;flex-direction:column;gap:4px;">
                <span class="badge badge--blue" style="align-self:flex-start;">${assignedCount} product${assignedCount !== 1 ? 's' : ''}</span>
                <span style="font-size:11px;color:var(--text-muted);">
                  ${assignedCount > 0 ? previewNames + (hasMore ? ` +${assignedCount - 3} more` : '') : 'No products assigned yet'}
                </span>
              </div>
            </td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                <button class="btn btn-cancel" style="font-size:12px;padding:5px 10px;display:inline-flex;align-items:center;gap:4px;"
                  onclick="openAssignModal('${d.discount_id}', '${d.discount_name.replace(/'/g, "\\'")}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                  Assign
                </button>
                <button class="btn-icon" onclick="editDiscount('${d.discount_id}')" title="Edit">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-icon btn-icon--red" onclick="deleteDiscount('${d.discount_id}', '${d.discount_name.replace(/'/g, "\\'")}')" title="Delete">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            </td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="4" class="table-empty">No discounts yet. Click "Add Discount" to create one.</td></tr>';
  renderPagerCustom('discountsPagination', discounts.length, discountsPage, DISC_PAGE_SIZE, 'changeDiscountsPage');
}

function changeDiscountsPage(page) {
  discountsPage = page;
  renderDiscounts(_discFilteredCache);
}
window.changeDiscountsPage = changeDiscountsPage;

function filterDiscounts(q) {
  discountsPage = 1;
  const filtered = allDiscounts.filter(d =>
    d.discount_name.toLowerCase().includes(q.toLowerCase())
  );
  renderDiscounts(filtered);
}

function loadDiscountedProducts() {
  const discounted = allProducts.filter(p => p.discount_id);
  document.getElementById('discountedProductsBody').innerHTML = discounted.length
    ? discounted.map(p => {
        const disc       = Array.isArray(p.discount) ? p.discount[0] : p.discount;
        const discPrice  = p.price * (1 - (disc?.percentage || 0) / 100);
        const savings    = p.price - discPrice;
        return `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:8px;">
                ${p.image_url
                  ? `<img src="${p.image_urls?.length ? p.image_urls[0] : p.image_url}" class="product-img-cell" style="width:32px;height:32px;" alt="${p.product_name}"/>`
                  : `<div class="product-img-placeholder" style="width:32px;height:32px;"></div>`}
                <div>
                  <strong>${p.product_name}</strong>
                  <div style="font-size:11px;color:var(--text-muted);">${p.category}</div>
                </div>
              </div>
            </td>
            <td>${peso(p.price)}</td>
            <td>
              <span class="badge badge--blue">${disc?.discount_name || '—'}</span>
              <span style="font-size:12px;color:var(--g-400);font-weight:700;margin-left:4px;">${disc?.percentage || 0}% OFF</span>
            </td>
            <td>
              <strong style="color:var(--g-400);font-size:14px;">${peso(discPrice)}</strong>
              <div style="font-size:11px;color:var(--text-muted);">Save ${peso(savings)}</div>
            </td>
            <td>
              <button class="btn btn-cancel" style="font-size:12px;padding:5px 10px;color:#ef4444;border-color:#ef4444;display:inline-flex;align-items:center;gap:4px;"
                onclick="removeProductDiscount('${p.product_id}', '${p.product_name.replace(/'/g, "\\'")}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Remove
              </button>
            </td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="5" class="table-empty">No products with discounts yet. Use "Assign" button on any discount.</td></tr>';
}

async function removeProductDiscount(productId, name) {
  if (!confirm(`Remove discount from "${name}"?`)) return;
  try {
    const res = await fetch('/api/admin/discounts/unassign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_ids: [productId] }),
    });
    if (res.ok) { showToast('Discount removed from product.'); invalidateSection('discounts'); loadDiscounts(); }
    else showToast('Failed to remove discount.', 'error');
  } catch (e) { showToast('Error.', 'error'); }
}

// Discount Modal
function openDiscountModal(discount = null) {
  document.getElementById('discountModalTitle').textContent = discount ? 'Edit Discount' : 'Add Discount';
  document.getElementById('discountId').value    = discount?.discount_id || '';
  document.getElementById('dName').value         = discount?.discount_name || '';
  document.getElementById('dPercentage').value   = discount?.percentage || '';

  // Load date fields — convert to datetime-local format
  const toLocal = iso => iso ? iso.slice(0, 16) : '';
  const startsEl = document.getElementById('dStartsAt');
  const endsEl   = document.getElementById('dEndsAt');
  if (startsEl) startsEl.value = toLocal(discount?.starts_at);
  if (endsEl)   endsEl.value   = toLocal(discount?.ends_at);

  document.getElementById('discountModalOverlay').classList.add('open');
  document.getElementById('discountModal').classList.add('open');
}

function closeDiscountModal() {
  document.getElementById('discountModalOverlay').classList.remove('open');
  document.getElementById('discountModal').classList.remove('open');
  document.getElementById('discountForm').reset();
  const startsEl = document.getElementById('dStartsAt');
  const endsEl   = document.getElementById('dEndsAt');
  if (startsEl) startsEl.value = '';
  if (endsEl)   endsEl.value   = '';
}

function editDiscount(id) {
  const discount = allDiscounts.find(d => d.discount_id === id);
  if (discount) openDiscountModal(discount);
}

async function deleteDiscount(id, name) {
  if (!confirm(`Delete discount "${name}"? It will be removed from all assigned products.`)) return;
  try {
    const res = await fetch(`/api/admin/discounts/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Discount deleted.'); invalidateSection('discounts'); loadDiscounts(); }
    else showToast('Failed to delete discount.', 'error');
  } catch (e) { showToast('Error.', 'error'); }
}

async function submitDiscount(e) {
  e.preventDefault();
  const discBtn = e.submitter || document.querySelector('#discountForm button[type="submit"]');
  const id   = document.getElementById('discountId').value;
  const startsAtVal = document.getElementById('dStartsAt')?.value;
  const endsAtVal   = document.getElementById('dEndsAt')?.value;

  // ── Validation ─────────────────────────────────────────
  const dName       = document.getElementById('dName').value.trim();
  const dPercentage = parseFloat(document.getElementById('dPercentage').value);

  if (!dName)                                    { showToast('Discount name is required.', 'error'); return; }
  if (isNaN(dPercentage) || dPercentage <= 0)   { showToast('Percentage must be greater than 0.', 'error'); return; }
  if (dPercentage > 100)                         { showToast('Percentage cannot exceed 100.', 'error'); return; }
  if (startsAtVal && endsAtVal && new Date(endsAtVal) <= new Date(startsAtVal)) {
    showToast('End date must be after the start date.', 'error'); return;
  }
  // ───────────────────────────────────────────────────────

  const data = {
    discount_name: dName,
    percentage:    dPercentage,
    starts_at:     startsAtVal ? new Date(startsAtVal).toISOString() : null,
    ends_at:       endsAtVal   ? new Date(endsAtVal).toISOString()   : null,
  };
  setButtonLoading(discBtn, true);
  try {
    const url    = id ? `/api/admin/discounts/${id}` : '/api/admin/discounts';
    const method = id ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      showToast(id ? 'Discount updated!' : 'Discount created!');
      closeDiscountModal();
      invalidateSection('discounts'); loadDiscounts();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to save discount.', 'error');
    }
  } catch (e) { showToast('Error saving discount.', 'error'); }
  finally { setButtonLoading(discBtn, false); }
}

// Assign Discount Modal
function openAssignModal(discountId, discountName) {
  currentAssignDiscountId = discountId;
  document.getElementById('assignModalTitle').textContent = `Assign: ${discountName}`;

  // Build state — pre-check products that already have this discount
  assignProductState = allProducts.map(p => ({
    product_id:      p.product_id,
    product_name:    p.product_name,
    category:        p.category,
    branch_stock:    p.branch_stock || [],
    checked:         p.discount_id === discountId,
    wasAssigned:     p.discount_id === discountId, // track original state
  }));

  // Populate branch filter from allBranches
  const branchSel = document.getElementById('assignBranchFilter');
  if (branchSel) {
    branchSel.innerHTML = '<option value="">All Branches</option>' +
      allBranches.map(b => `<option value="${b.branch_id}">${b.branch_name}</option>`).join('');
    branchSel.value = ''; // reset to all
  }

  // Reset search
  const searchEl = document.getElementById('assignSearchInput');
  if (searchEl) searchEl.value = '';

  renderAssignProducts(assignProductState);

  document.getElementById('assignModalOverlay').classList.add('open');
  document.getElementById('assignModal').classList.add('open');
}

function closeAssignModal() {
  document.getElementById('assignModalOverlay').classList.remove('open');
  document.getElementById('assignModal').classList.remove('open');
  currentAssignDiscountId = null;
  assignProductState      = [];
}

function renderAssignProducts(products) {
  const wrap = document.getElementById('assignProductList');
  wrap.innerHTML = products.length
    ? products.map(p => {
        const branchTags = (p.branch_stock || []).map(bs =>
          `<span style="font-size:10px;background:rgba(22,163,74,0.1);color:#16a34a;border-radius:4px;padding:1px 5px;">🏪 ${bs.branch?.branch_name || 'Branch'}: ${bs.quantity}</span>`
        ).join(' ');
        return `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;cursor:pointer;background:var(--surface-2);transition:background 0.15s;"
            onmouseover="this.style.background='var(--surface-3)'" onmouseout="this.style.background='var(--surface-2)'">
            <input type="checkbox" value="${p.product_id}" ${p.checked ? 'checked' : ''}
              onchange="toggleAssignProduct('${p.product_id}', this.checked)"
              style="accent-color:var(--g-400);width:15px;height:15px;flex-shrink:0;"/>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.product_name}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px;">${p.category}</div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;">${branchTags || '<span style="font-size:10px;color:var(--text-muted);">No branch stock</span>'}</div>
            </div>
            ${p.checked ? '<span class="badge badge--blue" style="flex-shrink:0;font-size:10px;">Assigned</span>' : ''}
          </label>`;
      }).join('')
    : '<p class="table-empty">No products found</p>';
}

function filterAssignProducts(q) {
  const branchId = document.getElementById('assignBranchFilter')?.value || '';
  const filtered = assignProductState.filter(p => {
    const matchSearch = !q ||
      p.product_name.toLowerCase().includes(q.toLowerCase()) ||
      p.category.toLowerCase().includes(q.toLowerCase());
    const matchBranch = !branchId ||
      (p.branch_stock || []).some(bs => bs.branch_id === branchId);
    return matchSearch && matchBranch;
  });
  renderAssignProducts(filtered);
}

function toggleAssignProduct(productId, checked) {
  const item = assignProductState.find(p => p.product_id === productId);
  if (item) item.checked = checked;
}

async function submitAssign() {
  if (!currentAssignDiscountId) return;

  const toAssign   = assignProductState.filter(p => p.checked).map(p => p.product_id);
  // Only unassign products that HAD this discount before and are now unchecked
  // (never touch products that had a different discount or no discount)
  const toUnassign = assignProductState.filter(p => p.wasAssigned && !p.checked).map(p => p.product_id);

  try {
    const requests = [];
    if (toAssign.length) {
      requests.push(fetch(`/api/admin/discounts/${currentAssignDiscountId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: toAssign }),
      }));
    }
    if (toUnassign.length) {
      requests.push(fetch('/api/admin/discounts/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: toUnassign }),
      }));
    }
    await Promise.all(requests);
    showToast('Discount assignments updated!');
    closeAssignModal();
    invalidateSection('discounts'); loadDiscounts();
  } catch (e) { showToast('Error updating assignments.', 'error'); }
}

// ─── USERS ────────────────────────────────────────────
async function loadUsers() {
  // ── Skeleton ──
  skTable('usersBody', ['sk-cell-full','sk-cell-md','sk-cell-full','sk-cell-sm',
                        'sk-cell-sm','sk-cell-sm','sk-cell-sm'], 8);
  // ─────────────
  try {
    if (!allBranches.length) await loadBranches();
    const res = await fetch('/api/admin/users');
    allUsers  = await res.json();
    renderUsers(allUsers);
  } catch (e) { console.error('Users error:', e); }
}

function renderUsers(users) {
  _userFilteredCache = users;
  const uStart = (usersPage - 1) * USER_PAGE_SIZE;
  const uPaged = users.slice(uStart, uStart + USER_PAGE_SIZE);
  document.getElementById('usersBody').innerHTML = uPaged.length
    ? uPaged.map(u => {
        const s = Array.isArray(u.staff)    ? u.staff[0]    : u.staff;
        const c = Array.isArray(u.customer) ? u.customer[0] : u.customer;
        const name = s?.fname
          ? `${s.fname} ${s.mi ? s.mi.trim() + ' ' : ''}${s.lname || ''}`.trim()
          : c?.fname
            ? `${c.fname} ${c.lname || ''}`.trim()
            : u.username;
        return `
        <tr>
          <td>${name}</td>
          <td>${u.username}</td>
          <td>${s?.email || c?.email || '—'}</td>
          <td>${badge(u.role)}</td>
          <td>${badge(u.status)}</td>
          <td>${new Date(u.created_at).toLocaleDateString('en-PH')}</td>
          <td>
            <div style="display:flex;gap:6px;">
              ${u.role !== 'customer' ? `
                <button class="btn-icon" onclick="editUser('${u.user_id}')" title="Edit">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>` : ''}
              <button class="btn-icon btn-icon--red" onclick="toggleUserStatus('${u.user_id}', '${u.status}')"
                title="${u.status === 'active' ? 'Deactivate' : 'Activate'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><circle cx="12" cy="12" r="10"/>
                  ${u.status === 'active'
                    ? '<line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>'
                    : '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'}
                </svg>
              </button>
            </div>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="table-empty">No users found</td></tr>';
  renderPagerCustom('usersPagination', users.length, usersPage, USER_PAGE_SIZE, 'changeUsersPage');
}
function changeUsersPage(page) { usersPage = page; renderUsers(_userFilteredCache); }
window.changeUsersPage = changeUsersPage;

let userSearchText = '';
let userRoleFilter = '';
let userStatusFilter = '';

function filterUserSearch(val) {
  userSearchText = val.toLowerCase();
  usersPage = 1;
  applyUserFilters();
}
window.filterUserSearch = filterUserSearch;

function filterUserRole(role) {
  userRoleFilter = role;
  usersPage = 1;
  applyUserFilters();
}

function filterUserStatus(status) {
  userStatusFilter = status;
  usersPage = 1;
  applyUserFilters();
}
window.filterUserStatus = filterUserStatus;

function applyUserFilters() {
  let filtered = allUsers;

  // Role filter
  if (userRoleFilter) {
    filtered = filtered.filter(u => u.role === userRoleFilter);
  }

  // Status filter
  if (userStatusFilter) {
    filtered = filtered.filter(u => {
      const status = (u.status || 'active').toLowerCase().trim();
      return status === userStatusFilter;
    });
  }

  // Search filter
  if (userSearchText) {
    filtered = filtered.filter(u => {
      const s    = Array.isArray(u.staff)    ? u.staff[0]    : u.staff;
      const c    = Array.isArray(u.customer) ? u.customer[0] : u.customer;
      const name = s?.fname
        ? (s.fname + ' ' + (s.lname || '')).toLowerCase()
        : c?.fname
        ? (c.fname + ' ' + (c.lname || '')).toLowerCase()
        : '';
      const username = (u.username || '').toLowerCase();
      const email    = (s?.email || c?.email || '').toLowerCase();
      const role     = (u.role || '').toLowerCase();
      return name.includes(userSearchText)
          || username.includes(userSearchText)
          || email.includes(userSearchText)
          || role.includes(userSearchText);
    });
  }

  renderUsers(filtered);
}

function toggleBranchVisibility(role) {
  const branchGroup = document.getElementById('uBranch')?.closest('.form-group');
  if (branchGroup) branchGroup.style.display = role === 'admin' ? 'none' : '';
}

function openUserModal(user = null) {
  // staff and customer come back as arrays from Supabase — normalize to object
  const s = user ? (Array.isArray(user.staff)    ? user.staff[0]    : user.staff)    : null;
  const c = user ? (Array.isArray(user.customer) ? user.customer[0] : user.customer) : null;

  document.getElementById('userModalTitle').textContent = user ? 'Edit Staff' : 'Add Staff';
  document.getElementById('userId').value     = user?.user_id || '';
  document.getElementById('uFname').value     = s?.fname || '';
  document.getElementById('uMi').value        = s?.mi?.trim() || '';
  document.getElementById('uLname').value     = s?.lname || '';
  document.getElementById('uEmail').value     = s?.email || c?.email || '';
  document.getElementById('uPhone').value     = s?.phone_number || '';
  document.getElementById('uUsername').value  = user?.username || '';

  const role = user?.role || 'staff';
  document.getElementById('uRole').value = role;
  document.getElementById('uPasswordGroup').style.display = user ? 'none' : 'block';

  // Toggle branch visibility based on role
  toggleBranchVisibility(role);

  // Populate branch dropdown then pre-select saved branch (B7c fix)
  populateBranchSelects('uBranch');
  setTimeout(() => {
    if (s?.branch_id) {
      document.getElementById('uBranch').value = s.branch_id;
    }
  }, 0);

  document.getElementById('userModalOverlay').classList.add('open');
  document.getElementById('userModal').classList.add('open');
}

function closeUserModal() {
  document.getElementById('userModalOverlay').classList.remove('open');
  document.getElementById('userModal').classList.remove('open');
  document.getElementById('userForm').reset();
  _userClearErrors();
  // Reset password eye icon to crossed on close
  const eyeBtn = document.querySelector('#uPasswordGroup .btn-icon');
  if (eyeBtn) eyeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const uPw = document.getElementById('uPassword');
  if (uPw) uPw.type = 'password';
}

// ── User Modal Inline Validation ─────────────────────────
function _userSetFieldError(inputId, msg) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.style.borderColor = msg ? '#ef4444' : '';
  const container = input.parentNode.classList.contains('form-group')
    ? input.parentNode
    : (input.parentNode.parentNode || input.parentNode);
  let hint = document.getElementById(inputId + '_uerr');
  if (msg) {
    if (!hint) {
      hint = document.createElement('span');
      hint.id        = inputId + '_uerr';
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

function _userClearErrors() {
  ['uFname','uLname','uEmail','uPhone','uUsername','uPassword'].forEach(id => _userSetFieldError(id, ''));
}

function _userCheckField(id) {
  const isNew = !document.getElementById('userId').value;
  const val   = (document.getElementById(id)?.value || '').trim();
  switch (id) {
    case 'uFname':    _userSetFieldError(id, !val ? 'First name is required.' : ''); break;
    case 'uLname':    _userSetFieldError(id, !val ? 'Last name is required.' : ''); break;
    case 'uUsername': _userSetFieldError(id, !val ? 'Username is required.' : /\s/.test(document.getElementById(id).value) ? 'Username cannot contain spaces.' : ''); break;
    case 'uEmail': {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      _userSetFieldError(id, !val ? 'Email is required.' : !ok ? 'Enter a valid email address.' : '');
      break;
    }
    case 'uPhone': {
      const raw = document.getElementById(id)?.value || '';
      _userSetFieldError(id, !raw ? 'Phone number is required.' : !/^09\d{9}$/.test(raw) ? 'Must be 09XXXXXXXXX (11 digits).' : '');
      break;
    }
    case 'uPassword': {
      if (!isNew) break;
      const pw = document.getElementById(id)?.value || '';
      _userSetFieldError(id, !pw ? 'Password is required.' : pw.length < 8 ? 'Must be at least 8 characters.' : '');
      break;
    }
  }
}

function _userValidate() {
  const isNew = !document.getElementById('userId').value;
  ['uFname','uLname','uUsername','uEmail','uPhone'].forEach(id => _userCheckField(id));
  if (isNew) _userCheckField('uPassword');
  return !['uFname','uLname','uUsername','uEmail','uPhone', ...(isNew ? ['uPassword'] : [])].some(id => {
    const hint = document.getElementById(id + '_uerr');
    return hint && hint.textContent;
  });
}

async function editUser(id) {
  const user = allUsers.find(u => u.user_id === id);
  if (user) openUserModal(user);
}

async function toggleUserStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  const user = allUsers.find(u => u.user_id === id);
  const username = user?.username || 'this user';
  const action = newStatus === 'inactive' ? 'Deactivate' : 'Reactivate';
  const confirmed = await showConfirmDialog(
    `${action} User`,
    `${action} <strong>${username}</strong>?`
  );
  if (!confirmed) return;
  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) { showToast('User status updated!'); invalidateSection('users'); loadUsers(); }
    else showToast('Failed to update user.', 'error');
  } catch (e) { showToast('Error.', 'error'); }
}

async function submitUser(e) {
  e.preventDefault();
  const id  = document.getElementById('userId').value;
  const btn = document.getElementById('userSubmitBtn');

  // ── Inline validation ─────────────────────────────────
  if (!_userValidate()) return;

  const fname    = document.getElementById('uFname').value.trim();
  const lname    = document.getElementById('uLname').value.trim();
  const username = document.getElementById('uUsername').value.trim();
  const email    = document.getElementById('uEmail').value.trim();
  const role     = document.getElementById('uRole').value;
  const phone    = document.getElementById('uPhone').value;
  const password = document.getElementById('uPassword').value;

  // ── Confirm dialog
  const action = id ? 'update' : 'add';

  const confirmed = await showConfirmDialog(
    id ? 'Confirm Update Staff' : 'Confirm Add Staff',
    `Are you sure you want to ${action} <strong>${fname} ${lname}</strong> with username <strong>${username}</strong>?`
  );
  if (!confirmed) return;

  // ── Loading
  setButtonLoading(btn, true);

  const data = {
    fname:     fname,
    mi:        document.getElementById('uMi').value,
    lname:     lname,
    email:     email,
    phone:     phone,
    username:  username,
    role:      role,
    password:  password,
    branch_id: document.getElementById('uBranch').value || null,
  };

  try {
    const url    = id ? `/api/admin/users/${id}` : '/api/admin/users';
    const method = id ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const resData = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast(id ? 'Staff updated successfully!' : 'Staff added successfully!');
      closeUserModal();
      invalidateSection('users'); loadUsers();
    } else {
      showToast(resData.error || 'Failed to save staff.', 'error');
    }
  } catch (err) {
    showToast('Error saving staff. Please try again.', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ── Confirm dialog helper ─────────────────────────────
function showConfirmDialog(title, message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:var(--card-bg);border-radius:16px;padding:1.5rem;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <h3 style="margin:0 0 0.5rem;font-size:16px;">${title}</h3>
        <p style="margin:0 0 1.2rem;font-size:13px;color:var(--text-muted);line-height:1.6;">${message}</p>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="confirmNo"  style="padding:8px 18px;border-radius:8px;border:1.5px solid var(--border);background:none;cursor:pointer;font-size:13px;">No</button>
          <button id="confirmYes" style="padding:8px 18px;border-radius:8px;border:none;background:linear-gradient(135deg,var(--g-700),var(--g-500));color:#fff;cursor:pointer;font-size:13px;font-weight:600;">Yes, Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirmYes').onclick = () => { document.body.removeChild(overlay); resolve(true); };
    overlay.querySelector('#confirmNo').onclick  = () => { document.body.removeChild(overlay); resolve(false); };
  });
}
window.showConfirmDialog = showConfirmDialog;

// ─── Init ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// STOCK REQUESTS & PURCHASE ORDERS
// ═══════════════════════════════════════════════════════

let allStockRequests = [];
let allPOs           = [];
let poPage           = 1;
const PO_PAGE_SIZE   = 10;
let srPage           = 1;
const SR_PAGE_SIZE   = 6;
let poItems          = []; // items in create PO modal


// ─── PO & SR page change handlers ─────────────────────────────────────────
function changePOPage(page) { poPage = page; renderPOs(allPOs); }
function changeSRPage(page) { srPage = page; renderStockRequests(allStockRequests); }
window.changePOPage = changePOPage;
window.changeSRPage = changeSRPage;

async function loadPurchaseOrders() {
  // ── Skeleton ──
  skTable('stockRequestsBody', ['sk-cell-full','sk-cell-sm','sk-cell-sm','sk-cell-md',
                                'sk-cell-md','sk-cell-sm','sk-cell-full','sk-cell-sm','sk-cell-sm'], 6);
  skTable('poBody', ['sk-cell-sm','sk-cell-full','sk-cell-sm','sk-cell-sm',
                     'sk-cell-sm','sk-cell-sm','sk-cell-sm'], 5);
  // ─────────────
  try {
    const [reqRes, poRes] = await Promise.all([
      fetch('/api/admin/stock-requests'),
      fetch('/api/admin/purchase-orders'),
    ]);
    allStockRequests = await reqRes.json();
    allPOs           = await poRes.json();

    // Badge — pending requests
    const pending = allStockRequests.filter(r => r.status === 'pending').length;
    const poBadge   = document.getElementById('poRequestBadge');
    if (poBadge) {
      poBadge.textContent   = pending;
      poBadge.style.display = pending > 0 ? 'inline' : 'none';
    }

    renderStockRequests(allStockRequests);
    renderPOs(allPOs);
  } catch (e) { console.error('PO error:', e); }
}

function renderStockRequests(requests) {
  const statusColors = { pending:'yellow', approved:'green', rejected:'red' };
  if (srPage > Math.ceil(requests.length / SR_PAGE_SIZE)) srPage = 1;
  const paged = requests.slice((srPage - 1) * SR_PAGE_SIZE, srPage * SR_PAGE_SIZE);
  renderPagerCustom('srPagination', requests.length, srPage, SR_PAGE_SIZE, 'changeSRPage');
  document.getElementById('stockRequestsBody').innerHTML = paged.length
    ? paged.map(r => `
        <tr>
          <td>
            <strong>${r.product?.product_name || '—'}</strong>
            ${r.variant_options && Object.keys(r.variant_options).length > 0
              ? '<div style="font-size:11px;color:var(--text-muted);">' + Object.entries(r.variant_options).map(function(e){return e[0]+': '+e[1];}).join(', ') + '</div>'
              : ''}
          </td>
          <td>${(() => {
            const bs = r.product?.branch_stock || [];
            const branchBs = bs.find(b => b.branch_id === r.branch_id);
            if (branchBs) return `${branchBs.quantity} units`;
            const total = bs.reduce((s, b) => s + Number(b.quantity), 0);
            return total > 0 ? `${total} units` : `${r.product?.quantity ?? 0} units`;
          })()}</td>
          <td>${r.quantity_needed} units</td>
          <td>${r.staff ? `${r.staff.fname} ${r.staff.lname}` : '—'}</td>
          <td>${r.branch?.branch_name || '—'}</td>
          <td>${badge(r.status)}</td>
          <td style="font-size:12px;">${r.note || '—'}</td>
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
          <td>
            <button class="btn-icon" onclick="openReviewRequest('${r.request_id}', '${r.product?.product_name}', ${r.quantity_needed}, '${r.status}')" title="Review / Change Decision">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="9" class="table-empty">No stock requests yet</td></tr>';
}

function renderPOs(pos) {
  const statusColors = { draft:'gray', ordered:'blue', received:'green', cancelled:'red' };
  if (poPage > Math.ceil(pos.length / PO_PAGE_SIZE)) poPage = 1;
  const paged = pos.slice((poPage - 1) * PO_PAGE_SIZE, poPage * PO_PAGE_SIZE);
  renderPagerCustom('poPagination', pos.length, poPage, PO_PAGE_SIZE, 'changePOPage');
  document.getElementById('poBody').innerHTML = paged.length
    ? paged.map(po => {
        const items    = po.po_item || [];
        const total    = items.reduce((s, i) => s + (Number(i.unit_cost) * Number(i.quantity)), 0);
        const itemCount = items.length;
        return `
        <tr>
          <td><strong>${po.po_number || '—'}</strong></td>
          <td>${po.supplier || '—'}</td>
          <td>${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
          <td>${peso(total)}</td>
          <td>${badge(po.status)}</td>
          <td>${new Date(po.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</td>
          <td>
            <button class="btn-icon" onclick="openPODetail('${po.po_id}')" title="View">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="table-empty">No purchase orders yet</td></tr>';
}

// ─── Review Stock Request ─────────────────────────────

function openReviewRequest(requestId, productName, qty, status) {
  document.getElementById('reviewRequestId').value    = requestId;
  document.getElementById('reviewRequestTitle').textContent = `Review Request — ${productName}`;
  document.getElementById('reviewRequestInfo').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div><strong>Product:</strong> ${productName}</div>
      <div><strong>Quantity Requested:</strong> ${qty} units</div>
    </div>`;
  document.getElementById('reviewAdminNote').value = '';
  // Show/hide buttons based on current status
  const approveBtn = document.querySelector('#reviewRequestModal .btn-solid-green');
  const rejectBtn  = document.querySelector('#reviewRequestModal .btn[style*="#ef4444"]');
  if (approveBtn) approveBtn.style.display = status === 'approved' ? 'none' : '';
  if (rejectBtn)  rejectBtn.style.display  = status === 'rejected' ? 'none' : '';
  document.getElementById('reviewRequestModalOverlay')?.classList.add('open');
  document.getElementById('reviewRequestModal')?.classList.add('open');
}

function closeReviewRequestModal() {
  document.getElementById('reviewRequestModalOverlay')?.classList.remove('open');
  document.getElementById('reviewRequestModal')?.classList.remove('open');
}

async function submitReview(status) {
  const requestId = document.getElementById('reviewRequestId').value;
  const adminNote = document.getElementById('reviewAdminNote').value;
  try {
    const res = await fetch(`/api/admin/stock-requests/${requestId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_note: adminNote }),
    });
    if (res.ok) {
      showToast(`Request ${status}!`);
      closeReviewRequestModal();
      invalidateSection('purchase_orders'); loadPurchaseOrders();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed.', 'error');
    }
  } catch (e) { showToast('Error.', 'error'); }
}

// ─── Create Purchase Order ────────────────────────────

function openCreatePOModal() {
  poItems = [];
  document.getElementById('poSupplier').value = '';
  document.getElementById('poNote').value     = '';
  document.getElementById('poItemsWrap').innerHTML = '';
  document.getElementById('poTotal').textContent   = '₱0.00';
  addPOItemRow(); // start with one row
  document.getElementById('createPOModalOverlay')?.classList.add('open');
  document.getElementById('createPOModal')?.classList.add('open');
}

function closeCreatePOModal() {
  document.getElementById('createPOModalOverlay')?.classList.remove('open');
  document.getElementById('createPOModal')?.classList.remove('open');
}


function loadPORowVariants(sel) {
  const row      = sel.closest('div[style*="grid"]') || sel.parentElement.parentElement;
  const wrap     = row.querySelector('.po-variant-wrap');
  if (!wrap) return;
  const opt      = sel.options[sel.selectedIndex];
  const groups   = JSON.parse(opt?.dataset?.groups || '[]');

  if (!groups.length) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }

  wrap.style.display = 'flex';
  wrap.innerHTML = groups.map(g => `
    <div style="flex:1;min-width:100px;">
      <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:2px;">${g.label}</label>
      <select class="form-input form-select po-variant-opt" data-label="${g.label}" style="font-size:11px;padding:4px 6px;">
        <option value="">Any</option>
        ${(g.choices || []).map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
  `).join('');
}

function addPOItemRow() {
  const wrap = document.getElementById('poItemsWrap');
  const idx  = wrap.children.length;
  const row  = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 80px 100px 32px;gap:8px;margin-bottom:8px;align-items:center;';
  row.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:4px;">
      <select class="form-input form-select po-product" onchange="updatePORowStock(this);updatePOTotal();loadPORowVariants(this);">
        <option value="">Select product</option>
        ${allProducts.map(p => {
          const bs = p.branch_stock || [];
          const totalStock = bs.length
            ? bs.reduce((s, b) => s + Number(b.quantity), 0)
            : Number(p.quantity || 0);
          return `<option value="${p.product_id}" data-stock="${totalStock}" data-bs='${JSON.stringify(bs)}' data-groups='${JSON.stringify(p.option_groups||[])}'>${p.product_name}</option>`;
        }).join('')}
      </select>
      <div class="po-variant-wrap" style="display:none;flex-wrap:wrap;gap:4px;"></div>
      <span class="po-stock-info" style="font-size:11px;color:var(--text-muted);padding-left:4px;"></span>
    </div>
    <input type="number" class="form-input po-qty" min="1" placeholder="Qty" oninput="updatePOTotal()"/>
    <input type="number" class="form-input po-cost" min="0" step="0.01" placeholder="Unit Cost" oninput="updatePOTotal()"/>
    <button type="button" onclick="this.parentElement.remove();updatePOTotal();" style="background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;width:32px;height:32px;font-size:16px;">&times;</button>
  `;
  wrap.appendChild(row);
}


function updatePORowStock(sel) {
  const opt  = sel.options[sel.selectedIndex];
  const stock = opt?.dataset?.stock || '0';
  const bsRaw = opt?.dataset?.bs;
  let info    = `Current stock: ${stock} units`;
  if (bsRaw) {
    try {
      const bs = JSON.parse(bsRaw);
      if (bs.length > 1) {
        info = bs.map(b => `${b.branch?.branch_name || 'Branch'}: ${b.quantity}`).join(' | ');
      }
    } catch {}
  }
  const row = sel.closest('[style]');
  const infoEl = row?.querySelector('.po-stock-info');
  if (infoEl) infoEl.textContent = opt.value ? info : '';
}

function updatePOTotal() {
  const rows  = document.getElementById('poItemsWrap').children;
  let total   = 0;
  for (const row of rows) {
    const qty  = parseFloat(row.querySelector('.po-qty')?.value || 0);
    const cost = parseFloat(row.querySelector('.po-cost')?.value || 0);
    total += qty * cost;
  }
  document.getElementById('poTotal').textContent = peso(total);
}

async function submitCreatePO() {
  const createBtn = document.querySelector('#createPOModal .btn-solid-green');
  if (createBtn) { setButtonLoading(createBtn, true); }
  const supplier = document.getElementById('poSupplier').value.trim();
  const note     = document.getElementById('poNote').value.trim();
  if (!supplier) { showToast('Supplier name is required.', 'error'); return; }

  const rows  = document.getElementById('poItemsWrap').children;
  const items = [];
  for (const row of rows) {
    const productId = row.querySelector('.po-product')?.value;
    const qty       = parseInt(row.querySelector('.po-qty')?.value || 0);
    const unitCost  = parseFloat(row.querySelector('.po-cost')?.value || 0);
    if (productId && qty > 0) {
      // Get variant options for this row
      const variantSelects = row.querySelectorAll('.po-variant-opt');
      const variantOpts = {};
      variantSelects.forEach(vs => {
        if (vs.value) variantOpts[vs.dataset.label] = vs.value;
      });
      items.push({ product_id: productId, quantity: qty, unit_cost: unitCost, unitCost, variant_options: Object.keys(variantOpts).length ? variantOpts : null });
    }
  }
  if (!items.length) { showToast('Add at least one item.', 'error'); return; }

  try {
    const res = await fetch('/api/admin/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier, note, items }),
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`PO ${data.po_number} created!`);
      closeCreatePOModal();
      invalidateSection('purchase_orders'); loadPurchaseOrders();
      // Show digital receipt
      const receiptItems = items.map(i => ({
        product_name: allProducts.find(p => p.product_id === i.product_id)?.product_name || '—',
        quantity:     i.quantity,
        unit_cost:    i.unitCost || i.unit_cost,
      }));
      const receiptTotal = items.reduce((s, i) => s + (i.unitCost || i.unit_cost || 0) * i.quantity, 0);
      showPOReceipt({ po_number: data.po_number, supplier, note, status: 'draft' }, receiptItems, receiptTotal);
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to create PO.', 'error');
    }
  } catch (e) { showToast('Error.', 'error'); }
}


// ─── PO Digital Receipt ───────────────────────────────
function showPOReceipt(po, items, total) {
  const now    = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });

  const itemsHtml = items.map(i => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid var(--border);">
        ${i.product?.product_name || i.product_name || '—'}
        ${i.variant_options ? `<div style="font-size:10px;color:var(--text-muted);">${Object.entries(i.variant_options).map(([k,v]) => k+': '+v).join(', ')}</div>` : ''}
      </td>
      <td style="padding:6px 8px;border-bottom:1px solid var(--border);text-align:center;">${i.quantity}</td>
      <td style="padding:6px 8px;border-bottom:1px solid var(--border);text-align:right;">${peso(i.unit_cost)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid var(--border);text-align:right;font-weight:600;">${peso(Number(i.unit_cost) * Number(i.quantity))}</td>
    </tr>`).join('');

  showModal(`
    <div style="padding:1.5rem;" id="poReceiptContent">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px dashed var(--border);">
        <div style="font-size:20px;font-weight:700;color:var(--text-primary);">Triple E & Fiel Collince</div>
        <div style="font-size:12px;color:var(--text-muted);">General Merchandise</div>
        <div style="font-size:12px;color:var(--text-muted);">Koronadal City, South Cotabato</div>
        <div style="margin-top:8px;font-size:14px;font-weight:700;color:var(--g-400);">PURCHASE ORDER RECEIPT</div>
      </div>

      <!-- PO Info -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:1rem;font-size:13px;">
        <div><span style="color:var(--text-muted);">PO Number</span><br/><strong>${po.po_number || '—'}</strong></div>
        <div><span style="color:var(--text-muted);">Status</span><br/>${badge(po.status)}</div>
        <div><span style="color:var(--text-muted);">Supplier</span><br/><strong>${po.supplier || '—'}</strong></div>
        <div><span style="color:var(--text-muted);">Date</span><br/><strong>${dateStr} ${timeStr}</strong></div>
        ${po.note ? `<div style="grid-column:1/-1;"><span style="color:var(--text-muted);">Note</span><br/>${po.note}</div>` : ''}
      </div>

      <!-- Items Table -->
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:1rem;">
        <thead>
          <tr style="background:var(--surface-2);">
            <th style="padding:8px;text-align:left;font-size:12px;">Product</th>
            <th style="padding:8px;text-align:center;font-size:12px;">Qty</th>
            <th style="padding:8px;text-align:right;font-size:12px;">Unit Cost</th>
            <th style="padding:8px;text-align:right;font-size:12px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr style="background:var(--surface-2);">
            <td colspan="3" style="padding:8px;text-align:right;font-weight:700;">TOTAL</td>
            <td style="padding:8px;text-align:right;font-weight:700;color:var(--g-400);font-size:15px;">${peso(total)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Footer -->
      <div style="text-align:center;font-size:11px;color:var(--text-muted);padding-top:1rem;border-top:2px dashed var(--border);">
        Generated by Triple E & Fiel Collince E-Commerce & POS System<br/>
        ${dateStr} at ${timeStr}
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:8px;margin-top:1rem;">
        <button onclick="printPOReceipt()" class="btn btn-cancel" style="flex:1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print
        </button>
        <button onclick="closeModal()" class="btn btn-solid-green" style="flex:1;">Done</button>
      </div>
    </div>
  `);
}

function printPOReceipt() {
  const content = document.getElementById('poReceiptContent')?.innerHTML;
  if (!content) return;
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>PO Receipt</title>
        <style>
          body { font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; border-bottom: 1px solid #ddd; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
  win.document.close();
  win.print();
}

// ─── PO Detail Modal ──────────────────────────────────

function openPODetail(poId) {
  const po = allPOs.find(p => p.po_id === poId);
  if (!po) return;
  document.getElementById('poDetailTitle').textContent = `${po.po_number} — ${po.supplier}`;

  const items = po.po_item || [];
  const total = items.reduce((s, i) => s + Number(i.unit_cost) * Number(i.quantity), 0);

  document.getElementById('poDetailContent').innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:1rem;font-size:13px;">
      <div><strong>Supplier:</strong> ${po.supplier}</div>
      <div><strong>Status:</strong> ${badge(po.status)}</div>
      <div><strong>Created:</strong> ${new Date(po.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      ${po.note ? `<div><strong>Note:</strong> ${po.note}</div>` : ''}
    </div>
    <table class="data-table" style="margin-bottom:1rem;">
      <thead><tr><th>Product</th><th>Qty</th><th>Unit Cost</th><th>Subtotal</th></tr></thead>
      <tbody>
        ${items.map(i => `
          <tr>
            <td>
              ${i.product?.product_name || '—'}
              ${i.variant_options ? `<div style="font-size:10px;color:var(--text-muted);">${Object.entries(i.variant_options).map(([k,v])=>k+': '+v).join(', ')}</div>` : ''}
            </td>
            <td>${i.quantity}</td>
            <td>${peso(i.unit_cost)}</td>
            <td>${peso(Number(i.unit_cost) * Number(i.quantity))}</td>
          </tr>`).join('')}
        <tr style="font-weight:700;">
          <td colspan="3" style="text-align:right;">Total</td>
          <td>${peso(total)}</td>
        </tr>
      </tbody>
    </table>`;

  // Action buttons based on status
  const footer = document.getElementById('poDetailFooter');
  footer.innerHTML = `<button type="button" class="btn btn-cancel" onclick="closePODetailModal()">Close</button>`;
  if (po.status === 'draft') {
    footer.innerHTML += `
      <button class="btn btn-cancel" onclick="updatePOStatus('${poId}', 'cancelled')">Cancel PO</button>
      <button class="btn btn-solid-green" onclick="updatePOStatus('${poId}', 'ordered')">Mark as Ordered</button>`;
  } else if (po.status === 'ordered') {
    // Build per-item receive + distribute UI
    const itemRows = items.map((item, idx) => {
      const orderedQty = Number(item.quantity);
      const productLabel = (item.product?.product_name || '—')
        + (item.variant_options && Object.keys(item.variant_options).length
            ? ' <span style="font-size:10px;color:var(--text-muted);">(' + Object.entries(item.variant_options).map(([k,v])=>k+': '+v).join(', ') + ')</span>'
            : '');
      const branchInputs = allBranches.map(b =>
        `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <label style="font-size:12px;font-weight:500;min-width:120px;">${b.branch_name}</label>
          <input type="number" id="dist_${idx}_${b.branch_id}" min="0" value="0"
            data-item="${idx}" data-branch="${b.branch_id}"
            style="width:64px;padding:4px 8px;border-radius:6px;border:1.5px solid var(--border);background:var(--surface);color:var(--text-primary);font-size:12px;"
            oninput="validatePODistribution()"/>
          <span style="font-size:11px;color:var(--text-muted);">units</span>
        </div>`
      ).join('');
      return `
        <div style="background:var(--surface-2,var(--surface));border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px;" data-item-idx="${idx}" data-ordered="${orderedQty}">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:600;">${productLabel}</span>
            <span style="font-size:11px;color:var(--text-muted);">Ordered: ${orderedQty}</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <label style="font-size:11px;color:var(--text-muted);">Actually received:</label>
              <input type="number" id="recv_${idx}" min="0" max="${orderedQty}" value="${orderedQty}"
                style="width:64px;padding:4px 8px;border-radius:6px;border:1.5px solid var(--g-400);background:var(--surface);color:var(--text-primary);font-size:12px;font-weight:600;"
                oninput="validatePODistribution()"/>
              <span style="font-size:11px;color:var(--text-muted);">/ ${orderedQty} max</span>
            </div>
          </div>
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;">📦 Distribute to Branches</div>
          ${branchInputs}
          <div id="distError_${idx}" style="font-size:11px;color:#ef4444;margin-top:4px;display:none;"></div>
          <div id="distCount_${idx}" style="font-size:11px;color:var(--text-muted);margin-top:4px;"></div>
        </div>`;
    }).join('');

    footer.innerHTML += `
      <div style="width:100%;max-height:380px;overflow-y:auto;padding-right:2px;">
        <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:8px;">Receive &amp; Distribute Items</div>
        ${itemRows}
      </div>
      <button id="markReceivedBtn" class="btn btn-solid-green" disabled onclick="submitPOReceive('${poId}')">Mark as Received ✓</button>`;

    // Run initial validation to set counter labels
    setTimeout(validatePODistribution, 0);
  }

  document.getElementById('poDetailModalOverlay')?.classList.add('open');
  document.getElementById('poDetailModal')?.classList.add('open');
}

function closePODetailModal() {
  document.getElementById('poDetailModalOverlay')?.classList.remove('open');
  document.getElementById('poDetailModal')?.classList.remove('open');
}

// ─── PO Receive & Distribute Validation ──────────────────
function validatePODistribution() {
  var footer   = document.getElementById('poDetailFooter');
  if (!footer) return;
  var itemDivs = footer.querySelectorAll('[data-item-idx]');
  if (!itemDivs.length) return;

  var allValid = true;

  itemDivs.forEach(function(div) {
    var idx        = div.getAttribute('data-item-idx');
    var orderedQty = parseInt(div.getAttribute('data-ordered')) || 0;
    var recvInput  = document.getElementById('recv_' + idx);
    var recvQty    = Math.min(parseInt(recvInput?.value || '0'), orderedQty);
    if (recvInput && parseInt(recvInput.value) > orderedQty) {
      recvInput.value = orderedQty; // clamp silently
      recvQty = orderedQty;
    }

    var distTotal  = 0;
    allBranches.forEach(function(b) {
      var inp = document.getElementById('dist_' + idx + '_' + b.branch_id);
      if (inp) distTotal += parseInt(inp.value || '0');
    });

    var errEl   = document.getElementById('distError_' + idx);
    var countEl = document.getElementById('distCount_' + idx);
    var over    = distTotal > recvQty;
    var none    = recvQty <= 0;

    if (countEl) {
      countEl.textContent = 'Distributed: ' + distTotal + ' / ' + recvQty + ' received';
      countEl.style.color = over ? '#ef4444' : distTotal === recvQty ? 'var(--g-400)' : 'var(--text-muted)';
    }
    if (errEl) {
      if (over) {
        errEl.textContent = '⚠ Total distributed (' + distTotal + ') exceeds received (' + recvQty + ')';
        errEl.style.display = '';
      } else if (none) {
        errEl.textContent = '⚠ Enter the actually received quantity above (must be > 0)';
        errEl.style.display = '';
      } else {
        errEl.style.display = 'none';
      }
    }

    if (over || none || distTotal === 0) allValid = false;
  });

  var btn = document.getElementById('markReceivedBtn');
  if (btn) btn.disabled = !allValid;
}

async function submitPOReceive(poId) {
  var footer   = document.getElementById('poDetailFooter');
  var itemDivs = footer ? footer.querySelectorAll('[data-item-idx]') : [];
  var po       = allPOs.find(function(p) { return p.po_id === poId; });
  if (!po) return;

  // Build per-item received quantities + branch distributions
  var itemsPayload = [];
  var items = po.po_item || [];
  itemDivs.forEach(function(div) {
    var idx       = div.getAttribute('data-item-idx');
    var item      = items[parseInt(idx)];
    if (!item) return;
    var recvQty   = parseInt(document.getElementById('recv_' + idx)?.value || '0');
    var branches  = [];
    allBranches.forEach(function(b) {
      var qty = parseInt(document.getElementById('dist_' + idx + '_' + b.branch_id)?.value || '0');
      if (qty > 0) branches.push({ branch_id: b.branch_id, quantity: qty });
    });
    itemsPayload.push({ po_item_id: item.po_item_id, product_id: item.product_id, received_quantity: recvQty, branches: branches });
  });

  var btn = document.getElementById('markReceivedBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

  try {
    const res = await fetch('/api/admin/purchase-orders/' + poId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'received', po_number: po.po_number, items: itemsPayload }),
    });
    if (res.ok) {
      showToast('PO marked as received!');
      closePODetailModal();
      invalidateSection('purchase_orders'); loadPurchaseOrders();
      invalidateSection('inventory'); loadInventory();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to receive PO.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Mark as Received ✓'; }
    }
  } catch (e) {
    showToast('Error submitting.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Mark as Received ✓'; }
  }
}

async function updatePOStatus(poId, status, branchId = null, branches = null) {
  const po = allPOs.find(p => p.po_id === poId);
  const activeBtn = document.getElementById(status === 'received' ? 'markReceivedBtn' : 'markOrderedBtn');
  try {
    const res = await fetch(`/api/admin/purchase-orders/${poId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, po_number: po?.po_number, branch_id: branchId, branches: branches }),
    });
    if (res.ok) {
      if (activeBtn) { activeBtn.disabled = false; activeBtn.textContent = status === 'received' ? 'Mark as Received ✓' : 'Mark as Ordered'; }
      showToast(`PO marked as ${status}!`);
      closePODetailModal();
      invalidateSection('purchase_orders'); loadPurchaseOrders();
      if (status === 'received') { invalidateSection('inventory'); loadInventory(); }
      // Show receipt when marked as ordered or received
      if (status === 'ordered' || status === 'received') {
        const items   = po?.po_item || [];
        const total   = items.reduce((s, i) => s + Number(i.unit_cost) * Number(i.quantity), 0);
        showPOReceipt({ ...po, status }, items, total);
      }
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to update PO.', 'error');
    }
  } catch (e) { if (createBtn) { setButtonLoading(createBtn, false); } showToast('Error.', 'error'); }
}


document.addEventListener('DOMContentLoaded', async function () {
  await loadBranches();
  _loadedSections.add('products'); loadProducts();

  // Restore last section from URL hash or localStorage
  const hash    = window.location.hash.replace('#', '');
  const saved   = localStorage.getItem('admin-section');
  const section = hash || saved || 'overview';
  const valid   = Object.keys(pageTitles);
  showSection(valid.includes(section) ? section : 'overview', null);

  // Restore open modal if any
  const openModal = localStorage.getItem('admin-open-modal');
  if (openModal) {
    localStorage.removeItem('admin-open-modal');
    if (openModal === 'product')   openProductModal();
    if (openModal === 'inventory') openInventoryModal();
    if (openModal === 'discount')  openDiscountModal();
    if (openModal === 'user')      openUserModal();
  }
});

window.addEventListener('beforeunload', function () {
  if (document.getElementById('productModal')?.classList.contains('open'))
    localStorage.setItem('admin-open-modal', 'product');
  else if (document.getElementById('inventoryModal')?.classList.contains('open'))
    localStorage.setItem('admin-open-modal', 'inventory');
  else if (document.getElementById('discountModal')?.classList.contains('open'))
    localStorage.setItem('admin-open-modal', 'discount');
  else if (document.getElementById('userModal')?.classList.contains('open'))
    localStorage.setItem('admin-open-modal', 'user');
  else
    localStorage.removeItem('admin-open-modal');
});
// ─── Add spin animation ───────────────────────────────
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
    // Always save info
    const infoRes  = await fetch('/auth/profile', {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'info', fname, mi, lname, username, email, phone_number: phone }),
    });
    const infoData = await infoRes.json();
    if (!infoRes.ok) { showToast(infoData.error || 'Failed to save profile.', 'error'); return; }

    // Optionally change password
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