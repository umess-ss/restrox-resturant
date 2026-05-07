import mongoose from 'mongoose';
import { tenantFields, addTenantIndexes } from '../../plugins/tenantPlugin.js';

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ['appetizer', 'main', 'dessert', 'beverage', 'special'],
      required: true,
    },
    imageUrl: { type: String },
    isAvailable: { type: Boolean, default: true },
    preparationTime: { type: Number, default: 15 }, // minutes

    // Tags for filtering / display (e.g. 'vegan', 'spicy', 'gluten-free')
    tags: [{ type: String, trim: true, lowercase: true }],

    // Allergen declarations
    allergens: [
      {
        type: String,
        enum: ['gluten', 'dairy', 'eggs', 'nuts', 'soy', 'shellfish', 'fish', 'sesame'],
      },
    ],

    /**
     * Fixed overhead cost per serving (packaging, gas, labour share, etc.)
     * Added on top of ingredient cost when calculating profit margin.
     * Defaults to 0 — managers set this per item.
     */
    overheadCost: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Virtual: recipe is populated separately but we expose a helper flag
menuItemSchema.virtual('hasRecipe').get(function () {
  return Boolean(this._recipe);
});

menuItemSchema.set('toJSON', { virtuals: true });
menuItemSchema.set('toObject', { virtuals: true });

// Menu items are restaurant-scoped (shared across branches by default)
menuItemSchema.add(tenantFields(false));
addTenantIndexes(menuItemSchema, false);

export default mongoose.model('MenuItem', menuItemSchema);
