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

export async function placeOrder(cartItems, paymentMethod, refNo = '') {
  const customerId = await getCustomerId();
  const res = await api.post('/orders',
    { cart_items: cartItems, payment_method: paymentMethod, ref_no: refNo },
    { headers: headers(customerId) }
  );
  return res.data;
}