const mongoose = require("mongoose");

let cached = global.__mongooseCache;
if (!cached) {
  cached = global.__mongooseCache = { conn: null, promise: null };
}

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
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const mongoUri = getMongoUri();
    cached.promise = mongoose
      .connect(mongoUri, {
        dbName: "Room_Checker_v2",
      })
      .then((mongooseInstance) => {
        console.log("MongoDB connected successfully");
        return mongooseInstance;
      })
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDatabase;
