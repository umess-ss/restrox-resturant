import { Router } from 'express';
import { getTables, createTable, updateTable, deleteTable } from './table.controller.js';
import { protect, can } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

router.get('/', can('tables:read'), getTables);
router.post('/', can('tables:write'), createTable);
router.put('/:id', can('tables:write'), updateTable);
router.delete('/:id', can('tables:delete'), deleteTable);

export default router;
