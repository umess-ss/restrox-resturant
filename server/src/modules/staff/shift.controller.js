import Shift from './shift.model.js';

export const getShifts = async (req, res) => {
  const { from, to, department, userId } = req.query;
  const filter = {};
  if (department) filter.department = department;
  if (userId) filter['assignedTo.user'] = userId;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const shifts = await Shift.find(filter)
    .populate('assignedTo.user', 'name role')
    .populate('createdBy', 'name')
    .sort('date startTime');
  res.json(shifts);
};

export const getMyShifts = async (req, res) => {
  const { from, to } = req.query;
  const filter = { 'assignedTo.user': req.user._id };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const shifts = await Shift.find(filter)
    .populate('assignedTo.user', 'name role')
    .sort('date startTime');
  res.json(shifts);
};

export const createShift = async (req, res) => {
  const shift = await Shift.create({ ...req.body, createdBy: req.user._id });
  await shift.populate('assignedTo.user', 'name role');
  res.status(201).json(shift);
};

export const updateShift = async (req, res) => {
  const shift = await Shift.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('assignedTo.user', 'name role');
  if (!shift) return res.status(404).json({ message: 'Shift not found' });
  res.json(shift);
};

export const deleteShift = async (req, res) => {
  const shift = await Shift.findByIdAndDelete(req.params.id);
  if (!shift) return res.status(404).json({ message: 'Shift not found' });
  res.status(204).send();
};

export const confirmShift = async (req, res) => {
  const shift = await Shift.findById(req.params.id);
  if (!shift) return res.status(404).json({ message: 'Shift not found' });

  const assignment = shift.assignedTo.find(
    (a) => a.user.toString() === req.user._id.toString()
  );
  if (!assignment) return res.status(403).json({ message: 'You are not assigned to this shift' });

  assignment.status = 'confirmed';
  await shift.save();
  res.json(shift);
};

export const getWeeklySchedule = async (req, res) => {
  const { weekStart } = req.query;
  const start = weekStart ? new Date(weekStart) : (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const shifts = await Shift.find({ date: { $gte: start, $lte: end } })
    .populate('assignedTo.user', 'name role')
    .sort('date startTime');

  // Group by date string
  const schedule = {};
  for (const shift of shifts) {
    const key = shift.date.toISOString().split('T')[0];
    if (!schedule[key]) schedule[key] = [];
    schedule[key].push(shift);
  }

  res.json({ weekStart: start, weekEnd: end, schedule });
};
