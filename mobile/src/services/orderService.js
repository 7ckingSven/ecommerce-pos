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

export async function placeOrder(cartItems, paymentMethod, refNo = '', branchId = null, shippingFee = 0) {
  const customerId = await getCustomerId();
  const res = await api.post('/orders',
    { cart_items: cartItems, payment_method: paymentMethod, ref_no: refNo, branch_id: branchId, shipping_fee: shippingFee },
    { headers: headers(customerId) }
  );
  return res.data;
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