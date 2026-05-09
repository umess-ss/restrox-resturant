import api from './axios.js';
import axios from 'axios';
import { getApiBaseUrl, getApiPath } from './config.js';

const base = '/payments';
const publicApi = axios.create({
  baseURL: getApiBaseUrl(),
});

publicApi.interceptors.request.use((config) => {
  if (config.url && !/^https?:\/\//i.test(config.url)) {
    config.url = getApiPath(config.url);
  }
  return config;
});

export const initiatePayment = (data) => api.post(`${base}/initiate`, data).then((r) => r.data);
export const verifyPayment = (data) => api.post(`${base}/verify`, data).then((r) => r.data);
export const fetchOrderPayments = (orderId) => api.get(`${base}/order/${orderId}`).then((r) => r.data);

export const initiatePublicPayment = (data) =>
  publicApi.post(`${base}/initiate`, data).then((r) => r.data);

export const verifyPublicPayment = (data) =>
  publicApi.post(`${base}/verify`, data).then((r) => r.data);
