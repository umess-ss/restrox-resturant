import Order from '../orders/order.model.js';
import Payment from './payment.model.js';
import { checkout } from '../orders/order.service.js';

const METHODS = ['cash', 'esewa', 'khalti', 'qr', 'card'];

const assertMethod = (method) => {
  if (!METHODS.includes(method)) {
    throw Object.assign(new Error('Invalid payment method'), { status: 422 });
  }
};

const assertAmountMatches = (clientAmount, orderAmount) => {
  if (clientAmount === undefined || clientAmount === null) return;
  if (Number(clientAmount).toFixed(2) !== Number(orderAmount).toFixed(2)) {
    throw Object.assign(new Error('Payment amount does not match order total'), { status: 422 });
  }
};

const mockGatewayVerify = ({ method, status }) => ({
  provider: method,
  mode: 'mock',
  verified: status === 'success',
});

export const initiatePayment = async ({ orderId, method, amount, transactionId, source, userId }) => {
  assertMethod(method);

  const order = await Order.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.paymentStatus === 'paid') throw Object.assign(new Error('Order already paid'), { status: 409 });

  assertAmountMatches(amount, order.totalAmount);

  const payment = await Payment.create({
    order: order._id,
    amount: order.totalAmount,
    method,
    transactionId,
    source: source || order.source || 'pos',
    createdBy: userId,
    restaurant: order.restaurant,
    branch: order.branch,
    status: 'pending',
  });

  return { payment, orderTotal: order.totalAmount, mock: ['esewa', 'khalti'].includes(method) };
};

export const verifyPayment = async ({ paymentId, status = 'success', transactionId, gatewayResponse, userId }) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 });
  if (payment.status === 'success') return payment;

  const order = await Order.findById(payment.order);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.paymentStatus === 'paid') throw Object.assign(new Error('Order already paid'), { status: 409 });

  payment.gatewayResponse = gatewayResponse || mockGatewayVerify({ method: payment.method, status });
  payment.transactionId = transactionId || payment.transactionId;

  if (status !== 'success') {
    payment.status = 'failed';
    await payment.save();
    return payment;
  }

  await checkout(order._id, { paymentMethod: payment.method, transactionId: payment.transactionId }, userId);
  payment.status = 'success';
  payment.paidAt = new Date();
  await payment.save();
  return payment;
};

export const getPaymentsForOrder = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  return Payment.find({ order: orderId })
    .select('order amount method status transactionId gatewayResponse paidAt source createdAt')
    .sort('-createdAt');
};

export const getLatestSuccessfulPayment = (orderId) =>
  Payment.findOne({ order: orderId, status: 'success' }).sort('-paidAt -createdAt').lean();
