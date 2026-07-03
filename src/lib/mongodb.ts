import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb+srv://luckystar000628_db_user:WRME48zXeidyBkL7@cluster0.cpxk6bb.mongodb.net/cluster0?retryWrites=true&w=majority";

export async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  console.log("Connected to MongoDB");
  console.log("MONGODB_URI: ", MONGODB_URI);
  return mongoose.connect(MONGODB_URI);
}
