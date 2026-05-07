/**
 * public.service.js
 *
 * Business logic for unauthenticated customer QR ordering.
 * Delegates order creation to the existing order.service.js so all
 * existing KDS/POS/socket flows work without modification.
 */
import Restaurant from '../saas/restaurant.model.js';
import Branch from '../saas/branch.model.js';
import Table from '../tables/table.model.js';
import MenuItem from '../menu/menu.model.js';
import Order from '../orders/order.model.js';
import { createOrder as svcCreateOrder } from '../orders/order.service.js';

// ─── Validate table ───────────────────────────────────────────────────────────

/**
 * Resolves and validates a table from public URL params.
 * Returns { restaurant, branch, table } or throws with an appropriate status.
 */
export const resolveTable = async (restaurantId, branchId, tableId) => {
  const restaurant = await Restaurant.findById(restaurantId).select('name slug plan isActive features');
  if (!restaurant || !restaurant.isActive) {
    throw Object.assign(new Error('Restaurant not found or inactive'), { status: 404 });
  }

  const branch = await Branch.findOne({ _id: branchId, restaurant: restaurantId, isActive: true })
    .select('name');
  if (!branch) {
    throw Object.assign(new Error('Branch not found'), { status: 404 });
  }

  const table = await Table.findOne({
    _id: tableId,
    restaurant: restaurantId,
    branch: branchId,
  }).select('number capacity status location currentOrder');
  if (!table) {
    throw Object.assign(new Error('Table not found'), { status: 404 });
  }

  return { restaurant, branch, table };
};

// ─── Public menu ──────────────────────────────────────────────────────────────

/**
 * Returns available menu items for a restaurant, grouped by category.
 */
export const getPublicMenu = async (restaurantId) => {
  const items = await MenuItem.find({
    restaurant: restaurantId,
    isAvailable: true,
  })
    .select('name description price category image tags allergens preparationTime')
    .sort('category name')
    .lean();

  // Group by category for easier frontend rendering
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return { items, grouped, total: items.length };
};

// ─── Place order ──────────────────────────────────────────────────────────────

/**
 * Places a customer order via the existing order service.
 * The existing service handles table validation, menu validation,
 * financial calculation, KOT generation, and socket events.
 *
 * @param {object} opts
 * @param {string} opts.restaurantId
 * @param {string} opts.branchId
 * @param {string} opts.tableId
 * @param {Array}  opts.items          - [{ menuItem, quantity, notes }]
 * @param {string} [opts.customerName]
 * @param {string} [opts.notes]
 */
export const placeCustomerOrder = async ({ restaurantId, branchId, tableId, items, customerName, notes }) => {
  // Use a system-level userId placeholder for customer orders
  // In a real deployment this would be a dedicated "customer" service account
  // For now we use null — the order service handles null waiter gracefully
  const order = await svcCreateOrder({
    tableId,
    itemInputs: items,
    notes: notes || (customerName ? `Customer: ${customerName}` : undefined),
    taxRate: undefined, // use restaurant default
    userId: null,       // no authenticated user
    restaurantId,
    branchId,
  });

  // Tag the order as QR-sourced (non-blocking — order is already created)
  await Order.findByIdAndUpdate(order._id, { source: 'qr', customerName: customerName || '' });

  return order;
};

// ─── Order status ─────────────────────────────────────────────────────────────

/**
 * Returns the public-safe status of an order.
 * Only exposes fields a customer needs — no financial or staff data.
 */
export const getOrderStatus = async (orderId) => {
  const order = await Order.findById(orderId)
    .select('orderNumber status items kotNumber createdAt')
    .populate('items.menuItem', 'name')
    .lean();

  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    kotNumber: order.kotNumber,
    status: order.status,
    itemCount: order.items.length,
    createdAt: order.createdAt,
  };
};
