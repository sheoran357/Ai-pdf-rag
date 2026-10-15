// routes/chatRoutes.js
import express from "express";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";

const router = express.Router();

/* --------------------- CREATE NEW CHAT --------------------- */
router.post("/new", async (req, res) => {
  try {
    const chat = await Chat.create({
      title: req.body.title || "New Chat",
    });
    res.json(chat);
  } catch (err) {
    console.error(" New chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* --------------------- LIST CHATS --------------------- */
router.get("/", async (req, res) => {
  try {
    const chats = await Chat.find().sort({ updatedAt: -1 });
    res.json(chats);
  } catch (err) {
    console.error(" Load chats error:", err);
    res.status(500).json({ error: err.message });
  }
});


router.get("/:chatId/messages", async (req, res) => {
  try {
    const msgs = await Message.find({
      chatId: req.params.chatId,
    }).sort({ timestamp: 1 });

    res.json(msgs);
  } catch (err) {
    console.error(" Load messages error:", err);
    res.status(500).json({ error: err.message });
  }
});


router.post("/message", async (req, res) => {
  try {
    const { chatId, sender, text, timestamp, pdfName } = req.body;

    if (!chatId || !sender || !text) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const msg = await Message.create({
      chatId,
      sender,
      text,
      timestamp: timestamp || Date.now(),
      pdfName: pdfName || "",   
    });

    res.json(msg);
  } catch (err) {
    console.error("Save message error:", err);
    res.status(500).json({ error: err.message });
  }
});


router.patch("/:chatId", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title cannot be empty" });
    }

    const updated = await Chat.findByIdAndUpdate(
      req.params.chatId,
      { title },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("Rename chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
