import mongoose from 'mongoose';

const wastageSchema = new mongoose.Schema(
  {
    ingredient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ingredient',
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    reason: {
      type: String,
      required: true,
      enum: ['expired', 'spoiled', 'damaged', 'spillage', 'other'],
    },
    notes: { type: String, trim: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Automatically creates a stock_out transaction when saved
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction' },
  },
  { timestamps: true }
);

export default mongoose.model('Wastage', wastageSchema);
