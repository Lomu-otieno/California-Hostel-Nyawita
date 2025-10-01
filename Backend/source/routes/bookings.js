import express from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import Student from "../models/Student.js";

const router = express.Router();

// Helper functions
const calculateDuration = (checkInDate, checkOutDate) => {
  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  const diffTime = Math.abs(end - start);
  const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
  return diffMonths;
};

const validateBookingDates = (checkInDate, checkOutDate) => {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (checkIn < today) {
    throw new Error("Check-in date cannot be in the past");
  }

  if (checkOut <= checkIn) {
    throw new Error("Check-out date must be after check-in date");
  }

  // Maximum booking duration (e.g., 12 months)
  const maxDuration = 12;
  const duration = calculateDuration(checkInDate, checkOutDate);
  if (duration > maxDuration) {
    throw new Error(`Booking duration cannot exceed ${maxDuration} months`);
  }
};

const validateBookingRequest = (student, room, checkInDate, checkOutDate) => {
  if (!student || !room || !checkInDate || !checkOutDate) {
    throw new Error(
      "Student, room, checkInDate, and checkOutDate are required"
    );
  }
};

// Enhanced room availability check
const checkRoomAvailability = async (roomId, session = null) => {
  const query = Room.findById(roomId);
  if (session) query.session(session);

  const room = await query;

  if (!room) {
    throw new Error("Room not found");
  }

  if (room.status !== "available") {
    throw new Error(`Room is not available. Current status: ${room.status}`);
  }

  if (room.currentOccupancy >= room.capacity) {
    throw new Error("Room is already at full capacity");
  }

  return room;
};

// Create a booking with enhanced validation
router.post("/", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { student, room, checkInDate, checkOutDate, duration, totalAmount } =
      req.body;

    // Validate required fields
    validateBookingRequest(student, room, checkInDate, checkOutDate);
    validateBookingDates(checkInDate, checkOutDate);

    // Check if student exists
    const studentExists = await Student.findById(student).session(session);
    if (!studentExists) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Student not found" });
    }

    // Enhanced room availability check
    const roomExists = await checkRoomAvailability(room, session);

    // Check if student already has an active booking
    const existingBooking = await Booking.findOne({
      student: student,
      status: { $in: ["confirmed", "checked-in"] },
    }).session(session);

    if (existingBooking) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Student already has an active booking",
      });
    }

    // Calculate duration and total amount
    const calculatedDuration =
      duration || calculateDuration(checkInDate, checkOutDate);
    const calculatedTotalAmount =
      totalAmount || roomExists.price * calculatedDuration;

    const bookingData = {
      ...req.body,
      duration: calculatedDuration,
      totalAmount: calculatedTotalAmount,
    };

    // Create booking
    const booking = await Booking.create([bookingData], { session });
    const createdBooking = booking[0];

    // Update room occupancy
    roomExists.currentOccupancy += 1;
    if (roomExists.currentOccupancy === roomExists.capacity) {
      roomExists.status = "occupied";
    }
    await roomExists.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Populate and return response
    const populatedBooking = await Booking.findById(createdBooking._id)
      .populate("student")
      .populate("room");

    res.status(201).json({
      message: "Booking created successfully",
      booking: populatedBooking,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

// Get available rooms for booking
router.get("/available-rooms", async (req, res) => {
  try {
    const { checkInDate, checkOutDate } = req.query;

    // Get all available rooms
    const availableRooms = await Room.find({
      status: "available",
      $expr: { $lt: ["$currentOccupancy", "$capacity"] },
    }).sort({ roomNumber: 1 });

    res.json({
      success: true,
      count: availableRooms.length,
      data: availableRooms,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Other routes remain the same...
// Get all bookings with filtering
router.get("/", async (req, res) => {
  try {
    const { status, student, room } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (student) filter.student = student;
    if (room) filter.room = room;

    const bookings = await Booking.find(filter)
      .populate("student")
      .populate("room")
      .sort({ createdAt: -1 });

    res.json({
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get bookings for a specific student
router.get("/student/:studentId", async (req, res) => {
  try {
    const bookings = await Booking.find({ student: req.params.studentId })
      .populate("student")
      .populate("room")
      .sort({ createdAt: -1 });

    res.json({
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a single booking by ID
router.get("/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("student")
      .populate("room");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update booking
router.put("/:id", async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("student")
      .populate("room");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json(booking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete booking
router.delete("/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Update room occupancy when booking is deleted
    if (
      booking.room &&
      (booking.status === "confirmed" || booking.status === "checked-in")
    ) {
      const room = await Room.findById(booking.room);
      if (room) {
        room.currentOccupancy = Math.max(0, room.currentOccupancy - 1);
        if (room.currentOccupancy < room.capacity) {
          room.status = "available";
        }
        await room.save();
      }
    }

    await Booking.findByIdAndDelete(req.params.id);

    res.json({ message: "Booking deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
