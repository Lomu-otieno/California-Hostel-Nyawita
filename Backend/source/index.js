import app from "./server.js";
import { connectDB } from "./lib/db.js";
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running locally on port ${PORT}`);
    });
  } catch (err) {
    console.error(err);
  }
};

startServer();
