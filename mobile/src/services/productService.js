import api from './api';

export async function getProducts(category = '') {
  const params = category ? { category } : {};
  const res = await api.get('/products', { params });
  return res.data;
}

export async function getProduct(productId) {
  const res = await api.get(`/products/${productId}`);
  return res.data;
}

export async function searchProducts(query, category = '') {
  const res = await api.get('/products/search', {
    params: { q: query, category }
  });
  return res.data;
}