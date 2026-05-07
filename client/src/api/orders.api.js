import api from './axios.js';

export const fetchOrders = (params) => api.get('/orders', { params }).then((r) => r.data);
export const createOrder = (data) => api.post('/orders', data).then((r) => r.data);
export const updateOrderStatus = (id, status) => api.patch(`/orders/${id}/status`, { status }).then((r) => r.data);
export const markOrderPaid = (id) => api.patch(`/orders/${id}/pay`).then((r) => r.data);
