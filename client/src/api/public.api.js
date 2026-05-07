/**
 * public.api.js
 *
 * API client for unauthenticated customer QR ordering endpoints.
 * Uses plain axios — no auth token, no interceptors that redirect to login.
 */
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const pub = axios.create({ baseURL: BASE });

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

// ─── Order status ─────────────────────────────────────────────────────────────
export const fetchPublicOrderStatus = (orderId) =>
  pub.get(`/public/orders/${orderId}/status`).then((r) => r.data);

export const fetchPublicBill = (orderId) =>
  pub.get(`/public/orders/${orderId}/bill`).then((r) => r.data);

export const requestPublicBill = (orderId) =>
  pub.post(`/public/orders/${orderId}/request-bill`).then((r) => r.data);

export const publicReceiptPdfUrl = (orderId) =>
  `${BASE}/public/orders/${orderId}/receipt/pdf`;

// ─── Call waiter ──────────────────────────────────────────────────────────────
export const callPublicWaiter = (orderId) =>
  pub.post(`/public/orders/${orderId}/call-waiter`).then((r) => r.data);
