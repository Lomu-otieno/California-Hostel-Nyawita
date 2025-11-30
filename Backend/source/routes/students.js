import express from "express";
import Student from "../models/Student.js";
import { protect, warden } from "../middleware/auth.js";

const student_router = express.Router();

// Get all students (admin/warden only)
student_router.get("/", protect, warden, async (req, res) => {
  try {
    const students = await Student.find()
      .populate("user", "name email")
      .populate("room");
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get student by ID (student can see their own, admin/warden can see any)
student_router.get("/:id", protect, async (req, res) => {
  try {
    // allow if user is admin/warden OR if it's the same user
    if (
      req.user.role !== "admin" &&
      req.user.role !== "warden" &&
      req.user._id.toString() !== req.params.id
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this student" });
    }

    const student = await Student.findById(req.params.id)
      .populate("user", "name email")
      .populate("room");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//Only allow students to update their own profile by ID
student_router.put("/:id", protect, async (req, res) => {
  try {
    // Only students can update profiles
    if (req.user.role !== "student") {
      return res.status(403).json({
        message: "Only students can update their profile",
      });
    }

    // Find the student profile for the current user
    let student = await Student.findOne({ user: req.user._id });

    // If student profile doesn't exist, create it
    if (!student) {
      // Generate unique student ID
      const studentCount = await Student.countDocuments();
      const studentId = `STU${(studentCount + 1).toString().padStart(4, "0")}`;

      student = await Student.create({
        studentId: studentId,
        user: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.body.phone || "",
        emergencyContact: req.body.emergencyContact || {
          name: "",
          phone: "",
          relationship: "",
        },
        status: "active",
      });

      const populatedStudent = await Student.findById(student._id)
        .populate("user", "name email")
        .populate("room");

      return res.status(201).json({
        message: "Student profile created successfully",
        data: populatedStudent,
      });
    }

    // ✅ FIX: Check if the requested student ID matches the user's student profile ID
    if (student._id.toString() !== req.params.id) {
      return res.status(403).json({
        message: "Not authorized to update this student profile",
      });
    }

    // If student profile exists, update allowed fields
    const allowedFields = ["phone", "emergencyContact"];
    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const updatedStudent = await Student.findByIdAndUpdate(
      student._id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("user", "name email")
      .populate("room");

    return res.json({
      message: "Student profile updated successfully",
      data: updatedStudent,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Only students can update their own profile via this endpoint
student_router.put("/profile/me", protect, async (req, res) => {
  try {
    // Only students can update their own profile
    if (req.user.role !== "student") {
      return res.status(403).json({
        message: "Only students can update their profile",
      });
    }

    let student = await Student.findOne({ user: req.user._id });

    // If student profile doesn't exist, create it
    if (!student) {
      // Generate unique student ID
      const studentCount = await Student.countDocuments();
      const studentId = `STU${(studentCount + 1).toString().padStart(4, "0")}`;

      student = await Student.create({
        studentId: studentId,
        user: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.body.phone || "",
        emergencyContact: req.body.emergencyContact || {
          name: "",
          phone: "",
          relationship: "",
        },
        status: "active",
      });

      const populatedStudent = await Student.findById(student._id)
        .populate("user", "name email")
        .populate("room");

      return res.status(201).json({
        message: "Student profile created successfully",
        data: populatedStudent,
      });
    }

    // If student profile exists, update allowed fields
    const allowedFields = ["phone", "emergencyContact"];
    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const updatedStudent = await Student.findByIdAndUpdate(
      student._id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("user", "name email")
      .populate("room");

    res.json({
      message: "Student profile updated successfully",
      data: updatedStudent,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Admin/Warden can only assign rooms (not update profile)
student_router.patch("/:id/assign-room", protect, warden, async (req, res) => {
  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({ message: "Room ID is required" });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Use the assignRoom method from the Student model
    await student.assignRoom(roomId);

    const updatedStudent = await Student.findById(student._id)
      .populate("user", "name email")
      .populate("room");

    res.json({
      message: "Room assigned successfully",
      data: updatedStudent,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete student (admin/warden only)
student_router.delete("/:id", protect, warden, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: "Student removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default student_router;
