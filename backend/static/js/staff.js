// ─── Pagination ──────────────────────────────────────
const ITEMS_PER_PAGE = 10;
let staffOrdersPage = 1;
let staffInvPage    = 1;

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

function changeStaffOrdersPage(p) { staffOrdersPage = p; renderStaffOrders(staffOrders); }
function changeStaffInvPage(p)    { staffInvPage = p;    renderInvProducts(invProducts); }
window.changeStaffOrdersPage = changeStaffOrdersPage;
window.changeStaffInvPage    = changeStaffInvPage;

const pageTitles = {
  pos:       ['Point of Sale',    'Process walk-in customer orders'],
  inventory: ['Inventory',        'View branch stock levels'],
  orders:    ['Orders',           'View and manage customer orders'],
  requests:  ['Stock Requests',   'Request stock from admin'],
  summary:   ['Sales Summary',    'View your sales performance'],
};


// ─── Auto Refresh (5 seconds) ─────────────────────────
let autoRefreshTimer = null;
const AUTO_REFRESH_SECTIONS = ['orders', 'inventory', 'pos'];
const AUTO_REFRESH_INTERVAL = 5000; // 5 seconds

function startAutoRefresh(section) {
  stopAutoRefresh();
  if (!AUTO_REFRESH_SECTIONS.includes(section)) return;
  autoRefreshTimer = setInterval(() => {
    if (loaders[section]) loaders[section]();
  }, AUTO_REFRESH_INTERVAL);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    const section = localStorage.getItem('staff-section') || 'pos';
    startAutoRefresh(section);
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
  loaders[name] && loaders[name]();
  startAutoRefresh(name);
}

const loaders = {
  pos:       loadPosProducts,
  inventory: loadInventory,
  orders:    loadOrders,
  summary:   loadSummary,
  requests:  loadRequests,
};


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

// ══════════════════════════════════════════════════════
// GLOBAL STATE
// ══════════════════════════════════════════════════════
let posProducts     = [];
let orderItems      = [];
let selectedPayment = 'walk_in_cash';
let invProducts     = [];
let staffOrders     = [];
let allBranches     = [];

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
  try {
    const res   = await fetch('/api/products');
    const all   = await res.json();
    // Filter to only show products for this branch
    posProducts = all.filter(p =>
      !p.branch_id || p.branch_id === staffBranchId
    );
    renderPosProducts(posProducts);
    populateCategories(posProducts);
  } catch (e) { console.error('POS products error:', e); }
}

function populateCategories(products) {
  const cats = [...new Set(products.map(p => p.category))];
  const wrap = document.getElementById('posCats');
  wrap.innerHTML = `<button class="pos-cat active" onclick="filterPosCategory('', this)">All</button>` +
    cats.map(c => `<button class="pos-cat" onclick="filterPosCategory('${c}', this)">${c}</button>`).join('');
}

function filterPosCategory(cat, el) {
  document.querySelectorAll('.pos-cat').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderPosProducts(cat ? posProducts.filter(p => p.category === cat) : posProducts);
}

function searchProducts(q) {
  const filtered = posProducts.filter(p =>
    p.product_name.toLowerCase().includes(q.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(q.toLowerCase()) ||
    p.category.toLowerCase().includes(q.toLowerCase())
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
      <div class="pos-product-card${p.quantity <= 0 ? ' out-of-stock' : ''}"
           onclick="${p.quantity > 0 ? `addToOrder('${p.product_id}', '${p.product_name.replace(/'/g, "\\'")}', ${effectivePrice}, ${p.quantity})` : ''}">
        ${p.image_url
          ? `<img src="${p.image_url}" class="pos-product-img" alt="${p.product_name}"/>`
          : `<div class="pos-product-img-placeholder">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
             </div>`
        }
        <div class="pos-product-name">${p.product_name}</div>
        ${priceDisplay}
        <div class="pos-product-stock">${p.quantity <= 0 ? '⚠️ Out of stock' : `Stock: ${p.quantity}`}</div>
      </div>`;
  }).join('');
}

function addToOrder(productId, name, price, maxStock) {
  const existing = orderItems.find(i => i.product_id === productId);
  if (existing) {
    if (existing.quantity >= maxStock) {
      showToast(`Only ${maxStock} units available.`, 'error');
      return;
    }
    existing.quantity++;
  } else {
    orderItems.push({ product_id: productId, name, price, quantity: 1, max: maxStock });
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
    const checkBtn = document.getElementById('processOrderBtn');
    if (checkBtn) checkBtn.disabled = true;
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
  const checkBtn2 = document.getElementById('processOrderBtn');
  if (checkBtn2) checkBtn2.disabled = false;
}

function updateTotal() {
  const total = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
  document.getElementById('posSubtotal').textContent = peso(total);
  document.getElementById('posTotal').textContent    = peso(total);
  computeChange();
}

function clearOrder() {
  if (orderItems.length && !confirm('Clear current order?')) return;
  orderItems = [];
  renderOrderItems();
  updateTotal();
  document.getElementById('posCustomer').value     = '';
  document.getElementById('posCashReceived').value = '';
  document.getElementById('posChange').value        = '';
  document.getElementById('posGcashRef').value      = '';
}

function selectPayment(method, el) {
  selectedPayment = method;
  document.querySelectorAll('.pos-pay-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('posRefNo').style.display     = method === 'gcash' ? 'flex' : 'none';
  document.getElementById('posCashInput').style.display = method === 'walk_in_cash' ? 'flex' : 'none';
}

function computeChange() {
  const total    = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const received = parseFloat(document.getElementById('posCashReceived').value) || 0;
  const change   = received - total;
  const input    = document.getElementById('posChange');
  input.value       = change >= 0 ? peso(change) : '—';
  input.style.color = change >= 0 ? 'var(--g-400)' : '#ef4444';
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
    const total    = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const received = parseFloat(document.getElementById('posCashReceived').value) || 0;
    if (received < total) {
      showToast('Cash received is less than total amount.', 'error');
      return;
    }
  }

  try {
    const total    = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const quantity = orderItems.reduce((s, i) => s + i.quantity, 0);

    const res = await fetch('/api/staff/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_type:     'walk_in',
        quantity,
        total,
        ref_no:         refNo || null,
        payment_method: selectedPayment,
        branch_id:      branchId,             // ← sent to create Sales_Transaction
        cart_items:     orderItems.map(i => ({
          product_id: i.product_id,
          quantity:   i.quantity,
          price:      i.price,
        })),
        customer_name: document.getElementById('posCustomer').value.trim(),
      }),
    });

    const data = await res.json();
    if (res.ok) {
      // Capture receipt data BEFORE clearing order
      const receiptItems    = [...orderItems];
      const receiptReceived = parseFloat(document.getElementById('posCashReceived').value) || 0;
      const receiptPayment  = selectedPayment;
      const receiptRefNo    = document.getElementById('posGcashRef').value;
      clearOrder();
      loadPosProducts();
      showToast('Order processed successfully!');
      showReceipt(data, receiptItems, receiptReceived, receiptPayment, receiptRefNo);
    } else {
      showToast(data.error || 'Failed to process order.', 'error');
    }
  } catch (e) {
    showToast('Error processing order.', 'error');
  }
}

// ─── Receipt ──────────────────────────────────────────
function showReceipt(data, items, received, payment, refNo) {
  // Use passed parameters (captured before clearOrder)
  items    = items    || orderItems;
  received = received !== undefined ? received : parseFloat(document.getElementById('posCashReceived').value) || 0;
  payment  = payment  || selectedPayment;
  refNo    = refNo    || document.getElementById('posGcashRef').value;

  const total     = items.reduce((s, i) => s + i.price * i.quantity, 0) || Number(data.total) || 0;
  const change    = received - total;
  const now       = new Date();

  // VAT Inclusive (12%) breakdown
  const VAT_RATE  = 0.12;
  const vatAmount = total - (total / (1 + VAT_RATE));
  const baseAmt   = total - vatAmount;

  // Get branch name for receipt
  const branchId   = staffBranchId || document.getElementById('posBranch').value;
  const branchName = staffBranchName || allBranches.find(b => b.branch_id === branchId)?.branch_name || '';

  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt-header">
      <strong>Triple E & Fiel Collins</strong><br>
      <span>General Merchandise</span><br>
      ${branchName ? `<span>${branchName} Branch</span><br>` : ''}
      <span>Koronadal City, South Cotabato</span><br>
      <span style="font-size:11px;color:var(--text-muted);">${now.toLocaleString('en-PH')}</span>
    </div>
    <hr class="receipt-divider"/>
    <div style="margin-bottom:0.5rem;">
      ${items.map(i => `
        <div class="receipt-row">
          <span>${i.name} x${i.quantity}</span>
          <span>${peso(i.price * i.quantity)}</span>
        </div>`).join('')}
    </div>
    <hr class="receipt-divider"/>
    <div class="receipt-row">
      <span>VAT Exclusive Amount</span>
      <span>${peso(baseAmt)}</span>
    </div>
    <div class="receipt-row">
      <span>VAT (12%)</span>
      <span>${peso(vatAmount)}</span>
    </div>
    <hr class="receipt-divider"/>
    <div class="receipt-row receipt-total">
      <span>TOTAL (VAT Inclusive)</span>
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
      VAT Reg. TIN: 000-000-000-000<br>
      Thank you for shopping!
    </div>`;

  document.getElementById('receiptModalOverlay').classList.add('open');
  document.getElementById('receiptModal').classList.add('open');
}

function closeReceiptModal() {
  document.getElementById('receiptModalOverlay').classList.remove('open');
  document.getElementById('receiptModal').classList.remove('open');
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
async function loadInventory() {
  try {
    const [prodRes, invRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/staff/inventory'),
    ]);
    const allInvProds = await prodRes.json();
    // Filter to this branch only
    invProducts = allInvProds.filter(p =>
      !p.branch_id || p.branch_id === staffBranchId
    );
    const invData = await invRes.json();

    // Stats
    document.getElementById('invTotalProducts').textContent = invProducts.length;
    document.getElementById('invLowStock').textContent      = invProducts.filter(p => p.quantity > 0 && p.quantity <= 10).length;
    document.getElementById('invOutOfStock').textContent    = invProducts.filter(p => p.quantity <= 0).length;

    // Low stock banner
    const lowCount  = invProducts.filter(p => p.status === 'active' && p.quantity <= 10).length;
    const banner    = document.getElementById('staffLowStockBanner');
    const bannerTxt = document.getElementById('staffLowStockText');
    if (banner && lowCount > 0) {
      banner.style.display = 'flex';
      bannerTxt.textContent = `⚠️ ${lowCount} product${lowCount > 1 ? 's are' : ' is'} running low on stock!`;
    } else if (banner) {
      banner.style.display = 'none';
    }

    // Update inventory nav badge (low stock + out of stock)
    const invBadge = document.getElementById('invLowStockBadge');
    if (invBadge) {
      const totalAlert = invProducts.filter(p => p.quantity <= 10).length;
      invBadge.textContent   = totalAlert > 99 ? '99+' : totalAlert;
      invBadge.style.display = totalAlert > 0 ? 'inline-block' : 'none';
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    document.getElementById('invRecentRestocks').textContent = invData.filter(i => new Date(i.date) >= oneWeekAgo).length;

    renderInvProducts(invProducts);

    // History — read nested branch names from FK join
    document.getElementById('invHistoryBody').innerHTML = invData.length
      ? invData.map(i => `
          <tr>
            <td>${i.product?.product_name || '—'}</td>
            <td><strong style="color:var(--g-400);">+${i.quantity_added}</strong></td>
            <td>${i.quantity_before}</td>
            <td>${i.quantity_after}</td>
            <td>${i.from_branch?.branch_name || '—'}</td>
            <td>${i.to_branch?.branch_name   || '—'}</td>
            <td>${new Date(i.date).toLocaleDateString('en-PH')}</td>
            <td>${i.note || '—'}</td>
          </tr>`).join('')
      : '<tr><td colspan="8" class="table-empty">No inventory records yet</td></tr>';

  } catch (e) { console.error('Inventory error:', e); }
}

function renderInvProducts(products) {
  const paged = paginate(products, staffInvPage);
  document.getElementById('invProductsBody').innerHTML = paged.length
    ? paged.map(p => `
        <tr>
          <td><strong>${p.product_name}</strong></td>
          <td>${p.brand || '—'}</td>
          <td>${p.category}</td>
          <td>${peso(p.price)}</td>
          <td>
            <span style="color:${p.quantity <= 0 ? '#ef4444' : p.quantity <= 10 ? '#eab308' : 'var(--g-400)'};font-weight:600;">
              ${p.quantity}
            </span>
          </td>
          <td>${p.quantity <= 0
            ? '<span class="badge badge--red">Out of Stock</span>'
            : p.quantity <= 10
              ? '<span class="badge badge--yellow">Low Stock</span>'
              : '<span class="badge badge--green">In Stock</span>'
          }</td>
          <td>
            <button class="btn-icon" onclick="quickAddStock('${p.product_id}', '${p.product_name.replace(/'/g, "\\'")}', ${p.quantity})" title="Add Stock">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><line x="12" y="5" x2="12" y2="19"/><line x="5" y="12" x2="19" y2="12"/></svg>
            </button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="7" class="table-empty">No products found</td></tr>';
  renderPager('staffInvPagination', products.length, staffInvPage, 'changeStaffInvPage');
}

function filterInventorySearch(q) {
  const filtered = invProducts.filter(p =>
    p.product_name.toLowerCase().includes(q.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(q.toLowerCase()) ||
    p.category.toLowerCase().includes(q.toLowerCase())
  );
  renderInvProducts(filtered);
}

function filterStaffInventoryType(type) {
  if (type === 'low_stock') {
    const lowStock = invProducts.filter(p => p.quantity <= 10);
    renderInvProducts(lowStock);
  } else {
    renderInvProducts(invProducts);
  }
}

function openStockModal(productId = '') {
  const sel = document.getElementById('stockProduct');
  sel.innerHTML = '<option value="">Select product</option>' +
    invProducts.map(p =>
      `<option value="${p.product_id}" ${p.product_id === productId ? 'selected' : ''}>${p.product_name} (Stock: ${p.quantity})</option>`
    ).join('');

  // Re-populate branch selects in case they weren't loaded yet
  populateBranchSelects();

  document.getElementById('stockModalOverlay').classList.add('open');
  document.getElementById('stockModal').classList.add('open');
}

function quickAddStock(productId) {
  openStockModal(productId);
}

function closeStockModal() {
  document.getElementById('stockModalOverlay').classList.remove('open');
  document.getElementById('stockModal').classList.remove('open');
  document.getElementById('stockForm').reset();
}

async function submitStock(e) {
  e.preventDefault();
  const stockBtn = e.submitter || document.querySelector('#stockForm button[type="submit"]');
  setButtonLoading(stockBtn, true);
  const fromBranch = document.getElementById('stockFromBranch').value;
  const toBranch   = document.getElementById('stockToBranch').value;
  if (!toBranch) { showToast('Please select a destination branch.', 'error'); return; }
  const data = {
    product_id:     document.getElementById('stockProduct').value,
    quantity:       parseInt(document.getElementById('stockQty').value),
    from_branch_id: fromBranch || null,  // null if restock (no source branch)
    to_branch_id:   toBranch,
    note:           document.getElementById('stockNote').value,
  };
  try {
    const res = await fetch('/api/staff/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      showToast('Stock updated!');
      closeStockModal();
      loadInventory();
      loadPosProducts();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to update stock.', 'error');
    }
  } catch (e) { showToast('Error updating stock.', 'error'); }
}

// ══════════════════════════════════════════════════════
// ORDERS
// ══════════════════════════════════════════════════════
async function loadOrders() {
  try {
    const res  = await fetch('/api/staff/orders?limit=50');
    const data = await res.json();
    // Sort newest first using created_at timestamp
    staffOrders = data.sort((a, b) => {
      const da = new Date(a.created_at || a.date || 0);
      const db = new Date(b.created_at || b.date || 0);
      return db - da;
    });
    renderStaffOrders(staffOrders);
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
          <td>${badge(o.order_type)}</td>
          <td>${o.order_item?.length || 0} item(s)</td>
          <td>${peso(o.total)}</td>
          <td>${o.payment?.payment_method ? badge(o.payment.payment_method) : (Array.isArray(o.payment) && o.payment[0] ? badge(o.payment[0].payment_method) : '—')}</td>
          <td>${new Date(o.date).toLocaleDateString('en-PH')}</td>
          <td>${badge(o.status)}</td>
          <td style="display:flex;gap:6px;align-items:center;">
            <select class="filter-select" style="font-size:11px;padding:4px 8px;"
              onchange="updateOrderStatus('${o.order_id}', this.value)">
              <option value="pending"          ${o.status==='pending'          ?'selected':''}>Pending</option>
              <option value="processing"       ${o.status==='processing'       ?'selected':''}>Processing</option>
              <option value="out_for_delivery" ${o.status==='out_for_delivery' ?'selected':''}>Out for Delivery</option>
              <option value="completed"        ${o.status==='completed'        ?'selected':''}>Completed</option>
              <option value="cancelled"        ${o.status==='cancelled'        ?'selected':''}>Cancelled</option>
            </select>
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
  const branch   = order.branch_name || order.branch?.branch_name || staffBranchName || '—';

  // Parse delivery address
  const addrParts  = (order.address || '').split('|');
  const addrString = addrParts.length > 1
    ? [addrParts[0], addrParts[1], addrParts[2], addrParts[3]].filter(Boolean).join(', ')
    : order.address || '';

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
      + '<div style="color:var(--text-muted);margin-bottom:2px;">📍 Delivery Address</div>'
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
    + '<div><span style="color:var(--text-muted);">Branch</span><br/><strong>🏪 ' + branch + '</strong></div>'
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


function filterStaffOrders(status) {
  renderStaffOrders(status ? staffOrders.filter(o => o.status === status) : staffOrders);
}

async function updateOrderStatus(id, status) {
  try {
    const res = await fetch(`/api/staff/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) showToast('Order status updated!');
    else showToast('Failed to update status.', 'error');
  } catch (e) { showToast('Error updating status.', 'error'); }
}

// ══════════════════════════════════════════════════════
// SALES SUMMARY
// ══════════════════════════════════════════════════════
let allSummaryOrders = []; // store all orders for date filtering

async function loadSummary() {
  try {
    const res    = await fetch('/api/staff/orders?limit=100');
    allSummaryOrders = await res.json();

    // Set today's date in picker — use PH timezone
    const today  = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const picker = document.getElementById('summaryDatePicker');
    if (picker && !picker.value) picker.value = today;

    renderSummaryForDate(picker?.value || today);
  } catch (e) { console.error('Summary error:', e); }
}

function renderSummaryForDate(dateStr) {
  const isToday = dateStr === new Date().toISOString().split('T')[0];
  const label   = isToday ? 'Today' : new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', { month:'long', day:'numeric', year:'numeric' });

  // Update labels
  const summaryLabel = document.getElementById('summaryLabel');
  const tableTitle   = document.getElementById('summaryTableTitle');
  if (summaryLabel) summaryLabel.textContent = `${label}'s Sales`;
  if (tableTitle)   tableTitle.textContent   = `${label}'s Transactions`;

  const labelEl = document.getElementById('summaryDateLabel');
  if (labelEl) labelEl.textContent = isToday ? '📅 Today' : `📅 ${label}`;

  // Filter orders by date — PH timezone
  const filtered = allSummaryOrders.filter(o => {
    const raw = o.created_at || o.date || null;
    if (!raw) return false;
    const localDate = new Date(raw).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    return localDate === dateStr;
  });

  const allValid = filtered.filter(o => o.status !== 'cancelled');
  const total    = allValid.reduce((s, o) => s + Number(o.total || 0), 0);
  console.log('Summary:', dateStr, 'filtered:', filtered.length, 'total:', total);

  document.getElementById('summaryToday').textContent  = peso(total);
  document.getElementById('summaryOrders').textContent = allValid.length;
  document.getElementById('summaryWalkin').textContent = allValid.filter(o => o.order_type === 'walk_in').length;
  document.getElementById('summaryOnline').textContent = allValid.filter(o => o.order_type === 'online').length;

  document.getElementById('summaryTodayBody').innerHTML = filtered.length
    ? filtered.map(o => `
        <tr>
          <td><code style="font-family:'JetBrains Mono',monospace;font-size:11px;">${shortId(o.order_id)}</code></td>
          <td>${o.customer ? `${o.customer.fname} ${o.customer.lname}` : 'Walk-in'}</td>
          <td>${badge(o.order_type)}</td>
          <td>${o.payment?.payment_method ? badge(o.payment.payment_method) : (Array.isArray(o.payment) && o.payment[0] ? badge(o.payment[0].payment_method) : '—')}</td>
          <td>${peso(o.total)}</td>
          <td>${new Date(o.date || o.created_at).toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' })}</td>
          <td>${badge(o.status)}</td>
        </tr>`).join('')
    : `<tr><td colspan="7" class="table-empty">No transactions for ${label}</td></tr>`;
}

function loadSummaryByDate(dateStr) {
  if (!dateStr) return;
  renderSummaryForDate(dateStr);
}

function resetSummaryDate() {
  const today  = new Date().toISOString().split('T')[0];
  const picker = document.getElementById('summaryDatePicker');
  if (picker) picker.value = today;
  renderSummaryForDate(today);
}

// ─── Init ─────────────────────────────────────────────
// ─── STOCK REQUESTS ───────────────────────────────────

async function loadRequests() {
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

    document.getElementById('requestsBody').innerHTML = data.length
      ? data.map(r => {
          const statusColors = { pending:'yellow', approved:'green', rejected:'red' };
          const statusColor  = statusColors[r.status] || 'gray';
          return `
          <tr>
            <td><strong>${r.product?.product_name || '—'}</strong></td>
            <td>${r.product?.quantity ?? '—'} units</td>
            <td>${r.quantity_needed} units</td>
            <td><span class="badge badge--${statusColor}">${r.status}</span></td>
            <td style="font-size:12px;">${r.note || '—'}</td>
            <td style="font-size:12px;color:${r.status === 'rejected' ? '#ef4444' : 'inherit'};">${r.admin_note || '—'}</td>
            <td>${new Date(r.created_at).toLocaleDateString('en-PH')}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="7" class="table-empty">No stock requests yet</td></tr>';

  } catch (e) { console.error('Requests error:', e); }
}

async function openRequestModal() {
  if (!invProducts.length) await loadInventory();
  const sel = document.getElementById('reqProduct');
  if (sel) {
    // Use branch_stock quantity for this branch, fallback to product.quantity
    sel.innerHTML = '<option value="">Select product</option>' +
      invProducts.map(p => {
        const branchStock = p.branch_stock?.find(bs => bs.branch_id === staffBranchId);
        const stock = branchStock ? branchStock.quantity : p.quantity || 0;
        return `<option value="${p.product_id}" data-stock="${stock}">${p.product_name} (Stock: ${stock})</option>`;
      }).join('');
  }
  document.getElementById('requestModalOverlay')?.classList.add('open');
  document.getElementById('requestModal')?.classList.add('open');
}

function closeRequestModal() {
  document.getElementById('requestModalOverlay')?.classList.remove('open');
  document.getElementById('requestModal')?.classList.remove('open');
  document.getElementById('requestForm')?.reset();
  document.getElementById('reqCurrentStock').value = '';
}

function updateCurrentStock(sel) {
  const opt   = sel.options[sel.selectedIndex];
  const stock = opt?.dataset?.stock;
  document.getElementById('reqCurrentStock').value = stock !== undefined && stock !== '' ? `${stock} units` : '';
}

async function submitRequest(e) {
  e.preventDefault();
  const reqBtn = e.submitter || document.querySelector('#requestForm button[type="submit"]');
  setButtonLoading(reqBtn, true);
  const productId = document.getElementById('reqProduct').value;
  const qty       = parseInt(document.getElementById('reqQty').value);
  const note      = document.getElementById('reqNote').value;

  try {
    const res = await fetch('/api/staff/stock-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id:     productId,
        quantity_needed: qty,
        note:           note,
        branch_id:      staffBranchId,
      }),
    });
    if (res.ok) {
      showToast('Stock request submitted!');
      closeRequestModal();
      loadRequests();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to submit request.', 'error');
    }
  } catch (e) { showToast('Error submitting request.', 'error'); }
  finally { setButtonLoading(reqBtn, false); }
}


document.addEventListener('DOMContentLoaded', async () => {
  await loadBranches();
  loadPosProducts();

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
    if (openModal === 'stock') openStockModal();
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