import { Router } from 'express';
import { body } from 'express-validator';
import { protect } from '../../middlewares/auth.middleware.js';
import { tenantContext } from '../../middlewares/tenant.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import { createFeedback, getFeedback } from './feedback.controller.js';

const router = Router();

router.use(protect, tenantContext);

router.get('/', getFeedback);

router.post(
  '/',
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional({ values: 'falsy' }).trim().isLength({ max: 600 }),
    body('customerName').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
    body('customerPhone').optional({ values: 'falsy' }).trim().isLength({ max: 30 }),
  ],
  validate,
  createFeedback
);

export default router;
