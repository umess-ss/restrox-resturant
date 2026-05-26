import User from '../auth/auth.model.js';
import StaffProfile from './staffProfile.model.js';
import Branch from '../saas/branch.model.js';
import { ROLES } from '../../config/roles.js';

// ─── Staff list ───────────────────────────────────────────────────────────────

export const getStaff = async (req, res) => {
  const { role, department, isActive = 'true' } = req.query;
  const userFilter = { ...req.tenantFilter };
  if (req.branchId) userFilter.branch = req.branchId;
  if (role) userFilter.role = role;
  if (isActive !== 'all') userFilter.isActive = isActive === 'true';

  const users = await User.find(userFilter).select('-password').sort('name');
  const userIds = users.map((u) => u._id);

  const profileFilter = { ...req.branchFilter, user: { $in: userIds } };
  if (department) profileFilter.department = department;

  const profiles = await StaffProfile.find(profileFilter).lean();
  const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

  const staff = users.map((u) => ({
    ...u.toPublic(),
    profile: profileMap.get(u._id.toString()) || null,
  }));

  res.json(staff);
};

export const getStaffMember = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, ...req.tenantFilter }).select('-password');
  if (!user) return res.status(404).json({ message: 'Staff member not found' });

  const profile = await StaffProfile.findOne({ user: req.params.id, ...req.branchFilter });
  res.json({ ...user.toPublic(), profile: profile || null });
};

export const createStaff = async (req, res) => {
  const {
    name,
    email,
    password,
    role = ROLES.WAITER,
    branchId,
    department = 'floor',
    baseSalary = 0,
    salaryType = 'monthly',
    phone,
  } = req.body;

  if (!Object.values(ROLES).includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: 'Email already in use' });

  const branch = branchId || req.branchId;
  if (!branch) return res.status(400).json({ message: 'Branch is required to create staff' });

  const branchDoc = await Branch.findOne({ _id: branch, restaurant: req.restaurantId, isActive: true });
  if (!branchDoc) return res.status(404).json({ message: 'Branch not found for this restaurant' });

  const user = await User.create({
    name,
    email,
    password,
    role,
    restaurant: req.restaurantId,
    branch,
  });

  const profile = await StaffProfile.create({
    user: user._id,
    restaurant: req.restaurantId,
    branch,
    department,
    baseSalary: Number(baseSalary) || 0,
    salaryType,
    phone,
  });

  res.status(201).json({ ...user.toPublic(), profile });
};

// ─── Profile CRUD ─────────────────────────────────────────────────────────────

export const upsertProfile = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, ...req.tenantFilter });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const profile = await StaffProfile.findOneAndUpdate(
    { user: req.params.id, ...req.branchFilter },
    { ...req.body, user: req.params.id, restaurant: req.restaurantId, branch: user.branch || req.branchId },
    { new: true, upsert: true, runValidators: true }
  ).populate('user', 'name email role');

  res.json(profile);
};

export const updateStaff = async (req, res) => {
  const { name, role, isActive } = req.body;
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, ...req.tenantFilter },
    { name, role, isActive },
    { new: true, runValidators: true }
  ).select('-password');
  if (!user) return res.status(404).json({ message: 'Staff member not found' });
  res.json(user.toPublic());
};

export const deleteStaff = async (req, res) => {
  const user = await User.findOneAndUpdate({ _id: req.params.id, ...req.tenantFilter }, { isActive: false }, { new: true });
  if (!user) return res.status(404).json({ message: 'Staff member not found' });
  res.status(204).send();
};
