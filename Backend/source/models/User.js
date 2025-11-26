import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Student from "./Student.js"; // Make sure this path is correct

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "warden", "student"],
      default: "student",
    },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare passwords
userSchema.methods.correctPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Enhanced post-save hook
userSchema.post("save", async function (doc, next) {
  try {
    if (doc.role !== "student") return next();

    // Lazy import to avoid circular dependency
    const Student = (await import("./Student.js")).default;

    const exists = await Student.findOne({ user: doc._id });
    if (exists) return next();

    const studentId = `STU${Date.now().toString().slice(-6)}`;

    await Student.create({
      studentId,
      user: doc._id,
      name: doc.name,
      email: doc.email,
      status: "active",
    });

    console.log("Student created for:", doc.email);
    next();
  } catch (err) {
    console.error("Student auto-create failed:", err);
    next();
  }
});

export default mongoose.model("User", userSchema);
