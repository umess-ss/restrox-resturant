import mongoose from 'mongoose';
import { tenantFields, addTenantIndexes } from '../../plugins/tenantPlugin.js';

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true },       // snapshot at order time
    price: { type: Number, required: true },       // snapshot at order time
    quantity: { type: Number, required: true, min: 1 },
    notes: { type: String, trim: true },           // e.g. "no onions"
    kotPrinted: { type: Boolean, default: false }, // has this item been sent to kitchen?
    // Item-level KDS status — chef updates per item
    itemStatus: {
      type: String,
      enum: ['pending', 'preparing', 'ready'],
      default: 'pending',
    },
  },
  { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    note: { type: String },
  },
  { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const orderSchema = new mongoose.Schema(
  {
    // Auto-incrementing human-readable order number (e.g. ORD-0042)
    orderNumber: { type: String, unique: true },

    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
    waiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // null for QR orders

    items: { type: [orderItemSchema], validate: { validator: (v) => v.length > 0, message: 'Order must have at least one item' } },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled'],
      default: 'pending',
      index: true,
    },

    // KOT (Kitchen Order Ticket)
    kotNumber: { type: String },          // e.g. KOT-0042
    kotPrintedAt: { type: Date },

    // Financials
    subtotal: { type: Number, required: true },
    taxRate: { type: Number, default: 0.1 },       // 10% default — configurable per order
    taxAmount: { type: Number, default: 0 },
    discountType: { type: String, enum: ['flat', 'percent', 'none'], default: 'none' },
    discountValue: { type: Number, default: 0 },   // flat $ or percent %
    discountAmount: { type: Number, default: 0 },  // computed
    totalAmount: { type: Number, required: true },

    // Payment
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
    paymentMethod: { type: String, enum: ['cash', 'card', 'upi', 'wallet', 'complimentary'] },
    paidAt: { type: Date },
    billGeneratedAt: { type: Date },

    // Inventory
    inventoryDeducted: { type: Boolean, default: false },

    // Customer QR ordering
    // source: 'pos' = placed by staff via POS, 'customer_qr' = placed by customer via QR scan
    source: {
      type: String,
      enum: ['pos', 'customer_qr'],
      default: 'pos',
      index: true,
    },
    // Optional customer identity — only set for customer_qr orders
    customerName:  { type: String, trim: true, maxlength: 60 },
    customerPhone: { type: String, trim: true, maxlength: 20 },
    customerNote:  { type: String, trim: true, maxlength: 200 },

    // Audit trail
    statusHistory: [statusHistorySchema],

    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// ─── Tenant fields ────────────────────────────────────────────────────────────
orderSchema.add(tenantFields(true)); // restaurant + branch scoped

// ─── Pre-save: generate orderNumber scoped to restaurant ─────────────────────

orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    // Scope order number to restaurant so ORD-0001 can exist in multiple restaurants
    const count = await mongoose.model('Order').countDocuments({ restaurant: this.restaurant });
    this.orderNumber = `ORD-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// ─── Indexes ──────────────────────────────────────────────────────────────────

orderSchema.index({ table: 1, status: 1 });
orderSchema.index({ createdAt: -1 });
addTenantIndexes(orderSchema, true);

export default mongoose.model('Order', orderSchema);
