/**
 * TEFC E-Commerce — Staff Dashboard Unit Tests
 * =============================================
 * Tests for staff.js utility functions
 * Run with: npm test tests/web/staff.test.js
 */

// ─── Mock browser globals ─────────────────────────────────────────────────────
global.document = {
  getElementById: jest.fn(() => ({
    innerHTML: '',
    style:     {},
    classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn(), contains: jest.fn() },
    textContent: '',
    value: '',
  })),
  createElement: jest.fn(() => ({
    style: {},
    innerHTML: '',
  })),
  body: { appendChild: jest.fn(), removeChild: jest.fn() },
  querySelector: jest.fn(),
};

global.localStorage = {
  getItem:    jest.fn(() => null),
  setItem:    jest.fn(),
  removeItem: jest.fn(),
};

global.window = { staffBranchId: null };

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok:   true,
    json: () => Promise.resolve([]),
  })
);


// ─── Utility Functions (from staff.js logic) ─────────────────────────────────

function peso(amount) {
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortId(id) {
  return (id || '').slice(0, 8).toUpperCase();
}

const ITEMS_PER_PAGE = 10;
function paginate(arr, page) {
  return arr.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
}

function badge(status) {
  const map = {
    pending:          'badge--yellow',
    processing:       'badge--blue',
    completed:        'badge--green',
    cancelled:        'badge--red',
    approved:         'badge--green',
    rejected:         'badge--red',
    walk_in:          'badge--gray',
    online:           'badge--blue',
    cash_on_delivery: 'badge--yellow',
    gcash:            'badge--blue',
    walk_in_cash:     'badge--gray',
  };
  const cls = map[status] || 'badge--gray';
  return `<span class="badge ${cls}">${(status || '').replace(/_/g, ' ')}</span>`;
}

// POS product filter by branch
function filterProductsByBranch(products, staffBranchId) {
  if (!staffBranchId) return products;
  return products.filter(p => {
    const bs = (p.branch_stock || []).find(b => b.branch_id === staffBranchId);
    return bs !== undefined;
  });
}

// Get branch stock quantity
function getBranchStock(product, staffBranchId) {
  if (!staffBranchId) return product.quantity || 0;
  const bs = (product.branch_stock || []).find(b => b.branch_id === staffBranchId);
  return bs ? bs.quantity : 0;
}

// VAT receipt calculation
function calculateVAT(total) {
  const VAT_RATE  = 0.12;
  const vatAmount = total * VAT_RATE;
  const baseAmt   = total - vatAmount;
  return { vatAmount, baseAmt };
}

// Order total calculation
function calculateOrderTotal(items) {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// Apply order filters
function applyOrderFilters(orders, typeFilter, statusFilter, searchText) {
  let filtered = orders;
  if (typeFilter)   filtered = filtered.filter(o => o.order_type === typeFilter);
  if (statusFilter) filtered = filtered.filter(o => o.status    === statusFilter);
  if (searchText) {
    const q = searchText.toLowerCase();
    filtered = filtered.filter(o => {
      const customer = o.customer
        ? (o.customer.fname + ' ' + o.customer.lname).toLowerCase()
        : 'walk-in';
      const orderId  = (o.order_id || '').toLowerCase();
      return customer.includes(q) || orderId.includes(q);
    });
  }
  return filtered;
}


// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Staff — Peso Formatter', () => {
  test('formats 285 pesos', () => {
    expect(peso(285)).toBe('₱285.00');
  });

  test('formats zero', () => {
    expect(peso(0)).toBe('₱0.00');
  });

  test('formats decimal', () => {
    expect(peso(99.99)).toBe('₱99.99');
  });
});


describe('Staff — Badge Generator', () => {
  test('pending is yellow', () => {
    expect(badge('pending')).toContain('badge--yellow');
  });

  test('approved is green', () => {
    expect(badge('approved')).toContain('badge--green');
  });

  test('rejected is red', () => {
    expect(badge('rejected')).toContain('badge--red');
  });

  test('walk_in_cash replaces underscores', () => {
    expect(badge('walk_in_cash')).toContain('walk in cash');
  });
});


describe('Staff — POS Product Filter by Branch', () => {
  const products = [
    {
      product_id: '1',
      product_name: 'Product A',
      branch_stock: [
        { branch_id: 'branch-triple-e', quantity: 10 },
        { branch_id: 'branch-fiel',     quantity: 5  },
      ]
    },
    {
      product_id: '2',
      product_name: 'Product B',
      branch_stock: [
        { branch_id: 'branch-triple-e', quantity: 3 },
      ]
    },
    {
      product_id: '3',
      product_name: 'Product C',
      branch_stock: [
        { branch_id: 'branch-fiel', quantity: 7 },
      ]
    },
  ];

  test('filters products for Triple E branch', () => {
    const result = filterProductsByBranch(products, 'branch-triple-e');
    expect(result.length).toBe(2);
    expect(result.map(p => p.product_id)).toContain('1');
    expect(result.map(p => p.product_id)).toContain('2');
  });

  test('filters products for Fiel Collince branch', () => {
    const result = filterProductsByBranch(products, 'branch-fiel');
    expect(result.length).toBe(2);
    expect(result.map(p => p.product_id)).toContain('1');
    expect(result.map(p => p.product_id)).toContain('3');
  });

  test('returns all products when no branch ID', () => {
    const result = filterProductsByBranch(products, null);
    expect(result.length).toBe(3);
  });

  test('returns empty for unknown branch', () => {
    const result = filterProductsByBranch(products, 'unknown-branch');
    expect(result.length).toBe(0);
  });
});


describe('Staff — Branch Stock Quantity', () => {
  const product = {
    quantity: 20,
    branch_stock: [
      { branch_id: 'branch-triple-e', quantity: 10 },
      { branch_id: 'branch-fiel',     quantity: 5  },
    ]
  };

  test('returns Triple E branch stock', () => {
    expect(getBranchStock(product, 'branch-triple-e')).toBe(10);
  });

  test('returns Fiel Collince branch stock', () => {
    expect(getBranchStock(product, 'branch-fiel')).toBe(5);
  });

  test('returns 0 for unknown branch', () => {
    expect(getBranchStock(product, 'unknown')).toBe(0);
  });

  test('returns total quantity when no branch specified', () => {
    expect(getBranchStock(product, null)).toBe(20);
  });
});


describe('Staff — VAT Calculation', () => {
  test('calculates 12% VAT on ₱285', () => {
    const { vatAmount, baseAmt } = calculateVAT(285);
    expect(vatAmount).toBeCloseTo(34.2);
    expect(baseAmt).toBeCloseTo(250.8);
  });

  test('base + vat = total', () => {
    const total = 1500;
    const { vatAmount, baseAmt } = calculateVAT(total);
    expect(baseAmt + vatAmount).toBeCloseTo(total);
  });

  test('zero total', () => {
    const { vatAmount, baseAmt } = calculateVAT(0);
    expect(vatAmount).toBe(0);
    expect(baseAmt).toBe(0);
  });
});


describe('Staff — Order Total Calculation', () => {
  test('calculates total for multiple items', () => {
    const items = [
      { price: 100, quantity: 2 },
      { price: 50,  quantity: 3 },
      { price: 25,  quantity: 1 },
    ];
    expect(calculateOrderTotal(items)).toBe(375);
  });

  test('single item', () => {
    const items = [{ price: 285, quantity: 1 }];
    expect(calculateOrderTotal(items)).toBe(285);
  });

  test('empty items returns 0', () => {
    expect(calculateOrderTotal([])).toBe(0);
  });
});


describe('Staff — Order Filters', () => {
  const orders = [
    { order_id: 'aaa', order_type: 'walk_in', status: 'completed',  customer: null },
    { order_id: 'bbb', order_type: 'online',  status: 'pending',    customer: { fname: 'Jorist', lname: 'Dave' } },
    { order_id: 'ccc', order_type: 'walk_in', status: 'pending',    customer: null },
    { order_id: 'ddd', order_type: 'online',  status: 'completed',  customer: { fname: 'Maria',  lname: 'Santos' } },
  ];

  test('filters by walk_in type', () => {
    const result = applyOrderFilters(orders, 'walk_in', '', '');
    expect(result.length).toBe(2);
  });

  test('filters by online type', () => {
    const result = applyOrderFilters(orders, 'online', '', '');
    expect(result.length).toBe(2);
  });

  test('filters by pending status', () => {
    const result = applyOrderFilters(orders, '', 'pending', '');
    expect(result.length).toBe(2);
  });

  test('filters by completed status', () => {
    const result = applyOrderFilters(orders, '', 'completed', '');
    expect(result.length).toBe(2);
  });

  test('searches by customer name', () => {
    const result = applyOrderFilters(orders, '', '', 'jorist');
    expect(result.length).toBe(1);
    expect(result[0].order_id).toBe('bbb');
  });

  test('walk-in shows as walk-in in search', () => {
    const result = applyOrderFilters(orders, '', '', 'walk-in');
    expect(result.length).toBe(2);
  });

  test('combines type and status filter', () => {
    const result = applyOrderFilters(orders, 'online', 'pending', '');
    expect(result.length).toBe(1);
    expect(result[0].order_id).toBe('bbb');
  });

  test('returns all when no filter', () => {
    const result = applyOrderFilters(orders, '', '', '');
    expect(result.length).toBe(4);
  });
});


describe('Staff — Pagination', () => {
  const items = Array.from({ length: 15 }, (_, i) => i + 1);

  test('page 1 returns first 10', () => {
    expect(paginate(items, 1).length).toBe(10);
  });

  test('page 2 returns remaining 5', () => {
    expect(paginate(items, 2).length).toBe(5);
  });

  test('empty array returns empty', () => {
    expect(paginate([], 1).length).toBe(0);
  });
});