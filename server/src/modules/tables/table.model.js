import mongoose from 'mongoose';
import { tenantFields, addTenantIndexes } from '../../plugins/tenantPlugin.js';

const tableSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    capacity: { type: Number, required: true, min: 1 },
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

// Tables are branch-scoped — table number 1 can exist in every branch
tableSchema.add(tenantFields(true));
addTenantIndexes(tableSchema, true);
tableSchema.index({ restaurant: 1, branch: 1, number: 1 }, { unique: true });

export default mongoose.model('Table', tableSchema);
