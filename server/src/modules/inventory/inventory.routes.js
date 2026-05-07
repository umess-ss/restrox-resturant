import { Router } from 'express';
import { body } from 'express-validator';
import { protect, can, authorize } from '../../middlewares/auth.middleware.js';
import { tenantContext } from '../../middlewares/tenant.middleware.js';
import validate from '../../middlewares/validate.middleware.js';

import {
  getIngredients, getIngredient, createIngredient, updateIngredient, deleteIngredient,
  stockIn, stockOut, adjustStock, getLowStock, getTransactionHistory,
} from './ingredient.controller.js';
import { reportWastage, getWastageLog } from './wastage.controller.js';
import { getRecipes, getRecipe, upsertRecipe, deleteRecipe, getRecipeCost } from './recipe.controller.js';
import {
  stockSummary, consumptionReport, wastageSummary, stockMovement, inventoryValuation,
} from './report.controller.js';

const router = Router();
router.use(protect, tenantContext);

// ─── Ingredients ──────────────────────────────────────────────────────────────

router.get('/ingredients', can('inventory:read'), getIngredients);
router.get('/ingredients/low-stock', can('inventory:read'), getLowStock);
router.get('/ingredients/:id', can('inventory:read'), getIngredient);
router.get('/ingredients/:id/history', can('inventory:read'), getTransactionHistory);

router.post(
  '/ingredients',
  can('inventory:write'),
  [
    body('name').trim().notEmpty(),
    body('unit').isIn(['kg', 'g', 'l', 'ml', 'pcs', 'dozen', 'box']),
    body('quantity').isFloat({ min: 0 }),
    body('threshold').isFloat({ min: 0 }),
    body('costPerUnit').isFloat({ min: 0 }),
    body('supplier.name').trim().notEmpty(),
  ],
  validate,
  createIngredient
);

router.put('/ingredients/:id', can('inventory:write'), updateIngredient);
router.delete('/ingredients/:id', can('inventory:delete'), deleteIngredient);

// ─── Stock movements ──────────────────────────────────────────────────────────

const qtyValidation = [body('quantity').isFloat({ min: 0.001 }).withMessage('Quantity must be > 0'), validate];

router.post('/ingredients/:id/stock-in', can('inventory:write'), qtyValidation, stockIn);
router.post('/ingredients/:id/stock-out', can('inventory:write'), qtyValidation, stockOut);
router.post(
  '/ingredients/:id/adjust',
  authorize('admin', 'manager'),
  [body('newQuantity').isFloat({ min: 0 }), validate],
  adjustStock
);

// ─── Wastage ──────────────────────────────────────────────────────────────────

router.post(
  '/wastage',
  can('inventory:write'),
  [
    body('ingredientId').isMongoId(),
    body('quantity').isFloat({ min: 0.001 }),
    body('reason').isIn(['expired', 'spoiled', 'damaged', 'spillage', 'other']),
  ],
  validate,
  reportWastage
);
router.get('/wastage', can('inventory:read'), getWastageLog);

// ─── Recipes ──────────────────────────────────────────────────────────────────

router.get('/recipes', can('inventory:read'), getRecipes);
router.get('/recipes/:menuItemId', can('inventory:read'), getRecipe);
router.get('/recipes/:menuItemId/cost', can('inventory:read'), getRecipeCost);
router.put(
  '/recipes/:menuItemId',
  can('inventory:write'),
  [
    body('ingredients').isArray({ min: 1 }),
    body('ingredients.*.ingredient').isMongoId(),
    body('ingredients.*.quantity').isFloat({ min: 0.001 }),
  ],
  validate,
  upsertRecipe
);
router.delete('/recipes/:menuItemId', can('inventory:delete'), deleteRecipe);

// ─── Reports ──────────────────────────────────────────────────────────────────

router.get('/reports/stock-summary', can('inventory:read'), stockSummary);
router.get('/reports/consumption', can('inventory:read'), consumptionReport);
router.get('/reports/wastage-summary', can('inventory:read'), wastageSummary);
router.get('/reports/stock-movement', can('inventory:read'), stockMovement);
router.get('/reports/valuation', authorize('admin', 'manager'), inventoryValuation);

export default router;
