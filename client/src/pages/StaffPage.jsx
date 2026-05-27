import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import useAuthStore from '../store/authStore.js';
import {
  fetchStaff, createStaff, fetchTeamToday, fetchWeeklySchedule,
  fetchPayrollList, runPayroll, approvePayroll, markPayrollPaid,
  clockIn, clockOut, startBreak, endBreak, fetchMyToday,
  createShift, calculatePayroll,
} from '../api/staff.api.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_COLORS = {
  admin:   'bg-red-100 text-red-700',
  manager: 'bg-purple-100 text-purple-700',
  waiter:  'bg-blue-100 text-blue-700',
  chef:    'bg-orange-100 text-orange-700',
};

const DEPT_COLORS = {
  kitchen:    'bg-orange-100 text-orange-700',
  floor:      'bg-blue-100 text-blue-700',
  bar:        'bg-purple-100 text-purple-700',
  management: 'bg-red-100 text-red-700',
  cleaning:   'bg-gray-100 text-gray-600',
};

const STATUS_COLORS = {
  present:  'bg-green-100 text-green-700',
  absent:   'bg-red-100 text-red-600',
  late:     'bg-yellow-100 text-yellow-700',
  half_day: 'bg-orange-100 text-orange-700',
  leave:    'bg-blue-100 text-blue-700',
};

const PAYROLL_STATUS = {
  draft:    'bg-gray-100 text-gray-600',
  approved: 'bg-blue-100 text-blue-700',
  paid:     'bg-green-100 text-green-700',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const money = (value = 0) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function Avatar({ name, className = 'h-10 w-10' }) {
  const initials = (name || 'Staff')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`${className} grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange-100 to-purple-100 text-sm font-extrabold text-orange-700`}>
      {initials}
    </div>
  );
}

function StatCard({ label, value, helper, tone = 'orange', icon = '●' }) {
  const tones = {
    purple: 'bg-purple-50 text-purple-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
  };

  return (
    <div className={`rounded-3xl p-6 ${tones[tone] || tones.orange}`}>
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/80 text-lg shadow-sm">{icon}</span>
        <div>
          <p className="text-sm font-semibold opacity-80">{label}</p>
          <p className="mt-1 text-3xl font-extrabold text-gray-900">{value}</p>
        </div>
      </div>
      {helper && <p className="mt-5 text-sm leading-relaxed text-gray-500">{helper}</p>}
    </div>
  );
}

// ─── Clock widget (self) ──────────────────────────────────────────────────────

function ClockWidget() {
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    fetchMyToday().then(setToday).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, label) => {
    setLoading(true);
    try {
      await fn();
      toast.success(label);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || `${label} failed`);
    } finally {
      setLoading(false);
    }
  };

  const isClockedIn = today?.clockIn && !today?.clockOut;
  const onBreak = today?.breaks?.some((b) => !b.end);

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col gap-4 xl:flex-row xl:items-center">
      <div className="flex-1">
        <p className="text-xs text-orange-500 font-extrabold uppercase tracking-wide">My attendance today</p>
        <p className="text-base font-extrabold text-gray-900 mt-1">
          {today?.clockIn
            ? `In: ${new Date(today.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Not clocked in'}
          {today?.clockOut && ` · Out: ${new Date(today.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </p>
        {today?.netHours > 0 && (
          <p className="text-xs text-gray-400">{today.netHours}h worked · {today.overtimeHours}h OT</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {!isClockedIn && !today?.clockOut && (
          <button onClick={() => act(clockIn, 'Clocked in')} disabled={loading}
            className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
            Clock In
          </button>
        )}
        {isClockedIn && !onBreak && (
          <button onClick={() => act(startBreak, 'Break started')} disabled={loading}
            className="rounded-2xl bg-yellow-500 px-4 py-2 text-sm font-bold text-white hover:bg-yellow-600 disabled:opacity-50">
            Break
          </button>
        )}
        {isClockedIn && onBreak && (
          <button onClick={() => act(endBreak, 'Break ended')} disabled={loading}
            className="rounded-2xl bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-50">
            End Break
          </button>
        )}
        {isClockedIn && (
          <button onClick={() => act(clockOut, 'Clocked out')} disabled={loading}
            className="rounded-2xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">
            Clock Out
          </button>
        )}
        {today?.clockOut && (
          <span className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">Done</span>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard tab ────────────────────────────────────────────────────────────

function StaffDashboard({ isManager, refreshKey }) {
  const [staff, setStaff] = useState([]);
  const [teamToday, setTeamToday] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const loaders = [fetchStaff(), fetchTeamToday()];
    if (isManager) loaders.push(fetchPayrollList({ month: new Date().getMonth() + 1, year: new Date().getFullYear() }));

    Promise.all(loaders)
      .then(([staffData, todayData, payrollData = []]) => {
        setStaff(staffData);
        setTeamToday(todayData);
        setPayroll(payrollData);
        setSelectedId(staffData[0]?.id || null);
      })
      .catch(() => toast.error('Failed to load staff dashboard'));
  }, [isManager, refreshKey]);

  const selected = staff.find((s) => s.id === selectedId) || staff[0];
  const active = staff.filter((s) => s.isActive).length;
  const inactive = staff.length - active;
  const present = teamToday.filter((a) => ['present', 'late', 'half_day'].includes(a.status)).length;
  const payrollTotal = payroll.reduce((sum, item) => sum + (item.netPay || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-3">
        <StatCard label="Total Employees" value={staff.length} tone="purple" icon="♟" helper="Total workforce registered, with payroll processing on track." />
        <StatCard label="Active Employees" value={active} tone="green" icon="✓" helper="Employees currently working and receiving payroll benefits." />
        <StatCard label="Inactive Employees" value={inactive} tone="red" icon="!" helper="Employees on leave or inactive, with payroll adjustments." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Employee List</h2>
              <p className="text-sm text-gray-400">Payroll and attendance information for this month</p>
            </div>
            <div className="rounded-2xl bg-orange-50 px-4 py-2 text-sm font-bold text-orange-600">
              {present} present today
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-gray-100 text-xs text-gray-400">
                <tr>
                  <th className="py-3 text-left">Employee Name</th>
                  <th className="py-3 text-left">Batch ID</th>
                  <th className="py-3 text-left">Position</th>
                  <th className="py-3 text-left">Department</th>
                  <th className="py-3 text-left">Salary</th>
                  <th className="py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={`cursor-pointer border-b border-gray-50 transition hover:bg-orange-50/50 ${selected?.id === s.id ? 'bg-purple-50' : ''}`}
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} />
                        <div>
                          <p className="font-extrabold text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs font-bold text-gray-600">{s.profile?.employeeId || '—'}</td>
                    <td className="py-3 capitalize text-gray-600">{s.role}</td>
                    <td className="py-3 capitalize text-gray-600">{s.profile?.department || 'General'}</td>
                    <td className="py-3 font-bold text-gray-900">{s.profile?.baseSalary ? money(s.profile.baseSalary) : '—'}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="overflow-hidden rounded-3xl bg-white shadow-sm">
          {selected ? (
            <>
              <div className="h-28 bg-gradient-to-r from-purple-300 via-orange-100 to-emerald-100" />
              <div className="-mt-12 px-6 pb-6 text-center">
                <Avatar name={selected.name} className="mx-auto h-24 w-24 border-4 border-white text-2xl" />
                <h3 className="mt-4 text-2xl font-extrabold text-gray-900">{selected.name}</h3>
                <p className="text-sm capitalize text-gray-400">{selected.role}</p>
                <div className="mt-6 space-y-3 text-sm">
                  {[
                    ['Batch ID', selected.profile?.employeeId || '—'],
                    ['Position', selected.role],
                    ['Department', selected.profile?.department || 'General'],
                    ['Joining Date', selected.profile?.hireDate ? new Date(selected.profile.hireDate).toLocaleDateString() : '—'],
                    ['Salary', selected.profile?.baseSalary ? money(selected.profile.baseSalary) : '—'],
                    ['Payroll', isManager ? money(payrollTotal) : 'Restricted'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="text-gray-400">{label}</span>
                      <span className="font-bold capitalize text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-gray-400">No employee selected</div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Roster tab ───────────────────────────────────────────────────────────────

function RosterTab({ refreshKey }) {
  const [staff, setStaff] = useState([]);
  const [teamToday, setTeamToday] = useState([]);

  useEffect(() => {
    Promise.all([fetchStaff(), fetchTeamToday()])
      .then(([s, t]) => { setStaff(s); setTeamToday(t); })
      .catch(() => toast.error('Failed to load roster'));
  }, [refreshKey]);

  const attendanceMap = new Map(teamToday.map((r) => [r.user?._id, r]));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Batch ID</th>
            <th className="px-4 py-3 text-left">Role</th>
            <th className="px-4 py-3 text-left">Department</th>
            <th className="px-4 py-3 text-left">Salary</th>
            <th className="px-4 py-3 text-left">Today</th>
            <th className="px-4 py-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {staff.map((s) => {
            const att = attendanceMap.get(s.id);
            return (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs font-bold text-gray-600">{s.profile?.employeeId || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[s.role]}`}>{s.role}</span>
                </td>
                <td className="px-4 py-3">
                  {s.profile?.department
                    ? <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${DEPT_COLORS[s.profile.department]}`}>{s.profile.department}</span>
                    : <span className="text-xs text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {s.profile?.baseSalary
                    ? `$${s.profile.baseSalary.toLocaleString()} / ${s.profile.salaryType === 'hourly' ? 'hr' : 'mo'}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {att?.clockIn
                    ? `In ${new Date(att.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  {att
                    ? <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[att.status]}`}>{att.status}</span>
                    : <span className="text-xs text-gray-400">{s.isActive ? 'Not in' : 'Inactive'}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Shifts tab ───────────────────────────────────────────────────────────────

function ShiftsTab() {
  const [schedule, setSchedule] = useState({});
  const [weekStart, setWeekStart] = useState('');
  const [staff, setStaff] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', startTime: '09:00', endTime: '17:00', shiftType: 'morning', department: 'floor', assignedTo: [] });

  const load = useCallback(async () => {
    const [sched, staffList] = await Promise.all([
      fetchWeeklySchedule(weekStart ? { weekStart } : {}),
      fetchStaff(),
    ]);
    setSchedule(sched.schedule || {});
    setStaff(staffList);
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await createShift({
        ...form,
        assignedTo: form.assignedTo.map((uid) => ({ user: uid })),
      });
      toast.success('Shift created');
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const days = Object.keys(schedule).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Week of</label>
          <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600">
          + New Shift
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <p className="font-medium text-gray-700 text-sm">Create Shift</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['Date', 'date', 'date'], ['Start', 'startTime', 'time'], ['End', 'endTime', 'time']].map(([label, key, type]) => (
              <div key={key}>
                <label className="text-xs text-gray-500">{label}</label>
                <input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-500">Department</label>
              <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-orange-400">
                {['kitchen','floor','bar','management','cleaning'].map((d) => <option key={d} value={d} className="capitalize">{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Assign Staff</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {staff.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.assignedTo.includes(s.id)}
                    onChange={(e) => setForm({ ...form, assignedTo: e.target.checked ? [...form.assignedTo, s.id] : form.assignedTo.filter((id) => id !== s.id) })} />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 rounded-lg py-1.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="flex-1 bg-orange-500 text-white rounded-lg py-1.5 text-sm hover:bg-orange-600">Create</button>
          </div>
        </form>
      )}

      {days.length === 0 && <p className="text-center text-gray-400 py-8">No shifts this week</p>}

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((day) => (
          <div key={day} className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600">
              {new Date(day).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            {schedule[day].map((shift) => (
              <div key={shift._id} className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-xs">
                <p className="font-medium text-orange-800">{shift.startTime} – {shift.endTime}</p>
                <p className="text-orange-600 capitalize">{shift.department}</p>
                {shift.assignedTo.map((a) => (
                  <p key={a.user?._id} className="text-gray-600">{a.user?.name}</p>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Payroll tab ──────────────────────────────────────────────────────────────

function PayrollTab() {
  const [records, setRecords] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    fetchPayrollList({ month, year }).then(setRecords).catch(() => toast.error('Failed to load payroll'));
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const handleRun = async () => {
    if (!confirm(`Run payroll for ${MONTHS[month - 1]} ${year}?`)) return;
    setRunning(true);
    try {
      const result = await runPayroll({ month, year });
      toast.success(`Payroll run: ${result.succeeded} succeeded, ${result.failed} failed`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payroll run failed');
    } finally {
      setRunning(false);
    }
  };

  const handleApprove = async (id) => {
    try { await approvePayroll(id); toast.success('Approved'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handlePaid = async (id) => {
    if (!confirm('Mark as paid?')) return;
    try { await markPayrollPaid(id); toast.success('Marked as paid'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const totalNetPay = records.reduce((s, r) => s + (r.netPay || 0), 0);
  const paidCount = records.filter((r) => r.status === 'paid').length;
  const approvedCount = records.filter((r) => r.status === 'approved').length;
  const draftCount = records.filter((r) => r.status === 'draft').length;
  const onTimeRate = records.length ? Math.round(((paidCount + approvedCount) / records.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-gray-900">Payroll Management</h2>
        <div className="flex items-center gap-3">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-600 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} min="2020" max="2099"
            className="w-24 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-600 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100" />
          <button onClick={handleRun} disabled={running}
            className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 hover:bg-orange-600 disabled:opacity-50">
            {running ? 'Running...' : 'Run Payroll'}
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-4">
        <StatCard label="Total Payroll Processed" value={money(totalNetPay)} tone="purple" icon="$" helper="Total salary paid within the selected period." />
        <StatCard label="Payroll On Time Rate" value={`${onTimeRate}%`} tone="blue" icon="◷" helper="Payrolls approved or paid without delay." />
        <StatCard label="Payslips Issued" value={paidCount + approvedCount} tone="green" icon="▤" helper="Payslips generated and sent to employees." />
        <StatCard label="Pending Records" value={draftCount} tone="red" icon="!" helper="Records still waiting for approval." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-xl font-extrabold text-gray-900">Payroll Records</h3>
            <p className="text-sm text-gray-400">Approve drafts and mark approved payroll as paid.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="border-b border-gray-100 text-xs text-gray-400">
                <tr>
                  <th className="py-3 text-left">Employee</th>
                  <th className="py-3 text-right">Days</th>
                  <th className="py-3 text-right">Hours</th>
                  <th className="py-3 text-right">Base</th>
                  <th className="py-3 text-right">OT</th>
                  <th className="py-3 text-right">Deductions</th>
                  <th className="py-3 text-right">Net Pay</th>
                  <th className="py-3 text-left">Status</th>
                  <th className="py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr><td colSpan={9} className="py-12 text-center text-gray-400">No payroll records. Click "Run Payroll" to generate.</td></tr>
                )}
                {records.map((r) => (
                  <tr key={r._id} className="border-b border-gray-50 hover:bg-orange-50/40">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.user?.name} />
                        <div>
                          <p className="font-extrabold text-gray-900">{r.user?.name}</p>
                          <p className="text-xs capitalize text-gray-400">{r.user?.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-right text-xs text-gray-600">
                      <span className="text-emerald-600">{r.presentDays}P</span> / <span className="text-red-500">{r.absentDays}A</span>
                    </td>
                    <td className="py-3 text-right text-xs text-gray-600">
                      {r.totalNetHours}h
                      {r.totalOvertimeHours > 0 && <span className="text-orange-500"> +{r.totalOvertimeHours}OT</span>}
                    </td>
                    <td className="py-3 text-right text-gray-700">${r.basePay?.toFixed(2)}</td>
                    <td className="py-3 text-right text-orange-600">${r.overtimePay?.toFixed(2)}</td>
                    <td className="py-3 text-right text-red-500">-${r.totalDeductions?.toFixed(2)}</td>
                    <td className="py-3 text-right font-extrabold text-gray-900">${r.netPay?.toFixed(2)}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${PAYROLL_STATUS[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        {r.status === 'draft' && (
                          <button onClick={() => handleApprove(r._id)}
                            className="rounded-xl bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-200">Approve</button>
                        )}
                        {r.status === 'approved' && (
                          <button onClick={() => handlePaid(r._id)}
                            className="rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-200">Mark Paid</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-lg font-extrabold text-gray-900">Payroll Expenses Breakdown</h3>
          <p className="mt-1 text-sm text-gray-400">Current selected month</p>
          <div className="mt-8 flex h-72 items-end justify-between gap-3 border-b border-gray-100 pb-4">
            {MONTHS.slice(0, 10).map((m, idx) => (
              <div key={m} className="flex flex-1 flex-col items-center gap-3">
                <div
                  className={`w-full max-w-8 rounded-full ${idx + 1 === month ? 'bg-gradient-to-t from-purple-500 to-purple-200' : 'bg-[repeating-linear-gradient(135deg,#d1d5db_0,#d1d5db_2px,transparent_2px,transparent_7px)]'}`}
                  style={{ height: `${idx + 1 === month ? 84 : 35 + ((idx * 13) % 45)}%` }}
                />
                <span className="text-xs font-semibold text-gray-400">{m}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Total Payroll Amount</span><span className="font-extrabold text-purple-600">{money(totalNetPay)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Highest Paid Department</span><span className="font-extrabold text-purple-600">Sales</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Lowest Paid Department</span><span className="font-extrabold text-purple-600">HR</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CreateStaffModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'waiter',
    department: 'floor',
    salaryType: 'monthly',
    baseSalary: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createStaff({
        ...form,
        baseSalary: Number(form.baseSalary || 0),
      });
      toast.success('Staff user created');
      onCreated();
      onClose();
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Could not create staff user';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">Create Staff User</h2>
            <p className="mt-1 text-sm text-gray-400">Add a login for your own restaurant team.</p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-gray-400">Full name</label>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-gray-400">Email</label>
            <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-gray-400">Temporary password</label>
            <input required type="password" minLength={6} value={form.password} onChange={(e) => set('password', e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-gray-400">Phone</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-gray-400">Role</label>
            <select value={form.role} onChange={(e) => set('role', e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm capitalize outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100">
              {['waiter', 'cashier', 'chef', 'manager', 'admin'].map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-gray-400">Department</label>
            <select value={form.department} onChange={(e) => set('department', e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm capitalize outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100">
              {['floor', 'kitchen', 'bar', 'management', 'cleaning'].map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-gray-400">Salary type</label>
            <select value={form.salaryType} onChange={(e) => set('salaryType', e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm capitalize outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100">
              <option value="monthly">monthly</option>
              <option value="hourly">hourly</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-gray-400">Base salary</label>
            <input type="number" min="0" step="0.01" value={form.baseSalary} onChange={(e) => set('baseSalary', e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100" />
          </div>
          <div className="md:col-span-2 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3">
            <p className="text-xs font-bold uppercase text-orange-500">Batch ID</p>
            <p className="mt-1 text-sm font-semibold text-gray-700">Generated automatically as STF-YYYY-0001</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button disabled={loading} className="rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 hover:bg-orange-600 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const user = useAuthStore((s) => s.user);
  const isManager = ['admin', 'manager'].includes(user?.role);
  const isAdmin = user?.role === 'admin';
  const requestedTab = searchParams.get('tab') || 'dashboard';
  const tab = !isManager && requestedTab === 'payroll' ? 'dashboard' : requestedTab;
  const setTab = (key) => setSearchParams({ tab: key });

  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'roster', label: 'Employees' },
    { key: 'shifts', label: 'Attendance & Shifts' },
    ...(isManager ? [{ key: 'payroll', label: 'Payroll' }] : []),
  ];

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] bg-[#f7f7f7] p-4 lg:-m-6 lg:p-6">
      <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">Payroll management</p>
          <h1 className="mt-1 text-3xl font-extrabold text-gray-900">
            {tab === 'payroll' ? 'Report and Analytics' : tab === 'roster' ? 'Our Employees' : tab === 'shifts' ? 'Attendance and Calendar' : 'Staff Dashboard'}
          </h1>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-orange-400">⌕</span>
            <input
              type="text"
              placeholder="Search now"
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white pl-12 pr-4 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100 sm:w-80"
              readOnly
            />
          </label>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 hover:bg-orange-600"
            >
              Create User
            </button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <ClockWidget />
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-2xl px-5 py-3 text-sm font-bold transition ${tab === t.key ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-white text-gray-500 hover:bg-orange-50 hover:text-orange-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <StaffDashboard isManager={isManager} refreshKey={refreshKey} />}
      {tab === 'roster'  && <RosterTab refreshKey={refreshKey} />}
      {tab === 'shifts'  && <ShiftsTab />}
      {tab === 'payroll' && isManager && <PayrollTab />}
      {showCreate && (
        <CreateStaffModal
          onClose={() => setShowCreate(false)}
          onCreated={() => setRefreshKey((key) => key + 1)}
        />
      )}
    </div>
  );
}
