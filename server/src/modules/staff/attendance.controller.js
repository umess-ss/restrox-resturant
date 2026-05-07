import Attendance from './attendance.model.js';
import {
  clockIn as svcClockIn,
  clockOut as svcClockOut,
  startBreak as svcStartBreak,
  endBreak as svcEndBreak,
  getTodayStatus,
  getAttendanceSummary,
} from './attendance.service.js';

// ─── Self actions (any authenticated user) ───────────────────────────────────

export const myClockIn = async (req, res) => {
  const record = await svcClockIn(req.user._id, req.body.notes);
  res.status(201).json(record);
};

export const myClockOut = async (req, res) => {
  const record = await svcClockOut(req.user._id, req.body.notes);
  res.json(record);
};

export const myBreakStart = async (req, res) => {
  const record = await svcStartBreak(req.user._id);
  res.json(record);
};

export const myBreakEnd = async (req, res) => {
  const record = await svcEndBreak(req.user._id);
  res.json(record);
};

export const myToday = async (req, res) => {
  const status = await getTodayStatus(req.user._id);
  res.json(status);
};

export const myAttendance = async (req, res) => {
  const { from, to } = req.query;
  const summary = await getAttendanceSummary(
    req.user._id,
    from ? new Date(from) : new Date(new Date().setDate(1)), // default: start of month
    to ? new Date(to) : new Date()
  );
  res.json(summary);
};

// ─── Manager/Admin actions ────────────────────────────────────────────────────

export const getStaffAttendance = async (req, res) => {
  const { from, to } = req.query;
  const summary = await getAttendanceSummary(
    req.params.userId,
    from ? new Date(from) : new Date(new Date().setDate(1)),
    to ? new Date(to) : new Date()
  );
  res.json(summary);
};

export const markAttendance = async (req, res) => {
  const { userId } = req.params;
  const { date, status, leaveType, leaveApproved, notes } = req.body;

  const day = new Date(date);
  day.setHours(0, 0, 0, 0);

  const record = await Attendance.findOneAndUpdate(
    { user: userId, date: day },
    { user: userId, date: day, status, leaveType, leaveApproved, notes },
    { upsert: true, new: true, runValidators: true }
  );
  res.json(record);
};

export const getTeamAttendanceToday = async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const records = await Attendance.find({ date: today })
    .populate('user', 'name role')
    .sort('user.name');
  res.json(records);
};

export const getAttendanceReport = async (req, res) => {
  const { month, year } = req.query;
  const m = Number(month) || new Date().getMonth() + 1;
  const y = Number(year) || new Date().getFullYear();

  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0, 23, 59, 59);

  const records = await Attendance.find({ date: { $gte: from, $lte: to } })
    .populate('user', 'name role')
    .sort('date');

  // Group by user
  const byUser = {};
  for (const r of records) {
    const uid = r.user._id.toString();
    if (!byUser[uid]) {
      byUser[uid] = { user: r.user, records: [], totalNetHours: 0, totalOvertimeHours: 0, presentDays: 0, absentDays: 0, lateDays: 0 };
    }
    byUser[uid].records.push(r);
    byUser[uid].totalNetHours += r.netHours || 0;
    byUser[uid].totalOvertimeHours += r.overtimeHours || 0;
    if (['present', 'late'].includes(r.status)) byUser[uid].presentDays++;
    if (r.status === 'absent') byUser[uid].absentDays++;
    if (r.isLate) byUser[uid].lateDays++;
  }

  res.json(Object.values(byUser));
};
