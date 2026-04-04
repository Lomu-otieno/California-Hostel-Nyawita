import express from "express";
import cors from "cors";
import { connectDB } from "./lib/db.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.json());

// Import routes
import authRoute from "./routes/auth.js";
import bookingRoutes from "./routes/bookings.js";
import studentRoutes from "./routes/students.js";
import roomRoutes from "./routes/rooms.js";
import reviewRoutes from "./routes/review.js";
// import paymentsRoute from "./routes/payments.js";

// Use routes
app.use("/api/auth", authRoute);
app.use("/api/bookings", bookingRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/reviews", reviewRoutes);
// app.use("/api/payments", paymentsRoute);

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Hostel Management API is running!" });
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

// Start server after DB connection
let isConnected = false;

const connectDatabase = async () => {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
};

// Run DB connection on every request (safe for serverless)
app.use(async (req, res, next) => {
  await connectDatabase();
  next();
});

// Export app (VERY IMPORTANT for Vercel)
export default app;

startServer();
