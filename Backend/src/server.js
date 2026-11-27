const { webcrypto } = require("crypto");
if (typeof global.crypto === "undefined") {
  global.crypto = webcrypto;
}

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const connectDatabase = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const routineRoutes = require("./routes/routineRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
const port = Number(process.env.PORT) || 5000;

// Middleware
app.use(express.json({ limit: "4mb" }));
app.use(cors());
app.use(helmet());

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Ensure MongoDB is connected before handling API routes (needed for serverless cold starts)
app.use(async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error("Database connection error:", error.message);
    res.status(503).json({ message: "Database connection unavailable." });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/routine", routineRoutes);
app.use("/api/admin", adminRoutes);

// Only bind a local port when running outside Vercel serverless
if (!process.env.VERCEL && require.main === module) {
  connectDatabase().catch((err) => {
    console.error("Initial MongoDB connection failed:", err.message);
  });
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;
