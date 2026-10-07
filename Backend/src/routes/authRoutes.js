const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');

const router = express.Router();

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { id, name, designation, department, password } = req.body;

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
      password: hashedPassword
    });

    await newUser.save();

    const userData = {
      username: newUser.userId,
      name: newUser.name,
      id: newUser.userId,
      designation: newUser.designation,
      department: newUser.department
    };

    res.status(201).json({ user: userData });
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

    const userData = {
      username: user.userId,
      name: user.name,
      id: user.userId,
      designation: user.designation,
      department: user.department
    };

    res.status(200).json({ user: userData });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login.' });
  }
});

module.exports = router;