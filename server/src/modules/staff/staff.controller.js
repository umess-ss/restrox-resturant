import User from '../auth/auth.model.js';
import StaffProfile from './staffProfile.model.js';

// ─── Staff list ───────────────────────────────────────────────────────────────

export const getStaff = async (req, res) => {
  const { role, department, isActive = 'true' } = req.query;
  const userFilter = {};
  if (role) userFilter.role = role;
  if (isActive !== 'all') userFilter.isActive = isActive === 'true';

  const users = await User.find(userFilter).select('-password').sort('name');
  const userIds = users.map((u) => u._id);

  const profileFilter = { user: { $in: userIds } };
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
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ message: 'Staff member not found' });

  const profile = await StaffProfile.findOne({ user: req.params.id });
  res.json({ ...user.toPublic(), profile: profile || null });
};

// ─── Profile CRUD ─────────────────────────────────────────────────────────────

export const upsertProfile = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const profile = await StaffProfile.findOneAndUpdate(
    { user: req.params.id },
    { ...req.body, user: req.params.id },
    { new: true, upsert: true, runValidators: true }
  ).populate('user', 'name email role');

  res.json(profile);
};

export const updateStaff = async (req, res) => {
  const { name, role, isActive } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { name, role, isActive },
    { new: true, runValidators: true }
  ).select('-password');
  if (!user) return res.status(404).json({ message: 'Staff member not found' });
  res.json(user.toPublic());
};

export const deleteStaff = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!user) return res.status(404).json({ message: 'Staff member not found' });
  res.status(204).send();
};
