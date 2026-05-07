import StockTransaction from './stockTransaction.model.js';
import Wastage from './wastage.model.js';
import Ingredient from './ingredient.model.js';

/**
 * GET /api/inventory/reports/stock-summary
 * Current stock levels with low-stock flag and total value.
 */
export const stockSummary = async (req, res) => {
  const summary = await Ingredient.aggregate([
    { $match: { isActive: true } },
    {
      $project: {
        name: 1,
        unit: 1,
        quantity: 1,
        threshold: 1,
        costPerUnit: 1,
        totalValue: { $multiply: ['$quantity', '$costPerUnit'] },
        isLowStock: { $lte: ['$quantity', '$threshold'] },
        supplier: '$supplier.name',
      },
    },
    { $sort: { isLowStock: -1, name: 1 } }, // low-stock items first
  ]);

  const totalInventoryValue = summary.reduce((s, i) => s + i.totalValue, 0);
  const lowStockCount = summary.filter((i) => i.isLowStock).length;

  res.json({ totalInventoryValue: +totalInventoryValue.toFixed(2), lowStockCount, items: summary });
};

/**
 * GET /api/inventory/reports/consumption
 * Ingredient consumption over a date range, grouped by ingredient.
 * Query params: from, to
 */
export const consumptionReport = async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);

  const report = await StockTransaction.aggregate([
    {
      $match: {
        type: 'stock_out',
        ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
      },
    },
    {
      $group: {
        _id: '$ingredient',
        totalConsumed: { $sum: { $abs: '$quantity' } },
        totalCost: { $sum: { $multiply: [{ $abs: '$quantity' }, '$costPerUnit'] } },
        transactions: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'ingredients',
        localField: '_id',
        foreignField: '_id',
        as: 'ingredient',
      },
    },
    { $unwind: '$ingredient' },
    {
      $project: {
        _id: 0,
        ingredient: '$ingredient.name',
        unit: '$ingredient.unit',
        totalConsumed: 1,
        totalCost: { $round: ['$totalCost', 2] },
        transactions: 1,
      },
    },
    { $sort: { totalConsumed: -1 } },
  ]);

  res.json(report);
};

/**
 * GET /api/inventory/reports/wastage-summary
 * Wastage grouped by ingredient and reason over a date range.
 */
export const wastageSummary = async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);

  const report = await Wastage.aggregate([
    {
      $match: Object.keys(dateFilter).length ? { createdAt: dateFilter } : {},
    },
    {
      $group: {
        _id: { ingredient: '$ingredient', reason: '$reason' },
        totalWasted: { $sum: '$quantity' },
        incidents: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'ingredients',
        localField: '_id.ingredient',
        foreignField: '_id',
        as: 'ingredient',
      },
    },
    { $unwind: '$ingredient' },
    {
      $project: {
        _id: 0,
        ingredient: '$ingredient.name',
        unit: '$ingredient.unit',
        reason: '$_id.reason',
        totalWasted: 1,
        incidents: 1,
        estimatedLoss: {
          $round: [{ $multiply: ['$totalWasted', '$ingredient.costPerUnit'] }, 2],
        },
      },
    },
    { $sort: { estimatedLoss: -1 } },
  ]);

  const totalLoss = report.reduce((s, r) => s + r.estimatedLoss, 0);
  res.json({ totalEstimatedLoss: +totalLoss.toFixed(2), breakdown: report });
};

/**
 * GET /api/inventory/reports/stock-movement
 * Full movement history for one ingredient with running balance.
 * Query params: ingredientId (required), from, to
 */
export const stockMovement = async (req, res) => {
  const { ingredientId, from, to } = req.query;
  if (!ingredientId) return res.status(400).json({ message: 'ingredientId is required' });

  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);

  const transactions = await StockTransaction.aggregate([
    {
      $match: {
        ingredient: new (await import('mongoose')).default.Types.ObjectId(ingredientId),
        ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
      },
    },
    { $sort: { createdAt: 1 } },
    {
      $lookup: {
        from: 'users',
        localField: 'performedBy',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        type: 1,
        quantity: 1,
        quantityBefore: 1,
        quantityAfter: 1,
        notes: 1,
        createdAt: 1,
        performedBy: '$user.name',
        reference: 1,
      },
    },
  ]);

  res.json(transactions);
};

/**
 * GET /api/inventory/reports/valuation
 * Total inventory value grouped by supplier.
 */
export const inventoryValuation = async (req, res) => {
  const report = await Ingredient.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$supplier.name',
        ingredients: { $sum: 1 },
        totalValue: { $sum: { $multiply: ['$quantity', '$costPerUnit'] } },
      },
    },
    {
      $project: {
        _id: 0,
        supplier: '$_id',
        ingredients: 1,
        totalValue: { $round: ['$totalValue', 2] },
      },
    },
    { $sort: { totalValue: -1 } },
  ]);

  const grandTotal = report.reduce((s, r) => s + r.totalValue, 0);
  res.json({ grandTotal: +grandTotal.toFixed(2), bySupplier: report });
};
