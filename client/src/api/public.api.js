/**
 * public.api.js
 *
 * API client for unauthenticated customer QR ordering endpoints.
 * Uses plain axios — no auth token, no interceptors that redirect to login.
 */
import axios from 'axios';
import { buildApiUrl, getApiBaseUrl, getApiPath } from './config.js';

const BASE = getApiBaseUrl();

const pub = axios.create({ baseURL: BASE });

pub.interceptors.request.use((config) => {
  if (config.url && !/^https?:\/\//i.test(config.url)) {
    config.url = getApiPath(config.url);
  }
  return config;
});

// ─── Table info ───────────────────────────────────────────────────────────────
export const fetchPublicTable = (restaurantId, branchId, tableId) =>
  pub.get(`/public/restaurants/${restaurantId}/branches/${branchId}/tables/${tableId}`)
    .then((r) => r.data);

// ─── Menu ─────────────────────────────────────────────────────────────────────
export const fetchPublicMenu = (restaurantId, branchId) =>
  pub.get(`/public/restaurants/${restaurantId}/branches/${branchId}/menu`)
    .then((r) => r.data);

// ─── Place order ──────────────────────────────────────────────────────────────
export const placePublicOrder = (data) =>
  pub.post('/public/orders', data).then((r) => r.data);

export const appendPublicOrderItems = (orderId, data) =>
  pub.post(`/public/orders/${orderId}/items`, data).then((r) => r.data);

// ─── Order status ─────────────────────────────────────────────────────────────
export const fetchPublicOrderStatus = (orderId) =>
  pub.get(`/public/orders/${orderId}/status`).then((r) => r.data);

export const fetchPublicBill = (orderId) =>
  pub.get(`/public/orders/${orderId}/bill`).then((r) => r.data);

export const requestPublicBill = (orderId) =>
  pub.post(`/public/orders/${orderId}/request-bill`).then((r) => r.data);

export const publicReceiptPdfUrl = (orderId) =>
  buildApiUrl(`/public/orders/${orderId}/receipt/pdf`);

export const submitPublicFeedback = (orderId, data) =>
  pub.post(`/public/orders/${orderId}/feedback`, data).then((r) => r.data);

// ─── Call waiter ──────────────────────────────────────────────────────────────
export const callPublicWaiter = (orderId) =>
  pub.post(`/public/orders/${orderId}/call-waiter`).then((r) => r.data);
