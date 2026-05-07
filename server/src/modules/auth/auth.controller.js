import jwt from 'jsonwebtoken';
import User from './auth.model.js';

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

export const register = async (req, res) => {
  const { name, email, password, role } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: 'Email already in use' });

  const user = await User.create({ name, email, password, role });
  res.status(201).json({ token: signToken(user._id), user: { id: user._id, name, email, role } });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  res.json({ token: signToken(user._id), user: { id: user._id, name: user.name, email, role: user.role } });
};

export const getMe = async (req, res) => {
  res.json(req.user);
};
