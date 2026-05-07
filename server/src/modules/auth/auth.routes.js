import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getMe } from './auth.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';

const router = Router();

router.post(
  '/register',
  [body('email').isEmail(), body('password').isLength({ min: 6 }), body('name').notEmpty()],
  validate,
  register
);
router.post('/login', [body('email').isEmail(), body('password').notEmpty()], validate, login);
router.get('/me', protect, getMe);

export default router;
