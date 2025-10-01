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

// Create Student profile automatically if role is "student"
userSchema.post("save", async function (doc, next) {
  try {
    if (doc.role === "student") {
      const exists = await Student.findOne({ user: doc._id });
      if (!exists) {
        await Student.create({
          studentId: `STD-${doc._id.toString().slice(-6).toUpperCase()}`,
          user: doc._id,
          name: doc.name,
          email: doc.email,
          phone: "",
          emergencyContact: {
            name: "",
            phone: "",
            relationship: "",
          },
          status: "active",
        });
      }
    }
    next();
  } catch (error) {
    console.error("Error creating student profile:", error);
    next(error);
  }
});

export default mongoose.model("User", userSchema);
