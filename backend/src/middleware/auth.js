const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Verify token middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token is required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // A deactivated account's previously-issued access token must stop working
    // immediately rather than remaining valid until it naturally expires.
    const [rows] = await db.query('SELECT is_active FROM users WHERE id = ?', [decoded.userId]);
    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(403).json({ success: false, error: 'Account is deactivated or no longer exists' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
};

// Role check middleware
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User context missing' });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: `Forbidden: Access restricted. Required roles: [${roles.join(', ')}]` 
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  checkRole
};
