// ══════════════════════════════════════════════════════
// STAFF DASHBOARD — Triple E & Fiel Collins
// ══════════════════════════════════════════════════════

// ─── Theme + Sidebar ──────────────────────────────────
function toggleTheme() {
  const html  = document.documentElement;
  const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', theme);
  localStorage.setItem('staff-theme', theme);
}

(function () {
  const saved = localStorage.getItem('staff-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function updateDate() {
  document.getElementById('topbarDate').textContent = new Date().toLocaleDateString('en-PH', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
}
updateDate();

// ─── Section Navigation ───────────────────────────────
const pageTitles = {
  pos:       ['Point of Sale',  'Process walk-in transactions'],
  inventory: ['Inventory',      'Track and manage stock levels'],
  orders:    ['Orders',         'View and manage all orders'],
  summary:   ['Sales Summary',  "Today's sales overview"],
};

function showSection(name, el) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[name][0];
  document.getElementById('pageSub').textContent   = pageTitles[name][1];
  loaders[name] && loaders[name]();
}

const loaders = {
  pos:       loadPosProducts,
  inventory: loadInventory,
  orders:    loadOrders,
  summary:   loadSummary,
};

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
async function loadBranches() {
  try {
    const res   = await fetch('/api/staff/branches');
    allBranches = await res.json();
    populateBranchSelects();
  } catch (e) { console.error('Branches error:', e); }
}

function populateBranchSelects() {
  const options = `<option value="">Select branch</option>` +
    allBranches.map(b => `<option value="${b.branch_id}">${b.branch_name}</option>`).join('');

  // POS branch selector
  const posBranch = document.getElementById('posBranch');
  if (posBranch) posBranch.innerHTML = `<option value="">Select branch for this transaction *</option>` +
    allBranches.map(b => `<option value="${b.branch_id}">${b.branch_name}</option>`).join('');

  // Stock modal branch selects
  ['stockFromBranch', 'stockToBranch'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = options;
  });
}

// ══════════════════════════════════════════════════════
// POS
// ══════════════════════════════════════════════════════
async function loadPosProducts() {
  try {
    const res   = await fetch('/api/products');
    posProducts = await res.json();
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
    document.getElementById('posCheckoutBtn').disabled = true;
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
  document.getElementById('posCheckoutBtn').disabled = false;
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

  // Branch is required for Sales_Transaction
  const branchId = document.getElementById('posBranch').value;
  if (!branchId) {
    showToast('Please select the branch for this transaction.', 'error');
    return;
  }

  const refNo = document.getElementById('posGcashRef').value.trim();
  if (selectedPayment === 'gcash' && !refNo) {
    showToast('Please enter GCash reference number.', 'error');
    return;
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
      showToast('Order processed successfully!');
      showReceipt(data);
      clearOrder();
      loadPosProducts();
    } else {
      showToast(data.error || 'Failed to process order.', 'error');
    }
  } catch (e) {
    showToast('Error processing order.', 'error');
  }
}

// ─── Receipt ──────────────────────────────────────────
function showReceipt(data) {
  const total    = orderItems.length ? orderItems.reduce((s, i) => s + i.price * i.quantity, 0) : data.total;
  const received = parseFloat(document.getElementById('posCashReceived').value) || 0;
  const change   = received - total;
  const now      = new Date();

  // Get branch name for receipt
  const branchId   = document.getElementById('posBranch').value;
  const branchName = allBranches.find(b => b.branch_id === branchId)?.branch_name || '';

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
      ${orderItems.map(i => `
        <div class="receipt-row">
          <span>${i.name} x${i.quantity}</span>
          <span>${peso(i.price * i.quantity)}</span>
        </div>`).join('')}
    </div>
    <hr class="receipt-divider"/>
    <div class="receipt-row receipt-total">
      <span>TOTAL</span>
      <span>${peso(total)}</span>
    </div>
    ${selectedPayment === 'walk_in_cash' ? `
      <div class="receipt-row">
        <span>Cash Received</span>
        <span>${peso(received)}</span>
      </div>
      <div class="receipt-row">
        <span>Change</span>
        <span>${peso(Math.max(change, 0))}</span>
      </div>` : ''}
    ${selectedPayment === 'gcash' ? `
      <div class="receipt-row">
        <span>GCash Ref</span>
        <span>${document.getElementById('posGcashRef').value}</span>
      </div>` : ''}
    <hr class="receipt-divider"/>
    <div class="receipt-footer">
      Order ID: ${shortId(data.order_id)}<br>
      Payment: ${selectedPayment.replace(/_/g, ' ').toUpperCase()}<br>
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
    invProducts   = await prodRes.json();
    const invData = await invRes.json();

    // Stats
    document.getElementById('invTotalProducts').textContent = invProducts.length;
    document.getElementById('invLowStock').textContent      = invProducts.filter(p => p.quantity > 0 && p.quantity <= 10).length;
    document.getElementById('invOutOfStock').textContent    = invProducts.filter(p => p.quantity <= 0).length;

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
  document.getElementById('invProductsBody').innerHTML = products.length
    ? products.map(p => `
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="7" class="table-empty">No products found</td></tr>';
}

function filterInventorySearch(q) {
  const filtered = invProducts.filter(p =>
    p.product_name.toLowerCase().includes(q.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(q.toLowerCase()) ||
    p.category.toLowerCase().includes(q.toLowerCase())
  );
  renderInvProducts(filtered);
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
  const data = {
    product_id:     document.getElementById('stockProduct').value,
    quantity:       parseInt(document.getElementById('stockQty').value),
    from_branch_id: document.getElementById('stockFromBranch').value,  // ← FK
    to_branch_id:   document.getElementById('stockToBranch').value,    // ← FK
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
    const res   = await fetch('/api/staff/orders');
    staffOrders = await res.json();
    renderStaffOrders(staffOrders);
  } catch (e) { console.error('Orders error:', e); }
}

function renderStaffOrders(orders) {
  document.getElementById('staffOrdersBody').innerHTML = orders.length
    ? orders.map(o => `
        <tr>
          <td><code style="font-family:'JetBrains Mono',monospace;font-size:11px;">${shortId(o.order_id)}</code></td>
          <td>${o.customer ? `${o.customer.fname} ${o.customer.lname}` : 'Walk-in'}</td>
          <td>${badge(o.order_type)}</td>
          <td>${o.order_item?.length || 0} item(s)</td>
          <td>${peso(o.total)}</td>
          <td>${o.payment ? badge(o.payment.payment_method) : '—'}</td>
          <td>${new Date(o.date).toLocaleDateString('en-PH')}</td>
          <td>${badge(o.status)}</td>
          <td>
            <select class="filter-select" style="font-size:11px;padding:4px 8px;"
              onchange="updateOrderStatus('${o.order_id}', this.value)">
              <option value="pending"    ${o.status==='pending'    ?'selected':''}>Pending</option>
              <option value="processing" ${o.status==='processing' ?'selected':''}>Processing</option>
              <option value="completed"  ${o.status==='completed'  ?'selected':''}>Completed</option>
              <option value="cancelled"  ${o.status==='cancelled'  ?'selected':''}>Cancelled</option>
            </select>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="9" class="table-empty">No orders yet</td></tr>';
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
async function loadSummary() {
  try {
    const res    = await fetch('/api/staff/orders');
    const orders = await res.json();
    const today  = new Date().toLocaleDateString('en-PH');

    const todayOrders = orders.filter(o =>
      new Date(o.date).toLocaleDateString('en-PH') === today
    );

    const todayTotal = todayOrders
      .filter(o => o.status === 'completed')
      .reduce((s, o) => s + Number(o.total || 0), 0);

    document.getElementById('summaryToday').textContent  = peso(todayTotal);
    document.getElementById('summaryOrders').textContent = todayOrders.length;
    document.getElementById('summaryWalkin').textContent = todayOrders.filter(o => o.order_type === 'walk_in').length;
    document.getElementById('summaryOnline').textContent = todayOrders.filter(o => o.order_type === 'online').length;

    document.getElementById('summaryTodayBody').innerHTML = todayOrders.length
      ? todayOrders.map(o => `
          <tr>
            <td><code style="font-family:'JetBrains Mono',monospace;font-size:11px;">${shortId(o.order_id)}</code></td>
            <td>${o.customer ? `${o.customer.fname} ${o.customer.lname}` : 'Walk-in'}</td>
            <td>${badge(o.order_type)}</td>
            <td>${o.payment ? badge(o.payment.payment_method) : '—'}</td>
            <td>${peso(o.total)}</td>
            <td>${new Date(o.date).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${badge(o.status)}</td>
          </tr>`).join('')
      : '<tr><td colspan="7" class="table-empty">No transactions today yet</td></tr>';

  } catch (e) { console.error('Summary error:', e); }
}

// ─── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadBranches();   // load branches first — needed by POS + stock modal
  loadPosProducts();
});