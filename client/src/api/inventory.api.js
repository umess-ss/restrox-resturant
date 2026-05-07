import api from './axios.js';

const base = '/inventory';

// Ingredients
export const fetchIngredients = (params) => api.get(`${base}/ingredients`, { params }).then((r) => r.data);
export const fetchIngredient = (id) => api.get(`${base}/ingredients/${id}`).then((r) => r.data);
export const createIngredient = (data) => api.post(`${base}/ingredients`, data).then((r) => r.data);
export const updateIngredient = (id, data) => api.put(`${base}/ingredients/${id}`, data).then((r) => r.data);
export const deleteIngredient = (id) => api.delete(`${base}/ingredients/${id}`);
export const fetchLowStock = () => api.get(`${base}/ingredients/low-stock`).then((r) => r.data);
export const fetchTransactionHistory = (id, params) =>
  api.get(`${base}/ingredients/${id}/history`, { params }).then((r) => r.data);

// Stock movements
export const stockIn = (id, data) => api.post(`${base}/ingredients/${id}/stock-in`, data).then((r) => r.data);
export const stockOut = (id, data) => api.post(`${base}/ingredients/${id}/stock-out`, data).then((r) => r.data);
export const adjustStock = (id, data) => api.post(`${base}/ingredients/${id}/adjust`, data).then((r) => r.data);

// Wastage
export const reportWastage = (data) => api.post(`${base}/wastage`, data).then((r) => r.data);
export const fetchWastageLog = (params) => api.get(`${base}/wastage`, { params }).then((r) => r.data);

// Recipes
export const fetchRecipes = () => api.get(`${base}/recipes`).then((r) => r.data);
export const fetchRecipe = (menuItemId) => api.get(`${base}/recipes/${menuItemId}`).then((r) => r.data);
export const upsertRecipe = (menuItemId, data) => api.put(`${base}/recipes/${menuItemId}`, data).then((r) => r.data);
export const fetchRecipeCost = (menuItemId) => api.get(`${base}/recipes/${menuItemId}/cost`).then((r) => r.data);

// Reports
export const fetchStockSummary = () => api.get(`${base}/reports/stock-summary`).then((r) => r.data);
export const fetchConsumptionReport = (params) => api.get(`${base}/reports/consumption`, { params }).then((r) => r.data);
export const fetchWastageSummary = (params) => api.get(`${base}/reports/wastage-summary`, { params }).then((r) => r.data);
export const fetchStockMovement = (params) => api.get(`${base}/reports/stock-movement`, { params }).then((r) => r.data);
export const fetchValuation = () => api.get(`${base}/reports/valuation`).then((r) => r.data);
