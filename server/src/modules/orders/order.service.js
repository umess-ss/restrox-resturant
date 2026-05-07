import mongoose from 'mongoose';
import Order from './order.model.js';
import Table from '../tables/table.model.js';
import MenuItem from '../menu/menu.model.js';
import { deductRecipeIngredients } from '../inventory/inventory.service.js';
import logger from '../../config/logger.js';
import { getIO } from '../../socket/io.js';
import { emitOrderEvent, emitTableEvent, emitAnalyticsUpdate } from '../../socket/index.js';
import { EVENTS } from '../../socket/events.js';

// ─── Status machine ───────────────────────────────────────────────────────────

const VALID_TRANSITIONS = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['preparing', 'cancelled'],
  preparing:  ['ready', 'cancelled'],
  ready:      ['served', 'cancelled'],
  served:     ['paid', 'cancelled'],
  paid:       [],
  cancelled:  [],
};

export const assertTransition = (from, to) => {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    const err = new Error(`Cannot transition order from '${from}' to '${to}'`);
    err.status = 422;
    throw err;
  }
};

// ─── Financials ───────────────────────────────────────────────────────────────

/**
 * Computes subtotal, discount, tax, and total from raw items + options.
 */
export const calcFinancials = (items, { taxRate = 0.1, discountType = 'none', discountValue = 0 } = {}) => {
  const subtotal = +items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2);

  let discountAmount = 0;
  if (discountType === 'flat') discountAmount = Math.min(discountValue, subtotal);
  if (discountType === 'percent') discountAmount = +(subtotal * (discountValue / 100)).toFixed(2);

  const taxable = subtotal - discountAmount;
  const taxAmount = +(taxable * taxRate).toFixed(2);
  const totalAmount = +(taxable + taxAmount).toFixed(2);

  return { subtotal, discountAmount, taxAmount, totalAmount };
};

// ─── POS: create order ────────────────────────────────────────────────────────

/**
 * Creates an order and marks the table as occupied.
 * Validates that the table is available and all menu items exist and are available.
 */
export const createOrder = async ({ tableId, itemInputs, notes, taxRate, userId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate table
    const table = await Table.findById(tableId).session(session);
    if (!table) throw Object.assign(new Error('Table not found'), { status: 404 });
    if (table.status === 'occupied') {
      throw Object.assign(new Error(`Table ${table.number} is already occupied`), { status: 409 });
    }

    // Validate + snapshot menu items
    const menuIds = itemInputs.map((i) => i.menuItem);
    const menuItems = await MenuItem.find({ _id: { $in: menuIds }, isAvailable: true }).session(session);
    const menuMap = new Map(menuItems.map((m) => [m._id.toString(), m]));

    const items = itemInputs.map((input) => {
      const mi = menuMap.get(input.menuItem.toString());
      if (!mi) throw Object.assign(new Error(`Menu item ${input.menuItem} not found or unavailable`), { status: 422 });
      return { menuItem: mi._id, name: mi.name, price: mi.price, quantity: input.quantity, notes: input.notes };
    });

    const financials = calcFinancials(items, { taxRate });

    // Generate KOT number
    const orderCount = await Order.countDocuments().session(session);
    const kotNumber = `KOT-${String(orderCount + 1).padStart(4, '0')}`;

    const [order] = await Order.create(
      [{
        table: tableId,
        waiter: userId,
        items,
        kotNumber,
        taxRate: taxRate ?? 0.1,
        ...financials,
        notes,
        statusHistory: [{ status: 'pending', changedBy: userId }],
      }],
      { session }
    );

    // Mark table occupied and link order
    table.status = 'occupied';
    table.currentOrder = order._id;
    await table.save({ session });

    await session.commitTransaction();
    emitOrderEvent(getIO(), order, EVENTS.ORDER_CREATED);
    // Notify POS that table status changed to occupied
    emitTableEvent(getIO(), { _id: table._id, number: table.number, status: 'occupied', currentOrder: order._id, location: table.location });
    return order;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ─── Add items to existing order (before preparing) ──────────────────────────

export const addItemsToOrder = async (orderId, itemInputs, userId) => {
  const order = await Order.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (['ready', 'served', 'paid', 'cancelled'].includes(order.status)) {
    throw Object.assign(new Error(`Cannot add items to an order in '${order.status}' status`), { status: 422 });
  }

  const menuIds = itemInputs.map((i) => i.menuItem);
  const menuItems = await MenuItem.find({ _id: { $in: menuIds }, isAvailable: true });
  const menuMap = new Map(menuItems.map((m) => [m._id.toString(), m]));

  for (const input of itemInputs) {
    const mi = menuMap.get(input.menuItem.toString());
    if (!mi) throw Object.assign(new Error(`Menu item ${input.menuItem} not found`), { status: 422 });

    // Merge with existing item if same menuItem + same notes
    const existing = order.items.find(
      (i) => i.menuItem.toString() === mi._id.toString() && i.notes === (input.notes || '')
    );
    if (existing) {
      existing.quantity += input.quantity;
    } else {
      order.items.push({ menuItem: mi._id, name: mi.name, price: mi.price, quantity: input.quantity, notes: input.notes });
    }
  }

  const financials = calcFinancials(order.items, {
    taxRate: order.taxRate,
    discountType: order.discountType,
    discountValue: order.discountValue,
  });
  Object.assign(order, financials);
  await order.save();
  emitOrderEvent(getIO(), order, EVENTS.ORDER_ITEMS_ADDED);
  return order;
};

// ─── Status transition ────────────────────────────────────────────────────────

export const transitionStatus = async (orderId, newStatus, userId, note) => {
  const order = await Order.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

  assertTransition(order.status, newStatus);

  order.statusHistory.push({ status: newStatus, changedBy: userId, note });
  order.status = newStatus;

  // On payment: record payment time, trigger inventory deduction
  if (newStatus === 'paid') {
    order.paidAt = new Date();
    order.paymentStatus = 'paid';
  }

  await order.save();

  // Inventory deduction on payment (idempotent guard)
  if (newStatus === 'paid' && !order.inventoryDeducted) {
    try {
      await deductRecipeIngredients(order.items, userId, order._id);
      await Order.findByIdAndUpdate(orderId, { inventoryDeducted: true });
    } catch (err) {
      logger.error(`Inventory deduction failed for order ${orderId}: ${err.message}`);
      // Don't fail the payment — flag for manual reconciliation
    }
  }

  // Free the table when order is paid or cancelled
  if (['paid', 'cancelled'].includes(newStatus)) {
    const table = await Table.findByIdAndUpdate(order.table, {
      status: 'cleaning',
      currentOrder: null,
    }, { new: true });
    if (table) emitTableEvent(getIO(), table);
  }

  // Determine the specific event name for precise client-side handling
  const eventMap = {
    paid:      EVENTS.ORDER_PAID,
    cancelled: EVENTS.ORDER_CANCELLED,
  };
  const event = eventMap[newStatus] || EVENTS.ORDER_STATUS_CHANGED;
  emitOrderEvent(getIO(), order, event);

  // Push analytics snapshot to dashboard after payment
  if (newStatus === 'paid') {
    emitAnalyticsUpdate(getIO(), { trigger: 'order_paid', orderId: order._id, totalAmount: order.totalAmount });
  }

  return order;
};

// ─── KOT ─────────────────────────────────────────────────────────────────────

/**
 * "Prints" a KOT — marks all un-printed items as printed and records the timestamp.
 * Returns the KOT payload the frontend/printer can render.
 */
export const generateKOT = async (orderId, userId) => {
  const order = await Order.findById(orderId)
    .populate('table', 'number location')
    .populate('waiter', 'name');
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (['paid', 'cancelled'].includes(order.status)) {
    throw Object.assign(new Error('Cannot generate KOT for a closed order'), { status: 422 });
  }

  // Only include items not yet sent to kitchen
  const newItems = order.items.filter((i) => !i.kotPrinted);
  if (!newItems.length) throw Object.assign(new Error('All items already sent to kitchen'), { status: 409 });

  // Mark items as printed
  order.items.forEach((i) => { i.kotPrinted = true; });
  order.kotPrintedAt = new Date();

  // Advance to confirmed if still pending
  if (order.status === 'pending') {
    order.status = 'confirmed';
    order.statusHistory.push({ status: 'confirmed', changedBy: userId, note: 'KOT generated' });
  }

  await order.save();

  emitOrderEvent(getIO(), order, EVENTS.ORDER_KOT_PRINTED);

  return {
    kotNumber: order.kotNumber,
    orderNumber: order.orderNumber,
    table: order.table,
    waiter: order.waiter?.name,
    printedAt: order.kotPrintedAt,
    items: newItems.map((i) => ({ name: i.name, quantity: i.quantity, notes: i.notes })),
  };
};

// ─── KDS: Item-level status ───────────────────────────────────────────────────

/**
 * Updates the status of a single item in an order (for KDS).
 * When all items are 'ready', auto-advances the order to 'ready'.
 */
export const updateItemStatus = async (orderId, itemId, newStatus, userId) => {
  const order = await Order.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

  const item = order.items.id(itemId);
  if (!item) throw Object.assign(new Error('Item not found in order'), { status: 404 });

  item.itemStatus = newStatus;

  // Auto-advance order status based on item statuses
  const allReady = order.items.every((i) => i.itemStatus === 'ready');
  const anyPreparing = order.items.some((i) => i.itemStatus === 'preparing');

  if (allReady && order.status === 'preparing') {
    order.status = 'ready';
    order.statusHistory.push({ status: 'ready', changedBy: userId, note: 'All items ready' });
  } else if (anyPreparing && order.status === 'confirmed') {
    order.status = 'preparing';
    order.statusHistory.push({ status: 'preparing', changedBy: userId, note: 'Started preparing' });
  }

  await order.save();
  emitOrderEvent(getIO(), order, EVENTS.ORDER_ITEM_STATUS_CHANGED);
  return order;
};

// ─── Bill ─────────────────────────────────────────────────────────────────────

/**
 * Generates the bill payload. Applies discount if provided.
 * Does NOT change order status — call checkout for that.
 */
export const generateBill = async (orderId, { discountType, discountValue } = {}) => {
  const order = await Order.findById(orderId)
    .populate('table', 'number location')
    .populate('waiter', 'name')
    .populate('items.menuItem', 'name category');
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.status === 'cancelled') throw Object.assign(new Error('Order is cancelled'), { status: 422 });

  // Apply discount if provided
  if (discountType && discountType !== 'none') {
    const financials = calcFinancials(order.items, {
      taxRate: order.taxRate,
      discountType,
      discountValue: discountValue || 0,
    });
    Object.assign(order, { discountType, discountValue, ...financials });
    order.billGeneratedAt = new Date();
    await order.save();
  } else if (!order.billGeneratedAt) {
    order.billGeneratedAt = new Date();
    await order.save();
  }

  return {
    billNumber: `BILL-${order.orderNumber}`,
    orderNumber: order.orderNumber,
    kotNumber: order.kotNumber,
    table: order.table,
    waiter: order.waiter?.name,
    items: order.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.price,
      lineTotal: +(i.price * i.quantity).toFixed(2),
      notes: i.notes,
    })),
    subtotal: order.subtotal,
    discountType: order.discountType,
    discountValue: order.discountValue,
    discountAmount: order.discountAmount,
    taxRate: order.taxRate,
    taxAmount: order.taxAmount,
    totalAmount: order.totalAmount,
    paymentStatus: order.paymentStatus,
    billGeneratedAt: order.billGeneratedAt,
    createdAt: order.createdAt,
  };
};

// ─── Checkout ─────────────────────────────────────────────────────────────────

/**
 * Marks order as paid, records payment method, frees the table.
 */
export const checkout = async (orderId, { paymentMethod, discountType, discountValue }, userId) => {
  const order = await Order.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.paymentStatus === 'paid') throw Object.assign(new Error('Order already paid'), { status: 409 });
  if (!['served', 'ready'].includes(order.status)) {
    throw Object.assign(new Error(`Order must be served before checkout (current: ${order.status})`), { status: 422 });
  }

  // Apply final discount
  if (discountType && discountType !== 'none') {
    const financials = calcFinancials(order.items, { taxRate: order.taxRate, discountType, discountValue });
    Object.assign(order, { discountType, discountValue, ...financials });
  }

  order.paymentMethod = paymentMethod;
  return transitionStatus(orderId, 'paid', userId, `Payment via ${paymentMethod}`);
};
