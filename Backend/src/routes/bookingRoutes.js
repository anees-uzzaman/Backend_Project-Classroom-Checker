const express = require('express');
const Booking = require('../../models/Booking');
const { optionalAuthenticateToken } = require('../middleware/auth');

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
router.post('/', optionalAuthenticateToken, async (req, res) => {
  try {
    const { room, day, time, user, name, designation, id } = req.body;

    if (!room || !day || !time) {
      return res.status(400).json({ message: 'Room, day, and time slot are required.' });
    }

    const bookingUser = (req.user && req.user.userId) || user;
    const bookingName = (req.user && req.user.name) || name || bookingUser;
    const bookingDesignation = (req.user && req.user.designation) || designation || 'Student';

    if (!bookingUser) {
      return res.status(400).json({ message: 'User identifier is required to book a room.' });
    }

    // Check if room is already booked for this day and time
    const existing = await Booking.findOne({ room, day, time });
    if (existing) {
      return res.status(409).json({ message: `Room ${room} is already booked for ${day} at ${time}.` });
    }

    const bookingId = id || `${room}-${day}-${time}-${bookingUser}-${Date.now()}`;

    const newBooking = new Booking({
      room,
      day,
      time,
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
router.delete('/:id', optionalAuthenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findOne({ id });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Optional user check: if user is logged in, ensure they own the booking or are a Teacher
    if (req.user && req.user.designation !== 'Teacher' && booking.user !== req.user.userId) {
      return res.status(403).json({ message: 'You are not authorized to cancel this booking.' });
    }

    await Booking.deleteOne({ id });
    res.status(200).json({ message: 'Booking canceled successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error canceling booking.' });
  }
});

module.exports = router;
