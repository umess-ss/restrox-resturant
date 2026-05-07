import { Router } from 'express';
import { protect, minRole } from '../../middlewares/auth.middleware.js';
import {
  salesOverview,
  revenueTrend,
  topSellingItems,
  salesByCategory,
  hourlyDistribution,
  paymentMethods,
  inventorySummary,
  profitAnalysis,
  staffPerformance,
  orderFunnel,
  dashboardSnapshot,
} from './analytics.controller.js';

const router = Router();

// All analytics require at least manager role
router.use(protect, minRole('manager'));

router.get('/snapshot', dashboardSnapshot);
router.get('/overview', salesOverview);
router.get('/revenue-trend', revenueTrend);
router.get('/top-items', topSellingItems);
router.get('/sales-by-category', salesByCategory);
router.get('/hourly', hourlyDistribution);
router.get('/payment-methods', paymentMethods);
router.get('/inventory', inventorySummary);
router.get('/profit-analysis', profitAnalysis);
router.get('/staff-performance', staffPerformance);
router.get('/order-funnel', orderFunnel);

export default router;
