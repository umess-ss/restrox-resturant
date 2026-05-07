/**
 * public.controller.js
 *
 * Unauthenticated handlers for customer QR ordering.
 * No protect/tenantContext middleware — these are fully public.
 */
import {
  resolveTable,
  getPublicMenu,
  placeCustomerOrder,
  getOrderStatus,
} from './public.service.js';
import { getIO } from '../../socket/io.js';
import { EVENTS } from '../../socket/events.js';

// ─── GET /api/public/restaurants/:restaurantId/branches/:branchId/tables/:tableId

export const getTableInfo = async (req, res) => {
  const { restaurantId, branchId, tableId } = req.params;
  const { restaurant, branch, table } = await resolveTable(restaurantId, branchId, tableId);

  res.json({
    restaurant: { id: restaurant._id, name: restaurant.name },
    branch: { id: branch._id, name: branch.name },
    table: {
      id: table._id,
      number: table.number,
      capacity: table.capacity,
      status: table.status,
      location: table.location,
      hasActiveOrder: !!table.currentOrder,
    },
  });
};

// ─── GET /api/public/restaurants/:restaurantId/branches/:branchId/menu

export const getMenu = async (req, res) => {
  const { restaurantId } = req.params;
  const data = await getPublicMenu(restaurantId);
  res.json(data);
};

// ─── POST /api/public/orders

export const createCustomerOrder = async (req, res) => {
  const { restaurantId, branchId, tableId, items, customerName, notes } = req.body;

  if (!restaurantId || !branchId || !tableId) {
    return res.status(422).json({ message: 'restaurantId, branchId, and tableId are required' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(422).json({ message: 'At least one item is required' });
  }

  const order = await placeCustomerOrder({ restaurantId, branchId, tableId, items, customerName, notes });

  res.status(201).json({
    orderId: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    message: 'Order placed successfully',
  });
};

// ─── GET /api/public/orders/:orderId/status

export const getStatus = async (req, res) => {
  const data = await getOrderStatus(req.params.orderId);
  res.json(data);
};

// ─── POST /api/public/orders/:orderId/call-waiter

export const callWaiter = async (req, res) => {
  const { orderId } = req.params;
  const io = getIO();

  // Emit to the POS room so waiters see the alert immediately
  if (io) {
    io.to('pos').emit('customer:call_waiter', {
      orderId,
      message: 'Customer is requesting assistance',
      at: new Date(),
    });
  }

  res.json({ message: 'Waiter notified' });
};
