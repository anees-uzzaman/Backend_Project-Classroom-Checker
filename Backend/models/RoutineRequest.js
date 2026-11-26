const mongoose = require('mongoose');

const routineRequestSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    course: { type: String, required: true, trim: true },
    faculty: { type: String, required: true, trim: true },
    facultyName: { type: String, trim: true, default: '' },
    room: { type: String, required: true, trim: true },
    capacity: { type: Number, default: 40 },
    hasAC: { type: Boolean, default: true },
    hasProjector: { type: Boolean, default: true },
    isLab: { type: Boolean, default: false },
    note: { type: String, trim: true, default: '' },
    requestedBy: { type: String, required: true, trim: true },
    requestedByName: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    reviewedBy: { type: String, trim: true, default: '' },
    reviewNote: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

routineRequestSchema.index({ status: 1, createdAt: -1 });
routineRequestSchema.index({ requestedBy: 1, createdAt: -1 });

module.exports = mongoose.model('RoutineRequest', routineRequestSchema);
