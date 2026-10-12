import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// ─── Login ────────────────────────────────────────────
export async function login(loginInput, password) {
  const response = await api.post('/login', {
    login_input: loginInput,
    password,
  });
  const { user_id, customer, supabase_token } = response.data;
  await AsyncStorage.setItem('user_id',  user_id);
  await AsyncStorage.setItem('customer', JSON.stringify(customer));
  if (supabase_token) {
    await AsyncStorage.setItem('supabase_token', supabase_token);
  }
  return response.data;
}

// ─── Register ─────────────────────────────────────────
export async function register(data) {
  const response = await api.post('/register', data);
  return response.data;
}

// ─── Logout ───────────────────────────────────────────
export async function logout() {
  await AsyncStorage.multiRemove(['user_id', 'customer', 'supabase_token']);
}

// ─── Get Current Customer ─────────────────────────────
export async function getCustomer() {
  const data = await AsyncStorage.getItem('customer');
  return data ? JSON.parse(data) : null;
}

// ─── Get Customer ID ──────────────────────────────────
export async function getCustomerId() {
  const customer = await getCustomer();
  return customer?.customer_id || null;
}

// ─── Check if Logged In ───────────────────────────────
export async function isLoggedIn() {
  const user_id = await AsyncStorage.getItem('user_id');
  return !!user_id;
}

// ─── Get Supabase Token (for Realtime order status updates) ──
export async function getSupabaseToken() {
  return await AsyncStorage.getItem('supabase_token');
}