const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

/**
 * Stub auth: verifies a JWT issued by POST /api/auth/login.
 * This is intentionally simple for the prototype (see README, "Security
 * basics" section) — in production this would be replaced by the college's
 * real SSO / identity provider, but the rest of the app only depends on
 * `req.userId` and `req.userRole` existing, so swapping this out later is
 * a localized change.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.username = payload.username;
    req.userRole = payload.role || 'student';
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin (college) role required for this action' });
  }
  return next();
}

module.exports = { requireAuth, requireAdmin };
