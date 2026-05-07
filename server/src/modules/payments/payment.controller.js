import {
  initiatePayment as svcInitiate,
  verifyPayment as svcVerify,
  getPaymentsForOrder as svcGetForOrder,
} from './payment.service.js';

export const initiatePayment = async (req, res) => {
  const result = await svcInitiate({
    orderId: req.body.orderId,
    method: req.body.method,
    amount: req.body.amount,
    transactionId: req.body.transactionId,
    source: req.body.source,
    userId: req.user?._id,
  });
  res.status(201).json(result);
};

export const verifyPayment = async (req, res) => {
  const payment = await svcVerify({
    paymentId: req.body.paymentId,
    status: req.body.status,
    transactionId: req.body.transactionId,
    gatewayResponse: req.body.gatewayResponse,
    userId: req.user?._id,
  });
  res.json({ payment });
};

export const getPaymentsForOrder = async (req, res) => {
  const payments = await svcGetForOrder(req.params.orderId);
  res.json(payments);
};
