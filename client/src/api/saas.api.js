import api from './axios.js';

const base = '/saas';

// Onboarding (public)
export const onboardRestaurant = (data) => api.post(`${base}/onboard`, data).then((r) => r.data);

// Restaurant
export const fetchMyRestaurant = () => api.get(`${base}/me`).then((r) => r.data);
export const updateRestaurant = (data) => api.put(`${base}/me`, data).then((r) => r.data);

// Branches
export const fetchBranches = () => api.get(`${base}/branches`).then((r) => r.data);
export const fetchBranch = (id) => api.get(`${base}/branches/${id}`).then((r) => r.data);
export const createBranch = (data) => api.post(`${base}/branches`, data).then((r) => r.data);
export const updateBranch = (id, data) => api.put(`${base}/branches/${id}`, data).then((r) => r.data);
export const deactivateBranch = (id) => api.delete(`${base}/branches/${id}`);

// Superadmin
export const fetchAllRestaurants = (params) => api.get(`${base}/admin/restaurants`, { params }).then((r) => r.data);
export const updateRestaurantPlan = (id, data) => api.patch(`${base}/admin/restaurants/${id}/plan`, data).then((r) => r.data);
