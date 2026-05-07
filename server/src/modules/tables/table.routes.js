import { Router } from 'express';
import { getTables, getTable, createTable, updateTable, deleteTable, getTableOrder, getTableQR } from './table.controller.js';
import { protect, can, authorize } from '../../middlewares/auth.middleware.js';
import { tenantContext } from '../../middlewares/tenant.middleware.js';

const router = Router();
router.use(protect, tenantContext);

router.get('/', can('tables:read'), getTables);
router.get('/:id', can('tables:read'), getTable);
router.get('/:id/order', can('tables:read'), getTableOrder);
router.get('/:id/qr', authorize('admin', 'manager'), getTableQR);
router.post('/', can('tables:write'), createTable);
router.put('/:id', can('tables:write'), updateTable);
router.delete('/:id', can('tables:delete'), deleteTable);

export default router;
