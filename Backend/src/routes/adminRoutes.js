const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const { JWT_SECRET, authenticateToken, requireAdmin } = require('../middleware/auth');

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

// GET /api/admin/users - List all users (Admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'userId name designation department section facultyCode createdAt updatedAt').sort({ createdAt: -1 });
    const formatted = users.map(u => ({
      id: u.userId,
      username: u.userId,
      name: u.name,
      designation: u.designation,
      department: u.department,
      section: u.section || '',
      facultyCode: u.facultyCode || '',
      createdAt: u.createdAt
    }));
    res.status(200).json({ users: formatted });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching user list.' });
  }
});

// Handler for role assignment
async function handleRoleAssignment(req, res) {
  try {
    const targetUserId = req.body.targetUserId || req.body.userId;
    const newRole = req.body.newRole || req.body.role || req.body.designation;

    if (!targetUserId || !newRole) {
      return res.status(400).json({ message: 'Target user ID and new role are required.' });
    }

    const trimmedId = String(targetUserId).trim();
    const normalizedRole = newRole.charAt(0).toUpperCase() + newRole.slice(1).toLowerCase();

    const allowedRoles = ['Student', 'Teacher', 'Admin'];
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        message: `Invalid role '${newRole}'. Allowed roles are: ${allowedRoles.join(', ')}.`
      });
    }

    const targetUser = await User.findOne({ userId: trimmedId });
    if (!targetUser) {
      return res.status(404).json({ message: `Target user with ID '${trimmedId}' not found.` });
    }

    const previousRole = targetUser.designation;
    targetUser.designation = normalizedRole;
    await targetUser.save();

    // Synchronize role across any bookings owned by the target user
    await Booking.updateMany(
      { user: targetUser.userId },
      { designation: normalizedRole }
    );

    const isSelf = req.user && req.user.userId === targetUser.userId;

    res.status(200).json({
      message: `Role updated confirmation: User ${targetUser.name} (${targetUser.userId}) role changed from ${previousRole} to ${normalizedRole}.`,
      confirmation: {
        success: true,
        targetUserId: targetUser.userId,
        name: targetUser.name,
        department: targetUser.department,
        previousRole,
        newRole: normalizedRole,
        updatedAt: new Date().toISOString()
      },
      user: {
        id: targetUser.userId,
        username: targetUser.userId,
        name: targetUser.name,
        designation: targetUser.designation,
        department: targetUser.department,
        section: targetUser.section || '',
        facultyCode: targetUser.facultyCode || ''
      },
      ...(isSelf ? { token: createToken(targetUser) } : {})
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating user role.' });
  }
}

// POST /api/admin/assign-role (Admin only)
router.post('/assign-role', authenticateToken, requireAdmin, handleRoleAssignment);

// PUT /api/admin/users/role (Admin only alias)
router.put('/users/role', authenticateToken, requireAdmin, handleRoleAssignment);

// POST /api/admin/bootstrap - Allows first-time promotion if no Admin exists
router.post('/bootstrap', authenticateToken, async (req, res) => {
  try {
    const adminCount = await User.countDocuments({ designation: 'Admin' });
    if (adminCount > 0) {
      return res.status(403).json({
        message: 'System already has an active Administrator. Role changes must be performed by an existing Admin.'
      });
    }

    const user = await User.findOne({ userId: req.user.userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.designation = 'Admin';
    await user.save();

    const token = createToken(user);
    res.status(200).json({
      message: 'Initial administrator successfully initialized.',
      user: {
        id: user.userId,
        username: user.userId,
        name: user.name,
        designation: user.designation,
        department: user.department
      },
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during admin bootstrap.' });
  }
});

module.exports = (req, res, next) => router(req, res, next);
