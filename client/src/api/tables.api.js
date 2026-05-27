import api from './axios.js';

const base = '/tables';

export const fetchTables = (params) => api.get(base, { params }).then((r) => r.data);
export const fetchTable = (id) => api.get(`${base}/${id}`).then((r) => r.data);
export const fetchTableOrder = (id) => api.get(`${base}/${id}/order`).then((r) => r.data);
export const fetchTableQR = (id) => api.get(`${base}/${id}/qr`).then((r) => r.data);
export const createTable = (data) => api.post(base, data).then((r) => r.data);
export const updateTable = (id, data) => api.put(`${base}/${id}`, data).then((r) => r.data);
export const deleteTable = (id) => api.delete(`${base}/${id}`);
