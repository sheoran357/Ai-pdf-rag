import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema({
  title: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("Chat", ChatSchema);
