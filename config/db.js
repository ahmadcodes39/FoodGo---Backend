import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

export const connectToMongo = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ Connected to MongoDB: ${connection.connection.host}`);
  } catch (error) {
    console.log(`❌ Error in connecting MongoDB: ${error.message}`);
    process.exit(1);
  }
};
