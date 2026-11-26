const express = require('express');
const Booking = require('../../models/Booking');
const Routine = require('../../models/Routine');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/bookings
router.get('/', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.status(200).json({ bookings });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching bookings.' });
  }
});

// POST /api/bookings
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { room, day, time, id } = req.body;

    if (!room || !day || !time) {
      return res.status(400).json({ message: 'Room, day, and time slot are required.' });
    }

    const cleanRoom = String(room).trim();
    const cleanDay = String(day).trim();
    const cleanTime = String(time).trim();

    if (/^(online|tba)$/i.test(cleanRoom)) {
      return res.status(400).json({ message: `Room '${cleanRoom}' cannot be booked as a physical classroom.` });
    }

    // Check if a regular class is scheduled in Routine at this day, time, and room
    const scheduledClass = await Routine.findOne({
      room: cleanRoom,
      day: cleanDay,
      time: cleanTime
    });
    if (scheduledClass) {
      return res.status(409).json({
        message: `Room ${cleanRoom} has a scheduled class (${scheduledClass.course} - Sec ${scheduledClass.section}) on ${cleanDay} at ${cleanTime}.`
      });
    }

    // Check if another user already booked this room for this day and time
    const existing = await Booking.findOne({
      room: cleanRoom,
      day: cleanDay,
      time: cleanTime
    });
    if (existing) {
      return res.status(409).json({
        message: `Room ${cleanRoom} is already booked for ${cleanDay} at ${cleanTime}.`
      });
    }

    const bookingUser = req.user.userId;
    const bookingName = req.user.name || bookingUser;
    const bookingDesignation = req.user.designation || 'Student';
    const bookingId = id || `${cleanRoom}-${cleanDay}-${cleanTime}-${bookingUser}-${Date.now()}`;

    const newBooking = new Booking({
      room: cleanRoom,
      day: cleanDay,
      time: cleanTime,
      user: bookingUser,
      name: bookingName,
      designation: bookingDesignation,
      id: bookingId
    });

    await newBooking.save();
    res.status(201).json({ booking: newBooking });
  } catch (error) {
    res.status(500).json({ message: 'Server error creating booking.' });
  }
});

// DELETE /api/bookings/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findOne({ id });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Allow the booking creator or an Admin to cancel
    if (booking.user !== req.user.userId && req.user.designation !== 'Admin') {
      return res.status(403).json({ message: 'You are not authorized to cancel this booking.' });
    }

    await Booking.deleteOne({ id });
    res.status(200).json({ message: 'Booking canceled successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error canceling booking.' });
  }
});

module.exports = router;
