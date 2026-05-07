import { Router } from 'express';
import { body } from 'express-validator';
import { protect, can, authorize } from '../../middlewares/auth.middleware.js';
import { tenantContext } from '../../middlewares/tenant.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  getOrders, getOrder, getKitchenOrders, createOrder, addItems,
  updateOrderStatus, printKOT, getBill, checkoutOrder, cancelOrder, updateItemStatus,
} from './order.controller.js';

const router = Router();
router.use(protect, tenantContext); // all order routes require tenant context

// ─── Kitchen display (before /:id) ───────────────────────────────────────────
router.get('/kitchen', can('orders:read'), getKitchenOrders);

// ─── Collection ───────────────────────────────────────────────────────────────
router.get('/', can('orders:read'), getOrders);

router.post(
  '/',
  can('orders:write'),
  [
    body('table').isMongoId().withMessage('Valid table ID required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.menuItem').isMongoId().withMessage('Valid menu item ID required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be >= 1'),
  ],
  validate,
  createOrder
);

// ─── Single order ─────────────────────────────────────────────────────────────
router.get('/:id', can('orders:read'), getOrder);

router.post(
  '/:id/items',
  can('orders:write'),
  [
    body('items').isArray({ min: 1 }),
    body('items.*.menuItem').isMongoId(),
    body('items.*.quantity').isInt({ min: 1 }),
  ],
  validate,
  addItems
);

router.patch(
  '/:id/status',
  can('orders:write'),
  [body('status').notEmpty().withMessage('Status is required')],
  validate,
  updateOrderStatus
);

router.post('/:id/kot', can('orders:write'), printKOT);

router.get('/:id/bill', can('orders:read'), getBill);

router.post(
  '/:id/checkout',
  can('orders:pay'),
  [body('paymentMethod').isIn(['cash', 'card', 'upi', 'wallet', 'complimentary']).withMessage('Invalid payment method')],
  validate,
  checkoutOrder
);

router.post('/:id/cancel', can('orders:write'), cancelOrder);

router.patch(
  '/:id/items/:itemId/status',
  can('orders:write'),
  [body('status').isIn(['pending', 'preparing', 'ready']).withMessage('Invalid item status')],
  validate,
  updateItemStatus
);

export default router;
