import mongoose from 'mongoose';
import { tenantFields, addTenantIndexes } from '../../plugins/tenantPlugin.js';

const tableSchema = new mongoose.Schema(
  {
    tableId: { type: String, sparse: true }, // e.g. TABLE-0001
    number: { type: Number, required: true }, // unique enforced by compound index below
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

tableSchema.pre('save', async function (next) {
  if (!this.isNew || this.tableId) return next();

  const prefix = 'TABLE-';
  const latest = await mongoose
    .model('Table')
    .findOne({
      restaurant: this.restaurant,
      branch: this.branch,
      tableId: new RegExp(`^${prefix}`),
    })
    .sort({ tableId: -1 })
    .select('tableId')
    .lean();

  const latestNumber = Number(latest?.tableId?.slice(prefix.length)) || 0;
  this.tableId = `${prefix}${String(latestNumber + 1).padStart(4, '0')}`;
  next();
});

// Tables are branch-scoped — table number 1 can exist in every branch
tableSchema.add(tenantFields(true));
addTenantIndexes(tableSchema, true);
tableSchema.index({ restaurant: 1, branch: 1, number: 1 }, { unique: true });
tableSchema.index(
  { restaurant: 1, branch: 1, tableId: 1 },
  { unique: true, partialFilterExpression: { tableId: { $type: 'string' } } }
);

export default mongoose.model('Table', tableSchema);
