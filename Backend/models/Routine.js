const mongoose = require('mongoose');

const routineSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    course: { type: String, required: true, trim: true },
    faculty: { type: String, required: true, trim: true },
    room: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

routineSchema.index({ day: 1, time: 1, room: 1 });

module.exports = mongoose.model('Routine', routineSchema);
