import express from "express";
import cors from "cors";
import { connectDB } from "./lib/db.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(async (req, res, next) => {
  await connectDatabase();
  next();
});

// Import routes
import authRoute from "./routes/auth.js";
import bookingRoutes from "./routes/bookings.js";
import studentRoutes from "./routes/students.js";
import roomRoutes from "./routes/rooms.js";
import reviewRoutes from "./routes/review.js";

// Use routes
app.use("/api/auth", authRoute);
app.use("/api/bookings", bookingRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/reviews", reviewRoutes);

// Basic route
app.get("/", (req, res) => {
  res.json({
    message: "California-Hostel-Nyawita Management API is up and running🥹!",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Connect DB for serverless (Vercel)
let isConnected = false;
const connectDatabase = async () => {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
};

// Export app for Vercel
export default app;
