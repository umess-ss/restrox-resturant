import { Router } from 'express';
import { getStaff, updateStaff, deleteStaff } from './staff.controller.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(protect, authorize('admin', 'manager'));

router.get('/', getStaff);
router.put('/:id', updateStaff);
router.delete('/:id', authorize('admin'), deleteStaff);

export default router;
