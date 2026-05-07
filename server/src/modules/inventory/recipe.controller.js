import Recipe from './recipe.model.js';

export const getRecipes = async (req, res) => {
  const recipes = await Recipe.find({ isActive: true })
    .populate('menuItem', 'name category price')
    .populate('ingredients.ingredient', 'name unit costPerUnit');
  res.json(recipes);
};

export const getRecipe = async (req, res) => {
  const recipe = await Recipe.findOne({ menuItem: req.params.menuItemId })
    .populate('menuItem', 'name category price')
    .populate('ingredients.ingredient', 'name unit costPerUnit');
  if (!recipe) return res.status(404).json({ message: 'Recipe not found for this menu item' });
  res.json(recipe);
};

export const upsertRecipe = async (req, res) => {
  const { menuItemId } = req.params;
  const { ingredients, notes } = req.body;

  const recipe = await Recipe.findOneAndUpdate(
    { menuItem: menuItemId },
    { menuItem: menuItemId, ingredients, notes, isActive: true },
    { new: true, upsert: true, runValidators: true }
  )
    .populate('menuItem', 'name category')
    .populate('ingredients.ingredient', 'name unit');

  res.status(200).json(recipe);
};

export const deleteRecipe = async (req, res) => {
  const recipe = await Recipe.findOneAndUpdate(
    { menuItem: req.params.menuItemId },
    { isActive: false },
    { new: true }
  );
  if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
  res.status(204).send();
};

/**
 * Returns the estimated ingredient cost for one serving of a menu item.
 */
export const getRecipeCost = async (req, res) => {
  const recipe = await Recipe.findOne({ menuItem: req.params.menuItemId, isActive: true }).populate(
    'ingredients.ingredient',
    'name unit costPerUnit'
  );
  if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

  const breakdown = recipe.ingredients.map(({ ingredient, quantity }) => ({
    ingredient: ingredient.name,
    unit: ingredient.unit,
    quantity,
    costPerUnit: ingredient.costPerUnit,
    lineCost: +(ingredient.costPerUnit * quantity).toFixed(4),
  }));

  const totalCost = breakdown.reduce((s, r) => s + r.lineCost, 0);
  res.json({ menuItem: recipe.menuItem, totalCost: +totalCost.toFixed(4), breakdown });
};
