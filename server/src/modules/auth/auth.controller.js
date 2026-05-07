import jwt from 'jsonwebtoken';
import User from './auth.model.js';
import Restaurant from '../saas/restaurant.model.js';

// ─── Token helpers ────────────────────────────────────────────────────────────

const signAccess = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

const signRefresh = (id, version) =>
  jwt.sign({ id, version }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

const sendTokens = async (user, statusCode, res) => {
  const accessToken = signAccess(user._id);
  const refreshToken = signRefresh(user._id, user.tokenVersion);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Include restaurant context in the login response so the frontend
  // can set up the tenant store without an extra round-trip
  let restaurantContext = null;
  if (user.restaurant) {
    const restaurant = await Restaurant.findById(user.restaurant).select('name slug plan features isActive planExpiresAt');
    if (restaurant) {
      restaurantContext = {
        id: restaurant._id,
        name: restaurant.name,
        slug: restaurant.slug,
        plan: restaurant.plan,
        features: restaurant.features,
        isActive: restaurant.isActive,
      };
    }
  }

  res.status(statusCode).json({
    accessToken,
    user: user.toPublic(),
    restaurant: restaurantContext,
  });
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Public. Only admins can assign roles other than 'waiter'.
 */
export const register = async (req, res) => {
  const { name, email, password, role, branchId } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: 'Email already in use' });

  // Role assignment: only admins within a restaurant can assign non-waiter roles
  const assignedRole = role && req.user?.role === 'admin' ? role : 'waiter';

  // Inherit restaurant + branch from the creating admin, or from body if superadmin
  const restaurant = req.user?.restaurant || req.body.restaurant || null;
  const branch = branchId || req.user?.branch || null;

  const user = await User.create({ name, email, password, role: assignedRole, restaurant, branch });
  await sendTokens(user, 201, res);
};

/**
 * POST /api/auth/login
 * Public.
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  // password is select:false — must explicitly include it
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  if (!user.isActive) {
    return res.status(403).json({ message: 'Account deactivated. Contact an administrator.' });
  }

  await sendTokens(user, 200, res);
};

/**
 * POST /api/auth/logout
 * Protected. Clears cookie and bumps tokenVersion to invalidate all refresh tokens.
 */
export const logout = async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
};

/**
 * POST /api/auth/refresh
 * Public (uses httpOnly cookie). Issues a new access token.
 */
export const refresh = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ message: 'No refresh token' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) return res.status(401).json({ message: 'User not found or inactive' });
  if (user.tokenVersion !== decoded.version) {
    return res.status(401).json({ message: 'Refresh token revoked' });
  }

  res.json({ accessToken: signAccess(user._id), user: user.toPublic() });
};

/**
 * GET /api/auth/me
 * Protected.
 */
export const getMe = async (req, res) => {
  res.json(req.user.toPublic());
};

/**
 * PATCH /api/auth/change-password
 * Protected.
 */
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(currentPassword))) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save(); // triggers pre-save hash + sets passwordChangedAt

  await sendTokens(user, 200, res);
};

/**
 * PATCH /api/auth/profile
 * Protected. Users can update their own name only.
 */
export const updateProfile = async (req, res) => {
  const { name } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name },
    { new: true, runValidators: true }
  );
  res.json(user.toPublic());
};
