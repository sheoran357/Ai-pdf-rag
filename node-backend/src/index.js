import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import chatRoutes from "./routes/chatRoutes.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;
const allowedOrigins = (process.env.CORS_ORIGINS ||
  "http://localhost:5173,http://127.0.0.1:5173,null")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header include local CLI/health checks.
    if (!origin || origin === "null" || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not allowed by CORS."));
  },
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use((req, _res, next) => {
  console.info(`${req.method} ${req.path}`);
  next();
});

app.use("/api/chat", chatRoutes);

await connectDB();

app.use((error, _req, res, _next) => {
  console.error("Unhandled API error:", error.message);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Node chat API listening at http://127.0.0.1:${port}`);
});
