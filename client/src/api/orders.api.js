import api from './axios.js';

const base = '/orders';

export const fetchOrders = (params) => api.get(base, { params }).then((r) => r.data);
export const fetchOrder = (id) => api.get(`${base}/${id}`).then((r) => r.data);
export const fetchKitchenOrders = () => api.get(`${base}/kitchen`).then((r) => r.data);

export const createOrder = (data) => api.post(base, data).then((r) => r.data);
export const addItemsToOrder = (id, items) => api.post(`${base}/${id}/items`, { items }).then((r) => r.data);
export const updateOrderStatus = (id, status, note) => api.patch(`${base}/${id}/status`, { status, note }).then((r) => r.data);

export const printKOT = (id) => api.post(`${base}/${id}/kot`).then((r) => r.data);
export const fetchBill = (id, params) => api.get(`${base}/${id}/bill`, { params }).then((r) => r.data);
export const markBillPresented = (id) => api.patch(`${base}/${id}/bill-presented`).then((r) => r.data);
export const checkoutOrder = (id, data) => api.post(`${base}/${id}/checkout`, data).then((r) => r.data);
export const cancelOrder = (id, note) => api.post(`${base}/${id}/cancel`, { note }).then((r) => r.data);
export const updateItemStatus = (orderId, itemId, status) =>
  api.patch(`${base}/${orderId}/items/${itemId}/status`, { status }).then((r) => r.data);
