import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import useAuthStore from '../store/authStore.js';
import {
  fetchStaff, fetchTeamToday, fetchWeeklySchedule,
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
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
      <div className="flex-1">
        <p className="text-xs text-gray-500 font-medium">MY ATTENDANCE TODAY</p>
        <p className="text-sm font-semibold text-gray-800 mt-0.5">
          {today?.clockIn
            ? `In: ${new Date(today.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Not clocked in'}
          {today?.clockOut && ` · Out: ${new Date(today.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </p>
        {today?.netHours > 0 && (
          <p className="text-xs text-gray-400">{today.netHours}h worked · {today.overtimeHours}h OT</p>
        )}
      </div>
      <div className="flex gap-2">
        {!isClockedIn && !today?.clockOut && (
          <button onClick={() => act(clockIn, 'Clocked in')} disabled={loading}
            className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 disabled:opacity-50">
            Clock In
          </button>
        )}
        {isClockedIn && !onBreak && (
          <button onClick={() => act(startBreak, 'Break started')} disabled={loading}
            className="text-xs bg-yellow-500 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-600 disabled:opacity-50">
            Break
          </button>
        )}
        {isClockedIn && onBreak && (
          <button onClick={() => act(endBreak, 'Break ended')} disabled={loading}
            className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50">
            End Break
          </button>
        )}
        {isClockedIn && (
          <button onClick={() => act(clockOut, 'Clocked out')} disabled={loading}
            className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50">
            Clock Out
          </button>
        )}
        {today?.clockOut && (
          <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium">✓ Done</span>
        )}
      </div>
    </div>
  );
}

// ─── Roster tab ───────────────────────────────────────────────────────────────

function RosterTab() {
  const [staff, setStaff] = useState([]);
  const [teamToday, setTeamToday] = useState([]);

  useEffect(() => {
    Promise.all([fetchStaff(), fetchTeamToday()])
      .then(([s, t]) => { setStaff(s); setTeamToday(t); })
      .catch(() => toast.error('Failed to load roster'));
  }, []);

  const attendanceMap = new Map(teamToday.map((r) => [r.user?._id, r]));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Name</th>
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
                  {s.profile?.employeeId && <p className="text-xs text-gray-400">{s.profile.employeeId}</p>}
                </td>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} min="2020" max="2099"
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div className="flex items-center gap-3">
          {records.length > 0 && (
            <span className="text-sm font-semibold text-gray-700">
              Total: <span className="text-orange-600">${totalNetPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </span>
          )}
          <button onClick={handleRun} disabled={running}
            className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-50">
            {running ? 'Running...' : '▶ Run Payroll'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Staff</th>
              <th className="px-4 py-3 text-right">Days</th>
              <th className="px-4 py-3 text-right">Hours</th>
              <th className="px-4 py-3 text-right">Base</th>
              <th className="px-4 py-3 text-right">OT</th>
              <th className="px-4 py-3 text-right">Deductions</th>
              <th className="px-4 py-3 text-right">Net Pay</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No payroll records. Click "Run Payroll" to generate.</td></tr>
            )}
            {records.map((r) => (
              <tr key={r._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{r.user?.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{r.user?.role}</p>
                </td>
                <td className="px-4 py-3 text-right text-gray-600 text-xs">
                  <span className="text-green-600">{r.presentDays}P</span> / <span className="text-red-500">{r.absentDays}A</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-600 text-xs">
                  {r.totalNetHours}h
                  {r.totalOvertimeHours > 0 && <span className="text-orange-500"> +{r.totalOvertimeHours}OT</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">${r.basePay?.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-orange-600">${r.overtimePay?.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-red-500">−${r.totalDeductions?.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">${r.netPay?.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${PAYROLL_STATUS[r.status]}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {r.status === 'draft' && (
                      <button onClick={() => handleApprove(r._id)}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200">Approve</button>
                    )}
                    {r.status === 'approved' && (
                      <button onClick={() => handlePaid(r._id)}
                        className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200">Mark Paid</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const [tab, setTab] = useState('roster');
  const user = useAuthStore((s) => s.user);
  const isManager = ['admin', 'manager'].includes(user?.role);

  const tabs = [
    { key: 'roster', label: '👥 Roster' },
    { key: 'shifts', label: '📅 Shifts', managerOnly: false },
    ...(isManager ? [{ key: 'payroll', label: '💰 Payroll' }] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Staff</h2>
      </div>

      {/* Clock widget — visible to all */}
      <ClockWidget />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'roster'  && <RosterTab />}
      {tab === 'shifts'  && <ShiftsTab />}
      {tab === 'payroll' && isManager && <PayrollTab />}
    </div>
  );
}
