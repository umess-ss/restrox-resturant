/**
 * public.service.js
 *
 * Business logic for unauthenticated customer QR ordering.
 * Only exposes safe public data — no cost, margin, recipe, inventory, or staff fields.
 */
import mongoose from 'mongoose';
import Restaurant from '../saas/restaurant.model.js';
import Branch from '../saas/branch.model.js';
import Table from '../tables/table.model.js';
import MenuItem from '../menu/menu.model.js';
import Order from '../orders/order.model.js';
import { calcFinancials } from '../orders/order.service.js';
import { getIO } from '../../socket/io.js';
import { emitCustomerOrderEvent, emitTableEvent } from '../../socket/index.js';
import { EVENTS } from '../../socket/events.js';
import logger from '../../config/logger.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a clean 400 error for invalid MongoDB ObjectId strings.
 * Prevents Mongoose CastError 500s from reaching the client.
 */
const assertObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw Object.assign(new Error(`Invalid ${label}`), { status: 400 });
  }
};

// ─── Validate table ───────────────────────────────────────────────────────────

/**
 * Resolves and validates a table from public URL params.
 * Confirms the full chain: restaurant → branch → table.
 * Returns { restaurant, branch, table } or throws with an appropriate HTTP status.
 */
export const resolveTable = async (restaurantId, branchId, tableId) => {
  assertObjectId(restaurantId, 'restaurantId');
  assertObjectId(branchId, 'branchId');
  assertObjectId(tableId, 'tableId');

  const restaurant = await Restaurant.findById(restaurantId)
    .select('name isActive taxRate')
    .lean();
  if (!restaurant || !restaurant.isActive) {
    throw Object.assign(new Error('Restaurant not found'), { status: 404 });
  }

  const branch = await Branch.findOne({
    _id: branchId,
    restaurant: restaurantId,
    isActive: true,
  })
    .select('name')
    .lean();
  if (!branch) {
    throw Object.assign(new Error('Branch not found'), { status: 404 });
  }

  // Table must belong to this restaurant AND this branch
  const table = await Table.findOne({
    _id: tableId,
    restaurant: restaurantId,
    branch: branchId,
  })
    .select('number capacity status location currentOrder')
    .lean();
  if (!table) {
    throw Object.assign(new Error('Table not found'), { status: 404 });
  }

  return { restaurant, branch, table };
};

// ─── Public menu ──────────────────────────────────────────────────────────────

/**
 * Returns available menu items for a restaurant.
 * Explicit projection — never exposes overheadCost, costPerUnit, recipe, inventory.
 */
export const getPublicMenu = async (restaurantId, _branchId) => {
  assertObjectId(restaurantId, 'restaurantId');

  const items = await MenuItem.find({
    restaurant: restaurantId,
    isAvailable: true,
  })
    .select('name description price category image tags allergens preparationTime isAvailable')
    .sort('category name')
    .lean();

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return { items, grouped, total: items.length };
};

// ─── Create customer order ────────────────────────────────────────────────────

/**
 * Places a customer QR order atomically.
 *
 * - Validates restaurant → branch → table chain
 * - Confirms table is not already occupied
 * - Validates each menu item exists, is available, and belongs to the restaurant
 * - Snapshots price from DB — never trusts frontend price
 * - Recalculates subtotal, tax, total on backend
 * - Sets source = 'customer_qr', paymentStatus = 'unpaid', status = 'pending'
 * - Marks table as occupied
 * - Emits ORDER_CREATED to kitchen + pos + branch + table rooms
 *
 * @param {object} opts
 * @param {string}   opts.restaurantId
 * @param {string}   opts.branchId
 * @param {string}   opts.tableId
 * @param {Array}    opts.items          - [{ menuItem, quantity, notes? }]
 * @param {string}   [opts.customerName]
 * @param {string}   [opts.customerPhone]
 * @param {string}   [opts.customerNote]
 */
export const createCustomerOrder = async ({
  restaurantId,
  branchId,
  tableId,
  items: itemInputs,
  customerName,
  customerPhone,
  customerNote,
}) => {
  assertObjectId(restaurantId, 'restaurantId');
  assertObjectId(branchId, 'branchId');
  assertObjectId(tableId, 'tableId');

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ── 1. Validate restaurant ──────────────────────────────────────────────
    const restaurant = await Restaurant.findById(restaurantId)
      .select('name isActive taxRate')
      .session(session)
      .lean();
    if (!restaurant || !restaurant.isActive) {
      throw Object.assign(new Error('Restaurant not found'), { status: 404 });
    }

    // ── 2. Validate branch ──────────────────────────────────────────────────
    const branch = await Branch.findOne({ _id: branchId, restaurant: restaurantId, isActive: true })
      .select('name')
      .session(session)
      .lean();
    if (!branch) {
      throw Object.assign(new Error('Branch not found'), { status: 404 });
    }

    // ── 3. Validate table — must belong to restaurant + branch ──────────────
    const table = await Table.findOne({
      _id: tableId,
      restaurant: restaurantId,
      branch: branchId,
    }).session(session);
    if (!table) {
      throw Object.assign(new Error('Table not found'), { status: 404 });
    }
    if (table.status === 'occupied') {
      throw Object.assign(
        new Error(`Table ${table.number} is already occupied`),
        { status: 409 }
      );
    }

    // ── 4. Validate + snapshot menu items — never trust frontend price ───────
    const menuIds = itemInputs.map((i) => i.menuItem);
    const menuItems = await MenuItem.find({
      _id: { $in: menuIds },
      restaurant: restaurantId,
      isAvailable: true,
    }).session(session);

    const menuMap = new Map(menuItems.map((m) => [m._id.toString(), m]));

    const items = itemInputs.map((input) => {
      assertObjectId(input.menuItem, 'menuItem');
      const mi = menuMap.get(input.menuItem.toString());
      if (!mi) {
        throw Object.assign(
          new Error(`Menu item not found or unavailable: ${input.menuItem}`),
          { status: 422 }
        );
      }
      return {
        menuItem: mi._id,
        name: mi.name,
        price: mi.price,          // ← always from DB, never from request
        quantity: input.quantity,
        notes: input.notes?.trim() || undefined,
      };
    });

    // ── 5. Calculate financials on backend ───────────────────────────────────
    const taxRate = restaurant.taxRate ?? 0.1;
    const financials = calcFinancials(items, { taxRate });

    // ── 6. Generate KOT number scoped to restaurant ──────────────────────────
    const orderCount = await Order.countDocuments({ restaurant: restaurantId }).session(session);
    const kotNumber = `KOT-${String(orderCount + 1).padStart(4, '0')}`;

    // ── 7. Create order ──────────────────────────────────────────────────────
    const [order] = await Order.create(
      [{
        restaurant: restaurantId,
        branch: branchId,
        table: tableId,
        waiter: undefined,          // no staff for QR orders
        items,
        kotNumber,
        taxRate,
        ...financials,
        paymentStatus: 'unpaid',
        source: 'customer_qr',
        customerName:  customerName?.trim()  || undefined,
        customerPhone: customerPhone?.trim() || undefined,
        customerNote:  customerNote?.trim()  || undefined,
        statusHistory: [{ status: 'pending' }],
      }],
      { session }
    );

    // ── 8. Mark table occupied ───────────────────────────────────────────────
    table.status = 'occupied';
    table.currentOrder = order._id;
    await table.save({ session });

    await session.commitTransaction();

    // ── 9. Emit socket events ────────────────────────────────────────────────
    const io = getIO();
    emitCustomerOrderEvent(io, order, EVENTS.ORDER_CREATED);
    emitTableEvent(io, {
      _id: table._id,
      number: table.number,
      status: 'occupied',
      currentOrder: order._id,
      location: table.location,
    });

    logger.info(`[QR] order ${order.orderNumber} created — table ${table.number}, restaurant ${restaurantId}`);
    return order;

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ─── Order status ─────────────────────────────────────────────────────────────

/**
 * Returns the public-safe status of an order.
 * Never exposes: financials, staff IDs, inventory, internal notes, admin data.
 */
export const getOrderStatus = async (orderId) => {
  assertObjectId(orderId, 'orderId');

  const order = await Order.findById(orderId)
    .select('orderNumber status paymentStatus kotNumber totalAmount createdAt items source')
    .populate('table', 'number')
    .lean();

  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    kotNumber: order.kotNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount,
    tableNumber: order.table?.number,
    source: order.source,
    items: order.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      notes: i.notes,
      itemStatus: i.itemStatus,
    })),
    createdAt: order.createdAt,
  };
};

// ─── Call waiter ──────────────────────────────────────────────────────────────

/**
 * Validates the order exists, then emits a waiter-call event to the POS room.
 */
export const callWaiterForOrder = async (orderId) => {
  assertObjectId(orderId, 'orderId');

  const order = await Order.findById(orderId)
    .select('orderNumber table branch restaurant status')
    .populate('table', 'number')
    .lean();

  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (['paid', 'cancelled'].includes(order.status)) {
    throw Object.assign(new Error('Order is already closed'), { status: 422 });
  }

  const io = getIO();
  if (io) {
    const payload = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      tableNumber: order.table?.number,
      at: new Date(),
    };
    // Emit to POS room (waiters) and branch room if available
    io.to('pos').emit(EVENTS.CUSTOMER_CALL_WAITER, payload);
    if (order.branch) {
      io.to(`branch:${order.branch}`).emit(EVENTS.CUSTOMER_CALL_WAITER, payload);
    }
  }

  return { message: 'Waiter notified' };
};
