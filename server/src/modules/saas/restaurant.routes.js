import { Router } from 'express';
import { body } from 'express-validator';
import { protect, authorize } from '../../middlewares/auth.middleware.js';
import { tenantContext, checkPlanLimit } from '../../middlewares/tenant.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  onboardRestaurant,
  getMyRestaurant,
  updateRestaurant,
  getBranches,
  getBranch,
  createBranch,
  updateBranch,
  deactivateBranch,
  listAllRestaurants,
  updateRestaurantPlan,
} from './restaurant.controller.js';

const router = Router();

// ─── Public: onboarding (no auth required) ───────────────────────────────────
router.post(
  '/onboard',
  [
    body('restaurantName').trim().notEmpty().withMessage('Restaurant name required'),
    body('ownerName').trim().notEmpty().withMessage('Owner name required'),
    body('ownerEmail').isEmail().withMessage('Valid email required'),
    body('ownerPassword').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  ],
  validate,
  onboardRestaurant
);

// ─── Restaurant (admin of that restaurant) ────────────────────────────────────
router.get('/me', protect, tenantContext, getMyRestaurant);
router.put('/me', protect, tenantContext, authorize('admin'), updateRestaurant);

// ─── Branches ─────────────────────────────────────────────────────────────────
router.get('/branches', protect, tenantContext, getBranches);
router.get('/branches/:id', protect, tenantContext, getBranch);
router.post(
  '/branches',
  protect,
  tenantContext,
  authorize('admin'),
  checkPlanLimit('branches'),
  [body('name').trim().notEmpty()],
  validate,
  createBranch
);
router.put('/branches/:id', protect, tenantContext, authorize('admin'), updateBranch);
router.delete('/branches/:id', protect, tenantContext, authorize('admin'), deactivateBranch);

// ─── Superadmin only ──────────────────────────────────────────────────────────
const superadminOnly = (req, res, next) => {
  if (req.user.systemRole !== 'superadmin') {
    return res.status(403).json({ message: 'Superadmin access required' });
  }
  next();
};

router.get('/admin/restaurants', protect, superadminOnly, listAllRestaurants);
router.patch('/admin/restaurants/:id/plan', protect, superadminOnly, updateRestaurantPlan);

export default router;
