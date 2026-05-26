import mongoose from 'mongoose';
import { tenantFields, addTenantIndexes } from '../../plugins/tenantPlugin.js';

const feedbackSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      default: null,
    },
    customerName: { type: String, trim: true, maxlength: 80 },
    customerPhone: { type: String, trim: true, maxlength: 30 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 600 },
    sentiment: {
      type: String,
      enum: ['positive', 'bad'],
      default: 'positive',
      index: true,
    },
    source: {
      type: String,
      enum: ['customer_qr', 'staff'],
      default: 'customer_qr',
    },
  },
  { timestamps: true }
);

feedbackSchema.pre('validate', function setSentiment(next) {
  this.sentiment = this.rating >= 4 ? 'positive' : 'bad';
  next();
});

feedbackSchema.add(tenantFields(true));
addTenantIndexes(feedbackSchema, true);
feedbackSchema.index({ restaurant: 1, branch: 1, order: 1 }, { unique: true, sparse: true });

export default mongoose.model('Feedback', feedbackSchema);
