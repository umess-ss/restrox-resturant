import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../modules/auth/auth.model.js';
import logger from '../config/logger.js';

/**
 * Initializes Socket.IO server and attaches to the HTTP server.
 * Returns the io instance for use in controllers.
 */
export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ─── Auth middleware ────────────────────────────────────────────────────────

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user || !user.isActive) return next(new Error('User not found or inactive'));

      socket.user = user; // attach user to socket
      next();
    } catch (err) {
      logger.error(`Socket auth failed: ${err.message}`);
      next(new Error('Invalid token'));
    }
  });

  // ─── Connection handler ─────────────────────────────────────────────────────

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.user.name} (${socket.user.role})`);

    // Auto-join role-based rooms
    socket.join(`role:${socket.user.role}`);

    // Join kitchen room if chef
    if (socket.user.role === 'chef') {
      socket.join('kitchen');
      logger.info(`${socket.user.name} joined kitchen room`);
    }

    // Join POS room if waiter/manager/admin
    if (['waiter', 'manager', 'admin'].includes(socket.user.role)) {
      socket.join('pos');
    }

    // ─── Client → Server events ──────────────────────────────────────────────

    socket.on('join:order', (orderId) => {
      socket.join(`order:${orderId}`);
      logger.debug(`${socket.user.name} joined order:${orderId}`);
    });

    socket.on('leave:order', (orderId) => {
      socket.leave(`order:${orderId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.user.name}`);
    });
  });

  return io;
};

/**
 * Emits an order update to all relevant rooms.
 * Called by order service after mutations.
 */
export const emitOrderUpdate = (io, order, event = 'order:updated') => {
  if (!io) return;

  const payload = {
    _id: order._id,
    orderNumber: order.orderNumber,
    kotNumber: order.kotNumber,
    status: order.status,
    table: order.table,
    items: order.items,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };

  // Emit to specific order room
  io.to(`order:${order._id}`).emit(event, payload);

  // Emit to kitchen if order is in kitchen-relevant statuses
  if (['confirmed', 'preparing', 'ready'].includes(order.status)) {
    io.to('kitchen').emit(event, payload);
  }

  // Emit to POS
  io.to('pos').emit(event, payload);

  logger.debug(`Emitted ${event} for order ${order.orderNumber}`);
};
