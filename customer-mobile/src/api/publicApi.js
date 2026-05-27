const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

const request = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || 'Request failed');
  }

  return data;
};

export const fetchPublicTable = (restaurantId, branchId, tableId) =>
  request(`/public/restaurants/${restaurantId}/branches/${branchId}/tables/${tableId}`);

export const fetchPublicMenu = (restaurantId, branchId) =>
  request(`/public/restaurants/${restaurantId}/branches/${branchId}/menu`);

export const placePublicOrder = (payload) =>
  request('/public/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const appendPublicOrderItems = (orderId, payload) =>
  request(`/public/orders/${orderId}/items`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const fetchPublicOrderStatus = (orderId) =>
  request(`/public/orders/${orderId}/status`);

export const fetchPublicBill = (orderId) =>
  request(`/public/orders/${orderId}/bill`);

export const requestPublicBill = (orderId) =>
  request(`/public/orders/${orderId}/request-bill`, { method: 'POST' });

export const callPublicWaiter = (orderId) =>
  request(`/public/orders/${orderId}/call-waiter`, { method: 'POST' });

export const submitPublicFeedback = (orderId, payload) =>
  request(`/public/orders/${orderId}/feedback`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
