import express from "express";
import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";

const router = express.Router();

router.post("/new", async (req, res) => {
  try {
    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    const chat = await Chat.create({ title: title || "New Chat" });
    res.status(201).json(chat);
  } catch (error) {
    console.error("Create chat failed:", error.message);
    res.status(500).json({ error: "Could not create chat." });
  }
});

router.get("/", async (_req, res) => {
  try {
    const chats = await Chat.find().sort({ updatedAt: -1 }).lean();
    res.json(chats);
  } catch (error) {
    console.error("Load chats failed:", error.message);
    res.status(500).json({ error: "Could not load chats." });
  }
});

router.get("/:chatId/messages", async (req, res) => {
  const { chatId } = req.params;
  if (!mongoose.isValidObjectId(chatId)) {
    return res.status(400).json({ error: "Invalid chat ID." });
  }

  try {
    const chatExists = await Chat.exists({ _id: chatId });
    if (!chatExists) return res.status(404).json({ error: "Chat not found." });

    const messages = await Message.find({ chatId }).sort({ timestamp: 1 }).lean();
    res.json(messages);
  } catch (error) {
    console.error("Load messages failed:", error.message);
    res.status(500).json({ error: "Could not load chat messages." });
  }
});

router.post("/message", async (req, res) => {
  const { chatId, sender, text, timestamp, pdfName } = req.body || {};

  if (!chatId || !mongoose.isValidObjectId(chatId)) {
    return res.status(400).json({ error: "A valid chat ID is required." });
  }
  if (!["user", "bot"].includes(sender)) {
    return res.status(400).json({ error: "Sender must be 'user' or 'bot'." });
  }
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Message text cannot be empty." });
  }

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found." });

    const message = await Message.create({
      chatId,
      sender,
      text: text.trim(),
      timestamp: Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now(),
      pdfName: typeof pdfName === "string" ? pdfName.slice(0, 255) : "",
    });

    // Keep the sidebar's updatedAt sort in sync with recent conversation activity.
    chat.updatedAt = new Date();
    await chat.save();

    res.status(201).json(message);
  } catch (error) {
    console.error("Save message failed:", error.message);
    res.status(500).json({ error: "Could not save the message." });
  }
});

router.patch("/:chatId", async (req, res) => {
  const { chatId } = req.params;
  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";

  if (!mongoose.isValidObjectId(chatId)) {
    return res.status(400).json({ error: "Invalid chat ID." });
  }
  if (!title) {
    return res.status(400).json({ error: "Title cannot be empty." });
  }
  if (title.length > 120) {
    return res.status(400).json({ error: "Title must be 120 characters or fewer." });
  }

  try {
    const updated = await Chat.findByIdAndUpdate(
      chatId,
      { title },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: "Chat not found." });
    res.json(updated);
  } catch (error) {
    console.error("Rename chat failed:", error.message);
    res.status(500).json({ error: "Could not rename chat." });
  }
});

export default router;
