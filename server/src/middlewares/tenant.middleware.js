import Restaurant, { getPlanLimits } from '../modules/saas/restaurant.model.js';
import Branch from '../modules/saas/branch.model.js';

/**
 * tenantContext
 *
 * Runs after `protect`. Resolves the restaurant and branch from the
 * authenticated user and stamps them onto req:
 *
 *   req.restaurantId  — ObjectId
 *   req.branchId      — ObjectId | null (null = all branches for this user)
 *   req.restaurant    — full Restaurant document
 *   req.tenantFilter  — { restaurant: ObjectId } — use this in every query
 *   req.branchFilter  — { restaurant: ObjectId, branch: ObjectId } — branch-scoped queries
 *
 * Superadmins bypass tenant isolation entirely.
 * Inactive restaurants are blocked (subscription lapsed).
 */
export const tenantContext = async (req, res, next) => {
  // Superadmins can see everything — no tenant filter applied
  if (req.user.systemRole === 'superadmin') {
    req.tenantFilter = {};
    req.branchFilter = {};
    return next();
  }

  if (!req.user.restaurant) {
    return res.status(403).json({ message: 'User is not associated with any restaurant' });
  }

  const restaurant = await Restaurant.findById(req.user.restaurant);
  if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
  if (!restaurant.isActive) return res.status(403).json({ message: 'Restaurant account is inactive' });
  if (!restaurant.isSubscriptionActive) {
    return res.status(402).json({ message: 'Subscription expired — please renew your plan' });
  }

  req.restaurant    = restaurant;
  req.restaurantId  = restaurant._id;
  req.branchId      = req.user.branch || null;

  // Base filter — always applied to every query
  req.tenantFilter  = { restaurant: restaurant._id };

  // Branch filter — for branch-scoped resources (orders, inventory, tables)
  // If user has a specific branch, scope to it. Managers with null branch see all.
  req.branchFilter  = req.branchId
    ? { restaurant: restaurant._id, branch: req.branchId }
    : { restaurant: restaurant._id };

  next();
};

/**
 * requireBranch
 * Ensures the request has a resolved branchId.
 * Use on routes where branch context is mandatory (e.g. creating an order).
 */
export const requireBranch = (req, res, next) => {
  if (!req.branchId) {
    return res.status(400).json({ message: 'Branch context required — assign user to a branch' });
  }
  next();
};

/**
 * checkPlanFeature(feature)
 * Blocks access if the restaurant's plan doesn't include the feature.
 *
 * Usage: router.get('/payroll', protect, tenantContext, checkPlanFeature('payroll'), handler)
 */
export const checkPlanFeature = (feature) => (req, res, next) => {
  if (req.user.systemRole === 'superadmin') return next();
  if (!req.restaurant?.features?.[feature]) {
    return res.status(403).json({
      message: `Feature '${feature}' is not available on your current plan`,
      plan: req.restaurant?.plan,
      upgradeRequired: true,
    });
  }
  next();
};

/**
 * checkPlanLimit(resource)
 * Checks if the restaurant has hit a plan limit before creating a resource.
 * resource: 'branches' | 'staff'
 *
 * Usage: router.post('/branches', protect, tenantContext, checkPlanLimit('branches'), handler)
 */
export const checkPlanLimit = (resource) => async (req, res, next) => {
  if (req.user.systemRole === 'superadmin') return next();

  const limits = getPlanLimits(req.restaurant.plan);
  const limit = limits[resource];
  if (limit === -1) return next(); // unlimited

  let count = 0;
  if (resource === 'branches') {
    count = await Branch.countDocuments({ restaurant: req.restaurantId, isActive: true });
  }
  if (resource === 'staff') {
    const User = (await import('../modules/auth/auth.model.js')).default;
    count = await User.countDocuments({ restaurant: req.restaurantId, isActive: true });
  }

  if (count >= limit) {
    return res.status(403).json({
      message: `Plan limit reached: ${resource} (${count}/${limit})`,
      plan: req.restaurant.plan,
      upgradeRequired: true,
    });
  }
  next();
};

/**
 * assertBranchAccess
 * Verifies the user has access to the branchId in req.params.branchId or req.body.branch.
 * Prevents a user from one branch accessing another branch's data via URL manipulation.
 */
export const assertBranchAccess = (req, res, next) => {
  if (req.user.systemRole === 'superadmin') return next();
  if (!req.branchId) return next(); // manager with all-branch access

  const requestedBranch = (req.params.branchId || req.body?.branch || '').toString();
  if (!requestedBranch) return next();

  const allowed = [
    req.branchId.toString(),
    ...(req.user.allowedBranches || []).map((b) => b.toString()),
  ];

  if (!allowed.includes(requestedBranch)) {
    return res.status(403).json({ message: 'Access denied to this branch' });
  }
  next();
};
