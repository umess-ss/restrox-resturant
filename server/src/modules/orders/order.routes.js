import { Router } from 'express';
import { getOrders, getOrder, createOrder, updateOrderStatus, markOrderPaid } from './order.controller.js';
import { protect, can } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

router.get('/', can('orders:read'), getOrders);
router.get('/:id', can('orders:read'), getOrder);
router.post('/', can('orders:write'), createOrder);
router.patch('/:id/status', can('orders:write'), updateOrderStatus);
router.patch('/:id/pay', can('orders:pay'), markOrderPaid);

export default router;
