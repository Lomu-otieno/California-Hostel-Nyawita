import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number between 1 and 5",
      },
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    categories: {
      cleanliness: {
        type: Number,
        min: 1,
        max: 5,
        default: 0,
      },
      comfort: {
        type: Number,
        min: 1,
        max: 5,
        default: 0,
      },
      location: {
        type: Number,
        min: 1,
        max: 5,
        default: 0,
      },
      facilities: {
        type: Number,
        min: 1,
        max: 5,
        default: 0,
      },
      staff: {
        type: Number,
        min: 1,
        max: 5,
        default: 0,
      },
      valueForMoney: {
        type: Number,
        min: 1,
        max: 5,
        default: 0,
      },
    },
    likes: {
      type: Number,
      default: 0,
    },
    dislikes: {
      type: Number,
      default: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    response: {
      adminReply: {
        type: String,
        maxlength: 500,
      },
      repliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      repliedAt: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one review per booking
reviewSchema.index({ booking: 1 }, { unique: true });

// Index for efficient queries
reviewSchema.index({ room: 1, status: 1 });
reviewSchema.index({ student: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });

// Virtual for average category rating
reviewSchema.virtual("averageCategoryRating").get(function () {
  const categories = Object.values(this.categories);
  const validCategories = categories.filter((rating) => rating > 0);
  if (validCategories.length === 0) return this.rating;

  return (
    validCategories.reduce((sum, rating) => sum + rating, 0) /
    validCategories.length
  ).toFixed(1);
});

// Static method to get room ratings summary
reviewSchema.statics.getRoomRatingSummary = async function (roomId) {
  const result = await this.aggregate([
    {
      $match: {
        room: new mongoose.Types.ObjectId(roomId),
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$room",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: "$rating",
        },
        categoryAverages: {
          $avg: {
            cleanliness: "$categories.cleanliness",
            comfort: "$categories.comfort",
            location: "$categories.location",
            facilities: "$categories.facilities",
            staff: "$categories.staff",
            valueForMoney: "$categories.valueForMoney",
          },
        },
      },
    },
  ]);

  if (result.length > 0) {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    result[0].ratingDistribution.forEach((rating) => {
      distribution[rating]++;
    });

    return {
      averageRating: Math.round(result[0].averageRating * 10) / 10,
      totalReviews: result[0].totalReviews,
      ratingDistribution: distribution,
      categoryAverages: result[0].categoryAverages,
    };
  }

  return {
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    categoryAverages: {},
  };
};

// Update room rating when review is saved
reviewSchema.post("save", async function () {
  if (this.status === "approved") {
    const Room = mongoose.model("Room");
    const ratingSummary = await this.constructor.getRoomRatingSummary(
      this.room
    );

    await Room.findByIdAndUpdate(this.room, {
      $set: {
        rating: ratingSummary.averageRating,
        totalReviews: ratingSummary.totalReviews,
        ratingSummary: ratingSummary,
      },
    });
  }
});

export default mongoose.model("Review", reviewSchema);
