const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    {
      userId: user.userId,
      id: user.userId,
      username: user.userId,
      designation: user.designation,
      name: user.name,
      department: user.department,
      section: user.section || '',
      facultyCode: user.facultyCode || ''
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function formatUserData(user) {
  return {
    username: user.userId,
    name: user.name,
    id: user.userId,
    designation: user.designation,
    department: user.department,
    section: user.section || '',
    facultyCode: user.facultyCode || ''
  };
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { id, name, designation, department, password, section, facultyCode } = req.body;

    if (!id || !name || !designation || !department || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existingUser = await User.findOne({ userId: id.trim() });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this ID already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      userId: id.trim(),
      name: name.trim(),
      designation,
      department: department.trim(),
      section: section ? section.trim().toUpperCase() : '',
      facultyCode: facultyCode ? facultyCode.trim().toUpperCase() : '',
      password: hashedPassword
    });

    await newUser.save();

    const userData = formatUserData(newUser);
    const token = createToken(newUser);
    res.status(201).json({ user: userData, token });
  } catch (error) {
    res.status(500).json({ message: 'Server error during signup.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { id, password } = req.body;

    if (!id || !password) {
      return res.status(400).json({ message: 'ID and password are required.' });
    }

    const user = await User.findOne({ userId: id.trim() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid ID or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid ID or password' });
    }

    const userData = formatUserData(user);
    const token = createToken(user);
    res.status(200).json({ user: userData, token });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const userData = formatUserData(user);
    res.status(200).json({ user: userData });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching user profile.' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, designation, department, section, facultyCode } = req.body;

    const user = await User.findOne({ userId: req.user.userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (name) user.name = name.trim();
    if (designation && ['Student', 'Teacher', 'Admin'].includes(designation)) {
      user.designation = designation;
    }
    if (department) user.department = department.trim();
    if (section !== undefined) user.section = section.trim().toUpperCase();
    if (facultyCode !== undefined) user.facultyCode = facultyCode.trim().toUpperCase();

    await user.save();

    // Also update any bookings created by this user
    await Booking.updateMany(
      { user: user.userId },
      { name: user.name, designation: user.designation }
    );

    const userData = formatUserData(user);
    const token = createToken(user);
    res.status(200).json({ user: userData, token });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating user profile.' });
  }
});

module.exports = router;
