import mongoose from 'mongoose';

const tableSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    capacity: { type: Number, required: true },
    status: { type: String, enum: ['available', 'occupied', 'reserved', 'cleaning'], default: 'available' },
    location: { type: String, enum: ['indoor', 'outdoor', 'bar'], default: 'indoor' },
  },
  { timestamps: true }
);

export default mongoose.model('Table', tableSchema);
