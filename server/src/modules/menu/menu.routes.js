import { Router } from 'express';
import { getMenuItems, getMenuItem, createMenuItem, updateMenuItem, deleteMenuItem } from './menu.controller.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/', getMenuItems);
router.get('/:id', getMenuItem);
router.post('/', protect, authorize('admin', 'manager'), createMenuItem);
router.put('/:id', protect, authorize('admin', 'manager'), updateMenuItem);
router.delete('/:id', protect, authorize('admin'), deleteMenuItem);

export default router;
