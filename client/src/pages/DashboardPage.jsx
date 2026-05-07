import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, FunnelChart, Funnel, LabelList,
} from 'recharts';
import {
  fetchSnapshot, fetchRevenueTrend, fetchTopItems,
  fetchHourlyDistribution, fetchProfitAnalysis,
  fetchStaffPerformance, fetchPaymentMethods,
} from '../api/analytics.api.js';
import useAuthStore from '../store/authStore.js';

// ─── Palette ──────────────────────────────────────────────────────────────────

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];
const CATEGORY_COLORS = { appetizer: '#f59e0b', main: '#f97316', dessert: '#ec4899', beverage: '#3b82f6', special: '#8b5cf6', unknown: '#9ca3af' };

// ─── Shared components ────────────────────────────────────────────────────────

const Card = ({ title, children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
    {title && <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">{title}</h3>}
    {children}
  </div>
);

const Skeleton = ({ h = 'h-40' }) => (
  <div className={`${h} bg-gray-100 rounded-xl animate-pulse`} />
);

const Delta = ({ value }) => {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  return (
    <span className={`text-xs font-medium ml-1 ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(value)}%
    </span>
  );
};

const fmt = (n) => n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—';

// ─── KPI Cards ────────────────────────────────────────────────────────────────

function KPICards({ overview }) {
  if (!overview) return <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">{Array(5).fill(0).map((_, i) => <Skeleton key={i} h="h-24" />)}</div>;

  const cards = [
    { label: "Today's Revenue", value: `$${fmt(overview.todayRevenue)}`, sub: `${overview.todayOrders} orders`, color: 'bg-orange-500' },
    { label: 'Month Revenue', value: `$${fmt(overview.monthRevenue)}`, sub: `${overview.monthOrders} orders`, color: 'bg-purple-500' },
    { label: 'Active Orders', value: overview.activeOrders, sub: 'right now', color: 'bg-blue-500' },
    { label: 'Inventory Value', value: `$${fmt(overview.inventoryValue)}`, sub: `${overview.lowStockCount} low stock`, color: overview.lowStockCount > 0 ? 'bg-red-500' : 'bg-green-500' },
    { label: 'Payroll This Month', value: `$${fmt(overview.payrollCost)}`, sub: `${overview.staffCount} staff`, color: 'bg-teal-500' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div key={c.label} className={`${c.color} rounded-2xl p-4 text-white`}>
          <p className="text-xs opacity-80 font-medium">{c.label}</p>
          <p className="text-2xl font-bold mt-1 leading-tight">{c.value}</p>
          <p className="text-xs opacity-70 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Revenue Trend ────────────────────────────────────────────────────────────

function RevenueTrendChart() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(14);

  useEffect(() => {
    fetchRevenueTrend(days).then(setData).catch(() => toast.error('Failed to load trend'));
  }, [days]);

  return (
    <Card title="Revenue Trend" className="col-span-2">
      <div className="flex justify-end gap-2 mb-3">
        {[7, 14, 30].map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${days === d ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
            {d}d
          </button>
        ))}
      </div>
      {!data ? <Skeleton h="h-52" /> : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={55} />
            <Tooltip formatter={(v) => [`$${fmt(v)}`, 'Revenue']} labelStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ─── Top Items ────────────────────────────────────────────────────────────────

function TopItemsChart() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchTopItems({ limit: 8 }).then(setData).catch(() => {});
  }, []);

  return (
    <Card title="Top Selling Items">
      {!data ? <Skeleton h="h-52" /> : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
            <Tooltip formatter={(v, n) => [v, n === 'totalQty' ? 'Qty Sold' : 'Revenue']} />
            <Bar dataKey="totalQty" fill="#f97316" radius={[0, 4, 4, 0]} name="Qty Sold" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ─── Sales by Category (Pie) ──────────────────────────────────────────────────

function CategoryPieChart({ data }) {
  if (!data) return <Card title="Sales by Category"><Skeleton h="h-52" /></Card>;

  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    return (
      <text x={cx + r * Math.cos(-midAngle * RADIAN)} y={cy + r * Math.sin(-midAngle * RADIAN)}
        fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <Card title="Sales by Category">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="revenue" nameKey="category" cx="50%" cy="50%"
            outerRadius={90} labelLine={false} label={renderLabel}>
            {data.map((entry) => (
              <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || COLORS[0]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => [`$${fmt(v)}`, 'Revenue']} />
          <Legend formatter={(v) => <span className="text-xs capitalize">{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ─── Hourly Distribution ──────────────────────────────────────────────────────

function HourlyChart() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchHourlyDistribution(7).then(setData).catch(() => {});
  }, []);

  return (
    <Card title="Peak Hours (Last 7 Days)">
      {!data ? <Skeleton h="h-44" /> : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="orders" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Orders" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ─── Payment Methods ──────────────────────────────────────────────────────────

function PaymentMethodChart() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchPaymentMethods().then(setData).catch(() => {});
  }, []);

  return (
    <Card title="Payment Methods">
      {!data ? <Skeleton h="h-44" /> : (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="method" cx="50%" cy="50%"
              innerRadius={45} outerRadius={75}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [v, n]} />
            <Legend formatter={(v) => <span className="text-xs capitalize">{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ─── Profit vs Cost ───────────────────────────────────────────────────────────

function ProfitChart() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchProfitAnalysis().then(setData).catch(() => {});
  }, []);

  return (
    <Card title="Revenue vs Cost by Category" className="col-span-2">
      {!data ? <Skeleton h="h-52" /> : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} width={55} />
            <Tooltip formatter={(v) => `$${fmt(v)}`} />
            <Legend />
            <Bar dataKey="revenue" fill="#f97316" name="Revenue" radius={[3, 3, 0, 0]} />
            <Bar dataKey="cost" fill="#ef4444" name="Ingredient Cost" radius={[3, 3, 0, 0]} />
            <Bar dataKey="grossProfit" fill="#10b981" name="Gross Profit" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ─── Order Funnel ─────────────────────────────────────────────────────────────

function OrderFunnelChart({ data }) {
  if (!data) return <Card title="Order Status"><Skeleton h="h-44" /></Card>;

  const STATUS_COLORS_MAP = {
    pending: '#f59e0b', confirmed: '#3b82f6', preparing: '#f97316',
    ready: '#8b5cf6', served: '#06b6d4', paid: '#10b981', cancelled: '#ef4444',
  };

  return (
    <Card title="Order Status This Month">
      <div className="space-y-2">
        {data.filter((d) => d.count > 0).map((d) => {
          const max = Math.max(...data.map((x) => x.count), 1);
          return (
            <div key={d.status} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 capitalize w-20 shrink-0">{d.status}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(d.count / max) * 100}%`, backgroundColor: STATUS_COLORS_MAP[d.status] }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-700 w-8 text-right">{d.count}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Low Stock Alert ──────────────────────────────────────────────────────────

function LowStockAlert({ items }) {
  if (!items?.length) return null;
  return (
    <Card title={`⚠ Low Stock Alerts (${items.length})`} className="border-red-200 bg-red-50">
      <div className="space-y-1.5">
        {items.slice(0, 6).map((item) => (
          <div key={item._id} className="flex items-center justify-between text-sm">
            <span className="text-gray-700 font-medium">{item.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-red-600 font-semibold">{item.quantity} {item.unit}</span>
              <span className="text-xs text-gray-400">/ {item.threshold} threshold</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Staff Performance Table ──────────────────────────────────────────────────

function StaffPerformanceTable() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchStaffPerformance().then(setData).catch(() => {});
  }, []);

  if (!data) return <Card title="Staff Performance"><Skeleton h="h-44" /></Card>;

  return (
    <Card title={`Staff Performance — ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`} className="col-span-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left py-2">Name</th>
              <th className="text-left py-2">Role</th>
              <th className="text-right py-2">Present</th>
              <th className="text-right py-2">Absent</th>
              <th className="text-right py-2">Late</th>
              <th className="text-right py-2">Hours</th>
              <th className="text-right py-2">OT Hrs</th>
              <th className="text-right py-2">Net Pay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.staff.map((s) => (
              <tr key={s.userId} className="hover:bg-gray-50">
                <td className="py-2 font-medium text-gray-800">{s.name}</td>
                <td className="py-2 text-gray-500 capitalize text-xs">{s.role}</td>
                <td className="py-2 text-right text-green-600">{s.presentDays}</td>
                <td className="py-2 text-right text-red-500">{s.absentDays}</td>
                <td className="py-2 text-right text-yellow-600">{s.lateDays}</td>
                <td className="py-2 text-right text-gray-700">{s.totalNetHours}h</td>
                <td className="py-2 text-right text-orange-500">{s.totalOvertimeHours}h</td>
                <td className="py-2 text-right font-semibold text-gray-800">
                  {s.netPay !== null ? `$${fmt(s.netPay)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200">
            <tr>
              <td colSpan={7} className="py-2 text-sm font-semibold text-gray-700">Total Payroll</td>
              <td className="py-2 text-right font-bold text-gray-900">${fmt(data.totalPayrollCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

// ─── Date range picker ────────────────────────────────────────────────────────

function PeriodSelector({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {['today', 'week', 'month'].map((p) => (
        <button key={p} onClick={() => onChange(p)}
          className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors ${value === p ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
          {p}
        </button>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [staffData, setStaffData] = useState(null);
  const [payrollData, setPayrollData] = useState(null);
  const user = useAuthStore((s) => s.user);
  const isManager = ['admin', 'manager'].includes(user?.role);

  const load = useCallback(async () => {
    try {
      if (isManager) {
        const [snap, staff, payroll] = await Promise.all([
          fetchSnapshot(),
          fetchStaffPerformance(),
          // payroll cost from staff performance endpoint
          Promise.resolve(null),
        ]);
        setSnapshot(snap);
        setStaffData(staff);
      }
    } catch (err) {
      // Non-managers get a 403 — show basic view
      if (err.response?.status !== 403) toast.error('Failed to load analytics');
    }
  }, [isManager]);

  useEffect(() => { load(); }, [load]);

  // Non-manager: simple view
  if (!isManager) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
        <p className="text-gray-500 text-sm">Analytics are available to managers and admins.</p>
      </div>
    );
  }

  const overview = snapshot ? {
    todayRevenue: snapshot.overview?.todayRevenue,
    todayOrders: snapshot.overview?.todayOrders,
    monthRevenue: snapshot.overview?.monthRevenue,
    monthOrders: snapshot.overview?.monthOrders,
    activeOrders: snapshot.overview?.activeOrders,
    inventoryValue: snapshot.inventory?.totalValue,
    lowStockCount: snapshot.inventory?.lowStockCount,
    payrollCost: staffData?.totalPayrollCost,
    staffCount: staffData?.staff?.length,
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Analytics Dashboard</h2>
        <button onClick={load} className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
          ↻ Refresh
        </button>
      </div>

      {/* KPI row */}
      <KPICards overview={overview} />

      {/* Low stock alert — only if items exist */}
      {snapshot?.inventory?.lowStockCount > 0 && (
        <LowStockAlert items={[]} />
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RevenueTrendChart />
        <TopItemsChart />
        <CategoryPieChart data={snapshot?.salesByCategory} />
        <PaymentMethodChart />
        <HourlyChart />
        <OrderFunnelChart data={snapshot?.orderFunnel} />
        <ProfitChart />
        <StaffPerformanceTable />
      </div>
    </div>
  );
}
