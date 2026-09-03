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

export async function placeOrder(cartItems, paymentMethod, refNo = '', branchId = null, shippingFee = 0, address = '', senderNumber = '', receiptImage = null) {
  const customerId = await getCustomerId();

  // Upload receipt image to Supabase if provided
  let receiptImageUrl = null;
  if (receiptImage && receiptImage.base64) {
    try {
      const uploadRes = await api.post('/upload/gcash-receipt', {
        image_base64:  receiptImage.base64,
        file_name:     receiptImage.fileName || 'receipt.jpg',
        content_type:  receiptImage.type     || 'image/jpeg',
      }, { headers: { 'X-Customer-ID': customerId } });
      receiptImageUrl = uploadRes.data?.url || null;
    } catch (e) {
      console.warn('Receipt upload failed:', e);
    }
  }

  const res = await api.post('/orders',
    { cart_items: cartItems, payment_method: paymentMethod, ref_no: refNo, branch_id: branchId, shipping_fee: shippingFee, address: address, sender_number: senderNumber, receipt_image_url: receiptImageUrl },
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