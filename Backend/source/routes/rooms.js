import express from "express";
import Room from "../models/Room.js";
import { protect, admin, warden } from "../middleware/auth.js";

const router = express.Router();

// @desc    Get all rooms
// @route   GET /api/rooms
// @access  Public
router.get("/", async (req, res) => {
  try {
    const { status, floor, minPrice, maxPrice } = req.query;

    // Build filter object
    let filter = {};
    if (status) filter.status = status;
    if (floor) filter.floor = parseInt(floor);
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice);
      if (maxPrice) filter.price.$lte = parseInt(maxPrice);
    }

    const rooms = await Room.find(filter).sort({ roomNumber: 1 });

    res.json({
      success: true,
      count: rooms.length,
      data: rooms,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get available rooms
// @route   GET /api/rooms/available
// @access  Public
router.get("/available", async (req, res) => {
  try {
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

// @desc    Get single room
// @route   GET /api/rooms/:id
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    res.json({
      success: true,
      data: room,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Create a room
// @route   POST /api/rooms
// @access  Private (Admin/Warden)
router.post("/", protect, warden, async (req, res) => {
  try {
    const room = await Room.create(req.body);

    res.status(201).json({
      success: true,
      data: room,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Room number already exists",
      });
    }
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Update a room
// @route   PUT /api/rooms/:id
// @access  Private (Admin/Warden)
router.put("/:id", protect, warden, async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    res.json({
      success: true,
      data: room,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Room number already exists",
      });
    }
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Delete a room
// @route   DELETE /api/rooms/:id
// @access  Private (Admin only)
router.delete("/:id", protect, admin, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    if (room.currentOccupancy > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete room with current occupants",
      });
    }

    await Room.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Update room occupancy
// @route   PATCH /api/rooms/:id/occupancy
// @access  Private (Admin/Warden)
router.patch("/:id/occupancy", protect, warden, async (req, res) => {
  try {
    const { action } = req.body;

    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    if (action === "increase") {
      if (room.currentOccupancy >= room.capacity) {
        return res.status(400).json({
          success: false,
          message: "Room is already at full capacity",
        });
      }
      room.currentOccupancy += 1;
      if (room.currentOccupancy === room.capacity) {
        room.status = "occupied";
      }
    } else if (action === "decrease") {
      if (room.currentOccupancy <= 0) {
        return res.status(400).json({
          success: false,
          message: "Room occupancy is already zero",
        });
      }
      room.currentOccupancy -= 1;
      if (room.currentOccupancy < room.capacity) {
        room.status = "available";
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "increase" or "decrease"',
      });
    }

    await room.save();

    res.json({
      success: true,
      data: room,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get room statistics
// @route   GET /api/rooms/stats/overview
// @access  Private (Admin/Warden)
router.get("/stats/overview", protect, warden, async (req, res) => {
  try {
    const totalRooms = await Room.countDocuments();
    const availableRooms = await Room.countDocuments({
      status: "available",
      $expr: { $lt: ["$currentOccupancy", "$capacity"] },
    });
    const occupiedRooms = await Room.countDocuments({ status: "occupied" });
    const maintenanceRooms = await Room.countDocuments({
      status: "maintenance",
    });

    const totalCapacity = await Room.aggregate([
      { $group: { _id: null, total: { $sum: "$capacity" } } },
    ]);

    const totalOccupancy = await Room.aggregate([
      { $group: { _id: null, total: { $sum: "$currentOccupancy" } } },
    ]);

    const occupancyRate = totalCapacity[0]
      ? ((totalOccupancy[0]?.total / totalCapacity[0]?.total) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        totalRooms,
        availableRooms,
        occupiedRooms,
        maintenanceRooms,
        totalCapacity: totalCapacity[0]?.total || 0,
        totalOccupancy: totalOccupancy[0]?.total || 0,
        occupancyRate: parseFloat(occupancyRate),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
