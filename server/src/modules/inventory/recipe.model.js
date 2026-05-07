import mongoose from 'mongoose';
import { tenantFields, addTenantIndexes } from '../../plugins/tenantPlugin.js';

/**
 * Maps a MenuItem to the ingredients it consumes when served.
 * One recipe per menu item (upsert on menuItem).
 * Restaurant-scoped — recipes belong to the restaurant, not a branch.
 */
const recipeIngredientSchema = new mongoose.Schema(
  {
    ingredient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ingredient',
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 }, // per 1 serving
  },
  { _id: false }
);

const recipeSchema = new mongoose.Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
      unique: true,
      index: true,
    },
    ingredients: {
      type: [recipeIngredientSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: 'A recipe must have at least one ingredient',
      },
    },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Restaurant-scoped — unique recipe per menuItem per restaurant
recipeSchema.add(tenantFields(false));
addTenantIndexes(recipeSchema, false);

export default mongoose.model('Recipe', recipeSchema);
