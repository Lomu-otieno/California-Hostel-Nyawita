import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: true,
      unique: true,
    },
    floor: {
      type: Number,
      required: true,
    },
    capacity: {
      type: Number,
      required: true,
    },
    currentOccupancy: {
      type: Number,
      default: 0,
    },
    amenities: [String],
    status: {
      type: String,
      enum: ["available", "occupied", "maintenance"],
      default: "available",
    },
    price: {
      type: Number,
      required: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    ratingSummary: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Prevent over-occupancy
roomSchema.pre("save", function (next) {
  if (this.currentOccupancy > this.capacity) {
    next(new Error("Room occupancy cannot exceed capacity"));
  }
  next();
});

export default mongoose.model("Room", roomSchema);
