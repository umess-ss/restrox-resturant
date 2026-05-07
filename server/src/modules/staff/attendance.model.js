import mongoose from 'mongoose';

const breakSchema = new mongoose.Schema(
  {
    start: { type: Date, required: true },
    end: { type: Date },
  },
  { _id: true }
);

/**
 * Daily attendance record.
 * One record per staff per day.
 */
const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true }, // YYYY-MM-DD (start of day)

    // Clock times
    clockIn: { type: Date },
    clockOut: { type: Date },
    breaks: [breakSchema],

    // Computed fields
    totalHours: { type: Number, default: 0 },
    breakHours: { type: Number, default: 0 },
    netHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },

    // Status flags
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'half_day', 'leave'],
      default: 'present',
    },
    isLate: { type: Boolean, default: false },
    lateMinutes: { type: Number, default: 0 },

    // Leave tracking
    leaveType: { type: String, enum: ['sick', 'casual', 'earned', 'unpaid'] },
    leaveApproved: { type: Boolean },

    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// Compound index for unique attendance per user per day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

// Helper: calculate hours
attendanceSchema.methods.calculateHours = function (standardHours = 8) {
  if (!this.clockIn || !this.clockOut) {
    this.totalHours = 0;
    this.netHours = 0;
    this.overtimeHours = 0;
    return;
  }

  const totalMs = this.clockOut - this.clockIn;
  this.totalHours = +(totalMs / (1000 * 60 * 60)).toFixed(2);

  // Calculate break time
  this.breakHours = this.breaks.reduce((sum, b) => {
    if (!b.end) return sum;
    const breakMs = b.end - b.start;
    return sum + breakMs / (1000 * 60 * 60);
  }, 0);
  this.breakHours = +this.breakHours.toFixed(2);

  this.netHours = +(this.totalHours - this.breakHours).toFixed(2);
  this.overtimeHours = Math.max(0, +(this.netHours - standardHours).toFixed(2));
};

export default mongoose.model('Attendance', attendanceSchema);
