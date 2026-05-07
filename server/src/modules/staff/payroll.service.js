import Payroll from './payroll.model.js';
import Attendance from './attendance.model.js';
import StaffProfile from './staffProfile.model.js';
import User from '../auth/auth.model.js';

/**
 * Returns the number of working days (Mon–Fri) in a given month/year.
 */
const getWorkingDaysInMonth = (year, month) => {
  const days = new Date(year, month, 0).getDate(); // total days in month
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0 && day !== 6) count++; // exclude Sun (0) and Sat (6)
  }
  return count;
};

/**
 * Calculates and upserts a payroll record for a staff member for a given month.
 * Idempotent — safe to call multiple times (recalculates if still in 'draft').
 *
 * @param {string} userId
 * @param {number} month  1–12
 * @param {number} year
 * @param {object} overrides  - { bonus, taxRate, otherDeductions }
 */
export const calculatePayroll = async (userId, month, year, overrides = {}) => {
  const existing = await Payroll.findOne({ user: userId, month, year });
  if (existing?.status === 'paid') {
    throw Object.assign(new Error('Payroll already paid — cannot recalculate'), { status: 409 });
  }

  const [profile, user] = await Promise.all([
    StaffProfile.findOne({ user: userId }),
    User.findById(userId),
  ]);

  if (!profile) throw Object.assign(new Error('Staff profile not found'), { status: 404 });

  // Attendance for the month
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);

  const records = await Attendance.find({
    user: userId,
    date: { $gte: from, $lte: to },
  });

  const workingDays = getWorkingDaysInMonth(year, month);
  const presentDays = records.filter((r) => ['present', 'late'].includes(r.status)).length;
  const absentDays = records.filter((r) => r.status === 'absent').length;
  const lateDays = records.filter((r) => r.isLate).length;
  const leaveDays = records.filter((r) => r.status === 'leave').length;
  const halfDays = records.filter((r) => r.status === 'half_day').length;
  const totalNetHours = +records.reduce((s, r) => s + (r.netHours || 0), 0).toFixed(2);
  const totalOvertimeHours = +records.reduce((s, r) => s + (r.overtimeHours || 0), 0).toFixed(2);

  // ─── Earnings ─────────────────────────────────────────────────────────────

  let basePay = 0;
  let overtimePay = 0;

  if (profile.salaryType === 'monthly') {
    // Pro-rate for absences: deduct per working day
    const dailyRate = profile.baseSalary / workingDays;
    const effectiveDays = presentDays + leaveDays + halfDays * 0.5;
    basePay = +(dailyRate * effectiveDays).toFixed(2);
    // Overtime: hourly equivalent = monthly / (workingDays * 8)
    const hourlyEquiv = profile.baseSalary / (workingDays * 8);
    overtimePay = +(totalOvertimeHours * hourlyEquiv * profile.overtimeRate).toFixed(2);
  } else {
    // Hourly
    basePay = +(totalNetHours * profile.baseSalary).toFixed(2);
    overtimePay = +(totalOvertimeHours * profile.baseSalary * (profile.overtimeRate - 1)).toFixed(2);
  }

  const bonus = overrides.bonus ?? 0;
  const grossPay = +(basePay + overtimePay + bonus).toFixed(2);

  // ─── Deductions ───────────────────────────────────────────────────────────

  const taxRate = overrides.taxRate ?? 0.1; // 10% default
  const taxDeduction = +(grossPay * taxRate).toFixed(2);

  // Late deduction: 0.5% of daily rate per late day
  const dailyRate = profile.baseSalary / workingDays;
  const absenceDeduction = +(absentDays * dailyRate).toFixed(2);
  const otherDeductions = overrides.otherDeductions ?? 0;
  const totalDeductions = +(taxDeduction + absenceDeduction + otherDeductions).toFixed(2);

  const netPay = +(grossPay - totalDeductions).toFixed(2);

  // ─── Upsert ───────────────────────────────────────────────────────────────

  const payroll = await Payroll.findOneAndUpdate(
    { user: userId, month, year },
    {
      user: userId,
      profile: profile._id,
      month,
      year,
      workingDays,
      presentDays,
      absentDays,
      lateDays,
      leaveDays,
      totalNetHours,
      totalOvertimeHours,
      basePay,
      overtimePay,
      bonus,
      grossPay,
      taxDeduction,
      absenceDeduction,
      otherDeductions,
      totalDeductions,
      netPay,
      currency: profile.currency,
      status: existing?.status === 'approved' ? 'approved' : 'draft',
    },
    { upsert: true, new: true, runValidators: true }
  )
    .populate('user', 'name email role')
    .populate('profile', 'employeeId department salaryType baseSalary');

  return payroll;
};

/**
 * Runs payroll for all active staff for a given month.
 * Returns results array with success/error per staff member.
 */
export const runMonthlyPayroll = async (month, year, overrides = {}, requestedBy) => {
  const profiles = await StaffProfile.find().populate('user', 'name email isActive');
  const active = profiles.filter((p) => p.user?.isActive);

  const results = await Promise.allSettled(
    active.map((p) => calculatePayroll(p.user._id, month, year, overrides))
  );

  return results.map((r, i) => ({
    staff: active[i].user.name,
    userId: active[i].user._id,
    status: r.status,
    payroll: r.status === 'fulfilled' ? r.value : null,
    error: r.status === 'rejected' ? r.reason.message : null,
  }));
};
