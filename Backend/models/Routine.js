const mongoose = require('mongoose');

const routineSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    course: { type: String, required: true, trim: true },
    faculty: { type: String, required: true, trim: true },
    facultyName: { type: String, trim: true, default: '' },
    room: { type: String, required: true, trim: true },
    isLab: { type: Boolean, default: false }
  },
  { timestamps: true }
);

routineSchema.index({ day: 1, time: 1, room: 1 });
routineSchema.index({ section: 1 });
routineSchema.index({ faculty: 1 });

module.exports = mongoose.model('Routine', routineSchema);
