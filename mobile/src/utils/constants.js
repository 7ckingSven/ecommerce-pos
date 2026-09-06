// ─── API ──────────────────────────────────────────────
// Switch ENV to control which server to use:
//   'emulator' → local Flask (development)
//   'render'   → Render deployment (real phone / production)

const ENV = 'render'; // ← change this line only

export const API_BASE_URL = ENV === 'emulator'
  ? 'http://10.0.2.2:5000/api'                     // Android emulator → local Flask
  : 'https://ecommerce-pos-8rsf.onrender.com/api'; // Real phone → Render

// ─── App Info ─────────────────────────────────────────
export const APP_NAME     = 'Triple E & Fiel Collince';
export const APP_SUBTITLE = 'General Merchandise';

// ─── Colors ───────────────────────────────────────────
export const COLORS = {
  // Primary greens
  primary:      '#16a34a',
  primaryDark:  '#15803d',
  primaryLight: '#22c55e',
  primaryBg:    '#f0fdf4',
  primaryBorder:'#bbf7d0',

  // Neutrals
  dark:        '#111827',
  darkMid:     '#1f2937',
  gray:        '#6b7280',
  grayLight:   '#9ca3af',
  grayBorder:  '#e5e7eb',
  grayBg:      '#f9fafb',
  white:       '#ffffff',

  // Status
  error:       '#ef4444',
  errorBg:     '#fef2f2',
  warning:     '#f59e0b',
  success:     '#16a34a',

  // Text
  textPrimary:   '#111827',
  textSecondary: '#6b7280',
  textMuted:     '#9ca3af',
};

// ─── Typography ───────────────────────────────────────
export const FONTS = {
  regular: 'System',
  medium:  'System',
  bold:    'System',
};

// ─── Spacing ──────────────────────────────────────────
export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

// ─── Border Radius ────────────────────────────────────
export const RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 999,
};

// ─── Shadows ──────────────────────────────────────────
export const SHADOW = {
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius:  2,
    elevation:     2,
  },
  md: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  8,
    elevation:     4,
  },
  lg: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius:  16,
    elevation:     8,
  },
};