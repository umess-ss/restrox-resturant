import { Router } from 'express';
import { body } from 'express-validator';
import { protect, can, minRole } from '../../middlewares/auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMenuItemRecipe,
  upsertMenuItemRecipe,
  deleteMenuItemRecipe,
  getItemCost,
  getItemMargin,
  getAllMargins,
  getCategorySummary,
} from './menu.controller.js';

const router = Router();

// ─── Analytics (before /:id to avoid param collision) ────────────────────────
router.get('/analytics/margins', protect, minRole('manager'), getAllMargins);
router.get('/analytics/category-summary', protect, minRole('manager'), getCategorySummary);

// ─── Menu Items ───────────────────────────────────────────────────────────────
router.get('/', getMenuItems);       // public
router.get('/:id', getMenuItem);     // public

const itemValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be >= 0'),
  body('category')
    .isIn(['appetizer', 'main', 'dessert', 'beverage', 'special'])
    .withMessage('Invalid category'),
  // Optional recipe inline
  body('recipe').optional().isArray({ min: 1 }).withMessage('Recipe must be a non-empty array'),
  body('recipe.*.ingredient').optional().isMongoId().withMessage('Invalid ingredient ID'),
  body('recipe.*.quantity').optional().isFloat({ min: 0.001 }).withMessage('Quantity must be > 0'),
];

router.post('/', protect, can('menu:write'), itemValidation, validate, createMenuItem);
router.put('/:id', protect, can('menu:write'), updateMenuItem);
router.delete('/:id', protect, can('menu:delete'), deleteMenuItem);

// ─── Recipe sub-resource ──────────────────────────────────────────────────────
router.get('/:id/recipe', protect, can('menu:read'), getMenuItemRecipe);

const recipeValidation = [
  body('ingredients').isArray({ min: 1 }).withMessage('At least one ingredient required'),
  body('ingredients.*.ingredient').isMongoId().withMessage('Invalid ingredient ID'),
  body('ingredients.*.quantity').isFloat({ min: 0.001 }).withMessage('Quantity must be > 0'),
];

router.put('/:id/recipe', protect, can('menu:write'), recipeValidation, validate, upsertMenuItemRecipe);
router.delete('/:id/recipe', protect, can('menu:delete'), deleteMenuItemRecipe);

// ─── Cost & Margin ────────────────────────────────────────────────────────────
router.get('/:id/cost', protect, can('menu:read'), getItemCost);
router.get('/:id/margin', protect, can('menu:read'), getItemMargin);

export default router;
