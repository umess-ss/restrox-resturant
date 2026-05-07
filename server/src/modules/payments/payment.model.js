import mongoose from 'mongoose';
import { tenantFields, addTenantIndexes } from '../../plugins/tenantPlugin.js';

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['cash', 'esewa', 'khalti', 'qr', 'card'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    transactionId: { type: String, trim: true },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed },
    paidAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    source: {
      type: String,
      enum: ['pos', 'customer_qr'],
      default: 'pos',
      index: true,
    },
  },
  { timestamps: true }
);

paymentSchema.add(tenantFields(true, false));
addTenantIndexes(paymentSchema, true);

export default mongoose.model('Payment', paymentSchema);
