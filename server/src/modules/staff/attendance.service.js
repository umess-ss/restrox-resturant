import Attendance from './attendance.model.js';
import StaffProfile from './staffProfile.model.js';

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Clock in a staff member.
 * Creates an attendance record for today if one doesn't exist.
 */
export const clockIn = async (userId, notes) => {
  const today = startOfDay();

  const existing = await Attendance.findOne({ user: userId, date: today });
  if (existing?.clockIn) {
    throw Object.assign(new Error('Already clocked in today'), { status: 409 });
  }

  const now = new Date();

  // Determine if late based on profile's default shift start
  const profile = await StaffProfile.findOne({ user: userId });
  let isLate = false;
  let lateMinutes = 0;

  if (profile?.defaultShiftStart) {
    const [h, m] = profile.defaultShiftStart.split(':').map(Number);
    const shiftStart = new Date(today);
    shiftStart.setHours(h, m, 0, 0);
    // Grace period: 10 minutes
    const graceMs = 10 * 60 * 1000;
    if (now - shiftStart > graceMs) {
      isLate = true;
      lateMinutes = Math.floor((now - shiftStart) / 60000);
    }
  }

  const record = await Attendance.findOneAndUpdate(
    { user: userId, date: today },
    {
      $setOnInsert: { user: userId, date: today },
      $set: {
        clockIn: now,
        status: isLate ? 'late' : 'present',
        isLate,
        lateMinutes,
        notes,
      },
    },
    { upsert: true, new: true }
  );

  return record;
};

/**
 * Clock out a staff member.
 * Calculates hours worked.
 */
export const clockOut = async (userId, notes) => {
  const today = startOfDay();
  const record = await Attendance.findOne({ user: userId, date: today });

  if (!record?.clockIn) throw Object.assign(new Error('Not clocked in today'), { status: 409 });
  if (record.clockOut) throw Object.assign(new Error('Already clocked out today'), { status: 409 });

  // Close any open break
  const openBreak = record.breaks.find((b) => !b.end);
  if (openBreak) openBreak.end = new Date();

  record.clockOut = new Date();
  record.notes = notes || record.notes;

  const profile = await StaffProfile.findOne({ user: userId });
  const standardHours = profile?.weeklyHours ? profile.weeklyHours / 5 : 8;
  record.calculateHours(standardHours);

  // Mark half-day if worked less than half standard hours
  if (record.netHours < standardHours / 2) record.status = 'half_day';

  await record.save();
  return record;
};

/**
 * Start a break.
 */
export const startBreak = async (userId) => {
  const today = startOfDay();
  const record = await Attendance.findOne({ user: userId, date: today });

  if (!record?.clockIn) throw Object.assign(new Error('Not clocked in'), { status: 409 });
  if (record.clockOut) throw Object.assign(new Error('Already clocked out'), { status: 409 });
  if (record.breaks.some((b) => !b.end)) throw Object.assign(new Error('Break already in progress'), { status: 409 });

  record.breaks.push({ start: new Date() });
  await record.save();
  return record;
};

/**
 * End a break.
 */
export const endBreak = async (userId) => {
  const today = startOfDay();
  const record = await Attendance.findOne({ user: userId, date: today });

  if (!record) throw Object.assign(new Error('No attendance record for today'), { status: 404 });
  const openBreak = record.breaks.find((b) => !b.end);
  if (!openBreak) throw Object.assign(new Error('No break in progress'), { status: 409 });

  openBreak.end = new Date();
  await record.save();
  return record;
};

/**
 * Get today's attendance status for a user.
 */
export const getTodayStatus = async (userId) => {
  const today = startOfDay();
  const record = await Attendance.findOne({ user: userId, date: today });
  return record || { user: userId, date: today, status: 'not_clocked_in' };
};

/**
 * Get attendance summary for a user over a date range.
 */
export const getAttendanceSummary = async (userId, from, to) => {
  const records = await Attendance.find({
    user: userId,
    date: { $gte: startOfDay(from), $lte: startOfDay(to) },
  }).sort('date');

  const summary = {
    totalDays: records.length,
    presentDays: records.filter((r) => r.status === 'present').length,
    lateDays: records.filter((r) => r.isLate).length,
    absentDays: records.filter((r) => r.status === 'absent').length,
    halfDays: records.filter((r) => r.status === 'half_day').length,
    leaveDays: records.filter((r) => r.status === 'leave').length,
    totalNetHours: +records.reduce((s, r) => s + (r.netHours || 0), 0).toFixed(2),
    totalOvertimeHours: +records.reduce((s, r) => s + (r.overtimeHours || 0), 0).toFixed(2),
    records,
  };

  return summary;
};
