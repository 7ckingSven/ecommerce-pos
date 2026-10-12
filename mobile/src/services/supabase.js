import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../utils/constants';
import { getSupabaseToken } from './authService';

// Read-only Realtime client — uses the anon key only, never the service
// role key (that one lives in Flask's .env and must never ship to the app).
// `accessToken` feeds in the Supabase-compatible JWT Flask mints at login
// (see authService.js / app.py's make_supabase_token()), so RLS's
// auth.uid() resolves to the logged-in customer's customer_id instead of
// matching nothing.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  accessToken: async () => await getSupabaseToken(),
});