import User from '../auth/auth.model.js';

export const getStaff = async (req, res) => {
  const staff = await User.find({ isActive: true }).select('-password').sort('name');
  res.json(staff);
};

export const updateStaff = async (req, res) => {
  const { name, role, isActive } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { name, role, isActive },
    { new: true, runValidators: true }
  ).select('-password');
  if (!user) return res.status(404).json({ message: 'Staff member not found' });
  res.json(user);
};

export const deleteStaff = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!user) return res.status(404).json({ message: 'Staff member not found' });
  res.status(204).send();
};
