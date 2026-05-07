import mongoose from 'mongoose';

const tableSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    capacity: { type: Number, required: true },
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved', 'cleaning'],
      default: 'available',
    },
    location: {
      type: String,
      enum: ['indoor', 'outdoor', 'bar'],
      default: 'indoor',
    },
    // Active order on this table — set when order is created, cleared on payment
    currentOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    // Placeholder for QR-code-based ordering (URL or token)
    qrCode: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('Table', tableSchema);
