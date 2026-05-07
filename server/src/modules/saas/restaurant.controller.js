import Restaurant from './restaurant.model.js';
import Branch from './branch.model.js';
import User from '../auth/auth.model.js';

// ─── Public: onboarding ───────────────────────────────────────────────────────

/**
 * POST /api/saas/onboard
 * Creates a restaurant + default branch + owner user in one transaction.
 * This is the SaaS registration endpoint.
 */
export const onboardRestaurant = async (req, res) => {
  const { restaurantName, ownerName, ownerEmail, ownerPassword, timezone, currency } = req.body;

  // Check email not already taken
  const existingUser = await User.findOne({ email: ownerEmail });
  if (existingUser) return res.status(409).json({ message: 'Email already in use' });

  // Generate slug from restaurant name
  const slug = restaurantName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36);

  // Create restaurant
  const restaurant = await Restaurant.create({
    name: restaurantName,
    slug,
    email: ownerEmail,
    timezone: timezone || 'UTC',
    currency: currency || 'USD',
    plan: 'trial',
    planExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
  });

  // Create default HQ branch
  const branch = await Branch.create({
    restaurant: restaurant._id,
    name: 'Main Branch',
    isHeadquarters: true,
    isActive: true,
  });

  // Create owner user (admin role)
  const owner = await User.create({
    name: ownerName,
    email: ownerEmail,
    password: ownerPassword,
    role: 'admin',
    restaurant: restaurant._id,
    branch: branch._id,
  });

  // Link owner to restaurant
  restaurant.owner = owner._id;
  await restaurant.save();

  res.status(201).json({
    message: 'Restaurant created successfully',
    restaurant: { id: restaurant._id, name: restaurant.name, slug: restaurant.slug, plan: restaurant.plan },
    branch: { id: branch._id, name: branch.name },
    owner: owner.toPublic(),
  });
};

// ─── Restaurant management (admin of that restaurant) ────────────────────────

export const getMyRestaurant = async (req, res) => {
  const restaurant = await Restaurant.findById(req.restaurantId)
    .populate('owner', 'name email');
  res.json(restaurant);
};

export const updateRestaurant = async (req, res) => {
  const { name, phone, address, timezone, currency, taxRate } = req.body;
  const restaurant = await Restaurant.findByIdAndUpdate(
    req.restaurantId,
    { name, phone, address, timezone, currency, taxRate },
    { new: true, runValidators: true }
  );
  res.json(restaurant);
};

// ─── Branch management ────────────────────────────────────────────────────────

export const getBranches = async (req, res) => {
  const branches = await Branch.find({ restaurant: req.restaurantId, isActive: true }).sort('name');
  res.json(branches);
};

export const getBranch = async (req, res) => {
  const branch = await Branch.findOne({ _id: req.params.id, restaurant: req.restaurantId });
  if (!branch) return res.status(404).json({ message: 'Branch not found' });
  res.json(branch);
};

export const createBranch = async (req, res) => {
  const branch = await Branch.create({ ...req.body, restaurant: req.restaurantId });
  res.status(201).json(branch);
};

export const updateBranch = async (req, res) => {
  const branch = await Branch.findOneAndUpdate(
    { _id: req.params.id, restaurant: req.restaurantId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!branch) return res.status(404).json({ message: 'Branch not found' });
  res.json(branch);
};

export const deactivateBranch = async (req, res) => {
  const branch = await Branch.findOneAndUpdate(
    { _id: req.params.id, restaurant: req.restaurantId, isHeadquarters: false },
    { isActive: false },
    { new: true }
  );
  if (!branch) return res.status(404).json({ message: 'Branch not found or cannot deactivate HQ' });
  res.status(204).send();
};

// ─── Superadmin: platform-level views ────────────────────────────────────────

export const listAllRestaurants = async (req, res) => {
  const { plan, isActive, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (plan) filter.plan = plan;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const skip = (page - 1) * limit;
  const [restaurants, total] = await Promise.all([
    Restaurant.find(filter).populate('owner', 'name email').sort('-createdAt').skip(skip).limit(Number(limit)),
    Restaurant.countDocuments(filter),
  ]);
  res.json({ total, page: Number(page), pages: Math.ceil(total / limit), restaurants });
};

export const updateRestaurantPlan = async (req, res) => {
  const { plan, planExpiresAt, isActive } = req.body;
  const restaurant = await Restaurant.findByIdAndUpdate(
    req.params.id,
    { plan, planExpiresAt, isActive },
    { new: true }
  );
  if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
  res.json(restaurant);
};
