import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/rentalDB",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log(`Database connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.log("Error connecting to db:", error.message);
    process.exit(1);
  }
};

export { connectDB };
