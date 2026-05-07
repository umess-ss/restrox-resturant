import mongoose from 'mongoose';

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ['appetizer', 'main', 'dessert', 'beverage', 'special'],
      required: true,
    },
    image: { type: String },
    isAvailable: { type: Boolean, default: true },
    preparationTime: { type: Number, default: 15 }, // minutes
  },
  { timestamps: true }
);

export default mongoose.model('MenuItem', menuItemSchema);
