import mongoose from 'mongoose';

/**
 * A Branch is a physical location of a Restaurant.
 * Inventory and orders are scoped to a branch.
 * Menu items are scoped to the restaurant (shared across branches by default).
 */
const branchSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    timezone: { type: String },
    taxRate: { type: Number }, // overrides restaurant default if set
    isActive: { type: Boolean, default: true },
    isHeadquarters: { type: Boolean, default: false },

    // Branch-specific settings
    settings: {
      allowOnlineOrders: { type: Boolean, default: false },
      tableCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Compound index: branch names must be unique within a restaurant
branchSchema.index({ restaurant: 1, name: 1 }, { unique: true });

export default mongoose.model('Branch', branchSchema);
