import express from "express";
import mongoose from "mongoose";
import Review from "../models/Review.js";
import Room from "../models/Room.js";
import Booking from "../models/Booking.js";
import Student from "../models/Student.js";

const router = express.Router();

// Middleware to check if student can review (has completed booking)
const canStudentReview = async (req, res, next) => {
  try {
    const { booking, room, student } = req.body;

    // Check if booking exists and belongs to student
    const existingBooking = await Booking.findOne({
      _id: booking,
      student: student,
      room: room,
      status: "checked-out", // Only allow reviews for completed stays
    });

    if (!existingBooking) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot review this room. Booking not found or stay not completed.",
      });
    }

    // Check if student already reviewed this booking
    const existingReview = await Review.findOne({ booking });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this booking.",
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create a review
// @route   POST /api/reviews
// @access  Private (Student)
router.post("/", canStudentReview, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      student,
      room,
      booking,
      rating,
      title,
      comment,
      categories = {},
    } = req.body;

    // Validate required fields
    if (!student || !room || !booking || !rating || !title || !comment) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message:
          "Student, room, booking, rating, title, and comment are required",
      });
    }

    // Validate rating
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Rating must be a whole number between 1 and 5",
      });
    }

    const reviewData = {
      student,
      room,
      booking,
      rating,
      title: title.trim(),
      comment: comment.trim(),
      categories,
      isVerified: true, // Auto-verify since we check booking
      status: "approved", // Auto-approve for now, can be changed to "pending" for moderation
    };

    const review = await Review.create([reviewData], { session });
    const createdReview = review[0];

    await session.commitTransaction();

    // Populate and return response
    const populatedReview = await Review.findById(createdReview._id)
      .populate("student", "name email")
      .populate("room", "roomNumber floor");

    res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      data: populatedReview,
    });
  } catch (error) {
    await session.abortTransaction();

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this booking",
      });
    }

    res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    session.endSession();
  }
});

// @desc    Get all reviews with filtering
// @route   GET /api/reviews
// @access  Public
router.get("/", async (req, res) => {
  try {
    const {
      room,
      student,
      status = "approved",
      rating,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = { status };
    if (room) filter.room = room;
    if (student) filter.student = student;
    if (rating) filter.rating = parseInt(rating);

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortOptions,
      populate: [
        { path: "student", select: "name" },
        { path: "room", select: "roomNumber floor" },
      ],
    };

    const reviews = await Review.find(filter)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("student", "name")
      .populate("room", "roomNumber floor");

    const total = await Review.countDocuments(filter);

    res.json({
      success: true,
      count: reviews.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get reviews for a specific room
// @route   GET /api/reviews/room/:roomId
// @access  Public
router.get("/room/:roomId", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({
      room: req.params.roomId,
      status: "approved",
    })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("student", "name")
      .populate("room", "roomNumber floor");

    const total = await Review.countDocuments({
      room: req.params.roomId,
      status: "approved",
    });

    // Get rating summary
    const ratingSummary = await Review.getRoomRatingSummary(req.params.roomId);

    res.json({
      success: true,
      count: reviews.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      ratingSummary,
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get reviews by a specific student
// @route   GET /api/reviews/student/:studentId
// @access  Private
router.get("/student/:studentId", async (req, res) => {
  try {
    const reviews = await Review.find({ student: req.params.studentId })
      .populate("student", "name")
      .populate("room", "roomNumber floor")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get single review
// @route   GET /api/reviews/:id
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate("student", "name email")
      .populate("room", "roomNumber floor amenities")
      .populate("booking");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Private (Student who created the review)
router.put("/:id", async (req, res) => {
  try {
    const { rating, title, comment, categories } = req.body;

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // In real app, check if current user is the review owner
    // if (review.student.toString() !== req.user.id) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Not authorized to update this review",
    //   });
    // }

    // Only allow updating certain fields
    const updateData = {};
    if (rating) updateData.rating = rating;
    if (title) updateData.title = title.trim();
    if (comment) updateData.comment = comment.trim();
    if (categories) updateData.categories = categories;

    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("student", "name")
      .populate("room", "roomNumber floor");

    res.json({
      success: true,
      message: "Review updated successfully",
      data: updatedReview,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private (Student who created the review or Admin)
router.delete("/:id", async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // In real app, check if current user is the review owner or admin
    // if (review.student.toString() !== req.user.id && !req.user.isAdmin) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Not authorized to delete this review",
    //   });
    // }

    await Review.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get room rating statistics
// @route   GET /api/reviews/stats/room/:roomId
// @access  Public
router.get("/stats/room/:roomId", async (req, res) => {
  try {
    const ratingSummary = await Review.getRoomRatingSummary(req.params.roomId);

    res.json({
      success: true,
      data: ratingSummary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Admin: Update review status
// @route   PATCH /api/reviews/:id/status
// @access  Private (Admin)
router.patch("/:id/status", async (req, res) => {
  try {
    const { status, adminReply } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Use: pending, approved, or rejected",
      });
    }

    const updateData = { status };

    if (adminReply) {
      updateData.response = {
        adminReply: adminReply.trim(),
        repliedBy: null, // In real app: req.user.id
        repliedAt: new Date(),
      };
    }

    const review = await Review.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    })
      .populate("student", "name")
      .populate("room", "roomNumber floor");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    res.json({
      success: true,
      message: `Review ${status} successfully`,
      data: review,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
