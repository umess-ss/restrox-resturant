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
import { EVENTS, ROOMS } from '../../socket/events.js';
import logger from '../../config/logger.js';
import formatCurrency from '../../utils/formatCurrency.js';
import { getLatestSuccessfulPayment } from '../payments/payment.service.js';

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

const publicBillPayload = (order, payment) => ({
  restaurantName: order.restaurant?.name,
  restaurantAddress: order.restaurant?.address,
  restaurantPhone: order.restaurant?.phone,
  branchName: order.branch?.name,
  branchAddress: order.branch?.address,
  branchPhone: order.branch?.phone,
  orderNumber: order.orderNumber,
  tableNumber: order.table?.number,
  customerName: order.customerName,
  customerPhone: order.customerPhone,
  createdAt: order.createdAt,
  paidAt: order.paidAt,
  items: order.items.map((i) => ({
    name: i.name,
    quantity: i.quantity,
    price: i.price,
    lineTotal: +(i.price * i.quantity).toFixed(2),
  })),
  subtotal: order.subtotal,
  tax: order.taxAmount,
  discount: order.discountAmount || 0,
  serviceCharge: 0,
  totalAmount: order.totalAmount,
  orderStatus: order.status,
  paymentStatus: order.paymentStatus,
  billStatus: order.billStatus,
  paymentMethod: payment?.method || order.paymentMethod,
  transactionId: payment?.transactionId || order.transactionId,
});

const emitBillEvent = (io, order, event, payload) => {
  if (!io) return;
  io.to(ROOMS.pos).emit(event, payload);
  io.to(ROOMS.kitchen).emit(event, payload);
  io.to(ROOMS.order(order._id)).emit(event, payload);
  if (order.branch) io.to(ROOMS.branch(order.branch)).emit(event, payload);
  if (order.table?._id || order.table) io.to(ROOMS.table(order.table?._id || order.table)).emit(event, payload);
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

  let items = await MenuItem.find({
    $or: [
      { restaurant: restaurantId },
      { restaurant: { $exists: false } },
      { restaurant: null },
    ],
    isAvailable: true,
  })
    .select('name description price category imageUrl tags allergens preparationTime isAvailable')
    .sort('category name')
    .lean();

  // Local/demo databases may contain menu items seeded under a different
  // restaurant because the legacy admin menu endpoint used to be unscoped.
  // If this restaurant has no own/global items, expose available items so the
  // QR menu is not empty; new/updated items are tenant-scoped going forward.
  if (!items.length) {
    items = await MenuItem.find({ isAvailable: true })
      .select('name description price category imageUrl tags allergens preparationTime isAvailable')
      .sort('category name')
      .lean();
  }

  const publicItems = items.map((item) => ({
    _id: item._id,
    name: item.name,
    description: item.description,
    price: item.price,
    category: item.category,
    imageUrl: item.imageUrl || '',
    tags: item.tags,
    allergens: item.allergens,
    preparationTime: item.preparationTime,
    isAvailable: item.isAvailable,
  }));

  const grouped = publicItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return { items: publicItems, grouped, total: publicItems.length };
};

const getAvailableMenuItemsForOrder = async (restaurantId, menuIds, session) => {
  let menuItems = await MenuItem.find({
    _id: { $in: menuIds },
    $or: [
      { restaurant: restaurantId },
      { restaurant: { $exists: false } },
      { restaurant: null },
    ],
    isAvailable: true,
  }).session(session);

  if (menuItems.length !== menuIds.length) {
    const restaurantMenuCount = await MenuItem.countDocuments({
      $or: [
        { restaurant: restaurantId },
        { restaurant: { $exists: false } },
        { restaurant: null },
      ],
      isAvailable: true,
    }).session(session);

    if (restaurantMenuCount === 0) {
      menuItems = await MenuItem.find({
        _id: { $in: menuIds },
        isAvailable: true,
      }).session(session);
    }
  }

  return menuItems;
};

const snapshotOrderItems = async (restaurantId, itemInputs, session) => {
  const menuIds = itemInputs.map((i) => {
    assertObjectId(i.menuItem, 'menuItem');
    return i.menuItem;
  });
  const menuItems = await getAvailableMenuItemsForOrder(restaurantId, menuIds, session);
  const menuMap = new Map(menuItems.map((m) => [m._id.toString(), m]));

  return itemInputs.map((input) => {
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
      price: mi.price,
      quantity: input.quantity,
      notes: input.notes?.trim() || undefined,
    };
  });
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
    const items = await snapshotOrderItems(restaurantId, itemInputs, session);

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
    emitCustomerOrderEvent(io, {
      ...order.toObject(),
      table: { _id: table._id, number: table.number, location: table.location },
    }, EVENTS.ORDER_CREATED);
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

export const addItemsToCustomerOrder = async (orderId, itemInputs) => {
  assertObjectId(orderId, 'orderId');

  if (!Array.isArray(itemInputs) || itemInputs.length === 0) {
    throw Object.assign(new Error('At least one item required'), { status: 400 });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  let committed = false;

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

    if (order.paymentStatus === 'paid' || ['paid', 'cancelled'].includes(order.status)) {
      throw Object.assign(new Error('Cannot add items after payment or cancellation'), { status: 422 });
    }

    const newItems = await snapshotOrderItems(order.restaurant, itemInputs, session);

    newItems.forEach((newItem) => {
      const existing = order.items.find((item) => (
        item.itemStatus === 'pending'
        && item.menuItem?.toString() === newItem.menuItem.toString()
        && (item.notes || '') === (newItem.notes || '')
      ));

      if (existing) {
        existing.quantity += newItem.quantity;
      } else {
        order.items.push(newItem);
      }
    });

    const financials = calcFinancials(order.items, {
      taxRate: order.taxRate,
      discountType: order.discountType,
      discountValue: order.discountValue,
    });
    Object.assign(order, financials);

    if (order.billStatus !== 'not_requested') {
      order.billStatus = 'not_requested';
      order.billGeneratedAt = undefined;
    }

    if (['ready', 'served'].includes(order.status)) {
      order.status = 'confirmed';
      order.statusHistory.push({
        status: 'confirmed',
        note: 'Customer added more items',
      });
    }

    await order.save({ session });
    await session.commitTransaction();
    committed = true;

    const populatedOrder = await Order.findById(order._id)
      .populate('table', 'number location')
      .lean();

    emitCustomerOrderEvent(getIO(), populatedOrder, EVENTS.ORDER_ITEMS_ADDED);
    logger.info(`[QR] ${newItems.length} item line(s) added to order ${order.orderNumber}`);

    return getOrderStatus(order._id);
  } catch (err) {
    if (!committed) await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ─── Order status ─────────────────────────────────────────────────────────────

/**
 * Returns the public-safe status of an order.
 * Includes estimated preparation time calculated from menu item preparationTime fields.
 * Never exposes: financials breakdown, staff IDs, inventory, internal notes, admin data.
 */
export const getOrderStatus = async (orderId) => {
  assertObjectId(orderId, 'orderId');

  const order = await Order.findById(orderId)
    .select('restaurant branch table orderNumber status paymentStatus billStatus kotNumber totalAmount createdAt items source')
    .populate('table', 'number')
    .populate('items.menuItem', 'preparationTime') // only prep time — no cost/recipe fields
    .lean();

  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

  // ── Estimate preparation time ──────────────────────────────────────────────
  // Formula: max(preparationTime) across all items, with a small quantity factor.
  // If no preparationTime data, default to 15 minutes.
  const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing'];
  let estimatedPreparationTime = null;
  let estimatedReadyAt = null;

  if (ACTIVE_STATUSES.includes(order.status)) {
    const times = order.items
      .map((i) => {
        const base = i.menuItem?.preparationTime || 15;
        // Add 2 min per extra item beyond the first (parallel kitchen work)
        const quantityFactor = Math.ceil((i.quantity - 1) * 0.5);
        return base + quantityFactor;
      })
      .filter((t) => t > 0);

    if (times.length > 0) {
      estimatedPreparationTime = Math.max(...times); // kitchen works in parallel
      const createdMs = new Date(order.createdAt).getTime();
      estimatedReadyAt = new Date(createdMs + estimatedPreparationTime * 60 * 1000).toISOString();
    }
  }

  return {
    orderId: order._id,
    restaurantId: order.restaurant,
    branchId: order.branch,
    tableId: order.table?._id,
    orderNumber: order.orderNumber,
    kotNumber: order.kotNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    billStatus: order.billStatus,
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
    estimatedPreparationTime, // minutes, null if not applicable
    estimatedReadyAt,          // ISO string, null if not applicable
  };
};

// ─── Public bill ─────────────────────────────────────────────────────────────

export const getPublicBill = async (orderId) => {
  assertObjectId(orderId, 'orderId');

  const order = await Order.findById(orderId)
    .select('orderNumber restaurant branch table customerName customerPhone items subtotal taxAmount discountAmount totalAmount status paymentStatus billStatus paymentMethod transactionId createdAt paidAt')
    .populate('restaurant', 'name address phone')
    .populate('branch', 'name address phone')
    .populate('table', 'number')
    .lean();

  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  const payment = await getLatestSuccessfulPayment(order._id);
  return publicBillPayload(order, payment);
};

export const requestBillForOrder = async (orderId) => {
  assertObjectId(orderId, 'orderId');

  const order = await Order.findById(orderId)
    .select('orderNumber table branch status paymentStatus billStatus customerName customerPhone customerNote')
    .populate('table', 'number')
    .lean();

  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (['paid', 'cancelled'].includes(order.status)) {
    throw Object.assign(new Error('Order is already closed'), { status: 422 });
  }

  await Order.findByIdAndUpdate(orderId, { billStatus: 'requested' });

  const payload = {
    orderId: order._id,
    orderNumber: order.orderNumber,
    tableNumber: order.table?.number,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerNote: order.customerNote,
    message: `Table ${order.table?.number || '?'} requested bill`,
    createdAt: new Date(),
  };

  emitBillEvent(getIO(), order, EVENTS.CUSTOMER_REQUEST_BILL, payload);
  return { success: true, billStatus: 'requested' };
};

export const getReceiptPdf = async (orderId) => {
  const bill = await getPublicBill(orderId);
  if (bill.paymentStatus !== 'paid') {
    throw Object.assign(new Error('Receipt is available after payment'), { status: 403 });
  }

  const width = 226;
  const margin = 12;
  const fontSize = 8.5;
  const lineHeight = 10;
  const chars = 38;
  const separator = '-'.repeat(chars);
  const paidAt = bill.paidAt || new Date();

  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const title = (value) => ({ text: clean(value), align: 'center', size: 10 });
  const center = (value) => ({ text: clean(value), align: 'center' });
  const line = (value = '') => ({ text: clean(value) });
  const pair = (label, value, strong = false) => ({ label: clean(label), value: clean(value), strong });
  const wrap = (text, max = chars) => {
    const words = clean(text).split(' ');
    const out = [];
    let current = '';
    words.forEach((word) => {
      if ((current ? current.length + 1 : 0) + word.length <= max) {
        current = current ? `${current} ${word}` : word;
      } else {
        if (current) out.push(current);
        current = word.slice(0, max);
      }
    });
    if (current) out.push(current);
    return out.length ? out : [''];
  };
  const row = (left, right) => {
    const leftText = clean(left);
    const rightText = clean(right);
    const spaces = Math.max(1, chars - leftText.length - rightText.length);
    return `${leftText}${' '.repeat(spaces)}${rightText}`;
  };

  const rows = [
    title(bill.restaurantName || 'Restaurant'),
    bill.branchName ? center(bill.branchName) : null,
    bill.branchAddress || bill.restaurantAddress ? center(bill.branchAddress || bill.restaurantAddress) : null,
    bill.branchPhone || bill.restaurantPhone ? center(`Phone: ${bill.branchPhone || bill.restaurantPhone}`) : null,
    center('PAN/VAT: -'),
    line(separator),
    pair('Receipt No', `RCPT-${bill.orderNumber}`),
    pair('Order No', bill.orderNumber),
    pair('Table', bill.tableNumber || '-'),
    bill.customerName ? pair('Customer', bill.customerName) : null,
    bill.customerPhone ? pair('Phone', bill.customerPhone) : null,
    pair('Date', new Date(paidAt).toLocaleDateString()),
    pair('Time', new Date(paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    line(separator),
    line(row('Item', 'Amount')),
    line(separator),
    ...bill.items.flatMap((item) => [
      ...wrap(item.name, chars).map(line),
      line(row(`  ${item.quantity} x ${formatCurrency(item.price)}`, formatCurrency(item.lineTotal))),
    ]),
    line(separator),
    pair('Subtotal', formatCurrency(bill.subtotal)),
    bill.discount ? pair('Discount', formatCurrency(bill.discount)) : null,
    pair('VAT/Tax', formatCurrency(bill.tax)),
    bill.serviceCharge ? pair('Service Charge', formatCurrency(bill.serviceCharge)) : null,
    line(separator),
    pair('Grand Total', formatCurrency(bill.totalAmount), true),
    line(separator),
    pair('Payment', bill.paymentMethod || '-'),
    bill.transactionId ? pair('Txn ID', bill.transactionId) : null,
    pair('Status', bill.paymentStatus),
    line(separator),
    center('Thank you for dining with us'),
    center('Please visit again'),
    center(`Order ID: ${String(orderId).slice(-8)}`),
  ].filter(Boolean);

  const height = Math.max(360, rows.length * lineHeight + 28);
  const escapePdf = (value) => String(value).replace(/[()\\]/g, '\\$&');
  const textWidth = (text, size = fontSize) => clean(text).length * size * 0.6;
  const content = rows.map((entry, i) => {
    const size = entry.size || (entry.strong ? 10 : fontSize);
    const y = height - margin - (i + 1) * lineHeight;

    if (entry.label) {
      const label = `${entry.label}:`;
      const value = entry.value;
      const valueX = Math.max(margin + 70, width - margin - textWidth(value, size));
      return [
        `BT /F1 ${size} Tf ${margin.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(label)}) Tj ET`,
        `BT /F1 ${size} Tf ${valueX.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(value)}) Tj ET`,
      ].join('\n');
    }

    const text = entry.text;
    const x = entry.align === 'center'
      ? Math.max(margin, (width - textWidth(text, size)) / 2)
      : margin;
    return `BT /F1 ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(text)}) Tj ET`;
  }).join('\n');

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`,
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj',
    `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
};

// ─── Call waiter ──────────────────────────────────────────────────────────────

/**
 * Validates the order exists, then emits a waiter-call event to the POS room.
 */
export const callWaiterForOrder = async (orderId) => {
  assertObjectId(orderId, 'orderId');

  const order = await Order.findById(orderId)
    .select('orderNumber table branch restaurant status customerName customerPhone customerNote')
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
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerNote: order.customerNote,
      message: `Table ${order.table?.number || '?'} is calling waiter`,
      createdAt: new Date(),
    };
    // Emit to POS/KDS rooms and branch room if available
    io.to('pos').emit(EVENTS.CUSTOMER_CALL_WAITER, payload);
    io.to('kitchen').emit(EVENTS.CUSTOMER_CALL_WAITER, payload);
    if (order.branch) {
      io.to(`branch:${order.branch}`).emit(EVENTS.CUSTOMER_CALL_WAITER, payload);
    }
  }

  return { message: 'Waiter notified' };
};
