import { Router } from 'express';
import { body, param } from 'express-validator';
import jwt from 'jsonwebtoken';
import validate from '../../middlewares/validate.middleware.js';
import User from '../auth/auth.model.js';
import { initiatePayment, verifyPayment, getPaymentsForOrder } from './payment.controller.js';

const router = Router();

const optionalUser = async (req, _res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
  } catch {
    // Public QR payments are allowed without auth.
  }
  next();
};

router.use(optionalUser);

router.post(
  '/initiate',
  [
    body('orderId').isMongoId().withMessage('Valid order ID required'),
    body('method').isIn(['cash', 'esewa', 'khalti', 'qr', 'card']).withMessage('Invalid payment method'),
    body('amount').optional().isNumeric().withMessage('Amount must be numeric'),
  ],
  validate,
  initiatePayment
);

router.post(
  '/verify',
  [
    body('paymentId').isMongoId().withMessage('Valid payment ID required'),
    body('status').optional().isIn(['success', 'failed']).withMessage('Invalid payment status'),
  ],
  validate,
  verifyPayment
);

router.get(
  '/order/:orderId',
  [param('orderId').isMongoId().withMessage('Valid order ID required')],
  validate,
  getPaymentsForOrder
);

export default router;
