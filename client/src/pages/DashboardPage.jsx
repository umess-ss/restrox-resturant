import { useEffect, useState } from 'react';
import { fetchOrders } from '../api/orders.api.js';
import { fetchTables } from '../api/tables.api.js';
import { fetchMenuItems } from '../api/menu.api.js';

const StatCard = ({ label, value, color }) => (
  <div className={`rounded-xl p-5 text-white ${color}`}>
    <p className="text-sm opacity-80">{label}</p>
    <p className="text-3xl font-bold mt-1">{value}</p>
  </div>
);

export default function DashboardPage() {
  const [stats, setStats] = useState({ orders: 0, tables: 0, menuItems: 0, revenue: 0 });

  useEffect(() => {
    Promise.all([fetchOrders(), fetchTables(), fetchMenuItems()]).then(([orders, tables, menu]) => {
      const revenue = orders
        .filter((o) => o.paymentStatus === 'paid')
        .reduce((s, o) => s + o.totalAmount, 0);
      setStats({ orders: orders.length, tables: tables.length, menuItems: menu.length, revenue });
    });
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Orders" value={stats.orders} color="bg-orange-500" />
        <StatCard label="Tables" value={stats.tables} color="bg-blue-500" />
        <StatCard label="Menu Items" value={stats.menuItems} color="bg-green-500" />
        <StatCard label="Revenue" value={`$${stats.revenue.toFixed(2)}`} color="bg-purple-500" />
      </div>
    </div>
  );
}
