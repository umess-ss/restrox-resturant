import api from './axios.js';

export const fetchTables = (params) => api.get('/tables', { params }).then((r) => r.data);
export const createTable = (data) => api.post('/tables', data).then((r) => r.data);
export const updateTable = (id, data) => api.put(`/tables/${id}`, data).then((r) => r.data);
