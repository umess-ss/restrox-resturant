import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import authRoutes from './modules/auth/auth.routes.js';
import menuRoutes from './modules/menu/menu.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import tableRoutes from './modules/tables/table.routes.js';
import staffRoutes from './modules/staff/staff.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import saasRoutes from './modules/saas/restaurant.routes.js';
import publicRoutes from './modules/public/public.routes.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Rate limiting — relaxed in development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
});
app.use('/api', limiter);

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  message: { message: 'Too many auth attempts, please try again later' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/saas', saasRoutes);
app.use('/api/public', publicRoutes); // unauthenticated customer QR ordering

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
