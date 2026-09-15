/**
 * TEFC E-Commerce — Admin Dashboard Unit Tests
 * =============================================
 * Tests for admin.js utility functions
 * Run with: npm test tests/web/admin.test.js
 */

// ─── Mock browser globals ─────────────────────────────────────────────────────
global.document = {
  getElementById: jest.fn(() => ({
    innerHTML: '',
    style:     {},
    classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn(), contains: jest.fn() },
    textContent: '',
  })),
  createElement:  jest.fn(() => ({
    style:     {},
    classList: { add: jest.fn() },
    innerHTML: '',
    appendChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
  })),
  body: { appendChild: jest.fn(), removeChild: jest.fn() },
  querySelector: jest.fn(),
};

global.localStorage = {
  getItem:    jest.fn(() => null),
  setItem:    jest.fn(),
  removeItem: jest.fn(),
};

global.window = {
  location: { hash: '' },
};

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok:   true,
    json: () => Promise.resolve([]),
  })
);


// ─── Utility Functions (extracted from admin.js logic) ───────────────────────

// Peso formatter
function peso(amount) {
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Short ID
function shortId(id) {
  return (id || '').slice(0, 8).toUpperCase();
}

// Paginate
const ITEMS_PER_PAGE = 10;
function paginate(arr, page) {
  return arr.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
}

// Badge
function badge(status) {
  const map = {
    pending:         'badge--yellow',
    processing:      'badge--blue',
    completed:       'badge--green',
    cancelled:       'badge--red',
    active:          'badge--green',
    inactive:        'badge--red',
    walk_in:         'badge--gray',
    online:          'badge--blue',
    paid:            'badge--green',
    cash_on_delivery:'badge--yellow',
    gcash:           'badge--blue',
  };
  const cls = map[status] || 'badge--gray';
  return `<span class="badge ${cls}">${(status || '').replace(/_/g, ' ')}</span>`;
}

// VAT Calculation
function calculateVAT(total) {
  const VAT_RATE  = 0.12;
  const vatAmount = total * VAT_RATE;
  const baseAmt   = total - vatAmount;
  return { vatAmount, baseAmt };
}

// Filter users
function filterUsers(users, searchText, roleFilter, statusFilter) {
  let filtered = users;
  if (roleFilter) {
    filtered = filtered.filter(u => u.role === roleFilter);
  }
  if (statusFilter) {
    filtered = filtered.filter(u => {
      const status = (u.status || 'active').toLowerCase().trim();
      return status === statusFilter;
    });
  }
  if (searchText) {
    const q = searchText.toLowerCase();
    filtered = filtered.filter(u => {
      const username = (u.username || '').toLowerCase();
      const email    = (u.email    || '').toLowerCase();
      const role     = (u.role     || '').toLowerCase();
      return username.includes(q) || email.includes(q) || role.includes(q);
    });
  }
  return filtered;
}

// Phone validation
function isValidPhone(phone) {
  return /^09[0-9]{9}$/.test(phone);
}

// Email validation
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Peso Formatter', () => {
  test('formats integer amount', () => {
    expect(peso(100)).toBe('₱100.00');
  });

  test('formats decimal amount', () => {
    expect(peso(99.5)).toBe('₱99.50');
  });

  test('formats zero', () => {
    expect(peso(0)).toBe('₱0.00');
  });

  test('formats large amount', () => {
    expect(peso(10000)).toBe('₱10,000.00');
  });

  test('handles string input', () => {
    expect(peso('250')).toBe('₱250.00');
  });
});


describe('Short ID', () => {
  test('returns 8 chars uppercase', () => {
    const id = '3e81dc69-2e3b-4ac8-b4dd-3be2e1239ffd';
    expect(shortId(id)).toBe('3E81DC69');
    expect(shortId(id).length).toBe(8);
  });

  test('handles empty string', () => {
    expect(shortId('')).toBe('');
  });

  test('handles null/undefined', () => {
    expect(shortId(null)).toBe('');
    expect(shortId(undefined)).toBe('');
  });

  test('returns uppercase', () => {
    const result = shortId('abcdefgh-1234');
    expect(result).toBe(result.toUpperCase());
  });
});


describe('Pagination', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

  test('returns first 10 items on page 1', () => {
    const result = paginate(items, 1);
    expect(result.length).toBe(10);
    expect(result[0].id).toBe(1);
    expect(result[9].id).toBe(10);
  });

  test('returns correct items on page 2', () => {
    const result = paginate(items, 2);
    expect(result.length).toBe(10);
    expect(result[0].id).toBe(11);
  });

  test('returns remaining items on last page', () => {
    const result = paginate(items, 3);
    expect(result.length).toBe(5);
    expect(result[0].id).toBe(21);
  });

  test('returns empty array for out-of-range page', () => {
    const result = paginate(items, 10);
    expect(result.length).toBe(0);
  });

  test('handles empty array', () => {
    const result = paginate([], 1);
    expect(result.length).toBe(0);
  });
});


describe('Badge Generator', () => {
  test('generates pending badge', () => {
    expect(badge('pending')).toContain('badge--yellow');
    expect(badge('pending')).toContain('pending');
  });

  test('generates completed badge', () => {
    expect(badge('completed')).toContain('badge--green');
  });

  test('generates cancelled badge', () => {
    expect(badge('cancelled')).toContain('badge--red');
  });

  test('generates online badge', () => {
    expect(badge('online')).toContain('badge--blue');
  });

  test('generates walk_in badge without underscore', () => {
    const result = badge('walk_in');
    expect(result).toContain('walk in');
  });

  test('handles unknown status', () => {
    expect(badge('unknown')).toContain('badge--gray');
  });

  test('handles empty/null status', () => {
    expect(badge('')).toContain('badge');
    expect(badge(null)).toContain('badge');
  });
});


describe('VAT Calculation', () => {
  test('calculates 12% VAT correctly', () => {
    const { vatAmount, baseAmt } = calculateVAT(100);
    expect(vatAmount).toBeCloseTo(12.0);
    expect(baseAmt).toBeCloseTo(88.0);
  });

  test('base + vat equals total', () => {
    const total = 285;
    const { vatAmount, baseAmt } = calculateVAT(total);
    expect(baseAmt + vatAmount).toBeCloseTo(total);
  });

  test('zero total gives zero VAT', () => {
    const { vatAmount, baseAmt } = calculateVAT(0);
    expect(vatAmount).toBe(0);
    expect(baseAmt).toBe(0);
  });

  test('large amount calculates correctly', () => {
    const { vatAmount } = calculateVAT(5000);
    expect(vatAmount).toBeCloseTo(600);
  });
});


describe('User Filter', () => {
  const users = [
    { username: 'admin1',  email: 'admin@test.com',  role: 'admin',    status: 'active'   },
    { username: 'staff1',  email: 'staff@test.com',  role: 'staff',    status: 'active'   },
    { username: 'staff2',  email: 'staff2@test.com', role: 'staff',    status: 'inactive' },
    { username: 'customer1',email:'cust@test.com',   role: 'customer', status: 'active'   },
  ];

  test('filters by role admin', () => {
    const result = filterUsers(users, '', 'admin', '');
    expect(result.length).toBe(1);
    expect(result[0].role).toBe('admin');
  });

  test('filters by role staff', () => {
    const result = filterUsers(users, '', 'staff', '');
    expect(result.length).toBe(2);
  });

  test('filters by status inactive', () => {
    const result = filterUsers(users, '', '', 'inactive');
    expect(result.length).toBe(1);
    expect(result[0].username).toBe('staff2');
  });

  test('filters by search text', () => {
    const result = filterUsers(users, 'admin', '', '');
    expect(result.length).toBe(1);
    expect(result[0].username).toBe('admin1');
  });

  test('combines role and status filters', () => {
    const result = filterUsers(users, '', 'staff', 'active');
    expect(result.length).toBe(1);
    expect(result[0].username).toBe('staff1');
  });

  test('returns all users when no filter', () => {
    const result = filterUsers(users, '', '', '');
    expect(result.length).toBe(4);
  });

  test('returns empty when no match', () => {
    const result = filterUsers(users, 'nonexistent', '', '');
    expect(result.length).toBe(0);
  });
});


describe('Phone Validation', () => {
  test('valid PH number passes', () => {
    expect(isValidPhone('09123456789')).toBe(true);
    expect(isValidPhone('09876543210')).toBe(true);
  });

  test('number not starting with 09 fails', () => {
    expect(isValidPhone('08123456789')).toBe(false);
    expect(isValidPhone('01234567890')).toBe(false);
  });

  test('short number fails', () => {
    expect(isValidPhone('0912345678')).toBe(false);
  });

  test('long number fails', () => {
    expect(isValidPhone('091234567890')).toBe(false);
  });

  test('empty string fails', () => {
    expect(isValidPhone('')).toBe(false);
  });
});


describe('Email Validation', () => {
  test('valid email passes', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user@domain.ph')).toBe(true);
  });

  test('missing @ fails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
  });

  test('missing domain fails', () => {
    expect(isValidEmail('test@')).toBe(false);
  });

  test('missing TLD fails', () => {
    expect(isValidEmail('test@domain')).toBe(false);
  });

  test('empty string fails', () => {
    expect(isValidEmail('')).toBe(false);
  });

  test('spaces in email fails', () => {
    expect(isValidEmail('test @email.com')).toBe(false);
  });
});