import Payroll from './payroll.model.js';
import { calculatePayroll, runMonthlyPayroll } from './payroll.service.js';

export const getPayrollList = async (req, res) => {
  const { month, year, status, userId } = req.query;
  const filter = {};
  if (month) filter.month = Number(month);
  if (year) filter.year = Number(year);
  if (status) filter.status = status;
  if (userId) filter.user = userId;

  const records = await Payroll.find(filter)
    .populate('user', 'name email role')
    .populate('profile', 'employeeId department')
    .sort('-year -month');
  res.json(records);
};

export const getMyPayroll = async (req, res) => {
  const records = await Payroll.find({ user: req.user._id })
    .sort('-year -month')
    .limit(12);
  res.json(records);
};

export const getPayrollSlip = async (req, res) => {
  const payroll = await Payroll.findById(req.params.id)
    .populate('user', 'name email role')
    .populate('profile', 'employeeId department baseSalary salaryType currency')
    .populate('approvedBy', 'name');
  if (!payroll) return res.status(404).json({ message: 'Payroll record not found' });

  // Staff can only view their own slip
  if (
    req.user.role === 'waiter' || req.user.role === 'chef'
  ) {
    if (payroll.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  res.json(payroll);
};

export const calculateStaffPayroll = async (req, res) => {
  const { userId } = req.params;
  const { month, year, bonus, taxRate, otherDeductions } = req.body;
  const payroll = await calculatePayroll(userId, Number(month), Number(year), {
    bonus: bonus ? Number(bonus) : 0,
    taxRate: taxRate ? Number(taxRate) : undefined,
    otherDeductions: otherDeductions ? Number(otherDeductions) : 0,
  });
  res.json(payroll);
};

export const runPayroll = async (req, res) => {
  const { month, year, taxRate, bonus } = req.body;
  const results = await runMonthlyPayroll(
    Number(month),
    Number(year),
    { taxRate: taxRate ? Number(taxRate) : undefined, bonus: bonus ? Number(bonus) : 0 },
    req.user._id
  );
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  res.json({ succeeded, failed, results });
};

export const approvePayroll = async (req, res) => {
  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) return res.status(404).json({ message: 'Payroll not found' });
  if (payroll.status === 'paid') return res.status(409).json({ message: 'Already paid' });

  payroll.status = 'approved';
  payroll.approvedBy = req.user._id;
  payroll.approvedAt = new Date();
  await payroll.save();
  res.json(payroll);
};

export const markPayrollPaid = async (req, res) => {
  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) return res.status(404).json({ message: 'Payroll not found' });
  if (payroll.status !== 'approved') {
    return res.status(422).json({ message: 'Payroll must be approved before marking as paid' });
  }

  payroll.status = 'paid';
  payroll.paidAt = new Date();
  await payroll.save();
  res.json(payroll);
};
