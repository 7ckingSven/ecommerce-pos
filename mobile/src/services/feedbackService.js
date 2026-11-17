import api from './api';
import { getCustomerId } from './authService';

// CRM: Feedback & Inquiries (revision, Nov 2026). Uses the `feedback`
// table — same X-Customer-ID header pattern as orderService.js.

function headers(customerId) {
  return { 'X-Customer-ID': customerId };
}

export async function submitFeedback(type, subject, message, orderId = null) {
  const customerId = await getCustomerId();
  const res = await api.post('/feedback',
    { type, subject, message, order_id: orderId },
    { headers: headers(customerId) }
  );
  return res.data;
}

export async function getMyFeedback() {
  const customerId = await getCustomerId();
  const res = await api.get('/feedback', { headers: headers(customerId) });
  return res.data;
}