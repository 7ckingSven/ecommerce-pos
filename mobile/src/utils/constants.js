// ─── API ──────────────────────────────────────────────
// Switch ENV to control which server to use:
//   'emulator' → local Flask (development)
//   'render'   → Render deployment (real phone / production)

const ENV = 'render'; // ← change this line only

export const API_BASE_URL = ENV === 'emulator'
  ? 'http://10.0.2.2:5000/api'                     // Android emulator → local Flask
  : 'https://api.tefcecommerce.shop/api';           // Real phone → Render (custom domain)

// ─── Supabase (Realtime order-status updates only — all other data still
// goes through the Flask API above) ─────────────────────
export const SUPABASE_URL      = 'https://klqtptysndojyeyyizvc.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtscXRwdHlzbmRvanlleXlpenZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTI2MTMsImV4cCI6MjA4ODEyODYxM30.pU8fRIrK8WCwUWkunM1RkEZY5kE--amvNlAUbqagb_4';

// ─── App Info ─────────────────────────────────────────
export const APP_NAME     = 'TEFC ECommerce';
export const APP_SUBTITLE = 'Triple E & Fiel Collince General Merchandise';

// ─── Colors (Light / Dark) ─────────────────────────────
// Dark mode (F6) — each screen reads its colors from ThemeContext's
// useTheme() instead of importing COLORS directly, so LIGHT_COLORS and
// DARK_COLORS below are the two palettes it switches between.
//
// `white` is ALWAYS pure white — it's used for text/icons that sit on a
// colored or intentionally-dark background (header titles, button labels,
// the auth-flow screens) and must stay legible regardless of theme.
// `surface` is the one that actually flips — it's the card/sheet/modal
// background, white in light mode and a dark slate in dark mode. Anywhere
// in the screens below that used `COLORS.white` as a *background* has been
// switched to `COLORS.surface`; every `COLORS.white` left as a *text or
// icon* color is intentionally untouched.
//
// `authBg` / `authMuted` are deliberately NOT theme-reactive: Splash,
// Login, Register and the rest of the auth flow already use a fixed dark
// navy brand background in both themes (that's a design choice independent
// of the app's light/dark toggle), so these two stay constant so that
// white text and muted labels on those screens never lose contrast.
export const LIGHT_COLORS = {
  // Primary greens
  primary:      '#16a34a',
  primaryDark:  '#15803d',
  primaryLight: '#22c55e',
  primaryBg:    '#f0fdf4',
  primaryBorder:'#bbf7d0',

  // Neutrals
  dark:        '#111827', // text color on light surfaces
  darkMid:     '#1f2937',
  gray:        '#6b7280',
  grayLight:   '#9ca3af',
  grayBorder:  '#e5e7eb',
  grayBg:      '#f9fafb', // page/app background
  white:       '#ffffff', // fixed — text/icons on colored or dark bg
  surface:     '#ffffff', // card/sheet/modal background
  border:      '#e5e7eb',

  // Status
  error:       '#ef4444',
  errorBg:     '#fef2f2',
  warning:     '#f59e0b',
  success:     '#16a34a',

  // Text
  textPrimary:   '#111827',
  textSecondary: '#6b7280',
  textMuted:     '#9ca3af',

  // Fixed — auth-flow brand background, same in both themes
  authBg:    '#111827',
  authMuted: '#9ca3af',
};

export const DARK_COLORS = {
  // Primary greens — slightly brighter so they stay vivid on dark surfaces
  primary:      '#22c55e',
  primaryDark:  '#16a34a',
  primaryLight: '#4ade80',
  primaryBg:    '#052e16',
  primaryBorder:'#14532d',

  // Neutrals
  // `surface` (card bg) was previously #1e293b against a #0f172a page —
  // only one step apart, so cards barely separated from the page and the
  // whole screen read as one dim, low-contrast mass. Page background is now
  // pushed a touch darker and surface a couple steps lighter so cards
  // visibly pop, and borders/muted text are brightened to match.
  dark:        '#f8fafc', // text color on dark surfaces — light text
  darkMid:     '#3f4e68',
  gray:        '#9fabbd',
  grayLight:   '#6b7a94',
  grayBorder:  '#3f4e68',
  grayBg:      '#0b1220', // page/app background
  white:       '#ffffff', // fixed — text/icons on colored or dark bg
  surface:     '#24324a', // card/sheet/modal background
  border:      '#3f4e68',

  // Status
  error:       '#f87171',
  errorBg:     '#450a0a',
  warning:     '#fbbf24',
  success:     '#22c55e',

  // Text
  textPrimary:   '#f8fafc',
  textSecondary: '#d2dbe8',
  textMuted:     '#9fabbd',

  // Fixed — auth-flow brand background, same in both themes
  authBg:    '#111827',
  authMuted: '#9ca3af',
};

// Legacy default export — kept so any file not yet migrated to
// useTheme()/makeStyles(COLORS) still gets a valid light-mode palette
// instead of crashing on an undefined import.
export const COLORS = LIGHT_COLORS;

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