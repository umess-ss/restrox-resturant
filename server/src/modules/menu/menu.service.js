import mongoose from 'mongoose';
import MenuItem from './menu.model.js';
import Recipe from '../inventory/recipe.model.js';
import logger from '../../config/logger.js';

/**
 * Calculates the ingredient cost for one serving of a menu item.
 * Returns a full breakdown plus totals.
 *
 * @param {string|ObjectId} menuItemId
 * @returns {{ ingredientCost, overheadCost, totalCost, breakdown }}
 */
export const calcItemCost = async (menuItemId) => {
  const [item, recipe] = await Promise.all([
    MenuItem.findById(menuItemId),
    Recipe.findOne({ menuItem: menuItemId, isActive: true }).populate(
      'ingredients.ingredient',
      'name unit costPerUnit'
    ),
  ]);

  if (!item) throw Object.assign(new Error('Menu item not found'), { status: 404 });

  const breakdown = recipe
    ? recipe.ingredients.map(({ ingredient, quantity }) => ({
        ingredient: ingredient.name,
        unit: ingredient.unit,
        quantity,
        costPerUnit: ingredient.costPerUnit,
        lineCost: +(ingredient.costPerUnit * quantity).toFixed(4),
      }))
    : [];

  const ingredientCost = +breakdown.reduce((s, r) => s + r.lineCost, 0).toFixed(4);
  const overheadCost = +(item.overheadCost || 0).toFixed(4);
  const totalCost = +(ingredientCost + overheadCost).toFixed(4);

  return { ingredientCost, overheadCost, totalCost, breakdown };
};

/**
 * Calculates profit margin for one serving.
 *
 * @param {string|ObjectId} menuItemId
 * @returns {{ sellingPrice, totalCost, grossProfit, marginPct, breakdown, ... }}
 */
export const calcItemMargin = async (menuItemId) => {
  const item = await MenuItem.findById(menuItemId);
  if (!item) throw Object.assign(new Error('Menu item not found'), { status: 404 });

  const costData = await calcItemCost(menuItemId);
  const sellingPrice = item.price;
  const grossProfit = +(sellingPrice - costData.totalCost).toFixed(4);
  const marginPct =
    sellingPrice > 0 ? +((grossProfit / sellingPrice) * 100).toFixed(2) : 0;

  return {
    menuItem: { id: item._id, name: item.name, category: item.category },
    sellingPrice,
    ...costData,
    grossProfit,
    marginPct,
  };
};

/**
 * Atomically creates a MenuItem and its Recipe in one transaction.
 *
 * @param {object} itemData   - MenuItem fields
 * @param {Array}  ingredients - [{ ingredient, quantity }] — optional
 * @param {string} userId
 */
export const createMenuItemWithRecipe = async (itemData, ingredients, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [item] = await MenuItem.create([itemData], { session });

    let recipe = null;
    if (ingredients?.length) {
      [recipe] = await Recipe.create(
        [{ menuItem: item._id, restaurant: item.restaurant, ingredients, isActive: true }],
        { session }
      );
    }

    await session.commitTransaction();
    logger.info(`MenuItem "${item.name}" created by user ${userId}`);
    return { item, recipe };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * Updates a recipe and returns a diff of what changed.
 * Useful for audit trails and understanding inventory impact.
 *
 * @param {string} menuItemId
 * @param {Array}  newIngredients - [{ ingredient, quantity }]
 * @param {string} notes
 */
export const updateRecipeWithDiff = async (menuItemId, newIngredients, notes) => {
  const existing = await Recipe.findOne({ menuItem: menuItemId }).populate(
    'ingredients.ingredient',
    'name unit'
  );

  // Build diff: added, removed, changed quantities
  const diff = { added: [], removed: [], changed: [] };

  if (existing) {
    const oldMap = new Map(
      existing.ingredients.map((i) => [i.ingredient._id.toString(), i])
    );
    const newMap = new Map(newIngredients.map((i) => [i.ingredient.toString(), i]));

    for (const [id, oldEntry] of oldMap) {
      if (!newMap.has(id)) {
        diff.removed.push({ ingredient: oldEntry.ingredient.name, was: oldEntry.quantity });
      } else {
        const newEntry = newMap.get(id);
        if (newEntry.quantity !== oldEntry.quantity) {
          diff.changed.push({
            ingredient: oldEntry.ingredient.name,
            was: oldEntry.quantity,
            now: newEntry.quantity,
          });
        }
      }
    }

    for (const [id] of newMap) {
      if (!oldMap.has(id)) diff.added.push({ ingredientId: id });
    }
  } else {
    // No existing recipe — every ingredient is new
    diff.added = newIngredients.map((i) => ({ ingredientId: i.ingredient.toString() }));
  }

  const recipe = await Recipe.findOneAndUpdate(
    { menuItem: menuItemId },
    { menuItem: menuItemId, ingredients: newIngredients, notes, isActive: true },
    { new: true, upsert: true, runValidators: true }
  )
    .populate('menuItem', 'name category price')
    .populate('ingredients.ingredient', 'name unit costPerUnit');

  return { recipe, diff };
};
