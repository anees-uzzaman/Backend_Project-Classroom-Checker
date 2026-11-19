const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, trim: true },
    day: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    user: { type: String, required: true, trim: true }, // userId
    name: { type: String, required: true, trim: true },
    designation: { type: String, required: true, enum: ['Student', 'Teacher', 'Admin'] },
    id: { type: String, required: true, unique: true, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
