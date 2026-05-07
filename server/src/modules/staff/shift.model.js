import mongoose from 'mongoose';

/**
 * A scheduled shift for one or more staff members on a specific date.
 */
const shiftSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true },   // HH:mm

    // Assigned staff
    assignedTo: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        status: {
          type: String,
          enum: ['scheduled', 'confirmed', 'swapped', 'absent'],
          default: 'scheduled',
        },
      },
    ],

    shiftType: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night', 'split'],
      default: 'morning',
    },

    department: {
      type: String,
      enum: ['kitchen', 'floor', 'bar', 'management', 'cleaning'],
    },

    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

shiftSchema.index({ date: 1, department: 1 });

export default mongoose.model('Shift', shiftSchema);
