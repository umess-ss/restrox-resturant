import mongoose from 'mongoose';
import { ROLES } from '../../config/roles.js';
import { tenantFields, addTenantIndexes } from '../../plugins/tenantPlugin.js';

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    relationship: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  { _id: false }
);

const bankDetailsSchema = new mongoose.Schema(
  {
    accountName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    ifsc: { type: String, trim: true, uppercase: true },
  },
  { _id: false }
);

/**
 * Extended profile for a staff member.
 * One-to-one with User — linked via `user` ref.
 * Keeps HR data separate from auth data.
 */
const staffProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // Employment
    employeeId: { type: String, unique: true, sparse: true }, // e.g. EMP-0001
    department: {
      type: String,
      enum: ['kitchen', 'floor', 'bar', 'management', 'cleaning'],
      default: 'floor',
    },
    hireDate: { type: Date, default: Date.now },
    terminationDate: { type: Date },

    // Compensation
    salaryType: { type: String, enum: ['monthly', 'hourly'], default: 'monthly' },
    baseSalary: { type: Number, required: true, min: 0 },   // monthly amount OR hourly rate
    overtimeRate: { type: Number, default: 1.5 },            // multiplier on hourly rate
    currency: { type: String, default: 'USD' },

    // Shift template (default working hours)
    defaultShiftStart: { type: String, default: '09:00' },   // HH:mm
    defaultShiftEnd: { type: String, default: '17:00' },     // HH:mm
    weeklyHours: { type: Number, default: 40 },

    // Contact
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    emergencyContact: { type: emergencyContactSchema },
    bankDetails: { type: bankDetailsSchema },

    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// Auto-generate employeeId on first save
staffProfileSchema.pre('save', async function (next) {
  if (this.isNew && !this.employeeId) {
    // Scope employee ID to restaurant
    const count = await mongoose.model('StaffProfile').countDocuments({ restaurant: this.restaurant });
    this.employeeId = `EMP-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Staff profiles are branch-scoped
staffProfileSchema.add(tenantFields(true));
addTenantIndexes(staffProfileSchema, true);

export default mongoose.model('StaffProfile', staffProfileSchema);
