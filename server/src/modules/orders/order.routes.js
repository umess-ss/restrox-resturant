import { Router } from 'express';
import { getOrders, getOrder, createOrder, updateOrderStatus, markOrderPaid } from './order.controller.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

router.get('/', getOrders);
router.get('/:id', getOrder);
router.post('/', createOrder);
router.patch('/:id/status', updateOrderStatus);
router.patch('/:id/pay', authorize('admin', 'manager'), markOrderPaid);

export default router;
