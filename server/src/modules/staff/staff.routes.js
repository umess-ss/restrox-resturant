import { Router } from 'express';
import { body } from 'express-validator';
import { protect, can, authorize, selfOrAdmin } from '../../middlewares/auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';

import { getStaff, getStaffMember, upsertProfile, updateStaff, deleteStaff } from './staff.controller.js';
import {
  myClockIn, myClockOut, myBreakStart, myBreakEnd,
  myToday, myAttendance,
  getStaffAttendance, markAttendance, getTeamAttendanceToday, getAttendanceReport,
} from './attendance.controller.js';
import {
  getShifts, getMyShifts, createShift, updateShift, deleteShift, confirmShift, getWeeklySchedule,
} from './shift.controller.js';
import {
  getPayrollList, getMyPayroll, getPayrollSlip,
  calculateStaffPayroll, runPayroll, approvePayroll, markPayrollPaid,
} from './payroll.controller.js';

const router = Router();
router.use(protect);

// ─── Staff profiles ───────────────────────────────────────────────────────────

router.get('/', can('staff:read'), getStaff);
router.get('/:id', selfOrAdmin, getStaffMember);
router.put('/:id', can('staff:write'), updateStaff);
router.put('/:id/profile', can('staff:write'), upsertProfile);
router.delete('/:id', can('staff:delete'), deleteStaff);

// ─── Attendance: self ─────────────────────────────────────────────────────────

router.post('/attendance/clock-in', myClockIn);
router.post('/attendance/clock-out', myClockOut);
router.post('/attendance/break-start', myBreakStart);
router.post('/attendance/break-end', myBreakEnd);
router.get('/attendance/today', myToday);
router.get('/attendance/my', myAttendance);

// ─── Attendance: manager/admin ────────────────────────────────────────────────

router.get('/attendance/team/today', can('staff:read'), getTeamAttendanceToday);
router.get('/attendance/report', can('staff:read'), getAttendanceReport);
router.get('/attendance/:userId', can('staff:read'), getStaffAttendance);
router.post(
  '/attendance/:userId/mark',
  can('staff:write'),
  [
    body('date').isISO8601().withMessage('Valid date required'),
    body('status').isIn(['present', 'absent', 'late', 'half_day', 'leave']),
  ],
  validate,
  markAttendance
);

// ─── Shifts ───────────────────────────────────────────────────────────────────

router.get('/shifts/my', getMyShifts);
router.get('/shifts/weekly', can('staff:read'), getWeeklySchedule);
router.get('/shifts', can('staff:read'), getShifts);
router.post(
  '/shifts',
  can('staff:write'),
  [
    body('date').isISO8601(),
    body('startTime').matches(/^\d{2}:\d{2}$/),
    body('endTime').matches(/^\d{2}:\d{2}$/),
    body('assignedTo').isArray({ min: 1 }),
  ],
  validate,
  createShift
);
router.put('/shifts/:id', can('staff:write'), updateShift);
router.delete('/shifts/:id', can('staff:write'), deleteShift);
router.post('/shifts/:id/confirm', confirmShift);

// ─── Payroll ──────────────────────────────────────────────────────────────────

router.get('/payroll/my', getMyPayroll);
router.get('/payroll', can('staff:read'), getPayrollList);
router.get('/payroll/:id', getPayrollSlip);  // controller enforces self-only for non-managers
router.post('/payroll/run', authorize('admin', 'manager'), runPayroll);
router.post('/payroll/:userId/calculate', authorize('admin', 'manager'), calculateStaffPayroll);
router.patch('/payroll/:id/approve', authorize('admin', 'manager'), approvePayroll);
router.patch('/payroll/:id/paid', authorize('admin'), markPayrollPaid);

export default router;
