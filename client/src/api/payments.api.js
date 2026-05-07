import api from './axios.js';
import axios from 'axios';

const base = '/payments';
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

export const initiatePayment = (data) => api.post(`${base}/initiate`, data).then((r) => r.data);
export const verifyPayment = (data) => api.post(`${base}/verify`, data).then((r) => r.data);
export const fetchOrderPayments = (orderId) => api.get(`${base}/order/${orderId}`).then((r) => r.data);

export const initiatePublicPayment = (data) =>
  publicApi.post(`${base}/initiate`, data).then((r) => r.data);

export const verifyPublicPayment = (data) =>
  publicApi.post(`${base}/verify`, data).then((r) => r.data);
