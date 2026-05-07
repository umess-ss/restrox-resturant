import mongoose from 'mongoose';
import { tenantFields, addTenantIndexes } from '../../plugins/tenantPlugin.js';

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contact: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
  },
  { _id: false }
);

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    unit: {
      type: String,
      required: true,
      enum: ['kg', 'g', 'l', 'ml', 'pcs', 'dozen', 'box'],
    },
    // Current stock level — always derived from transactions but cached here for fast reads
    quantity: { type: Number, required: true, default: 0, min: 0 },
    // When quantity drops to or below this, a low-stock alert is triggered
    threshold: { type: Number, required: true, min: 0 },
    costPerUnit: { type: Number, required: true, min: 0 },
    supplier: { type: supplierSchema, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Tenant fields — inventory is branch-scoped
ingredientSchema.add(tenantFields(true));
addTenantIndexes(ingredientSchema, true);
// Names must be unique per restaurant+branch (not globally)
ingredientSchema.index({ restaurant: 1, branch: 1, name: 1 }, { unique: true });

// Virtual: true when stock is at or below threshold
ingredientSchema.virtual('isLowStock').get(function () {
  return this.quantity <= this.threshold;
});

ingredientSchema.set('toJSON', { virtuals: true });
ingredientSchema.set('toObject', { virtuals: true });

export default mongoose.model('Ingredient', ingredientSchema);
