const { webcrypto } = require("crypto");
global.crypto = webcrypto;

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const connectDatabase = require("./config/db"); // Matches default export
const authRoutes = require("./routes/authRoutes");

const app = express();
const port = Number(process.env.PORT) || 5000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Connect Database
connectDatabase();

// Routes
app.use("/api/auth", authRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});