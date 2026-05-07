import { Router } from 'express';
import { getStaff, updateStaff, deleteStaff } from './staff.controller.js';
import { protect, can, selfOrAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

router.get('/', can('staff:read'), getStaff);
router.put('/:id', can('staff:write'), updateStaff);
router.delete('/:id', can('staff:delete'), deleteStaff);

export default router;
