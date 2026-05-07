import jwt from 'jsonwebtoken';
import User from '../modules/auth/auth.model.js';
import { PERMISSIONS, hasMinRole } from '../config/roles.js';

/**
 * protect
 * Verifies the Bearer access token, loads the user, and attaches to req.user.
 * Also guards against:
 *  - deactivated accounts
 *  - tokens issued before a password change
 */
export const protect = async (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;

  if (!token) return res.status(401).json({ message: 'Not authorized — no token provided' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ message: msg });
  }

  const user = await User.findById(decoded.id);
  if (!user) return res.status(401).json({ message: 'User no longer exists' });
  if (!user.isActive) return res.status(403).json({ message: 'Account deactivated' });
  if (user.changedPasswordAfter(decoded.iat)) {
    return res.status(401).json({ message: 'Password recently changed — please log in again' });
  }

  req.user = user;
  next();
};

/**
 * authorize(...roles)
 * Restricts access to users whose role is in the provided list.
 *
 * Usage: router.delete('/:id', protect, authorize('admin'), handler)
 */
export const authorize = (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden — requires one of: ${roles.join(', ')}`,
      });
    }
    next();
  };

/**
 * minRole(role)
 * Allows access if the user's role is >= the required role in the hierarchy.
 * chef < waiter < manager < admin
 *
 * Usage: router.get('/', protect, minRole('manager'), handler)
 */
export const minRole = (requiredRole) =>
  (req, res, next) => {
    if (!hasMinRole(req.user.role, requiredRole)) {
      return res.status(403).json({
        message: `Forbidden — requires at least '${requiredRole}' role`,
      });
    }
    next();
  };

/**
 * can(permission)
 * Fine-grained permission check using the PERMISSIONS map in config/roles.js.
 *
 * Usage: router.post('/', protect, can('menu:write'), handler)
 */
export const can = (permission) =>
  (req, res, next) => {
    const allowed = PERMISSIONS[permission];
    if (!allowed) {
      return res.status(500).json({ message: `Unknown permission: ${permission}` });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden — you don't have '${permission}' permission`,
      });
    }
    next();
  };

/**
 * selfOrAdmin
 * Allows access if the requesting user is the resource owner OR an admin.
 * Expects the resource user ID in req.params.id.
 *
 * Usage: router.put('/:id', protect, selfOrAdmin, handler)
 */
export const selfOrAdmin = (req, res, next) => {
  if (req.user.role === 'admin' || req.user._id.toString() === req.params.id) {
    return next();
  }
  res.status(403).json({ message: 'Forbidden — you can only modify your own account' });
};
