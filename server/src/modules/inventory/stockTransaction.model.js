import mongoose from 'mongoose';

/**
 * Immutable ledger of every stock movement.
 * Never update or delete records — append only.
 * The ingredient.quantity field is the running total derived from these records.
 */
const stockTransactionSchema = new mongoose.Schema(
  {
    ingredient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ingredient',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'stock_in',    // purchase / delivery
        'stock_out',   // recipe deduction when order is served
        'wastage',     // spoilage, spillage, expired
        'adjustment',  // manual correction by manager/admin
      ],
    },
    quantity: { type: Number, required: true }, // positive = in, negative = out
    quantityBefore: { type: Number, required: true },
    quantityAfter: { type: Number, required: true },
    costPerUnit: { type: Number }, // snapshot at time of transaction
    reference: {
      // Optional link to the source document
      kind: { type: String, enum: ['Order', 'Wastage', 'Manual'] },
      id: { type: mongoose.Schema.Types.ObjectId },
    },
    notes: { type: String, trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    // Prevent accidental updates to the ledger
    statics: {
      disableUpdate: true,
    },
  }
);

// Compound index for efficient per-ingredient history queries
stockTransactionSchema.index({ ingredient: 1, createdAt: -1 });

export default mongoose.model('StockTransaction', stockTransactionSchema);
