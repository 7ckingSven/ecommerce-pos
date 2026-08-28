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
  purchase_orders: ['Purchase Orders', 'Manage stock requests and purchase orders'],
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
const loaders = {
  overview:  loadOverview,
  products:  loadProducts,
  inventory: loadInventory,
  orders:    loadOrders,
  sales:     loadSales,
  discounts: loadDiscounts,
  users:          loadUsers,
  purchase_orders: loadPurchaseOrders,
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
      fetch('/api/admin/orders?limit=20').then(r => r.json()),
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
                ? `<img src="${p.image_urls?.length ? p.image_urls[0] : p.image_url}" class="product-img-cell" alt="${p.product_name}"/>`
                : `<div class="product-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`
              }
            </td>
            <td><strong>${p.product_name}</strong></td>
            <td>${p.brand || '—'}</td>
            <td>${p.category}</td>
            <td>${peso(p.price)}</td>
            <td>${discountCell}</td>
            <td>
              ${p.branch_stock?.length
                ? p.branch_stock.map(bs => `<span style="font-size:11px;background:rgba(22,163,74,0.1);color:var(--g-400);border-radius:4px;padding:2px 6px;margin-right:3px;">${bs.branch?.branch_name || '—'}: ${bs.quantity}</span>`).join('')
                : `<span style="font-size:12px;">${p.quantity}</span>`}
            </td>
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
  const brand = document.getElementById('brandFilter')?.value || '';
  let filtered = cat
    ? allProducts.filter(p => p.category?.trim().toUpperCase() === cat.trim().toUpperCase())
    : allProducts;
  if (brand) filtered = filtered.filter(p => p.brand?.trim() === brand.trim());
  renderProducts(filtered);
}

function filterByBrand(brand) {
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
  document.getElementById('pStatus').value      = product?.status || 'active';
  document.getElementById('pDescription').value = product?.description || '';

  // Populate discount dropdown
  const discSel = document.getElementById('pDiscount');
  discSel.innerHTML = '<option value="">No Discount</option>' +
    allDiscounts.map(d =>
      `<option value="${d.discount_id}" ${product?.discount_id === d.discount_id ? 'selected' : ''}>${d.discount_name} (${d.percentage}%)</option>`
    ).join('');

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
  const availEl = document.getElementById('pAvailableAt');
  if (availEl) availEl.value = product?.available_at || 'both';

  // Variants
  const existingVariants = product?.variants || [];
  const varEl = document.getElementById('pVariants');
  if (varEl) varEl.value = JSON.stringify(existingVariants);
  renderVariantChips(existingVariants);

  document.getElementById('productModalOverlay').classList.add('open');
  document.getElementById('productModal').classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModalOverlay').classList.remove('open');
  document.getElementById('productModal').classList.remove('open');
  document.getElementById('productForm').reset();
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
  const nwEl = document.getElementById('pNetWeight');
  if (nwEl) nwEl.value = '';
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
  formData.append('discount_id',   document.getElementById('pDiscount').value);
  formData.append('available_at',  document.getElementById('pAvailableAt').value);
  const ogEl2 = document.getElementById('pOptionGroups');
  formData.append('option_groups', ogEl2 ? ogEl2.value : '[]');
  const nwEl2 = document.getElementById('pNetWeight');
  formData.append('net_weight',    nwEl2 ? (nwEl2.value || '0') : '0');
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

async function loadInventory() {
  try {
    const [invRes, prodRes] = await Promise.all([
      fetch('/api/admin/inventory'),
      fetch('/api/admin/products'),
    ]);
    allInventory    = await invRes.json();
    const products  = await prodRes.json();

    // Check low stock products
    const lowStock = products.filter(p => p.status === 'active' && Number(p.quantity) <= 10);
    const banner   = document.getElementById('lowStockBanner');
    const bannerText = document.getElementById('lowStockBannerText');

    if (lowStock.length > 0 && banner) {
      banner.style.display = 'flex';
      bannerText.textContent = `⚠️ ${lowStock.length} product${lowStock.length > 1 ? 's are' : ' is'} running low on stock!`;

      // Also update nav badge
      const navInv = document.getElementById('navInventory');
      if (navInv && !navInv.querySelector('.nav-badge')) {
        const badge = document.createElement('span');
        badge.className   = 'nav-badge';
        badge.textContent = lowStock.length;
        badge.style.cssText = 'background:#ef4444;color:#fff;border-radius:999px;font-size:10px;padding:1px 6px;margin-left:auto;font-weight:700;';
        navInv.appendChild(badge);
      } else if (navInv) {
        const b = navInv.querySelector('.nav-badge');
        if (b) b.textContent = lowStock.length;
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
  if (qty > 0)
    return { label: 'Restock', color: 'var(--g-400)', icon: '↑', bg: 'rgba(22,163,74,0.1)' };
  return { label: 'Other', color: '#9ca3af', icon: '•', bg: 'rgba(107,114,128,0.1)' };
}

function renderInventory(data) {
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
  document.getElementById('inventoryBody').innerHTML = data.length
    ? data.map(i => {
        const type = getMovementType(i);
        const qty  = Number(i.quantity_added);
        const qtyDisplay = qty >= 0
          ? `<strong style="color:var(--g-400);">+${qty}</strong>`
          : `<strong style="color:#ef4444;">${qty}</strong>`;
        return `
        <tr>
          <td><span style="background:${type.bg};color:${type.color};border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;white-space:nowrap;">${type.icon} ${type.label}</span></td>
          <td><strong>${i.product?.product_name || '—'}</strong></td>
          <td>${i.staff ? `${i.staff.fname} ${i.staff.lname}` : '—'}</td>
          <td>${qtyDisplay}</td>
          <td>${i.quantity_before}</td>
          <td>${i.quantity_after}</td>
          <td>${i.from_branch?.branch_name || '—'}</td>
          <td>${i.to_branch?.branch_name   || '—'}</td>
          <td>${new Date(i.date).toLocaleDateString('en-PH')}</td>
          <td style="max-width:200px;font-size:12px;">${i.note || '—'}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="10" class="table-empty">No inventory records found</td></tr>';
}

function filterInventorySearch(q) {
  const filtered = allInventory.filter(i =>
    (i.product?.product_name || '').toLowerCase().includes(q.toLowerCase()) ||
    (i.note || '').toLowerCase().includes(q.toLowerCase())
  );
  renderInventory(filtered);
}

async function filterInventoryType(type, el) {
  if (type === 'low_stock') {
    // Show products with low stock from products API
    try {
      const res      = await fetch('/api/admin/products');
      const products = await res.json();
      const lowStock = products.filter(p => p.status === 'active' && Number(p.quantity) <= 10);
      document.getElementById('inventoryBody').innerHTML = lowStock.length
        ? `<tr><td colspan="9" style="padding:1rem;"><strong style="color:#ef4444;">⚠️ Low Stock Products (≤ 10 units)</strong></td></tr>` +
          lowStock.map(p => `
            <tr style="background:rgba(239,68,68,0.05);">
              <td><strong>${p.product_name}</strong></td>
              <td>—</td>
              <td colspan="2"><span style="color:#ef4444;font-weight:700;">${p.quantity} units remaining</span></td>
              <td>${p.category}</td>
              <td colspan="4">—</td>
            </tr>`).join('')
        : '<tr><td colspan="9" class="table-empty">✅ All products have sufficient stock</td></tr>';
    } catch (e) { console.error('Low stock filter error:', e); }
    return;
  }
  // Filter inventory records by type (from note field)
  const filtered = type
    ? allInventory.filter(i => (i.note || '').toLowerCase().includes(type))
    : allInventory;
  renderInventory(filtered);
}


// ─── ADD STOCK Modal ─────────────────────────────────

async function openAddStockModal() {
  if (!allProducts.length) await loadProducts();
  if (!allBranches.length) await loadBranches();

  const sel = document.getElementById('addStockProduct');
  if (sel) sel.innerHTML = '<option value="">Select product</option>' +
    allProducts.map(p => `<option value="${p.product_id}">${p.product_name} (Stock: ${p.quantity})</option>`).join('');

  const branchSel = document.getElementById('addStockBranch');
  if (branchSel) branchSel.innerHTML = '<option value="">Select branch</option>' +
    allBranches.map(b => `<option value="${b.branch_id}">${b.branch_name}</option>`).join('');

  document.getElementById('addStockModalOverlay')?.classList.add('open');
  document.getElementById('addStockModal')?.classList.add('open');
}

function closeAddStockModal() {
  document.getElementById('addStockModalOverlay')?.classList.remove('open');
  document.getElementById('addStockModal')?.classList.remove('open');
  document.getElementById('addStockForm')?.reset();
}

async function submitAddStock(e) {
  e.preventDefault();
  const data = {
    product_id:   document.getElementById('addStockProduct').value,
    quantity:     parseInt(document.getElementById('addStockQty').value),
    to_branch_id: document.getElementById('addStockBranch').value,
    note:         document.getElementById('addStockNote').value || 'Stock added',
    type:         'restock',
  };
  try {
    const res = await fetch('/api/admin/inventory', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      showToast('Stock added successfully!');
      closeAddStockModal();
      loadInventory(); loadProducts();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to add stock.', 'error');
    }
  } catch (e) { showToast('Error adding stock.', 'error'); }
}

// ─── STOCK TRANSFER Modal ─────────────────────────────

async function openTransferModal() {
  if (!allProducts.length) await loadProducts();
  if (!allBranches.length) await loadBranches();

  const prodSel = document.getElementById('transferProduct');
  if (prodSel) prodSel.innerHTML = '<option value="">Select product</option>' +
    allProducts.map(p => `<option value="${p.product_id}">${p.product_name} (Stock: ${p.quantity})</option>`).join('');

  const opts = '<option value="">Select branch</option>' +
    allBranches.map(b => `<option value="${b.branch_id}">${b.branch_name}</option>`).join('');
  const fromEl = document.getElementById('transferFrom');
  const toEl   = document.getElementById('transferTo');
  if (fromEl) fromEl.innerHTML = opts;
  if (toEl)   toEl.innerHTML   = opts;

  document.getElementById('transferModalOverlay')?.classList.add('open');
  document.getElementById('transferModal')?.classList.add('open');
}

function closeTransferModal() {
  document.getElementById('transferModalOverlay')?.classList.remove('open');
  document.getElementById('transferModal')?.classList.remove('open');
  document.getElementById('transferForm')?.reset();
}

async function submitTransfer(e) {
  e.preventDefault();
  const fromId = document.getElementById('transferFrom').value;
  const toId   = document.getElementById('transferTo').value;
  if (fromId === toId) { showToast('From and To branch must be different.', 'error'); return; }
  const data = {
    product_id:     document.getElementById('transferProduct').value,
    quantity:       parseInt(document.getElementById('transferQty').value),
    from_branch_id: fromId,
    to_branch_id:   toId,
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
      loadInventory(); loadProducts();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to transfer stock.', 'error');
    }
  } catch (e) { showToast('Error transferring stock.', 'error'); }
}

// ─── ADJUST STOCK Modal ───────────────────────────────

async function openAdjustModal() {
  if (!allProducts.length) await loadProducts();
  if (!allBranches.length) await loadBranches();

  const sel = document.getElementById('adjustProduct');
  if (sel) sel.innerHTML = '<option value="">Select product</option>' +
    allProducts.map(p => `<option value="${p.product_id}">${p.product_name} (Stock: ${p.quantity})</option>`).join('');

  const branchSel = document.getElementById('adjustBranch');
  if (branchSel) branchSel.innerHTML = '<option value="">Select branch</option>' +
    allBranches.map(b => `<option value="${b.branch_id}">${b.branch_name}</option>`).join('');

  document.getElementById('adjustModalOverlay')?.classList.add('open');
  document.getElementById('adjustModal')?.classList.add('open');
}

function closeAdjustModal() {
  document.getElementById('adjustModalOverlay')?.classList.remove('open');
  document.getElementById('adjustModal')?.classList.remove('open');
  document.getElementById('adjustForm')?.reset();
}

async function submitAdjust(e) {
  e.preventDefault();
  const productId = document.getElementById('adjustProduct').value;
  const qty       = parseInt(document.getElementById('adjustQty').value);
  const reason    = document.getElementById('adjustReason').value;
  const branchId  = document.getElementById('adjustBranch').value;
  const note      = document.getElementById('adjustNote').value;

  // Find current stock
  const product   = allProducts.find(p => p.product_id === productId);
  if (!product) { showToast('Product not found.', 'error'); return; }
  if (qty > product.quantity) {
    showToast(`Cannot deduct ${qty} — only ${product.quantity} units in stock.`, 'error');
    return;
  }

  const data = {
    product_id:     productId,
    quantity:       -qty, // negative = deduction
    to_branch_id:   branchId,
    note:           `[${reason.toUpperCase()}] ${note || reason}`,
    type:           'adjustment',
  };

  try {
    const res = await fetch('/api/admin/inventory', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      showToast(`Stock adjusted — ${qty} unit(s) deducted (${reason}).`);
      closeAdjustModal();
      loadInventory(); loadProducts();
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
  try {
    const res  = await fetch('/api/admin/orders?limit=80');
    const data = await res.json();
    // Sort newest first using created_at timestamp
    allOrders = data.sort((a, b) => {
      // Use created_at (precise timestamp) for sorting — requires created_at column in order table
      const da = a.created_at ? new Date(a.created_at) : new Date(a.date || 0);
      const db = b.created_at ? new Date(b.created_at) : new Date(b.date || 0);
      return db - da;
    });
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
          <td>${o.payment?.payment_method ? badge(o.payment.payment_method) : (Array.isArray(o.payment) && o.payment[0] ? badge(o.payment[0].payment_method) : '—')}</td>
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
// ─── Chart instances ─────────────────────────────────
let revenueChartInst = null;
let paymentChartInst = null;
let branchChartInst  = null;


// ─── Sales Filter Functions ───────────────────────────
let allSalesOrders = []; // Store all orders for filtering

function filterSalesOrders(orders) {
  const completed = orders.filter(o => o.status === 'completed');
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

  if (!month) { filterSalesOrders(allSalesOrders); return; }

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

function resetSalesFilter() {
  document.getElementById('salesQuickFilter').value  = 'all';
  document.getElementById('salesMonthFilter').value  = '';
  document.getElementById('salesDateFrom').value      = '';
  document.getElementById('salesDateTo').value        = '';
  document.getElementById('salesFilterLabel').textContent = '';
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
  const fcId = allBranches.find(b => b.branch_name?.toLowerCase().includes('fiel') || b.branch_name?.toLowerCase().includes('collins'))?.branch_id;

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
        labels: ['Triple E', 'Fiel Collins'],
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
  const top = Object.entries(productSales).sort((a,b)=>b[1].units-a[1].units).slice(0,5);
  document.getElementById('topProductsBody').innerHTML = top.length
    ? top.map(([name,v])=>`<tr><td>${name}</td><td>${v.units}</td><td>${peso(v.revenue)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="table-empty">No sales data yet</td></tr>';
}

async function loadSales() {
  try {
    const [orders, customers] = await Promise.all([
      fetch('/api/admin/orders?limit=500').then(r => r.json()),
      fetch('/api/admin/customers').then(r => r.json()),
    ]);

    allSalesOrders = orders;
    document.getElementById('salesCustomers').textContent = customers.length;

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
    ? users.map(u => {
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
}

function filterUserRole(role) {
  renderUsers(role ? allUsers.filter(u => u.role === role) : allUsers);
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
  document.getElementById('uRole').value      = user?.role || 'staff';
  document.getElementById('uPasswordGroup').style.display = user ? 'none' : 'block';

  // Populate branch dropdown
  populateBranchSelects('uBranch');
  if (s?.branch_id) {
    document.getElementById('uBranch').value = s.branch_id;
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
// ═══════════════════════════════════════════════════════
// STOCK REQUESTS & PURCHASE ORDERS
// ═══════════════════════════════════════════════════════

let allStockRequests = [];
let allPOs           = [];
let poItems          = []; // items in create PO modal

async function loadPurchaseOrders() {
  try {
    const [reqRes, poRes] = await Promise.all([
      fetch('/api/admin/stock-requests'),
      fetch('/api/admin/purchase-orders'),
    ]);
    allStockRequests = await reqRes.json();
    allPOs           = await poRes.json();

    // Badge — pending requests
    const pending = allStockRequests.filter(r => r.status === 'pending').length;
    const badge   = document.getElementById('poRequestBadge');
    if (badge) {
      badge.textContent   = pending;
      badge.style.display = pending > 0 ? 'inline' : 'none';
    }

    renderStockRequests(allStockRequests);
    renderPOs(allPOs);
  } catch (e) { console.error('PO error:', e); }
}

function renderStockRequests(requests) {
  const statusColors = { pending:'yellow', approved:'green', rejected:'red' };
  document.getElementById('stockRequestsBody').innerHTML = requests.length
    ? requests.map(r => `
        <tr>
          <td><strong>${r.product?.product_name || '—'}</strong></td>
          <td>${r.product?.quantity ?? '—'} units</td>
          <td>${r.quantity_needed} units</td>
          <td>${r.staff ? `${r.staff.fname} ${r.staff.lname}` : '—'}</td>
          <td>${r.branch?.branch_name || '—'}</td>
          <td>${badge(r.status)}</td>
          <td style="font-size:12px;">${r.note || '—'}</td>
          <td>${new Date(r.created_at).toLocaleDateString('en-PH')}</td>
          <td>
            <button class="btn-icon" onclick="openReviewRequest('${r.request_id}', '${r.product?.product_name}', ${r.quantity_needed})" title="Review / Change Decision">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        </tr>`).join('')
    : '<tr><td colspan="9" class="table-empty">No stock requests yet</td></tr>';
}

function renderPOs(pos) {
  const statusColors = { draft:'gray', ordered:'blue', received:'green', cancelled:'red' };
  document.getElementById('poBody').innerHTML = pos.length
    ? pos.map(po => {
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
          <td>${new Date(po.created_at).toLocaleDateString('en-PH')}</td>
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

function openReviewRequest(requestId, productName, qty) {
  document.getElementById('reviewRequestId').value    = requestId;
  document.getElementById('reviewRequestTitle').textContent = `Review Request — ${productName}`;
  document.getElementById('reviewRequestInfo').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div><strong>Product:</strong> ${productName}</div>
      <div><strong>Quantity Requested:</strong> ${qty} units</div>
    </div>`;
  document.getElementById('reviewAdminNote').value = '';
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
      loadPurchaseOrders();
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

function addPOItemRow() {
  const wrap = document.getElementById('poItemsWrap');
  const idx  = wrap.children.length;
  const row  = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 80px 100px 32px;gap:8px;margin-bottom:8px;align-items:center;';
  row.innerHTML = `
    <select class="form-input form-select po-product" onchange="updatePOTotal()">
      <option value="">Select product</option>
      ${allProducts.map(p => `<option value="${p.product_id}">${p.product_name}</option>`).join('')}
    </select>
    <input type="number" class="form-input po-qty" min="1" placeholder="Qty" oninput="updatePOTotal()"/>
    <input type="number" class="form-input po-cost" min="0" step="0.01" placeholder="Unit Cost" oninput="updatePOTotal()"/>
    <button type="button" onclick="this.parentElement.remove();updatePOTotal();" style="background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;width:32px;height:32px;font-size:16px;">&times;</button>
  `;
  wrap.appendChild(row);
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
  const supplier = document.getElementById('poSupplier').value.trim();
  const note     = document.getElementById('poNote').value.trim();
  if (!supplier) { showToast('Supplier name is required.', 'error'); return; }

  const rows  = document.getElementById('poItemsWrap').children;
  const items = [];
  for (const row of rows) {
    const productId = row.querySelector('.po-product')?.value;
    const qty       = parseInt(row.querySelector('.po-qty')?.value || 0);
    const unitCost  = parseFloat(row.querySelector('.po-cost')?.value || 0);
    if (productId && qty > 0) items.push({ product_id: productId, quantity: qty, unit_cost: unitCost });
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
      loadPurchaseOrders();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to create PO.', 'error');
    }
  } catch (e) { showToast('Error.', 'error'); }
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
      <div><strong>Created:</strong> ${new Date(po.created_at).toLocaleDateString('en-PH')}</div>
      ${po.note ? `<div><strong>Note:</strong> ${po.note}</div>` : ''}
    </div>
    <table class="data-table" style="margin-bottom:1rem;">
      <thead><tr><th>Product</th><th>Qty</th><th>Unit Cost</th><th>Subtotal</th></tr></thead>
      <tbody>
        ${items.map(i => `
          <tr>
            <td>${i.product?.product_name || '—'}</td>
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
    footer.innerHTML += `
      <button class="btn btn-solid-green" onclick="updatePOStatus('${poId}', 'received')">Mark as Received ✓</button>`;
  }

  document.getElementById('poDetailModalOverlay')?.classList.add('open');
  document.getElementById('poDetailModal')?.classList.add('open');
}

function closePODetailModal() {
  document.getElementById('poDetailModalOverlay')?.classList.remove('open');
  document.getElementById('poDetailModal')?.classList.remove('open');
}

async function updatePOStatus(poId, status) {
  const po = allPOs.find(p => p.po_id === poId);
  try {
    const res = await fetch(`/api/admin/purchase-orders/${poId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, po_number: po?.po_number }),
    });
    if (res.ok) {
      showToast(`PO marked as ${status}!`);
      closePODetailModal();
      loadPurchaseOrders();
      if (status === 'received') loadInventory();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to update PO.', 'error');
    }
  } catch (e) { showToast('Error.', 'error'); }
}


document.addEventListener('DOMContentLoaded', async function () {
  await loadBranches();
  loadProducts();

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