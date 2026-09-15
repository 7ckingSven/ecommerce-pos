/**
 * TEFC E-Commerce — Mobile App Unit Tests
 * ========================================
 * Tests for React Native utility functions
 * Run with: npm test tests/mobile/utils.test.js
 */


// ─── Utility Functions (from mobile app) ─────────────────────────────────────

// Price formatter
function formatPrice(price) {
  const num = Number(price);
  if (isNaN(num)) return '₱0.00';
  return `₱${num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Discounted price
function getDiscountedPrice(price, discount) {
  if (!discount) return null;
  return price * (1 - discount.percentage / 100);
}

// Cart count
function getCartCount(cartItems) {
  return (cartItems || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
}

// Cart total
function getCartTotal(cartItems) {
  return (cartItems || []).reduce((sum, item) => {
    const price = item.product?.price || item.price || 0;
    return sum + (price * (item.quantity || 0));
  }, 0);
}

// Shipping fee calculation
function calculateShipping(subtotal, address) {
  if (!address) return 0;
  const inKoronadal = address.toLowerCase().includes('koronadal');
  if (inKoronadal) return 0;
  if (subtotal >= 500) return 0; // free shipping
  return 50;
}

// Order status color
function getStatusColor(status) {
  const colors = {
    pending:          '#eab308',
    processing:       '#3b82f6',
    out_for_delivery: '#8b5cf6',
    completed:        '#22c55e',
    cancelled:        '#ef4444',
  };
  return colors[status] || '#6b7280';
}

// Phone validation
function isValidPhone(phone) {
  return /^09[0-9]{9}$/.test(phone || '');
}

// Email validation
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

// Password validation
function isValidPassword(password) {
  return (password || '').length >= 8;
}

// OTP validation
function isValidOTP(otp) {
  return /^[0-9]{6}$/.test(otp || '');
}

// Branch name from branch_stock
function getBranchName(product) {
  const bs = (product?.branch_stock || []).find(b => b.quantity > 0);
  return bs?.branch?.branch_name || null;
}

// Format order date
function formatOrderDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-PH', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}

// Selected options display
function formatSelectedOptions(options) {
  if (!options || Object.keys(options).length === 0) return '';
  return Object.entries(options)
    .map(([key, val]) => `${key}: ${val}`)
    .join(', ');
}


// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Mobile — Price Formatter', () => {
  test('formats regular price', () => {
    expect(formatPrice(285)).toBe('₱285.00');
  });

  test('formats decimal price', () => {
    expect(formatPrice(99.5)).toBe('₱99.50');
  });

  test('formats zero', () => {
    expect(formatPrice(0)).toBe('₱0.00');
  });

  test('handles null/undefined', () => {
    expect(formatPrice(null)).toBe('₱0.00');
    expect(formatPrice(undefined)).toBe('₱0.00');
  });

  test('handles string number', () => {
    expect(formatPrice('100')).toBe('₱100.00');
  });

  test('handles NaN', () => {
    expect(formatPrice('not-a-number')).toBe('₱0.00');
  });
});


describe('Mobile — Discounted Price', () => {
  test('calculates 10% discount', () => {
    const price    = 100;
    const discount = { percentage: 10 };
    expect(getDiscountedPrice(price, discount)).toBeCloseTo(90);
  });

  test('calculates 20% discount', () => {
    const price    = 285;
    const discount = { percentage: 20 };
    expect(getDiscountedPrice(price, discount)).toBeCloseTo(228);
  });

  test('returns null when no discount', () => {
    expect(getDiscountedPrice(100, null)).toBeNull();
    expect(getDiscountedPrice(100, undefined)).toBeNull();
  });

  test('100% discount gives zero', () => {
    expect(getDiscountedPrice(100, { percentage: 100 })).toBe(0);
  });
});


describe('Mobile — Cart Count', () => {
  test('counts total items in cart', () => {
    const cart = [
      { quantity: 2 },
      { quantity: 3 },
      { quantity: 1 },
    ];
    expect(getCartCount(cart)).toBe(6);
  });

  test('empty cart returns 0', () => {
    expect(getCartCount([])).toBe(0);
  });

  test('null cart returns 0', () => {
    expect(getCartCount(null)).toBe(0);
  });

  test('single item', () => {
    expect(getCartCount([{ quantity: 5 }])).toBe(5);
  });
});


describe('Mobile — Cart Total', () => {
  test('calculates total correctly', () => {
    const cart = [
      { price: 100, quantity: 2 },
      { price: 50,  quantity: 1 },
    ];
    expect(getCartTotal(cart)).toBe(250);
  });

  test('uses product price when available', () => {
    const cart = [
      { product: { price: 285 }, quantity: 1 },
    ];
    expect(getCartTotal(cart)).toBe(285);
  });

  test('empty cart returns 0', () => {
    expect(getCartTotal([])).toBe(0);
  });

  test('null cart returns 0', () => {
    expect(getCartTotal(null)).toBe(0);
  });
});


describe('Mobile — Shipping Fee', () => {
  test('free shipping in Koronadal', () => {
    expect(calculateShipping(100, 'Koronadal City')).toBe(0);
  });

  test('free shipping above ₱500', () => {
    expect(calculateShipping(500, 'General Santos City')).toBe(0);
    expect(calculateShipping(1000, 'General Santos City')).toBe(0);
  });

  test('₱50 fee below ₱500 outside Koronadal', () => {
    expect(calculateShipping(200, 'General Santos City')).toBe(50);
  });

  test('no address returns 0', () => {
    expect(calculateShipping(200, null)).toBe(0);
  });
});


describe('Mobile — Order Status Color', () => {
  test('pending is yellow', () => {
    expect(getStatusColor('pending')).toBe('#eab308');
  });

  test('completed is green', () => {
    expect(getStatusColor('completed')).toBe('#22c55e');
  });

  test('cancelled is red', () => {
    expect(getStatusColor('cancelled')).toBe('#ef4444');
  });

  test('unknown status returns gray', () => {
    expect(getStatusColor('unknown')).toBe('#6b7280');
  });

  test('out_for_delivery is purple', () => {
    expect(getStatusColor('out_for_delivery')).toBe('#8b5cf6');
  });
});


describe('Mobile — Phone Validation', () => {
  test('valid PH number', () => {
    expect(isValidPhone('09123456789')).toBe(true);
  });

  test('must start with 09', () => {
    expect(isValidPhone('08123456789')).toBe(false);
  });

  test('must be 11 digits', () => {
    expect(isValidPhone('0912345678')).toBe(false);
    expect(isValidPhone('091234567890')).toBe(false);
  });

  test('empty string fails', () => {
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone(null)).toBe(false);
  });
});


describe('Mobile — Email Validation', () => {
  test('valid email', () => {
    expect(isValidEmail('test@email.com')).toBe(true);
    expect(isValidEmail('joristdave@gmail.com')).toBe(true);
  });

  test('missing @ fails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
  });

  test('empty fails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});


describe('Mobile — Password Validation', () => {
  test('8+ chars is valid', () => {
    expect(isValidPassword('password')).toBe(true);
    expect(isValidPassword('securepass123')).toBe(true);
  });

  test('less than 8 chars fails', () => {
    expect(isValidPassword('pass')).toBe(false);
    expect(isValidPassword('1234567')).toBe(false);
  });

  test('empty fails', () => {
    expect(isValidPassword('')).toBe(false);
    expect(isValidPassword(null)).toBe(false);
  });
});


describe('Mobile — OTP Validation', () => {
  test('valid 6-digit OTP', () => {
    expect(isValidOTP('123456')).toBe(true);
    expect(isValidOTP('000000')).toBe(true);
    expect(isValidOTP('999999')).toBe(true);
  });

  test('less than 6 digits fails', () => {
    expect(isValidOTP('12345')).toBe(false);
  });

  test('more than 6 digits fails', () => {
    expect(isValidOTP('1234567')).toBe(false);
  });

  test('non-numeric fails', () => {
    expect(isValidOTP('abcdef')).toBe(false);
    expect(isValidOTP('12345a')).toBe(false);
  });

  test('empty fails', () => {
    expect(isValidOTP('')).toBe(false);
    expect(isValidOTP(null)).toBe(false);
  });
});


describe('Mobile — Branch Name from Product', () => {
  test('gets branch name from branch_stock', () => {
    const product = {
      branch_stock: [
        { branch_id: 'branch-1', quantity: 10, branch: { branch_name: 'Triple E' } },
      ]
    };
    expect(getBranchName(product)).toBe('Triple E');
  });

  test('returns null when no stock', () => {
    const product = { branch_stock: [] };
    expect(getBranchName(product)).toBeNull();
  });

  test('skips zero quantity branch', () => {
    const product = {
      branch_stock: [
        { branch_id: 'branch-1', quantity: 0, branch: { branch_name: 'Triple E' } },
        { branch_id: 'branch-2', quantity: 5, branch: { branch_name: 'Fiel Collince' } },
      ]
    };
    expect(getBranchName(product)).toBe('Fiel Collince');
  });

  test('handles null product', () => {
    expect(getBranchName(null)).toBeNull();
    expect(getBranchName(undefined)).toBeNull();
  });
});


describe('Mobile — Format Selected Options', () => {
  test('formats single option', () => {
    const opts = { Size: 'Large' };
    expect(formatSelectedOptions(opts)).toBe('Size: Large');
  });

  test('formats multiple options', () => {
    const opts = { Size: 'Large', Color: 'Red' };
    const result = formatSelectedOptions(opts);
    expect(result).toContain('Size: Large');
    expect(result).toContain('Color: Red');
  });

  test('returns empty string for empty options', () => {
    expect(formatSelectedOptions({})).toBe('');
    expect(formatSelectedOptions(null)).toBe('');
  });
});