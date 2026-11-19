const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'classroom-checker-secret-key-2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
}

function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
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
