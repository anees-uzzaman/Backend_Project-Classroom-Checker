const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'classroom-checker-secret-key-2026';

async function hydrateUserFromDb(decoded) {
  if (!decoded || !decoded.userId) return decoded;
  const dbUser = await User.findOne({ userId: decoded.userId })
    .select('userId name designation department section facultyCode')
    .lean();
  if (!dbUser) return null;
  return {
    ...decoded,
    userId: dbUser.userId,
    id: dbUser.userId,
    username: dbUser.userId,
    name: dbUser.name,
    designation: dbUser.designation,
    department: dbUser.department,
    section: dbUser.section || '',
    facultyCode: dbUser.facultyCode || ''
  };
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const hydrated = await hydrateUserFromDb(decoded);
    if (!hydrated) {
      return res.status(401).json({ message: 'User account no longer exists.' });
    }
    req.user = hydrated;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
}

async function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const hydrated = await hydrateUserFromDb(decoded);
      if (hydrated) {
        req.user = hydrated;
      }
    } catch {
      // Ignore invalid token in optional auth
    }
  }
  next();
}

function requireTeacher(req, res, next) {
  if (!req.user || (req.user.designation !== 'Teacher' && req.user.designation !== 'Admin')) {
    return res.status(403).json({ message: 'Access denied. Teacher privileges required.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.designation !== 'Admin') {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  authenticateToken,
  optionalAuthenticateToken,
  requireTeacher,
  requireAdmin
};
