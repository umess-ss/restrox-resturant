import Order from './order.model.js';
import {
  createOrder as svcCreate,
  addItemsToOrder,
  transitionStatus,
  generateKOT,
  generateBill,
  checkout as svcCheckout,
} from './order.service.js';

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getOrders = async (req, res) => {
  const { status, tableId, from, to, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (tableId) filter.table = tableId;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('table', 'number location')
      .populate('waiter', 'name')
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit)),
    Order.countDocuments(filter),
  ]);

  res.json({ total, page: Number(page), pages: Math.ceil(total / limit), orders });
};

export const getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('table', 'number capacity location')
    .populate('waiter', 'name email role')
    .populate('items.menuItem', 'name category price')
    .populate('statusHistory.changedBy', 'name role');
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json(order);
};

/**
 * GET /api/orders/kitchen
 * Active orders for the kitchen display (confirmed + preparing + ready).
 */
export const getKitchenOrders = async (req, res) => {
  const orders = await Order.find({ status: { $in: ['confirmed', 'preparing', 'ready'] } })
    .populate('table', 'number location')
    .populate('waiter', 'name')
    .sort('createdAt'); // oldest first for kitchen
  res.json(orders);
};

// ─── POS: create ─────────────────────────────────────────────────────────────

export const createOrder = async (req, res) => {
  const { table, items, notes, taxRate } = req.body;
  const order = await svcCreate({ tableId: table, itemInputs: items, notes, taxRate, userId: req.user._id });
  res.status(201).json(order);
};

export const addItems = async (req, res) => {
  const order = await addItemsToOrder(req.params.id, req.body.items, req.user._id);
  res.json(order);
};

// ─── Status ───────────────────────────────────────────────────────────────────

export const updateOrderStatus = async (req, res) => {
  const { status, note } = req.body;
  const order = await transitionStatus(req.params.id, status, req.user._id, note);
  res.json({ order });
};

// ─── KOT ─────────────────────────────────────────────────────────────────────

export const printKOT = async (req, res) => {
  const kot = await generateKOT(req.params.id, req.user._id);
  res.json(kot);
};

// ─── Bill ─────────────────────────────────────────────────────────────────────

export const getBill = async (req, res) => {
  const { discountType, discountValue } = req.query;
  const bill = await generateBill(req.params.id, {
    discountType,
    discountValue: discountValue ? Number(discountValue) : 0,
  });
  res.json(bill);
};

// ─── Checkout ─────────────────────────────────────────────────────────────────

export const checkoutOrder = async (req, res) => {
  const { paymentMethod, discountType, discountValue } = req.body;
  const order = await svcCheckout(
    req.params.id,
    { paymentMethod, discountType, discountValue },
    req.user._id
  );
  res.json({ order });
};

// ─── Cancel ───────────────────────────────────────────────────────────────────

export const cancelOrder = async (req, res) => {
  const { note } = req.body;
  const order = await transitionStatus(req.params.id, 'cancelled', req.user._id, note || 'Cancelled');
  res.json({ order });
};
