import express from "express";
import Student from "../models/Student.js";
import { protect, warden } from "../middleware/auth.js";
import bcrypt from "bcryptjs";

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

// Remove the POST /students route or keep it for additional profile setup
student_router.post("/", protect, async (req, res) => {
  try {
    // Check if student profile already exists
    const existingStudent = await Student.findOne({ user: req.user._id });

    if (existingStudent) {
      return res.status(400).json({
        message: "Student profile already exists. Use update instead.",
      });
    }

    // Only allow students to create profiles
    if (req.user.role !== "student") {
      return res.status(403).json({
        message: "Only students can create profiles",
      });
    }

    const student = await Student.create({
      ...req.body,
      user: req.user._id,
      name: req.user.name,
      email: req.user.email,
    });

    const populatedStudent = await Student.findById(student._id)
      .populate("user", "name email")
      .populate("room");

    res.status(201).json(populatedStudent);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update student (Admin/Warden: all fields, Student: only password)
student_router.put("/:id", protect, async (req, res) => {
  try {
    const isSelf = req.user._id.toString() === req.params.id;
    const isAdminOrWarden =
      req.user.role === "admin" || req.user.role === "warden";

    // If it's the student updating themselves → only allow password
    if (isSelf && req.user.role === "student") {
      if (!req.body.password) {
        return res
          .status(400)
          .json({ message: "Password is required to update" });
      }

      // Hash new password before saving
      const hashedPassword = await bcrypt.hash(req.body.password, 10);

      req.body = { password: hashedPassword }; // overwrite body with only password
    }

    // If not self and not admin/warden → reject
    if (!isSelf && !isAdminOrWarden) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this student" });
    }

    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("user", "name email")
      .populate("room");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(student);
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
