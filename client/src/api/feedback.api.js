import api from './axios.js';

const base = '/feedback';

export const fetchFeedback = (params) =>
  api.get(base, { params }).then((r) => r.data);

export const createFeedback = (data) =>
  api.post(base, data).then((r) => r.data);
