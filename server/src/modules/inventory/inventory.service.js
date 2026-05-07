import mongoose from 'mongoose';
import Ingredient from './ingredient.model.js';
import StockTransaction from './stockTransaction.model.js';
import Wastage from './wastage.model.js';
import Recipe from './recipe.model.js';
import logger from '../../config/logger.js';
import { getIO } from '../../socket/io.js';
import { emitLowStockAlert, emitStockUpdate } from '../../socket/index.js';

export const normalizeQuantity = (value, decimals = 3) => {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
};

/**
 * Core stock mutation helper.
 * Atomically updates ingredient.quantity and writes a ledger entry.
 * Uses a MongoDB session for atomicity.
 *
 * @param {object} opts
 * @param {string}  opts.ingredientId
 * @param {number}  opts.delta          - positive = add, negative = remove
 * @param {string}  opts.type           - StockTransaction type enum
 * @param {string}  opts.performedBy    - User._id
 * @param {object}  [opts.reference]    - { kind, id }
 * @param {string}  [opts.notes]
 * @param {object}  [opts.session]      - existing mongoose session
 * @returns {Promise<{ ingredient, transaction }>}
 */
export const applyStockDelta = async ({
  ingredientId,
  delta,
  type,
  performedBy,
  reference,
  notes,
  session,
}) => {
  const ownSession = !session;
  const s = session ?? (await mongoose.startSession());
  if (ownSession) s.startTransaction();

  try {
    const ingredient = await Ingredient.findById(ingredientId).session(s);
    if (!ingredient) throw new Error(`Ingredient ${ingredientId} not found`);

    const normalizedDelta = normalizeQuantity(delta);
    const quantityBefore = normalizeQuantity(ingredient.quantity);
    const newQty = normalizeQuantity(quantityBefore + normalizedDelta);
    if (newQty < 0) {
      throw new Error(
        `Insufficient stock for "${ingredient.name}": have ${quantityBefore} ${ingredient.unit}, need ${Math.abs(normalizedDelta)}`
      );
    }

    ingredient.quantity = newQty;
    await ingredient.save({ session: s });

    const [transaction] = await StockTransaction.create(
      [
        {
          ingredient: ingredientId,
          type,
          quantity: normalizedDelta,
          quantityBefore,
          quantityAfter: newQty,
          costPerUnit: ingredient.costPerUnit,
          reference,
          notes,
          performedBy,
        },
      ],
      { session: s }
    );

    if (ownSession) await s.commitTransaction();

    const io = getIO();
    // Emit stock update to kitchen + managers
    emitStockUpdate(io, ingredient);
    // Emit low-stock alert to managers only
    if (ingredient.isLowStock) {
      emitLowStockAlert(io, ingredient);
      logger.warn(`LOW STOCK: "${ingredient.name}" at ${newQty} ${ingredient.unit} (threshold: ${ingredient.threshold})`);
    }

    return { ingredient, transaction };
  } catch (err) {
    if (ownSession) await s.abortTransaction();
    throw err;
  } finally {
    if (ownSession) s.endSession();
  }
};

/**
 * Deducts ingredients for every item in an order based on its recipe.
 * Called when an order status transitions to 'paid'.
 * Runs all deductions in a single transaction.
 *
 * @param {object[]} orderItems  - [{ menuItem, quantity }]
 * @param {string}   performedBy - User._id
 * @param {string}   orderId     - Order._id (for reference)
 */
export const deductRecipeIngredients = async (orderItems, performedBy, orderId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const { menuItem, quantity: servings } of orderItems) {
      const recipe = await Recipe.findOne({ menuItem, isActive: true })
        .populate('ingredients.ingredient')
        .session(session);

      if (!recipe) {
        logger.warn(`No active recipe for menuItem ${menuItem} — skipping deduction`);
        continue;
      }

      for (const { ingredient, quantity: qtyPerServing } of recipe.ingredients) {
        const delta = -normalizeQuantity(qtyPerServing * servings);
        await applyStockDelta({
          ingredientId: ingredient._id,
          delta,
          type: 'stock_out',
          performedBy,
          reference: { kind: 'Order', id: orderId },
          notes: `Auto-deducted for order ${orderId}`,
          session,
        });
      }
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    // Log but don't crash the order flow — stock deduction failure shouldn't block serving
    logger.error(`Recipe deduction failed for order ${orderId}: ${err.message}`);
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * Records a wastage event and deducts stock.
 *
 * @param {object} opts
 * @param {string} opts.ingredientId
 * @param {number} opts.quantity
 * @param {string} opts.reason
 * @param {string} [opts.notes]
 * @param {string} opts.reportedBy
 * @returns {Promise<{ wastage, transaction }>}
 */
export const recordWastage = async ({ ingredientId, quantity, reason, notes, reportedBy }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { ingredient, transaction } = await applyStockDelta({
      ingredientId,
      delta: -normalizeQuantity(quantity),
      type: 'wastage',
      performedBy: reportedBy,
      notes,
      session,
    });

    const [wastage] = await Wastage.create(
      [
        {
          ingredient: ingredientId,
          quantity: normalizeQuantity(quantity),
          reason,
          notes,
          reportedBy,
          transaction: transaction._id,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return { wastage, ingredient, transaction };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * Returns all ingredients currently at or below their threshold.
 */
export const getLowStockIngredients = () =>
  Ingredient.find({ isActive: true }).then((items) =>
    items.filter((i) => i.quantity <= i.threshold)
  );
