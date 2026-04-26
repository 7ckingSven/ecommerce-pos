// ══════════════════════════════════════════════════════
// ADMIN DASHBOARD — Triple E & Fiel Collins
// ══════════════════════════════════════════════════════

// ─── Theme Toggle ─────────────────────────────────────
function toggleTheme() {
  const html  = document.documentElement;
  const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', theme);
  localStorage.setItem('admin-theme', theme);
}

(function () {
  const saved = localStorage.getItem('admin-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

// ─── Sidebar Toggle ───────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ─── Date Display ─────────────────────────────────────
function updateDate() {
  const now = new Date();
  document.getElementById('topbarDate').textContent = now.toLocaleDateString('en-PH', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
}
updateDate();

// ─── Section Navigation ───────────────────────────────
const pageTitles = {
  overview:  ['Overview',          'Welcome back'],
  products:  ['Products',          'Manage your product catalog'],
  inventory: ['Inventory',         'Track and manage stock levels'],
  orders:    ['Orders',            'View and manage all orders'],
  sales:     ['Sales Reports',     'View sales analytics and reports'],
  discounts: ['Discounts',         'Manage discounts and assign them to products'],
  users:     ['User Management',   'Manage staff and customer accounts'],
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
let allProducts  = [];
let allOrders    = [];
let allUsers     = [];
let allDiscounts = [];
let allBranches  = [];

// ══════════════════════════════════════════════════════
// DATA LOADERS
// ══════════════════════════════════════════════════════
const loaders = {
  overview:  loadOverview,
  products:  loadProducts,
  inventory: loadInventory,
  orders:    loadOrders,
  sales:     loadSales,
  discounts: loadDiscounts,
  users:     loadUsers,
};

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
  try {
    const [products, orders, payments] = await Promise.all([
      fetch('/api/admin/products').then(r => r.json()),
      fetch('/api/admin/orders').then(r => r.json()),
      fetch('/api/admin/payments').then(r => r.json()),
    ]);

    document.getElementById('statProducts').textContent = products.filter(p => p.status === 'active').length;
    document.getElementById('statOrders').textContent   = orders.length;

    const totalSales = payments.reduce((s, p) => s + Number(p.total || 0), 0);
    document.getElementById('statSales').textContent    = peso(totalSales);

    const lowStock = products.filter(p => Number(p.quantity) <= 10);
    document.getElementById('statLowStock').textContent = lowStock.length;

    // Recent Orders
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

    // Low Stock Alert
    document.getElementById('lowStockBody').innerHTML = lowStock.length
      ? lowStock.map(p => `
          <tr>
            <td>${p.product_name}</td>
            <td>${p.category}</td>
            <td><span style="color:#ef4444;font-weight:600;">${p.quantity}</span></td>
          </tr>`).join('')
      : '<tr><td colspan="3" class="table-empty">All products have sufficient stock ✓</td></tr>';

  } catch (e) { console.error('Overview error:', e); }
}

// ─── PRODUCTS ─────────────────────────────────────────
async function loadProducts() {
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

  } catch (e) { console.error('Products error:', e); }
}

function renderProducts(products) {
  document.getElementById('productsBody').innerHTML = products.length
    ? products.map(p => {
        const disc = p.discount;
        const discountCell = disc
          ? `<span class="badge badge--blue">${disc.discount_name} (${disc.percentage}%)</span>`
          : `<span style="color:var(--text-muted);font-size:12px;">—</span>`;
        return `
          <tr>
            <td>
              ${p.image_url
                ? `<img src="${p.image_url}" class="product-img-cell" alt="${p.product_name}"/>`
                : `<div class="product-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`
              }
            </td>
            <td><strong>${p.product_name}</strong></td>
            <td>${p.brand || '—'}</td>
            <td>${p.category}</td>
            <td>${peso(p.price)}</td>
            <td>${discountCell}</td>
            <td><span style="color:${p.quantity <= 10 ? '#ef4444' : 'inherit'};font-weight:${p.quantity <= 10 ? '600' : '400'};">${p.quantity}</span></td>
            <td>${badge(p.status)}</td>
            <td>
              <div style="display:flex;gap:6px;">
                <button class="btn-icon" onclick="editProduct('${p.product_id}')" title="Edit">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-icon btn-icon--red" onclick="deleteProduct('${p.product_id}', '${p.product_name.replace(/'/g, "\\'")}')" title="Deactivate">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            </td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="9" class="table-empty">No products found</td></tr>';
}

function filterProducts(q) {
  const filtered = allProducts.filter(p =>
    p.product_name.toLowerCase().includes(q.toLowerCase()) ||
    (p.brand || '').toLowerCase().includes(q.toLowerCase())
  );
  renderProducts(filtered);
}

function filterByCategory(cat) {
  renderProducts(cat ? allProducts.filter(p => p.category === cat) : allProducts);
}

// Product Modal
function openProductModal(product = null) {
  document.getElementById('productModalTitle').textContent = product ? 'Edit Product' : 'Add Product';
  document.getElementById('productId').value    = product?.product_id || '';
  document.getElementById('pName').value        = product?.product_name || '';
  document.getElementById('pBrand').value       = product?.brand || '';
  document.getElementById('pCategory').value    = product?.category || '';
  document.getElementById('pPrice').value       = product?.price || '';
  document.getElementById('pQuantity').value    = product?.quantity || '';
  document.getElementById('pStatus').value      = product?.status || 'active';
  document.getElementById('pDescription').value = product?.description || '';

  // Populate discount dropdown
  const discSel = document.getElementById('pDiscount');
  discSel.innerHTML = '<option value="">No Discount</option>' +
    allDiscounts.map(d =>
      `<option value="${d.discount_id}" ${product?.discount_id === d.discount_id ? 'selected' : ''}>${d.discount_name} (${d.percentage}%)</option>`
    ).join('');

  const preview = document.getElementById('pImagePreview');
  if (product?.image_url) {
    preview.src          = product.image_url;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  document.getElementById('productModalOverlay').classList.add('open');
  document.getElementById('productModal').classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModalOverlay').classList.remove('open');
  document.getElementById('productModal').classList.remove('open');
  document.getElementById('productForm').reset();
  document.getElementById('pImagePreview').style.display = 'none';
}

async function editProduct(id) {
  const product = allProducts.find(p => p.product_id === id);
  if (product) openProductModal(product);
}

async function deleteProduct(id, name) {
  if (!confirm(`Deactivate "${name}"?`)) return;
  try {
    const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Product deactivated.'); loadProducts(); }
    else showToast('Failed to deactivate product.', 'error');
  } catch (e) { showToast('Error.', 'error'); }
}

async function submitProduct(e) {
  e.preventDefault();
  const id       = document.getElementById('productId').value;
  const formData = new FormData();
  formData.append('product_name', document.getElementById('pName').value);
  formData.append('brand',        document.getElementById('pBrand').value);
  formData.append('category',     document.getElementById('pCategory').value);
  formData.append('price',        document.getElementById('pPrice').value);
  formData.append('quantity',     document.getElementById('pQuantity').value);
  formData.append('status',       document.getElementById('pStatus').value);
  formData.append('description',  document.getElementById('pDescription').value);
  formData.append('discount_id',  document.getElementById('pDiscount').value);
  const img = document.getElementById('pImage').files[0];
  if (img) formData.append('image', img);

  try {
    const url    = id ? `/api/admin/products/${id}` : '/api/admin/products';
    const method = id ? 'PUT' : 'POST';
    const res    = await fetch(url, { method, body: formData });
    if (res.ok) {
      showToast(id ? 'Product updated!' : 'Product added!');
      closeProductModal();
      loadProducts();
    } else {
      const data = await res.json();
      showToast(data.error || 'Failed to save product.', 'error');
    }
  } catch (e) { showToast('Error saving product.', 'error'); }
}

// Image preview
document.getElementById('pImage').addEventListener('change', function () {
  const file    = this.files[0];
  const preview = document.getElementById('pImagePreview');
  if (file) {
    const reader  = new FileReader();
    reader.onload = e => { preview.src = e.target.result; preview.style.display = 'block'; };
    reader.readAsDataURL(file);
  }
});

// ─── INVENTORY ────────────────────────────────────────
async function loadInventory() {
  try {
    const res  = await fetch('/api/admin/inventory');
    const data = await res.json();

    document.getElementById('inventoryBody').innerHTML = data.length
      ? data.map(i => `
          <tr>
            <td>${i.product?.product_name || '—'}</td>
            <td>${i.staff ? `${i.staff.fname} ${i.staff.lname}` : '—'}</td>
            <td><strong style="color:var(--g-400);">+${i.quantity_added}</strong></td>
            <td>${i.quantity_before}</td>
            <td>${i.quantity_after}</td>
            <td>${i.from_branch?.branch_name || '—'}</td>
            <td>${i.to_branch?.branch_name   || '—'}</td>
            <td>${new Date(i.date).toLocaleDateString('en-PH')}</td>
            <td>${i.note || '—'}</td>
          </tr>`).join('')
      : '<tr><td colspan="9" class="table-empty">No inventory records yet</td></tr>';

  } catch (e) { console.error('Inventory error:', e); }
}

async function openInventoryModal() {
  // Ensure products and branches are loaded
  if (!allProducts.length) await loadProducts();
  if (!allBranches.length) await loadBranches();

  const sel = document.getElementById('invProduct');
  sel.innerHTML = '<option value="">Select product</option>' +
    allProducts.map(p => `<option value="${p.product_id}">${p.product_name} (Stock: ${p.quantity})</option>`).join('');

  populateBranchSelects('invFromBranch', 'invToBranch');

  document.getElementById('inventoryModalOverlay').classList.add('open');
  document.getElementById('inventoryModal').classList.add('open');
}

function closeInventoryModal() {
  document.getElementById('inventoryModalOverlay').classList.remove('open');
  document.getElementById('inventoryModal').classList.remove('open');
  document.getElementById('inventoryForm').reset();
}

async function submitInventory(e) {
  e.preventDefault();
  const data = {
    product_id:     document.getElementById('invProduct').value,
    quantity:       parseInt(document.getElementById('invQty').value),
    from_branch_id: document.getElementById('invFromBranch').value,
    to_branch_id:   document.getElementById('invToBranch').value,
    note:           document.getElementById('invNote').value,
  };
  try {
    const res = await fetch('/api/admin/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      showToast('Stock updated successfully!');
      closeInventoryModal();
      loadInventory();
      loadProducts();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to update stock.', 'error');
    }
  } catch (e) { showToast('Error updating stock.', 'error'); }
}

// ─── ORDERS ───────────────────────────────────────────
async function loadOrders() {
  try {
    const res = await fetch('/api/admin/orders');
    allOrders = await res.json();
    renderOrders(allOrders);
  } catch (e) { console.error('Orders error:', e); }
}

function renderOrders(orders) {
  document.getElementById('ordersBody').innerHTML = orders.length
    ? orders.map(o => `
        <tr>
          <td><code style="font-family:'JetBrains Mono',monospace;font-size:11px;">${shortId(o.order_id)}</code></td>
          <td>${o.customer ? `${o.customer.fname} ${o.customer.lname}` : 'Walk-in'}</td>
          <td>${o.staff ? `${o.staff.fname} ${o.staff.lname}` : '—'}</td>
          <td>${badge(o.order_type)}</td>
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

async function updateOrderStatus(id, status) {
  try {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) showToast('Order status updated!');
    else showToast('Failed to update status.', 'error');
  } catch (e) { showToast('Error updating status.', 'error'); }
}

function filterOrders(type) {
  renderOrders(type ? allOrders.filter(o => o.order_type === type) : allOrders);
}

function filterOrderStatus(status) {
  renderOrders(status ? allOrders.filter(o => o.status === status) : allOrders);
}

// ─── SALES REPORTS ────────────────────────────────────
async function loadSales() {
  try {
    const [orders, payments, customers] = await Promise.all([
      fetch('/api/admin/orders').then(r => r.json()),
      fetch('/api/admin/payments').then(r => r.json()),
      fetch('/api/admin/customers').then(r => r.json()),
    ]);

    const completed = orders.filter(o => o.status === 'completed');
    const total     = completed.reduce((s, o) => s + Number(o.total || 0), 0);
    const online    = completed.filter(o => o.order_type === 'online').reduce((s, o) => s + Number(o.total || 0), 0);
    const walkin    = completed.filter(o => o.order_type === 'walk_in').reduce((s, o) => s + Number(o.total || 0), 0);

    document.getElementById('salesTotal').textContent     = peso(total);
    document.getElementById('salesOnline').textContent    = peso(online);
    document.getElementById('salesWalkin').textContent    = peso(walkin);
    document.getElementById('salesCustomers').textContent = customers.length;

    // Payment breakdown
    const methods = {};
    payments.forEach(p => {
      if (!methods[p.payment_method]) methods[p.payment_method] = { count: 0, total: 0 };
      methods[p.payment_method].count++;
      methods[p.payment_method].total += Number(p.total || 0);
    });
    document.getElementById('paymentBreakdownBody').innerHTML = Object.entries(methods).length
      ? Object.entries(methods).map(([m, v]) => `
          <tr>
            <td>${badge(m)}</td>
            <td>${v.count}</td>
            <td>${peso(v.total)}</td>
          </tr>`).join('')
      : '<tr><td colspan="3" class="table-empty">No payment data yet</td></tr>';

    // Top products
    const productSales = {};
    completed.forEach(o => {
      (o.order_item || []).forEach(item => {
        const name = item.product?.product_name || item.product_id;
        if (!productSales[name]) productSales[name] = { units: 0, revenue: 0 };
        productSales[name].units   += Number(item.quantity || 0);
        productSales[name].revenue += Number(item.price || 0) * Number(item.quantity || 0);
      });
    });
    const top = Object.entries(productSales).sort((a, b) => b[1].units - a[1].units).slice(0, 5);
    document.getElementById('topProductsBody').innerHTML = top.length
      ? top.map(([name, v]) => `
          <tr>
            <td>${name}</td>
            <td>${v.units}</td>
            <td>${peso(v.revenue)}</td>
          </tr>`).join('')
      : '<tr><td colspan="3" class="table-empty">No sales data yet</td></tr>';

  } catch (e) { console.error('Sales error:', e); }
}

// ══════════════════════════════════════════════════════
// DISCOUNTS
// ══════════════════════════════════════════════════════
let currentAssignDiscountId = null;
let assignProductState      = []; // { product_id, product_name, checked }

async function loadDiscounts() {
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

function renderDiscounts(discounts) {
  document.getElementById('discountsBody').innerHTML = discounts.length
    ? discounts.map(d => {
        const assignedCount = allProducts.filter(p => p.discount_id === d.discount_id).length;
        return `
          <tr>
            <td><strong>${d.discount_name}</strong></td>
            <td>
              <span style="font-size:18px;font-weight:700;color:var(--g-400);">${d.percentage}%</span>
            </td>
            <td>
              <span class="badge badge--blue">${assignedCount} product${assignedCount !== 1 ? 's' : ''}</span>
            </td>
            <td>${new Date(d.created_at).toLocaleDateString('en-PH')}</td>
            <td>
              <div style="display:flex;gap:6px;">
                <button class="btn-icon" onclick="openAssignModal('${d.discount_id}', '${d.discount_name.replace(/'/g, "\\'")}')" title="Assign to products">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                </button>
                <button class="btn-icon" onclick="editDiscount('${d.discount_id}')" title="Edit">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-icon btn-icon--red" onclick="deleteDiscount('${d.discount_id}', '${d.discount_name.replace(/'/g, "\\'")}')" title="Delete">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            </td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="5" class="table-empty">No discounts yet. Click "Add Discount" to create one.</td></tr>';
}

function filterDiscounts(q) {
  const filtered = allDiscounts.filter(d =>
    d.discount_name.toLowerCase().includes(q.toLowerCase())
  );
  renderDiscounts(filtered);
}

function loadDiscountedProducts() {
  const discounted = allProducts.filter(p => p.discount_id);
  document.getElementById('discountedProductsBody').innerHTML = discounted.length
    ? discounted.map(p => {
        const disc         = p.discount;
        const discounted   = p.price * (1 - (disc?.percentage || 0) / 100);
        return `
          <tr>
            <td><strong>${p.product_name}</strong></td>
            <td>${p.category}</td>
            <td>${peso(p.price)}</td>
            <td><span class="badge badge--blue">${disc?.discount_name || '—'} (${disc?.percentage || 0}%)</span></td>
            <td><strong style="color:var(--g-400);">${peso(discounted)}</strong></td>
            <td>
              <button class="btn-icon btn-icon--red" onclick="removeProductDiscount('${p.product_id}', '${p.product_name.replace(/'/g, "\\'")}')" title="Remove discount">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="6" class="table-empty">No products with discounts yet</td></tr>';
}

async function removeProductDiscount(productId, name) {
  if (!confirm(`Remove discount from "${name}"?`)) return;
  try {
    const res = await fetch('/api/admin/discounts/unassign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_ids: [productId] }),
    });
    if (res.ok) { showToast('Discount removed from product.'); loadDiscounts(); }
    else showToast('Failed to remove discount.', 'error');
  } catch (e) { showToast('Error.', 'error'); }
}

// Discount Modal
function openDiscountModal(discount = null) {
  document.getElementById('discountModalTitle').textContent = discount ? 'Edit Discount' : 'Add Discount';
  document.getElementById('discountId').value   = discount?.discount_id || '';
  document.getElementById('dName').value        = discount?.discount_name || '';
  document.getElementById('dPercentage').value  = discount?.percentage || '';
  document.getElementById('discountModalOverlay').classList.add('open');
  document.getElementById('discountModal').classList.add('open');
}

function closeDiscountModal() {
  document.getElementById('discountModalOverlay').classList.remove('open');
  document.getElementById('discountModal').classList.remove('open');
  document.getElementById('discountForm').reset();
}

function editDiscount(id) {
  const discount = allDiscounts.find(d => d.discount_id === id);
  if (discount) openDiscountModal(discount);
}

async function deleteDiscount(id, name) {
  if (!confirm(`Delete discount "${name}"? It will be removed from all assigned products.`)) return;
  try {
    const res = await fetch(`/api/admin/discounts/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Discount deleted.'); loadDiscounts(); }
    else showToast('Failed to delete discount.', 'error');
  } catch (e) { showToast('Error.', 'error'); }
}

async function submitDiscount(e) {
  e.preventDefault();
  const id   = document.getElementById('discountId').value;
  const data = {
    discount_name: document.getElementById('dName').value.trim(),
    percentage:    parseFloat(document.getElementById('dPercentage').value),
  };
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
      loadDiscounts();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to save discount.', 'error');
    }
  } catch (e) { showToast('Error saving discount.', 'error'); }
}

// Assign Discount Modal
function openAssignModal(discountId, discountName) {
  currentAssignDiscountId = discountId;
  document.getElementById('assignModalTitle').textContent = `Assign: ${discountName}`;

  // Build state — pre-check products that already have this discount
  assignProductState = allProducts.map(p => ({
    product_id:   p.product_id,
    product_name: p.product_name,
    category:     p.category,
    checked:      p.discount_id === discountId,
  }));

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
    ? products.map(p => `
        <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;cursor:pointer;background:var(--surface-2);transition:background 0.15s;"
          onmouseover="this.style.background='var(--surface-3)'" onmouseout="this.style.background='var(--surface-2)'">
          <input type="checkbox" value="${p.product_id}" ${p.checked ? 'checked' : ''}
            onchange="toggleAssignProduct('${p.product_id}', this.checked)"
            style="accent-color:var(--g-400);width:15px;height:15px;flex-shrink:0;"/>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.product_name}</div>
            <div style="font-size:11px;color:var(--text-muted);">${p.category}</div>
          </div>
          ${p.checked ? '<span class="badge badge--blue" style="flex-shrink:0;font-size:10px;">Assigned</span>' : ''}
        </label>`).join('')
    : '<p class="table-empty">No products found</p>';
}

function filterAssignProducts(q) {
  const filtered = assignProductState.filter(p =>
    p.product_name.toLowerCase().includes(q.toLowerCase()) ||
    p.category.toLowerCase().includes(q.toLowerCase())
  );
  renderAssignProducts(filtered);
}

function toggleAssignProduct(productId, checked) {
  const item = assignProductState.find(p => p.product_id === productId);
  if (item) item.checked = checked;
}

async function submitAssign() {
  if (!currentAssignDiscountId) return;

  const toAssign   = assignProductState.filter(p => p.checked).map(p => p.product_id);
  const toUnassign = assignProductState.filter(p => !p.checked).map(p => p.product_id);

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
    loadDiscounts();
  } catch (e) { showToast('Error updating assignments.', 'error'); }
}

// ─── USERS ────────────────────────────────────────────
async function loadUsers() {
  try {
    if (!allBranches.length) await loadBranches();
    const res = await fetch('/api/admin/users');
    allUsers  = await res.json();
    renderUsers(allUsers);
  } catch (e) { console.error('Users error:', e); }
}

function renderUsers(users) {
  document.getElementById('usersBody').innerHTML = users.length
    ? users.map(u => `
        <tr>
          <td>${u.staff
            ? `${u.staff.fname} ${u.staff.mi ? u.staff.mi + ' ' : ''}${u.staff.lname}`
            : u.customer ? `${u.customer.fname} ${u.customer.lname}` : '—'}</td>
          <td>${u.username}</td>
          <td>${u.staff?.email || u.customer?.email || '—'}</td>
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
        </tr>`).join('')
    : '<tr><td colspan="7" class="table-empty">No users found</td></tr>';
}

function filterUserRole(role) {
  renderUsers(role ? allUsers.filter(u => u.role === role) : allUsers);
}

function openUserModal(user = null) {
  document.getElementById('userModalTitle').textContent = user ? 'Edit Staff' : 'Add Staff';
  document.getElementById('userId').value     = user?.user_id || '';
  document.getElementById('uFname').value     = user?.staff?.fname || '';
  document.getElementById('uMi').value        = user?.staff?.mi || '';
  document.getElementById('uLname').value     = user?.staff?.lname || '';
  document.getElementById('uEmail').value     = user?.staff?.email || '';
  document.getElementById('uPhone').value     = user?.staff?.phone_number || '';
  document.getElementById('uUsername').value  = user?.username || '';
  document.getElementById('uRole').value      = user?.role || 'staff';
  document.getElementById('uPasswordGroup').style.display = user ? 'none' : 'block';

  // Populate branch dropdown
  populateBranchSelects('uBranch');
  if (user?.staff?.branch_id) {
    document.getElementById('uBranch').value = user.staff.branch_id;
  }

  document.getElementById('userModalOverlay').classList.add('open');
  document.getElementById('userModal').classList.add('open');
}

function closeUserModal() {
  document.getElementById('userModalOverlay').classList.remove('open');
  document.getElementById('userModal').classList.remove('open');
  document.getElementById('userForm').reset();
}

async function editUser(id) {
  const user = allUsers.find(u => u.user_id === id);
  if (user) openUserModal(user);
}

async function toggleUserStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  if (!confirm(`${newStatus === 'inactive' ? 'Deactivate' : 'Activate'} this user?`)) return;
  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) { showToast('User status updated!'); loadUsers(); }
    else showToast('Failed to update user.', 'error');
  } catch (e) { showToast('Error.', 'error'); }
}

async function submitUser(e) {
  e.preventDefault();
  const id   = document.getElementById('userId').value;
  const data = {
    fname:     document.getElementById('uFname').value,
    mi:        document.getElementById('uMi').value,
    lname:     document.getElementById('uLname').value,
    email:     document.getElementById('uEmail').value,
    phone:     document.getElementById('uPhone').value,
    username:  document.getElementById('uUsername').value,
    role:      document.getElementById('uRole').value,
    password:  document.getElementById('uPassword').value,
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
    if (res.ok) {
      showToast(id ? 'Staff updated!' : 'Staff added!');
      closeUserModal();
      loadUsers();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to save user.', 'error');
    }
  } catch (e) { showToast('Error saving user.', 'error'); }
}

// ─── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
  await loadBranches();   // load branches first — needed by modals
  loadOverview();
  loadProducts();         // preload for inventory modal + discount dropdown
});