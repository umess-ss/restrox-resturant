/**
 * public.routes.js
 *
 * All routes here are unauthenticated — no protect or tenantContext middleware.
 * A dedicated rate limiter is applied to prevent abuse.
 */
import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import validate from '../../middlewares/validate.middleware.js';
import {
  getTableInfo,
  getMenu,
  placeOrder,
  getStatus,
  callWaiter,
} from './public.controller.js';

const router = Router();

// General public limiter — 30 req/min per IP
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limiter for call-waiter — 5 req/min per IP to prevent spam
const callWaiterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: 'Too many waiter calls, please wait a moment' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(publicLimiter);

// ─── Table info ───────────────────────────────────────────────────────────────
router.get(
  '/restaurants/:restaurantId/branches/:branchId/tables/:tableId',
  getTableInfo
);

// ─── Menu ─────────────────────────────────────────────────────────────────────
router.get(
  '/restaurants/:restaurantId/branches/:branchId/menu',
  getMenu
);

// ─── Order placement ──────────────────────────────────────────────────────────
router.post(
  '/orders',
  [
    body('restaurantId').isMongoId().withMessage('Valid restaurantId required'),
    body('branchId').isMongoId().withMessage('Valid branchId required'),
    body('tableId').isMongoId().withMessage('Valid tableId required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.menuItem').isMongoId().withMessage('Valid menuItem ID required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be >= 1'),
    body('items.*.notes').optional().trim().isLength({ max: 100 }),
    body('customerName').optional().trim().isLength({ max: 60 }),
    body('customerPhone').optional().trim().isLength({ max: 20 }),
    body('customerNote').optional().trim().isLength({ max: 200 }),
  ],
  validate,
  placeOrder
);

// ─── Order status polling ─────────────────────────────────────────────────────
router.get('/orders/:orderId/status', getStatus);

// ─── Call waiter ──────────────────────────────────────────────────────────────
router.post('/orders/:orderId/call-waiter', callWaiterLimiter, callWaiter);

export default router;
