import api from './axios.js';

const base = '/staff';

// Staff profiles
export const fetchStaff = (params) => api.get(base, { params }).then((r) => r.data);
export const createStaff = (data) => api.post(base, data).then((r) => r.data);
export const fetchStaffMember = (id) => api.get(`${base}/${id}`).then((r) => r.data);
export const updateStaff = (id, data) => api.put(`${base}/${id}`, data).then((r) => r.data);
export const upsertProfile = (id, data) => api.put(`${base}/${id}/profile`, data).then((r) => r.data);
export const deactivateStaff = (id) => api.delete(`${base}/${id}`);

// Attendance — self
export const clockIn = (notes) => api.post(`${base}/attendance/clock-in`, { notes }).then((r) => r.data);
export const clockOut = (notes) => api.post(`${base}/attendance/clock-out`, { notes }).then((r) => r.data);
export const startBreak = () => api.post(`${base}/attendance/break-start`).then((r) => r.data);
export const endBreak = () => api.post(`${base}/attendance/break-end`).then((r) => r.data);
export const fetchMyToday = () => api.get(`${base}/attendance/today`).then((r) => r.data);
export const fetchMyAttendance = (params) => api.get(`${base}/attendance/my`, { params }).then((r) => r.data);

// Attendance — manager
export const fetchTeamToday = () => api.get(`${base}/attendance/team/today`).then((r) => r.data);
export const fetchAttendanceReport = (params) => api.get(`${base}/attendance/report`, { params }).then((r) => r.data);
export const fetchStaffAttendance = (userId, params) => api.get(`${base}/attendance/${userId}`, { params }).then((r) => r.data);
export const markAttendance = (userId, data) => api.post(`${base}/attendance/${userId}/mark`, data).then((r) => r.data);

// Shifts
export const fetchMyShifts = (params) => api.get(`${base}/shifts/my`, { params }).then((r) => r.data);
export const fetchWeeklySchedule = (params) => api.get(`${base}/shifts/weekly`, { params }).then((r) => r.data);
export const fetchShifts = (params) => api.get(`${base}/shifts`, { params }).then((r) => r.data);
export const createShift = (data) => api.post(`${base}/shifts`, data).then((r) => r.data);
export const updateShift = (id, data) => api.put(`${base}/shifts/${id}`, data).then((r) => r.data);
export const deleteShift = (id) => api.delete(`${base}/shifts/${id}`);
export const confirmShift = (id) => api.post(`${base}/shifts/${id}/confirm`).then((r) => r.data);

// Payroll
export const fetchMyPayroll = () => api.get(`${base}/payroll/my`).then((r) => r.data);
export const fetchPayrollList = (params) => api.get(`${base}/payroll`, { params }).then((r) => r.data);
export const fetchPayrollSlip = (id) => api.get(`${base}/payroll/${id}`).then((r) => r.data);
export const calculatePayroll = (userId, data) => api.post(`${base}/payroll/${userId}/calculate`, data).then((r) => r.data);
export const runPayroll = (data) => api.post(`${base}/payroll/run`, data).then((r) => r.data);
export const approvePayroll = (id) => api.patch(`${base}/payroll/${id}/approve`).then((r) => r.data);
export const markPayrollPaid = (id) => api.patch(`${base}/payroll/${id}/paid`).then((r) => r.data);
