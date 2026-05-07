import Wastage from './wastage.model.js';
import { recordWastage } from './inventory.service.js';

export const reportWastage = async (req, res) => {
  const { ingredientId, quantity, reason, notes } = req.body;
  const result = await recordWastage({
    ingredientId,
    quantity,
    reason,
    notes,
    reportedBy: req.user._id,
  });
  res.status(201).json(result);
};

export const getWastageLog = async (req, res) => {
  const { from, to, ingredientId, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (ingredientId) filter.ingredient = ingredientId;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (page - 1) * limit;
  const [records, total] = await Promise.all([
    Wastage.find(filter)
      .populate('ingredient', 'name unit')
      .populate('reportedBy', 'name role')
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit)),
    Wastage.countDocuments(filter),
  ]);

  res.json({ total, page: Number(page), pages: Math.ceil(total / limit), records });
};
