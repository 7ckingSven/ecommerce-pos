import api from './api';
import { getCustomerId } from './authService';

function headers(customerId) {
  return { 'X-Customer-ID': customerId };
}

export async function getOrders() {
  const customerId = await getCustomerId();
  const res = await api.get('/orders', { headers: headers(customerId) });
  return res.data;
}

// GCash orders now go through a verified PayMongo payment (see
// createGcashIntent / getGcashStatus below) instead of a manually-typed
// reference number, so placeOrder() just forwards the payment_intent_id —
// the server independently re-verifies it with PayMongo before accepting
// the order. Cash on Delivery orders are unaffected and pass no intent id.
export async function placeOrder(cartItems, paymentMethod, paymentIntentId = '', branchId = null, shippingFee = 0, address = '') {
  const customerId = await getCustomerId();

  const res = await api.post('/orders',
    { cart_items: cartItems, payment_method: paymentMethod, payment_intent_id: paymentIntentId, branch_id: branchId, shipping_fee: shippingFee, address: address },
    { headers: headers(customerId) }
  );
  return res.data;
}

// ─── GCash (PayMongo) ──────────────────────────────────
export async function createGcashIntent(amount) {
  const customerId = await getCustomerId();
  const res = await api.post('/orders/paymongo/gcash/create',
    { amount },
    { headers: headers(customerId) }
  );
  return res.data; // { payment_intent_id, redirect_url }
}

export async function getGcashStatus(paymentIntentId) {
  const customerId = await getCustomerId();
  const res = await api.get(`/orders/paymongo/gcash/status/${paymentIntentId}`, {
    headers: headers(customerId),
  });
  return res.data; // { status }
}

export async function getProfile() {
  const customerId = await getCustomerId();
  const res = await api.get('/customer/profile', { headers: headers(customerId) });
  return res.data;
}

export async function updateProfile(data) {
  const customerId = await getCustomerId();
  const res = await api.put('/customer/profile', data, { headers: headers(customerId) });
  return res.data;
}

export async function changePassword(oldPassword, newPassword) {
  const customerId = await getCustomerId();
  const res = await api.put('/customer/change-password',
    { old_password: oldPassword, new_password: newPassword },
    { headers: headers(customerId) }
  );
  return res.data;
}