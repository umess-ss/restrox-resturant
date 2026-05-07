import mongoose from 'mongoose';
import Order from '../orders/order.model.js';
import Ingredient from '../inventory/ingredient.model.js';
import Attendance from '../staff/attendance.model.js';
import Payroll from '../staff/payroll.model.js';
import Recipe from '../inventory/recipe.model.js';
import MenuItem from '../menu/menu.model.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const startOf = (unit, ref = new Date()) => {
  const d = new Date(ref);
  if (unit === 'day')   { d.setHours(0, 0, 0, 0); return d; }
  if (unit === 'week')  { d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0, 0, 0, 0); return d; }
  if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
  if (unit === 'year')  { d.setMonth(0, 1); d.setHours(0, 0, 0, 0); return d; }
};

const paidFilter = (from, to) => ({
  paymentStatus: 'paid',
  paidAt: { $gte: from, $lte: to },
});

const pctChange = (current, previous) =>
  previous === 0 ? null : +((((current - previous) / previous) * 100).toFixed(1));

// ─── 1. Sales Overview ────────────────────────────────────────────────────────

/**
 * GET /api/analytics/overview
 * KPI cards: revenue, orders, avg order value — today / week / month
 * with % change vs prior period.
 */
export const salesOverview = async (req, res) => {
  const now = new Date();

  const periods = {
    today:     { from: startOf('day', now),   to: now },
    yesterday: { from: startOf('day', new Date(now - 86400000)), to: new Date(startOf('day', now) - 1) },
    week:      { from: startOf('week', now),  to: now },
    lastWeek:  { from: startOf('week', new Date(now - 7 * 86400000)), to: new Date(startOf('week', now) - 1) },
    month:     { from: startOf('month', now), to: now },
    lastMonth: { from: startOf('month', new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: new Date(startOf('month', now) - 1) },
  };

  const aggregate = async (from, to) => {
    const [result] = await Order.aggregate([
      { $match: paidFilter(from, to) },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 }, avgOrder: { $avg: '$totalAmount' } } },
    ]);
    return result || { revenue: 0, orders: 0, avgOrder: 0 };
  };

  const [today, yesterday, week, lastWeek, month, lastMonth] = await Promise.all([
    aggregate(periods.today.from, periods.today.to),
    aggregate(periods.yesterday.from, periods.yesterday.to),
    aggregate(periods.week.from, periods.week.to),
    aggregate(periods.lastWeek.from, periods.lastWeek.to),
    aggregate(periods.month.from, periods.month.to),
    aggregate(periods.lastMonth.from, periods.lastMonth.to),
  ]);

  // Active orders right now
  const activeOrders = await Order.countDocuments({
    status: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'served'] },
  });

  res.json({
    today: {
      revenue: +today.revenue.toFixed(2),
      orders: today.orders,
      avgOrder: +today.avgOrder.toFixed(2),
      revenueChange: pctChange(today.revenue, yesterday.revenue),
      ordersChange: pctChange(today.orders, yesterday.orders),
    },
    week: {
      revenue: +week.revenue.toFixed(2),
      orders: week.orders,
      avgOrder: +week.avgOrder.toFixed(2),
      revenueChange: pctChange(week.revenue, lastWeek.revenue),
    },
    month: {
      revenue: +month.revenue.toFixed(2),
      orders: month.orders,
      avgOrder: +month.avgOrder.toFixed(2),
      revenueChange: pctChange(month.revenue, lastMonth.revenue),
    },
    activeOrders,
  });
};

// ─── 2. Revenue Trend ─────────────────────────────────────────────────────────

/**
 * GET /api/analytics/revenue-trend?days=30
 * Daily revenue for the last N days — for line chart.
 */
export const revenueTrend = async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);

  const data = await Order.aggregate([
    { $match: paidFilter(from, new Date()) },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
        avgOrder: { $avg: '$totalAmount' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id',
        revenue: { $round: ['$revenue', 2] },
        orders: 1,
        avgOrder: { $round: ['$avgOrder', 2] },
      },
    },
  ]);

  // Fill in missing days with 0
  const map = new Map(data.map((d) => [d.date, d]));
  const filled = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    filled.push(map.get(key) || { date: key, revenue: 0, orders: 0, avgOrder: 0 });
  }

  res.json(filled);
};

// ─── 3. Top-Selling Items ─────────────────────────────────────────────────────

/**
 * GET /api/analytics/top-items?limit=10&from=&to=
 */
export const topSellingItems = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const from = req.query.from ? new Date(req.query.from) : startOf('month');
  const to = req.query.to ? new Date(req.query.to) : new Date();

  const data = await Order.aggregate([
    { $match: paidFilter(from, to) },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.menuItem',
        name: { $first: '$items.name' },
        totalQty: { $sum: '$items.quantity' },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { totalQty: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'menuitems',
        localField: '_id',
        foreignField: '_id',
        as: 'menuItem',
      },
    },
    { $unwind: { path: '$menuItem', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        menuItemId: '$_id',
        name: 1,
        category: '$menuItem.category',
        totalQty: 1,
        totalRevenue: { $round: ['$totalRevenue', 2] },
        orderCount: 1,
        avgPrice: { $round: [{ $divide: ['$totalRevenue', '$totalQty'] }, 2] },
      },
    },
  ]);

  res.json(data);
};

// ─── 4. Sales by Category ─────────────────────────────────────────────────────

/**
 * GET /api/analytics/sales-by-category?from=&to=
 */
export const salesByCategory = async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : startOf('month');
  const to = req.query.to ? new Date(req.query.to) : new Date();

  const data = await Order.aggregate([
    { $match: paidFilter(from, to) },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'menuitems',
        localField: 'items.menuItem',
        foreignField: '_id',
        as: 'mi',
      },
    },
    { $unwind: { path: '$mi', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ['$mi.category', 'unknown'] },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        qty: { $sum: '$items.quantity' },
        orders: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        revenue: { $round: ['$revenue', 2] },
        qty: 1,
        orders: 1,
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  res.json(data);
};

// ─── 5. Hourly Distribution ───────────────────────────────────────────────────

/**
 * GET /api/analytics/hourly?days=7
 * Average orders per hour of day — for peak hours bar chart.
 */
export const hourlyDistribution = async (req, res) => {
  const days = Number(req.query.days) || 7;
  const from = new Date();
  from.setDate(from.getDate() - days);

  const data = await Order.aggregate([
    { $match: { createdAt: { $gte: from }, status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: { $hour: '$createdAt' },
        orders: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        hour: '$_id',
        label: {
          $concat: [
            { $toString: '$_id' },
            ':00',
          ],
        },
        orders: 1,
        revenue: { $round: ['$revenue', 2] },
      },
    },
  ]);

  // Fill all 24 hours
  const map = new Map(data.map((d) => [d.hour, d]));
  const filled = Array.from({ length: 24 }, (_, h) =>
    map.get(h) || { hour: h, label: `${h}:00`, orders: 0, revenue: 0 }
  );

  res.json(filled);
};

// ─── 6. Payment Method Breakdown ─────────────────────────────────────────────

/**
 * GET /api/analytics/payment-methods?from=&to=
 */
export const paymentMethods = async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : startOf('month');
  const to = req.query.to ? new Date(req.query.to) : new Date();

  const data = await Order.aggregate([
    { $match: { ...paidFilter(from, to), paymentMethod: { $exists: true } } },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
      },
    },
    {
      $project: {
        _id: 0,
        method: '$_id',
        count: 1,
        revenue: { $round: ['$revenue', 2] },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  res.json(data);
};

// ─── 7. Inventory Summary ─────────────────────────────────────────────────────

/**
 * GET /api/analytics/inventory
 * Low-stock items + total valuation + top-value ingredients.
 */
export const inventorySummary = async (req, res) => {
  const [valuationData, lowStock] = await Promise.all([
    Ingredient.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$quantity', '$costPerUnit'] } },
          totalItems: { $sum: 1 },
          lowStockCount: {
            $sum: { $cond: [{ $lte: ['$quantity', '$threshold'] }, 1, 0] },
          },
        },
      },
    ]),
    Ingredient.find({ isActive: true })
      .then((items) => items.filter((i) => i.quantity <= i.threshold).slice(0, 10)),
  ]);

  const topValue = await Ingredient.aggregate([
    { $match: { isActive: true } },
    {
      $project: {
        name: 1,
        unit: 1,
        quantity: 1,
        costPerUnit: 1,
        totalValue: { $multiply: ['$quantity', '$costPerUnit'] },
        isLowStock: { $lte: ['$quantity', '$threshold'] },
      },
    },
    { $sort: { totalValue: -1 } },
    { $limit: 8 },
  ]);

  const summary = valuationData[0] || { totalValue: 0, totalItems: 0, lowStockCount: 0 };

  res.json({
    totalValue: +summary.totalValue.toFixed(2),
    totalItems: summary.totalItems,
    lowStockCount: summary.lowStockCount,
    lowStockItems: lowStock.map((i) => ({
      _id: i._id,
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      threshold: i.threshold,
      deficit: +(i.threshold - i.quantity).toFixed(3),
    })),
    topValueItems: topValue,
  });
};

// ─── 8. Profit vs Cost by Category ───────────────────────────────────────────

/**
 * GET /api/analytics/profit-analysis?from=&to=
 * Revenue vs estimated ingredient cost per category.
 */
export const profitAnalysis = async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : startOf('month');
  const to = req.query.to ? new Date(req.query.to) : new Date();

  // Revenue per menu item from paid orders
  const revenueByItem = await Order.aggregate([
    { $match: paidFilter(from, to) },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.menuItem',
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        totalQty: { $sum: '$items.quantity' },
      },
    },
  ]);

  const itemIds = revenueByItem.map((r) => r._id);

  // Ingredient cost per menu item via recipes
  const recipes = await Recipe.find({ menuItem: { $in: itemIds }, isActive: true })
    .populate('ingredients.ingredient', 'costPerUnit')
    .lean();

  const costMap = new Map();
  for (const recipe of recipes) {
    const cost = recipe.ingredients.reduce(
      (s, i) => s + (i.ingredient?.costPerUnit || 0) * i.quantity,
      0
    );
    costMap.set(recipe.menuItem.toString(), cost);
  }

  // Attach category from menu items
  const menuItems = await MenuItem.find({ _id: { $in: itemIds } }).lean();
  const categoryMap = new Map(menuItems.map((m) => [m._id.toString(), m.category]));

  // Aggregate by category
  const byCategory = {};
  for (const item of revenueByItem) {
    const id = item._id.toString();
    const category = categoryMap.get(id) || 'unknown';
    const costPerServing = costMap.get(id) || 0;
    const totalCost = costPerServing * item.totalQty;

    if (!byCategory[category]) byCategory[category] = { revenue: 0, cost: 0, qty: 0 };
    byCategory[category].revenue += item.revenue;
    byCategory[category].cost += totalCost;
    byCategory[category].qty += item.totalQty;
  }

  const result = Object.entries(byCategory).map(([category, d]) => ({
    category,
    revenue: +d.revenue.toFixed(2),
    cost: +d.cost.toFixed(2),
    grossProfit: +(d.revenue - d.cost).toFixed(2),
    marginPct: d.revenue > 0 ? +((((d.revenue - d.cost) / d.revenue) * 100).toFixed(1)) : 0,
    qty: d.qty,
  }));

  result.sort((a, b) => b.revenue - a.revenue);
  res.json(result);
};

// ─── 9. Staff Performance ─────────────────────────────────────────────────────

/**
 * GET /api/analytics/staff-performance?month=&year=
 * Attendance rate, hours, payroll cost per staff member.
 */
export const staffPerformance = async (req, res) => {
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);

  const [attendanceData, payrollData] = await Promise.all([
    Attendance.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$user',
          presentDays: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
          absentDays: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          lateDays: { $sum: { $cond: ['$isLate', 1, 0] } },
          totalNetHours: { $sum: '$netHours' },
          totalOvertimeHours: { $sum: '$overtimeHours' },
        },
      },
      {
        $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          name: '$user.name',
          role: '$user.role',
          presentDays: 1,
          absentDays: 1,
          lateDays: 1,
          totalNetHours: { $round: ['$totalNetHours', 1] },
          totalOvertimeHours: { $round: ['$totalOvertimeHours', 1] },
        },
      },
    ]),
    Payroll.find({ month, year }).populate('user', 'name role').lean(),
  ]);

  const payrollMap = new Map(payrollData.map((p) => [p.user?._id?.toString(), p]));

  const merged = attendanceData.map((a) => {
    const payroll = payrollMap.get(a.userId.toString());
    return {
      ...a,
      netPay: payroll?.netPay || null,
      grossPay: payroll?.grossPay || null,
      payrollStatus: payroll?.status || null,
    };
  });

  // Summary totals
  const totalPayrollCost = payrollData.reduce((s, p) => s + (p.netPay || 0), 0);
  const avgAttendanceRate = merged.length
    ? +(merged.reduce((s, m) => s + (m.presentDays / Math.max(m.presentDays + m.absentDays, 1)), 0) / merged.length * 100).toFixed(1)
    : 0;

  res.json({ month, year, totalPayrollCost: +totalPayrollCost.toFixed(2), avgAttendanceRate, staff: merged });
};

// ─── 10. Order Status Funnel ──────────────────────────────────────────────────

/**
 * GET /api/analytics/order-funnel?from=&to=
 */
export const orderFunnel = async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : startOf('month');
  const to = req.query.to ? new Date(req.query.to) : new Date();

  const data = await Order.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { _id: 0, status: '$_id', count: 1 } },
  ]);

  const ORDER = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled'];
  const map = new Map(data.map((d) => [d.status, d.count]));
  const funnel = ORDER.map((s) => ({ status: s, count: map.get(s) || 0 }));

  res.json(funnel);
};

// ─── 11. Combined dashboard snapshot ─────────────────────────────────────────

/**
 * GET /api/analytics/snapshot
 * Single endpoint that returns everything needed for the dashboard in one round-trip.
 */
export const dashboardSnapshot = async (req, res) => {
  const [overview, trend, topItems, byCategory, inventory, funnel] = await Promise.all([
    // inline the logic to avoid HTTP overhead
    (async () => {
      const now = new Date();
      const todayFrom = startOf('day', now);
      const monthFrom = startOf('month', now);
      const [todayData, monthData, active] = await Promise.all([
        Order.aggregate([{ $match: paidFilter(todayFrom, now) }, { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }]),
        Order.aggregate([{ $match: paidFilter(monthFrom, now) }, { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }]),
        Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'served'] } }),
      ]);
      return {
        todayRevenue: +(todayData[0]?.revenue || 0).toFixed(2),
        todayOrders: todayData[0]?.orders || 0,
        monthRevenue: +(monthData[0]?.revenue || 0).toFixed(2),
        monthOrders: monthData[0]?.orders || 0,
        activeOrders: active,
      };
    })(),
    Order.aggregate([
      { $match: paidFilter(new Date(Date.now() - 14 * 86400000), new Date()) },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', revenue: { $round: ['$revenue', 2] }, orders: 1 } },
    ]),
    Order.aggregate([
      { $match: paidFilter(startOf('month'), new Date()) },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      { $sort: { qty: -1 } }, { $limit: 8 },
      { $project: { _id: 0, name: '$_id', qty: 1, revenue: { $round: ['$revenue', 2] } } },
    ]),
    Order.aggregate([
      { $match: paidFilter(startOf('month'), new Date()) },
      { $unwind: '$items' },
      { $lookup: { from: 'menuitems', localField: 'items.menuItem', foreignField: '_id', as: 'mi' } },
      { $unwind: { path: '$mi', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ['$mi.category', 'unknown'] }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      { $project: { _id: 0, category: '$_id', revenue: { $round: ['$revenue', 2] } } },
      { $sort: { revenue: -1 } },
    ]),
    Ingredient.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, totalValue: { $sum: { $multiply: ['$quantity', '$costPerUnit'] } }, lowStockCount: { $sum: { $cond: [{ $lte: ['$quantity', '$threshold'] }, 1, 0] } } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: startOf('month') } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { _id: 0, status: '$_id', count: 1 } },
    ]),
  ]);

  res.json({
    overview,
    revenueTrend: trend,
    topItems,
    salesByCategory: byCategory,
    inventory: {
      totalValue: +(inventory[0]?.totalValue || 0).toFixed(2),
      lowStockCount: inventory[0]?.lowStockCount || 0,
    },
    orderFunnel: funnel,
  });
};
