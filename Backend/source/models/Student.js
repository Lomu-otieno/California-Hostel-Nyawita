import mongoose from "mongoose";
import Room from "./Room.js";
const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      sparse: true,
    },
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },
    status: {
      type: String,
      enum: ["active", "graduated", "left"],
      default: "active",
    },
  },
  { timestamps: true }
);
// Add method to Student model
studentSchema.methods.assignRoom = async function (roomId) {
  const room = await Room.findById(roomId);
  if (!room) throw new Error("Room not found");
  if (room.currentOccupancy >= room.capacity) throw new Error("Room is full");

  this.room = roomId;
  await this.save();

  room.currentOccupancy += 1;
  if (room.currentOccupancy === room.capacity) {
    room.status = "occupied";
  }
  await room.save();

  return this;
};

export default mongoose.model("Student", studentSchema);
