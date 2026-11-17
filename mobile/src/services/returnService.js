import api from './api';
import { getCustomerId } from './authService';

// Returns & Refunds (revision, Nov 2026). Same X-Customer-ID header
// pattern as orderService.js/feedbackService.js.

function headers(customerId) {
  return { 'X-Customer-ID': customerId };
}

export async function submitReturn(orderId, reason, items) {
  // items: [{ order_item_id, qty_returned }]
  const customerId = await getCustomerId();
  const res = await api.post('/returns',
    { order_id: orderId, reason, items },
    { headers: headers(customerId) }
  );
  return res.data;
}

export async function getMyReturns() {
  const customerId = await getCustomerId();
  const res = await api.get('/returns', { headers: headers(customerId) });
  return res.data;
}