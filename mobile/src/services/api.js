import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor ──────────────────────────────
api.interceptors.request.use(
  config => config,
  error  => Promise.reject(error)
);

// ─── Response Interceptor ─────────────────────────────
api.interceptors.response.use(
  response => response,
  error    => {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Network Error:', error.request);
    }
    return Promise.reject(error);
  }
);

export default api;