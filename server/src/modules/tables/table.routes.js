import { Router } from 'express';
import { getTables, createTable, updateTable, deleteTable } from './table.controller.js';
import { protect, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/', protect, getTables);
router.post('/', protect, authorize('admin', 'manager'), createTable);
router.put('/:id', protect, authorize('admin', 'manager'), updateTable);
router.delete('/:id', protect, authorize('admin'), deleteTable);

export default router;
