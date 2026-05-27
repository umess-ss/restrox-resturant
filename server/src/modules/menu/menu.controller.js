import MenuItem from './menu.model.js';
import Recipe from '../inventory/recipe.model.js';
import {
  createMenuItemWithRecipe,
  updateRecipeWithDiff,
  calcItemCost,
  calcItemMargin,
} from './menu.service.js';

// ─── Menu Items ───────────────────────────────────────────────────────────────

const normalizeMenuItemData = ({ imageUrl, ...data }) => ({ ...data, imageUrl });

export const getMenuItems = async (req, res) => {
  const { category, available, tag, withRecipe } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (available !== undefined) filter.isAvailable = available === 'true';
  if (tag) filter.tags = tag;

  const items = await MenuItem.find(filter).sort('category name');

  if (withRecipe === 'true') {
    // Attach recipe summary to each item in one batch query
    const ids = items.map((i) => i._id);
    const recipes = await Recipe.find({ menuItem: { $in: ids }, isActive: true })
      .populate('ingredients.ingredient', 'name unit costPerUnit')
      .lean();

    const recipeMap = new Map(recipes.map((r) => [r.menuItem.toString(), r]));
    const enriched = items.map((item) => ({
      ...item.toJSON(),
      recipe: recipeMap.get(item._id.toString()) || null,
    }));
    return res.json(enriched);
  }

  res.json(items);
};

export const getMenuItem = async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Menu item not found' });

  const recipe = await Recipe.findOne({ menuItem: item._id, isActive: true }).populate(
    'ingredients.ingredient',
    'name unit costPerUnit quantity'
  );

  res.json({ ...item.toJSON(), recipe: recipe || null });
};

/**
 * POST /api/menu
 * Creates a MenuItem and optionally its Recipe in one atomic operation.
 * Body: { name, price, category, ..., recipe: [{ ingredient, quantity }] }
 */
export const createMenuItem = async (req, res) => {
  const { recipe: recipeIngredients, ...itemData } = req.body;
  const { item, recipe } = await createMenuItemWithRecipe(
    normalizeMenuItemData({ ...itemData, restaurant: req.restaurantId }),
    recipeIngredients,
    req.user._id
  );
  res.status(201).json({ ...item.toJSON(), recipe: recipe || null });
};

export const updateMenuItem = async (req, res) => {
  const { recipe: recipeIngredients, ...itemData } = req.body;

  const item = await MenuItem.findOneAndUpdate(
    { _id: req.params.id, ...req.tenantFilter },
    normalizeMenuItemData(itemData),
    { new: true, runValidators: true }
  );
  if (!item) return res.status(404).json({ message: 'Menu item not found' });

  // If recipe ingredients were included, update them too
  let recipe = null;
  let diff = null;
  if (recipeIngredients) {
    ({ recipe, diff } = await updateRecipeWithDiff(item._id, recipeIngredients));
  } else {
    recipe = await Recipe.findOne({ menuItem: item._id, isActive: true });
  }

  res.json({ ...item.toJSON(), recipe: recipe || null, ...(diff && { recipeDiff: diff }) });
};

export const deleteMenuItem = async (req, res) => {
  const item = await MenuItem.findOneAndDelete({ _id: req.params.id, ...req.tenantFilter });
  if (!item) return res.status(404).json({ message: 'Menu item not found' });
  // Soft-deactivate the recipe too
  await Recipe.findOneAndUpdate({ menuItem: req.params.id, ...req.tenantFilter }, { isActive: false });
  res.status(204).send();
};

// ─── Recipe management ────────────────────────────────────────────────────────

/**
 * GET /api/menu/:id/recipe
 */
export const getMenuItemRecipe = async (req, res) => {
  const recipe = await Recipe.findOne({ menuItem: req.params.id, isActive: true })
    .populate('menuItem', 'name price category')
    .populate('ingredients.ingredient', 'name unit costPerUnit quantity threshold');
  if (!recipe) return res.status(404).json({ message: 'No recipe found for this menu item' });
  res.json(recipe);
};

/**
 * PUT /api/menu/:id/recipe
 * Full replace of recipe ingredients with diff tracking.
 */
export const upsertMenuItemRecipe = async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Menu item not found' });

  const { ingredients, notes } = req.body;
  const { recipe, diff } = await updateRecipeWithDiff(req.params.id, ingredients, notes);
  res.json({ recipe, diff });
};

/**
 * DELETE /api/menu/:id/recipe
 */
export const deleteMenuItemRecipe = async (req, res) => {
  const recipe = await Recipe.findOneAndUpdate(
    { menuItem: req.params.id },
    { isActive: false },
    { new: true }
  );
  if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
  res.status(204).send();
};

// ─── Cost & Margin ────────────────────────────────────────────────────────────

/**
 * GET /api/menu/:id/cost
 * Returns ingredient cost breakdown for one serving.
 */
export const getItemCost = async (req, res) => {
  const data = await calcItemCost(req.params.id);
  res.json(data);
};

/**
 * GET /api/menu/:id/margin
 * Returns profit margin analysis for one serving.
 */
export const getItemMargin = async (req, res) => {
  const data = await calcItemMargin(req.params.id);
  res.json(data);
};

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * GET /api/menu/analytics/margins
 * All active menu items ranked by profit margin.
 * Useful for identifying high/low performers.
 */
export const getAllMargins = async (req, res) => {
  const items = await MenuItem.find({ isAvailable: true }).lean();

  const results = await Promise.all(
    items.map(async (item) => {
      try {
        return await calcItemMargin(item._id);
      } catch {
        return {
          menuItem: { id: item._id, name: item.name, category: item.category },
          sellingPrice: item.price,
          totalCost: null,
          grossProfit: null,
          marginPct: null,
          error: 'No recipe',
        };
      }
    })
  );

  // Sort: items with recipes first, then by margin descending
  results.sort((a, b) => {
    if (a.marginPct === null) return 1;
    if (b.marginPct === null) return -1;
    return b.marginPct - a.marginPct;
  });

  const withRecipe = results.filter((r) => r.marginPct !== null);
  const avgMargin =
    withRecipe.length
      ? +(withRecipe.reduce((s, r) => s + r.marginPct, 0) / withRecipe.length).toFixed(2)
      : 0;

  res.json({ avgMargin, count: results.length, items: results });
};

/**
 * GET /api/menu/analytics/category-summary
 * Average margin and item count per category.
 */
export const getCategorySummary = async (req, res) => {
  const items = await MenuItem.find({ isAvailable: true }).lean();

  const byCategory = {};
  await Promise.all(
    items.map(async (item) => {
      const cat = item.category;
      if (!byCategory[cat]) byCategory[cat] = { items: 0, totalMargin: 0, totalRevenue: 0 };
      byCategory[cat].items += 1;
      byCategory[cat].totalRevenue += item.price;
      try {
        const { marginPct } = await calcItemMargin(item._id);
        byCategory[cat].totalMargin += marginPct;
      } catch {
        // no recipe — skip margin
      }
    })
  );

  const summary = Object.entries(byCategory).map(([category, data]) => ({
    category,
    itemCount: data.items,
    avgSellingPrice: +(data.totalRevenue / data.items).toFixed(2),
    avgMarginPct: +(data.totalMargin / data.items).toFixed(2),
  }));

  res.json(summary.sort((a, b) => b.avgMarginPct - a.avgMarginPct));
};
