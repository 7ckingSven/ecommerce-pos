import api from './api';
import { getCustomerId } from './authService';

function headers(customerId) {
  return { 'X-Customer-ID': customerId };
}

export async function getCart() {
  const customerId = await getCustomerId();
  const res = await api.get('/cart', { headers: headers(customerId) });
  return res.data;
}

export async function addToCart(productId, quantity = 1, branchId = null, selectedOptions = {}) {
  const customerId = await getCustomerId();
  const res = await api.post('/cart',
    { product_id: productId, quantity, branch_id: branchId, selected_options: selectedOptions },
    { headers: headers(customerId) }
  );
  return res.data;
}

export async function updateCartItem(cartId, quantity) {
  const customerId = await getCustomerId();
  const res = await api.put(`/cart/${cartId}`,
    { quantity },
    { headers: headers(customerId) }
  );
  return res.data;
}

export async function removeFromCart(cartId) {
  const customerId = await getCustomerId();
  const res = await api.delete(`/cart/${cartId}`,
    { headers: headers(customerId) }
  );
  return res.data;
}

export async function updateCartItemOptions(cartId, selectedOptions) {
  const customerId = await getCustomerId();
  const res = await api.put(`/cart/${cartId}`,
    { selected_options: selectedOptions },
    { headers: headers(customerId) }
  );
  return res.data;
}