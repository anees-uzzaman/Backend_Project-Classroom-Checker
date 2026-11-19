const { webcrypto } = require("crypto");
global.crypto = webcrypto;

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
app.use(express.json());
app.use(cors());
app.use(helmet());

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Connect Database
connectDatabase();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/routine", routineRoutes);
app.use("/api/admin", adminRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;
