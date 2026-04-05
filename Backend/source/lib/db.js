import mongoose from "mongoose";

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  console.log("Connecting to MongoDB with URI:");

  if (!uri) throw new Error("MONGO_URI is undefined. Check your .env");

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log("MongoDB connected");
  } catch (error) {
    console.error("Error connecting to DB:", error);
    throw error;
  }
};
