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
  createCustomerOrder,
  getStatus,
  callWaiter,
} from './public.controller.js';

const router = Router();

// Stricter rate limit for public endpoints — 30 requests per minute per IP
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: 'Too many requests, please slow down' },
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
    body('customerName').optional().trim().isLength({ max: 60 }),
    body('notes').optional().trim().isLength({ max: 200 }),
  ],
  validate,
  createCustomerOrder
);

// ─── Order status polling ─────────────────────────────────────────────────────
router.get('/orders/:orderId/status', getStatus);

// ─── Call waiter ──────────────────────────────────────────────────────────────
router.post('/orders/:orderId/call-waiter', callWaiter);

export default router;
