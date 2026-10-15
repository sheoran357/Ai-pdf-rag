import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chat",
    required: true,
    index: true,
  },
  sender: {
    type: String,
    enum: ["user", "bot"],
    required: true,
  },
  text: {
    type: String,
    required: true,
    trim: true,
  },
  pdfName: {
    type: String,
    default: "",
    maxlength: 255,
  },
  timestamp: {
    type: Number,
    required: true,
    default: Date.now,
    index: true,
  },
});

export default mongoose.models.Message || mongoose.model("Message", messageSchema);
