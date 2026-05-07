import { Router } from 'express';
import { getMenuItems, getMenuItem, createMenuItem, updateMenuItem, deleteMenuItem } from './menu.controller.js';
import { protect, can } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/', getMenuItems);                                    // public
router.get('/:id', getMenuItem);                                  // public
router.post('/', protect, can('menu:write'), createMenuItem);
router.put('/:id', protect, can('menu:write'), updateMenuItem);
router.delete('/:id', protect, can('menu:delete'), deleteMenuItem);

export default router;
