import axios from 'axios';

/**
 * Centralised Axios instance.
 * All requests are relative to /api which Vite proxies to http://localhost:5000.
 */

const API_URL = import.meta.env.VITE_API_URL;
const axiosInstance = axios.create({
  baseURL: `${API_URL}/api` || 'http://localhost:5000/api',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor – can add auth headers here if needed
axiosInstance.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error),
);

// Response interceptor – normalise error messages
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred.';
    return Promise.reject(new Error(message));
  },
);

export default axiosInstance;
