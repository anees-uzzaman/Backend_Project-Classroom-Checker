const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, trim: true }, // 'id' from frontend
    name: { type: String, required: true, trim: true },
    designation: { type: String, required: true, enum: ['Student', 'Teacher', 'Admin'] },
    department: { type: String, required: true, trim: true },
    section: { type: String, trim: true, default: '' }, // For students, e.g. "5B", "6A"
    facultyCode: { type: String, trim: true, default: '' }, // For teachers, e.g. "SDS", "ABM"
    password: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);