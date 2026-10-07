const mongoose = require("mongoose");

function getMongoUri() {
  const configuredUri = process.env.MONGODB_URI;
  const username = process.env.MONGODB_USERNAME;
  const password = process.env.MONGODB_PASSWORD;

  if (!configuredUri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (configuredUri.startsWith("mongodb://") || configuredUri.startsWith("mongodb+srv://")) {
    return configuredUri;
  }

  if (!username || !password) {
    throw new Error(
      "MONGODB_USERNAME and MONGODB_PASSWORD are required when MONGODB_URI is a host."
    );
  }

  return `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(
    password
  )}@${configuredUri}/Room_Checker_v2?retryWrites=true&w=majority`;
}

async function connectDatabase() {
  const mongoUri = getMongoUri();

  await mongoose.connect(mongoUri, {
    dbName: "Room_Checker_v2", // Your new database name
  });
  console.log("MongoDB connected successfully");
}

module.exports = connectDatabase; // Export as a default function