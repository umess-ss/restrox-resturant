import mongoose from 'mongoose';

// ─── Subscription plans ───────────────────────────────────────────────────────

export const PLANS = Object.freeze({
  TRIAL:      'trial',       // 14 days, 1 branch, 5 staff
  STARTER:    'starter',     // 1 branch, 20 staff
  GROWTH:     'growth',      // 3 branches, 50 staff
  ENTERPRISE: 'enterprise',  // unlimited
});

const PLAN_LIMITS = {
  trial:      { branches: 1,  staff: 5,   ordersPerMonth: 500  },
  starter:    { branches: 1,  staff: 20,  ordersPerMonth: 5000 },
  growth:     { branches: 3,  staff: 50,  ordersPerMonth: 50000 },
  enterprise: { branches: -1, staff: -1,  ordersPerMonth: -1   }, // -1 = unlimited
};

export const getPlanLimits = (plan) => PLAN_LIMITS[plan] || PLAN_LIMITS.trial;

// ─── Schema ───────────────────────────────────────────────────────────────────

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    logo: { type: String },
    address: { type: String, trim: true },
    timezone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'USD' },
    taxRate: { type: Number, default: 0.1 },

    // Subscription
    plan: { type: String, enum: Object.values(PLANS), default: PLANS.TRIAL },
    planStartedAt: { type: Date, default: Date.now },
    planExpiresAt: { type: Date },
    isActive: { type: Boolean, default: true },

    // Owner (the user who registered the restaurant)
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Feature flags per restaurant
    features: {
      kds:        { type: Boolean, default: true },
      inventory:  { type: Boolean, default: true },
      payroll:    { type: Boolean, default: false }, // payroll only on growth+
      analytics:  { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

// Virtual: is the subscription currently valid?
restaurantSchema.virtual('isSubscriptionActive').get(function () {
  if (!this.planExpiresAt) return true; // enterprise / no expiry
  return this.planExpiresAt > new Date();
});

restaurantSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Restaurant', restaurantSchema);
