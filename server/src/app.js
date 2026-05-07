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

// ─── CORS — must be first, before Helmet and rate limiters ───────────────────
//
// Allowed origins are built from env vars — nothing is hardcoded.
//   CLIENT_URL      → primary origin (used for QR generation too)
//   CORS_ORIGINS    → comma-separated extra origins (e.g. LAN IP for mobile testing)
//
// Hardcoded localhost/127.0.0.1 entries ensure the laptop browser always works
// even if CLIENT_URL is set to the LAN IP for mobile testing.
const allowedOrigins = new Set(
  [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://192.168.18.6:5173',
    process.env.CLIENT_URL,
    ...(process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : []),
  ].filter(Boolean)
);

const corsOptions = {
  origin: (origin, callback) => {
    // No origin header = curl / Postman / server-to-server — always allow
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    // Pass false (not an Error) — cors package sends 403, not 500
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 204, // some browsers need 204 for preflight
};

// Respond to ALL preflight OPTIONS requests immediately — before any other middleware
app.options('*', cors(corsOptions));

// Apply CORS to all subsequent requests
app.use(cors(corsOptions));

// ─── Security & parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Skip OPTIONS requests so preflight is never rate-limited
const skipOptions = (req) => req.method === 'OPTIONS';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  skip: skipOptions,
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 200,
  message: { message: 'Too many auth attempts, please try again later' },
  skip: skipOptions,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/saas', saasRoutes);
app.use('/api/public', publicRoutes);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
