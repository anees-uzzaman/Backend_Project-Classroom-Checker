const mongoose = require('mongoose');

const roomDetailSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, unique: true, trim: true },
    capacity: { type: Number, default: 30 },
    ac: { type: Boolean, default: false },
    projector: { type: Boolean, default: false },
    lab: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RoomDetail', roomDetailSchema);
