import Ingredient from './ingredient.model.js';
import StockTransaction from './stockTransaction.model.js';
import { applyStockDelta, getLowStockIngredients } from './inventory.service.js';

// ─── Ingredients CRUD ─────────────────────────────────────────────────────────

export const getIngredients = async (req, res) => {
  const { lowStock, search } = req.query;
  const filter = { isActive: true };
  if (search) filter.name = { $regex: search, $options: 'i' };

  const ingredients = await Ingredient.find(filter).sort('name');

  if (lowStock === 'true') {
    return res.json(ingredients.filter((i) => i.isLowStock));
  }
  res.json(ingredients);
};

export const getIngredient = async (req, res) => {
  const ingredient = await Ingredient.findById(req.params.id);
  if (!ingredient) return res.status(404).json({ message: 'Ingredient not found' });
  res.json(ingredient);
};

export const createIngredient = async (req, res) => {
  const ingredient = await Ingredient.create(req.body);
  res.status(201).json(ingredient);
};

export const updateIngredient = async (req, res) => {
  // Prevent direct quantity edits — must go through stock-in/out/adjustment
  const { quantity, ...safeFields } = req.body;
  if (quantity !== undefined) {
    return res.status(400).json({
      message: 'Direct quantity edits are not allowed. Use /stock-in, /stock-out, or /adjust.',
    });
  }
  const ingredient = await Ingredient.findByIdAndUpdate(req.params.id, safeFields, {
    new: true,
    runValidators: true,
  });
  if (!ingredient) return res.status(404).json({ message: 'Ingredient not found' });
  res.json(ingredient);
};

export const deleteIngredient = async (req, res) => {
  // Soft delete
  const ingredient = await Ingredient.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!ingredient) return res.status(404).json({ message: 'Ingredient not found' });
  res.status(204).send();
};

// ─── Stock movements ──────────────────────────────────────────────────────────

export const stockIn = async (req, res) => {
  const { quantity, notes } = req.body;
  const { ingredient, transaction } = await applyStockDelta({
    ingredientId: req.params.id,
    delta: +quantity,
    type: 'stock_in',
    performedBy: req.user._id,
    reference: { kind: 'Manual' },
    notes,
  });
  res.json({ ingredient, transaction });
};

export const stockOut = async (req, res) => {
  const { quantity, notes } = req.body;
  const { ingredient, transaction } = await applyStockDelta({
    ingredientId: req.params.id,
    delta: -quantity,
    type: 'stock_out',
    performedBy: req.user._id,
    reference: { kind: 'Manual' },
    notes,
  });
  res.json({ ingredient, transaction });
};

export const adjustStock = async (req, res) => {
  const { newQuantity, notes } = req.body;
  const ingredient = await Ingredient.findById(req.params.id);
  if (!ingredient) return res.status(404).json({ message: 'Ingredient not found' });

  const delta = newQuantity - ingredient.quantity;
  if (delta === 0) return res.json({ message: 'No change needed', ingredient });

  const result = await applyStockDelta({
    ingredientId: req.params.id,
    delta,
    type: 'adjustment',
    performedBy: req.user._id,
    reference: { kind: 'Manual' },
    notes: notes || `Manual adjustment to ${newQuantity}`,
  });
  res.json(result);
};

// ─── Low-stock alerts ─────────────────────────────────────────────────────────

export const getLowStock = async (req, res) => {
  const items = await getLowStockIngredients();
  res.json({ count: items.length, items });
};

// ─── Transaction history ──────────────────────────────────────────────────────

export const getTransactionHistory = async (req, res) => {
  const { type, from, to, page = 1, limit = 20 } = req.query;
  const filter = { ingredient: req.params.id };
  if (type) filter.type = type;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (page - 1) * limit;
  const [transactions, total] = await Promise.all([
    StockTransaction.find(filter)
      .populate('performedBy', 'name role')
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit)),
    StockTransaction.countDocuments(filter),
  ]);

  res.json({ total, page: Number(page), pages: Math.ceil(total / limit), transactions });
};
