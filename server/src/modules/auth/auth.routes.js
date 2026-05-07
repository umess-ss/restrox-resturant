import { Router } from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  logout,
  refresh,
  getMe,
  changePassword,
  updateProfile,
} from './auth.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';

const router = Router();

// ─── Public ──────────────────────────────────────────────────────────────────

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

router.post('/refresh', refresh);

// ─── Protected ───────────────────────────────────────────────────────────────

router.use(protect); // all routes below require a valid JWT

router.post('/logout', logout);
router.get('/me', getMe);

router.patch(
  '/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  validate,
  changePassword
);

router.patch(
  '/profile',
  [body('name').trim().notEmpty().withMessage('Name is required')],
  validate,
  updateProfile
);

export default router;
