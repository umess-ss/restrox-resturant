import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../modules/auth/auth.model.js';
import logger from '../config/logger.js';
import { EVENTS, ROOMS } from './events.js';

// ─── Role → rooms map ─────────────────────────────────────────────────────────

const ROLE_ROOMS = {
  chef:    [ROOMS.kitchen, ROOMS.role('chef')],
  waiter:  [ROOMS.pos,     ROOMS.role('waiter')],
  manager: [ROOMS.pos,     ROOMS.managers, ROOMS.role('manager')],
  admin:   [ROOMS.pos,     ROOMS.managers, ROOMS.role('admin')],
};

// Allow Vite dev server origins during development (ports vary), and
// otherwise restrict to configured CLIENT_URL. Also allow no-origin (non-browser clients).
const socketAllowedOrigins = [process.env.CLIENT_URL].filter(Boolean);

const socketCorsOrigin = (origin, callback) => {
  // No origin (e.g. some non-browser clients) — allow
  if (!origin) return callback(null, true);

  // In development, accept any localhost origin (vite may use different ports)
  if (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost')) {
    return callback(null, true);
  }

  if (socketAllowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error('Origin not allowed by CORS'));
};

// ─── Auth middleware ──────────────────────────────────────────────────────────

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) return next(new Error('User not found or inactive'));

    socket.user = user;
    next();
  } catch (err) {
    logger.warn(`Socket auth failed: ${err.message}`);
    next(new Error('Invalid token'));
  }
};

// ─── Init ─────────────────────────────────────────────────────────────────────

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: socketCorsOrigin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    // Ping every 25s, disconnect after 60s of silence
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { name, role, _id } = socket.user;
    logger.info(`[WS] connected: ${name} (${role}) — socket ${socket.id}`);

    // ─── Auto-join role-based rooms ─────────────────────────────────────────
    const rooms = ROLE_ROOMS[role] || [ROOMS.role(role)];
    rooms.forEach((room) => socket.join(room));

    // Confirm to client which rooms they joined and their identity
    socket.emit(EVENTS.CONNECTED, {
      userId: _id,
      name,
      role,
      rooms,
    });

    // ─── Client-driven room subscriptions ───────────────────────────────────

    socket.on(EVENTS.CLIENT_JOIN_ORDER, (orderId) => {
      if (!orderId) return;
      socket.join(ROOMS.order(orderId));
      logger.debug(`[WS] ${name} joined ${ROOMS.order(orderId)}`);
    });

    socket.on(EVENTS.CLIENT_LEAVE_ORDER, (orderId) => {
      if (!orderId) return;
      socket.leave(ROOMS.order(orderId));
    });

    socket.on(EVENTS.CLIENT_JOIN_TABLE, (tableId) => {
      if (!tableId) return;
      socket.join(ROOMS.table(tableId));
    });

    socket.on(EVENTS.CLIENT_LEAVE_TABLE, (tableId) => {
      if (!tableId) return;
      socket.leave(ROOMS.table(tableId));
    });

    // ─── Reconnect with new token ────────────────────────────────────────────
    // Client sends this after a silent token refresh to re-authenticate
    // without a full disconnect/reconnect cycle.
    socket.on('client:reauth', async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user || !user.isActive) return socket.emit(EVENTS.ERROR, { message: 'Reauth failed' });

        // Leave old role rooms, join new ones (role may have changed)
        const oldRooms = ROLE_ROOMS[socket.user.role] || [];
        oldRooms.forEach((r) => socket.leave(r));

        socket.user = user;
        const newRooms = ROLE_ROOMS[user.role] || [ROOMS.role(user.role)];
        newRooms.forEach((r) => socket.join(r));

        socket.emit(EVENTS.CONNECTED, { userId: user._id, name: user.name, role: user.role, rooms: newRooms });
        logger.info(`[WS] reauth: ${user.name} (${user.role})`);
      } catch {
        socket.emit(EVENTS.ERROR, { message: 'Reauth failed — invalid token' });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`[WS] disconnected: ${name} — ${reason}`);
    });

    socket.on('error', (err) => {
      logger.error(`[WS] socket error for ${name}: ${err.message}`);
    });
  });

  return io;
};

// ─── Emit helpers ─────────────────────────────────────────────────────────────

/**
 * Builds the order payload — only fields consumers actually need.
 * Keeps payloads small; consumers fetch full detail via REST if needed.
 */
const orderPayload = (order) => ({
  _id: order._id,
  orderNumber: order.orderNumber,
  kotNumber: order.kotNumber,
  status: order.status,
  paymentStatus: order.paymentStatus,
  billStatus: order.billStatus,
  source: order.source,
  customerName: order.customerName,
  customerPhone: order.customerPhone,
  customerNote: order.customerNote,
  table: order.table,
  waiter: order.waiter,
  items: order.items,
  subtotal: order.subtotal,
  totalAmount: order.totalAmount,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

/**
 * emitOrderEvent
 * Routes order events to the correct rooms based on the event type and order status.
 *
 * Room routing:
 *   order:{id}  — anyone watching this specific order (POS cart, bill modal)
 *   kitchen     — chefs (confirmed / preparing / ready)
 *   pos         — waiters + managers (all statuses)
 *   managers    — managers + admins (paid / cancelled for revenue tracking)
 */
export const emitOrderEvent = (io, order, event) => {
  if (!io) return;

  const payload = orderPayload(order);

  // Always notify the specific order room
  io.to(ROOMS.order(order._id)).emit(event, payload);

  // Kitchen only cares about active cooking statuses
  const kitchenStatuses = ['confirmed', 'preparing', 'ready'];
  if (kitchenStatuses.includes(order.status) || event === EVENTS.ORDER_CANCELLED) {
    io.to(ROOMS.kitchen).emit(event, payload);
  }

  // POS gets everything
  io.to(ROOMS.pos).emit(event, payload);

  // Managers get paid/cancelled for dashboard revenue updates
  if ([EVENTS.ORDER_PAID, EVENTS.ORDER_CANCELLED].includes(event)) {
    io.to(ROOMS.managers).emit(event, payload);
  }

  logger.debug(`[WS] ${event} → order ${order.orderNumber} (status: ${order.status})`);
};

/**
 * emitTableEvent
 * Notifies POS and the specific table room when a table's status changes.
 */
export const emitTableEvent = (io, table) => {
  if (!io) return;
  const payload = {
    _id: table._id,
    number: table.number,
    status: table.status,
    currentOrder: table.currentOrder,
    location: table.location,
  };
  io.to(ROOMS.pos).emit(EVENTS.TABLE_STATUS_CHANGED, payload);
  io.to(ROOMS.table(table._id)).emit(EVENTS.TABLE_STATUS_CHANGED, payload);
};

/**
 * emitLowStockAlert
 * Sends low-stock alerts only to managers and admins.
 * Called from inventory.service after every stock mutation.
 */
export const emitLowStockAlert = (io, ingredient) => {
  if (!io) return;
  const payload = {
    _id: ingredient._id,
    name: ingredient.name,
    unit: ingredient.unit,
    quantity: ingredient.quantity,
    threshold: ingredient.threshold,
    deficit: +(ingredient.threshold - ingredient.quantity).toFixed(3),
    supplier: ingredient.supplier?.name,
  };
  io.to(ROOMS.managers).emit(EVENTS.INVENTORY_LOW_STOCK, payload);
  logger.warn(`[WS] low stock alert: ${ingredient.name} (${ingredient.quantity} ${ingredient.unit})`);
};

/**
 * emitStockUpdate
 * Notifies kitchen + managers when stock levels change.
 */
export const emitStockUpdate = (io, ingredient) => {
  if (!io) return;
  const payload = {
    _id: ingredient._id,
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    isLowStock: ingredient.quantity <= ingredient.threshold,
  };
  io.to(ROOMS.kitchen).emit(EVENTS.INVENTORY_STOCK_UPDATED, payload);
  io.to(ROOMS.managers).emit(EVENTS.INVENTORY_STOCK_UPDATED, payload);
};

/**
 * emitAnalyticsUpdate
 * Pushes a lightweight analytics snapshot to managers/admins.
 * Called after order payment to keep the dashboard live.
 */
export const emitAnalyticsUpdate = (io, snapshot) => {
  if (!io) return;
  io.to(ROOMS.managers).emit(EVENTS.ANALYTICS_SNAPSHOT, snapshot);
};

/**
 * emitCustomerOrderEvent
 * Emits a customer QR order event to all relevant rooms:
 *   kitchen — so KDS picks it up immediately
 *   pos     — so waiters see it
 *   branch:{branchId} — branch-scoped listeners
 *   table:{tableId}   — table-specific listeners (customer status page)
 *   order:{orderId}   — order-specific listeners
 *
 * Reuses the existing orderPayload shape so KDS/POS handle it identically
 * to a POS-created order.
 */
export const emitCustomerOrderEvent = (io, order, event) => {
  if (!io) return;

  const payload = orderPayload(order);

  io.to(ROOMS.kitchen).emit(event, payload);
  io.to(ROOMS.pos).emit(event, payload);
  io.to(ROOMS.order(order._id)).emit(event, payload);

  if (order.branch) {
    io.to(ROOMS.branch(order.branch)).emit(event, payload);
  }
  if (order.table) {
    io.to(ROOMS.table(order.table)).emit(event, payload);
  }

  logger.debug(`[WS] customer ${event} → order ${order.orderNumber}`);
};
