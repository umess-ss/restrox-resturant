/**
 * public.controller.js
 *
 * Unauthenticated handlers for customer QR ordering.
 * No protect/tenantContext middleware — these are fully public.
 */
import {
  resolveTable,
  getPublicMenu,
  createCustomerOrder,
  getOrderStatus,
  callWaiterForOrder,
  getPublicBill,
  requestBillForOrder,
  getReceiptPdf,
} from './public.service.js';

// ─── GET /api/public/restaurants/:restaurantId/branches/:branchId/tables/:tableId

export const getTableInfo = async (req, res) => {
  const { restaurantId, branchId, tableId } = req.params;
  const { restaurant, branch, table } = await resolveTable(restaurantId, branchId, tableId);

  res.json({
    restaurant: { id: restaurant._id, name: restaurant.name },
    branch:     { id: branch._id,     name: branch.name },
    table: {
      id:             table._id,
      number:         table.number,
      capacity:       table.capacity,
      status:         table.status,
      location:       table.location,
      hasActiveOrder: !!table.currentOrder,
    },
  });
};

// ─── GET /api/public/restaurants/:restaurantId/branches/:branchId/menu

export const getMenu = async (req, res) => {
  const { restaurantId, branchId } = req.params;
  const data = await getPublicMenu(restaurantId, branchId);
  res.json(data);
};

// ─── POST /api/public/orders

export const placeOrder = async (req, res) => {
  const { restaurantId, branchId, tableId, items, customerName, customerPhone, customerNote } = req.body;

  const order = await createCustomerOrder({
    restaurantId,
    branchId,
    tableId,
    items,
    customerName,
    customerPhone,
    customerNote,
  });

  res.status(201).json({
    success: true,
    orderId:       order._id,
    orderNumber:   order.orderNumber,
    status:        order.status,
    paymentStatus: order.paymentStatus,
    totalAmount:   order.totalAmount,
  });
};

// ─── GET /api/public/orders/:orderId/status

export const getStatus = async (req, res) => {
  const data = await getOrderStatus(req.params.orderId);
  res.json(data);
};

// ─── GET /api/public/orders/:orderId/bill

export const getBill = async (req, res) => {
  const data = await getPublicBill(req.params.orderId);
  res.json(data);
};

// ─── POST /api/public/orders/:orderId/request-bill

export const requestBill = async (req, res) => {
  const result = await requestBillForOrder(req.params.orderId);
  res.json(result);
};

// ─── GET /api/public/orders/:orderId/receipt/pdf

export const receiptPdf = async (req, res) => {
  const pdf = await getReceiptPdf(req.params.orderId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="receipt-${req.params.orderId}.pdf"`);
  res.send(pdf);
};

// ─── POST /api/public/orders/:orderId/call-waiter

export const callWaiter = async (req, res) => {
  const result = await callWaiterForOrder(req.params.orderId);
  res.json(result);
};
