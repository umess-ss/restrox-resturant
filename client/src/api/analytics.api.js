import api from './axios.js';

const base = '/analytics';

export const fetchSnapshot = () => api.get(`${base}/snapshot`).then((r) => r.data);
export const fetchOverview = () => api.get(`${base}/overview`).then((r) => r.data);
export const fetchRevenueTrend = (days) => api.get(`${base}/revenue-trend`, { params: { days } }).then((r) => r.data);
export const fetchTopItems = (params) => api.get(`${base}/top-items`, { params }).then((r) => r.data);
export const fetchSalesByCategory = (params) => api.get(`${base}/sales-by-category`, { params }).then((r) => r.data);
export const fetchHourlyDistribution = (days) => api.get(`${base}/hourly`, { params: { days } }).then((r) => r.data);
export const fetchPaymentMethods = (params) => api.get(`${base}/payment-methods`, { params }).then((r) => r.data);
export const fetchInventorySummary = () => api.get(`${base}/inventory`).then((r) => r.data);
export const fetchProfitAnalysis = (params) => api.get(`${base}/profit-analysis`, { params }).then((r) => r.data);
export const fetchStaffPerformance = (params) => api.get(`${base}/staff-performance`, { params }).then((r) => r.data);
export const fetchOrderFunnel = (params) => api.get(`${base}/order-funnel`, { params }).then((r) => r.data);
