const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, trim: true }, // 'id' from frontend
    name: { type: String, required: true, trim: true },
    designation: { type: String, required: true, enum: ['Student', 'Teacher'] },
    department: { type: String, required: true, trim: true },
    password: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);