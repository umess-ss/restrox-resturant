import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../../config/roles.js';

// System-level roles (platform operations, not restaurant-level)
export const SYSTEM_ROLES = Object.freeze({
  SUPERADMIN: 'superadmin', // platform operator — can see all restaurants
  USER:       'user',       // normal restaurant staff
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },

    // Restaurant-level role (chef, waiter, manager, admin)
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.WAITER,
    },

    // Platform-level role
    systemRole: {
      type: String,
      enum: Object.values(SYSTEM_ROLES),
      default: SYSTEM_ROLES.USER,
    },

    // ─── Tenant fields ────────────────────────────────────────────────────────
    // Which restaurant this user belongs to (null for superadmins)
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      index: true,
    },
    // Which branch this user is primarily assigned to (null = all branches)
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      index: true,
    },
    // Managers/admins can be granted access to multiple branches
    allowedBranches: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
    }],

    isActive: { type: Boolean, default: true },
    passwordChangedAt: { type: Date },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

userSchema.methods.changedPasswordAfter = function (jwtIssuedAt) {
  if (this.passwordChangedAt) {
    return Math.floor(this.passwordChangedAt.getTime() / 1000) > jwtIssuedAt;
  }
  return false;
};

userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    systemRole: this.systemRole,
    restaurant: this.restaurant,
    branch: this.branch,
    isActive: this.isActive,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
