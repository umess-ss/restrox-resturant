import api from './axios.js';

export const fetchMenuItems = (params) => api.get('/menu', { params }).then((r) => r.data);
export const createMenuItem = (data) => api.post('/menu', data).then((r) => r.data);
export const updateMenuItem = (id, data) => api.put(`/menu/${id}`, data).then((r) => r.data);
export const deleteMenuItem = (id) => api.delete(`/menu/${id}`);
