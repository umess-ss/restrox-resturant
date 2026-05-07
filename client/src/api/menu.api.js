import api from './axios.js';

const base = '/menu';

// Menu items
export const fetchMenuItems = (params) => api.get(base, { params }).then((r) => r.data);
export const fetchMenuItem = (id) => api.get(`${base}/${id}`).then((r) => r.data);
export const createMenuItem = (data) => api.post(base, data).then((r) => r.data);
export const updateMenuItem = (id, data) => api.put(`${base}/${id}`, data).then((r) => r.data);
export const deleteMenuItem = (id) => api.delete(`${base}/${id}`);

// Recipe sub-resource
export const fetchMenuItemRecipe = (id) => api.get(`${base}/${id}/recipe`).then((r) => r.data);
export const upsertMenuItemRecipe = (id, data) => api.put(`${base}/${id}/recipe`, data).then((r) => r.data);
export const deleteMenuItemRecipe = (id) => api.delete(`${base}/${id}/recipe`);

// Cost & margin
export const fetchItemCost = (id) => api.get(`${base}/${id}/cost`).then((r) => r.data);
export const fetchItemMargin = (id) => api.get(`${base}/${id}/margin`).then((r) => r.data);

// Analytics
export const fetchAllMargins = () => api.get(`${base}/analytics/margins`).then((r) => r.data);
export const fetchCategorySummary = () => api.get(`${base}/analytics/category-summary`).then((r) => r.data);
