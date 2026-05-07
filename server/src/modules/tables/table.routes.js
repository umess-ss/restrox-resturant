import { Router } from 'express';
import { getTables, getTable, createTable, updateTable, deleteTable, getTableOrder } from './table.controller.js';
import { protect, can } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(protect);

router.get('/', can('tables:read'), getTables);
router.get('/:id', can('tables:read'), getTable);
router.get('/:id/order', can('tables:read'), getTableOrder);
router.post('/', can('tables:write'), createTable);
router.put('/:id', can('tables:write'), updateTable);
router.delete('/:id', can('tables:delete'), deleteTable);

export default router;
