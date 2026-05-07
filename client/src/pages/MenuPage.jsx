import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  fetchMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  upsertMenuItemRecipe,
  fetchItemMargin,
  fetchAllMargins,
} from '../api/menu.api.js';
import { fetchIngredients } from '../api/inventory.api.js';
import formatCurrency from '../utils/formatCurrency.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['appetizer', 'main', 'dessert', 'beverage', 'special'];
const CATEGORY_COLORS = {
  appetizer: 'bg-yellow-100 text-yellow-700',
  main: 'bg-orange-100 text-orange-700',
  dessert: 'bg-pink-100 text-pink-700',
  beverage: 'bg-blue-100 text-blue-700',
  special: 'bg-purple-100 text-purple-700',
};

const EMPTY_ITEM = {
  name: '', description: '', price: '', category: 'main',
  imageUrl: '', preparationTime: 15, isAvailable: true, tags: '', overheadCost: 0,
};

const itemImageUrl = (item) => item?.imageUrl || item?.image || '';

function MenuImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 ${className}`}>
        <span className="text-lg">🍽️</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

// ─── Margin badge ─────────────────────────────────────────────────────────────

function MarginBadge({ pct }) {
  if (pct === null || pct === undefined) return <span className="text-xs text-gray-400">No recipe</span>;
  const color = pct >= 60 ? 'text-green-600' : pct >= 40 ? 'text-yellow-600' : 'text-red-600';
  return <span className={`text-xs font-semibold ${color}`}>{pct.toFixed(1)}%</span>;
}

// ─── Recipe Editor ────────────────────────────────────────────────────────────

function RecipeEditor({ item, ingredients, onClose, onSaved }) {
  const [rows, setRows] = useState([{ ingredient: '', quantity: '' }]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [margin, setMargin] = useState(null);

  // Load existing recipe rows
  useEffect(() => {
    if (item.recipe?.ingredients?.length) {
      setRows(
        item.recipe.ingredients.map((r) => ({
          ingredient: r.ingredient._id || r.ingredient,
          quantity: r.quantity,
        }))
      );
      setNotes(item.recipe.notes || '');
    }
  }, [item]);

  const addRow = () => setRows((r) => [...r, { ingredient: '', quantity: '' }]);
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));

  const save = async (e) => {
    e.preventDefault();
    const valid = rows.filter((r) => r.ingredient && Number(r.quantity) > 0);
    if (!valid.length) return toast.error('Add at least one ingredient with quantity > 0');
    setLoading(true);
    try {
      await upsertMenuItemRecipe(item._id, {
        ingredients: valid.map((r) => ({ ingredient: r.ingredient, quantity: Number(r.quantity) })),
        notes,
      });
      toast.success('Recipe saved');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const previewMargin = async () => {
    try {
      const data = await fetchItemMargin(item._id);
      setMargin(data);
    } catch {
      toast.error('Save recipe first to preview margin');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-800 text-lg">Recipe — {item.name}</h3>
            <p className="text-sm text-gray-500">Selling price: <strong>{formatCurrency(item.price)}</strong></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={save} className="p-6 space-y-4">
          {/* Ingredient rows */}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_120px_32px] gap-2 text-xs text-gray-500 font-medium px-1">
              <span>Ingredient</span><span>Qty per serving</span><span />
            </div>
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_32px] gap-2 items-center">
                <select
                  value={row.ingredient}
                  onChange={(e) => updateRow(i, 'ingredient', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">Select ingredient</option>
                  {ingredients.map((ing) => (
                    <option key={ing._id} value={ing._id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number" step="0.001" min="0.001"
                  placeholder="Qty"
                  value={row.quantity}
                  onChange={(e) => updateRow(i, 'quantity', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button
                  type="button" onClick={() => removeRow(i)}
                  className="text-red-400 hover:text-red-600 text-lg leading-none"
                  disabled={rows.length === 1}
                >×</button>
              </div>
            ))}
            <button
              type="button" onClick={addRow}
              className="text-sm text-orange-500 hover:text-orange-600 font-medium"
            >+ Add ingredient</button>
          </div>

          <input
            type="text" placeholder="Notes (optional)"
            value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />

          {/* Margin preview */}
          {margin && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1 border border-gray-200">
              <p className="font-medium text-gray-700 mb-2">Cost & Margin Preview</p>
              {margin.breakdown.map((b, i) => (
                <div key={i} className="flex justify-between text-gray-600">
                  <span>{b.ingredient} × {b.quantity} {b.unit}</span>
                  <span>{formatCurrency(b.lineCost)}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Ingredient cost</span><span>{formatCurrency(margin.ingredientCost)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Overhead</span><span>{formatCurrency(margin.overheadCost)}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-800">
                  <span>Total cost</span><span>{formatCurrency(margin.totalCost)}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-800">
                  <span>Selling price</span><span>{formatCurrency(margin.sellingPrice)}</span>
                </div>
                <div className={`flex justify-between font-bold text-base ${margin.marginPct >= 50 ? 'text-green-600' : margin.marginPct >= 30 ? 'text-yellow-600' : 'text-red-600'}`}>
                  <span>Gross margin</span>
                  <span>{margin.marginPct.toFixed(1)}% ({formatCurrency(margin.grossProfit)})</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button" onClick={previewMargin}
              className="flex-1 border border-orange-300 text-orange-600 rounded-lg py-2 text-sm hover:bg-orange-50"
            >Preview Margin</button>
            <button
              type="submit" disabled={loading}
              className="flex-1 bg-orange-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
            >{loading ? 'Saving...' : 'Save Recipe'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Item Form Modal ──────────────────────────────────────────────────────────

function ItemFormModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState(
    item
      ? { ...item, imageUrl: itemImageUrl(item), tags: item.tags?.join(', ') || '' }
      : EMPTY_ITEM
  );
  const [loading, setLoading] = useState(false);

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      ...form,
      imageUrl: form.imageUrl?.trim() || '',
      price: Number(form.price),
      overheadCost: Number(form.overheadCost),
      preparationTime: Number(form.preparationTime),
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };
    try {
      if (item) {
        await updateMenuItem(item._id, payload);
        toast.success('Item updated');
      } else {
        await createMenuItem(payload);
        toast.success('Item created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const field = (label, key, type = 'text', extra = {}) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type} value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        {...extra}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-800">{item ? 'Edit Item' : 'New Menu Item'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {field('Name *', 'name', 'text', { required: true })}

        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <textarea
            value={form.description} onChange={(e) => set('description', e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {field('Price (Rs) *', 'price', 'number', { min: 0, step: '0.01', required: true })}
          {field('Overhead Cost (Rs)', 'overheadCost', 'number', { min: 0, step: '0.01' })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category *</label>
            <select
              value={form.category} onChange={(e) => set('category', e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>
          {field('Prep Time (min)', 'preparationTime', 'number', { min: 1 })}
        </div>

        {field('Tags (comma-separated)', 'tags')}

        <div>
          <label className="block text-xs text-gray-500 mb-1">Image URL</label>
          <input
            type="url"
            value={form.imageUrl}
            onChange={(e) => set('imageUrl', e.target.value)}
            placeholder="https://example.com/menu-item.jpg"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <MenuImage
            src={form.imageUrl}
            alt={form.name || 'Menu item preview'}
            className="mt-2 h-32 w-full rounded-lg"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={form.isAvailable} onChange={(e) => set('isAvailable', e.target.checked)} />
          Available on menu
        </label>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="flex-1 bg-orange-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
            {loading ? 'Saving...' : item ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Margins Panel ────────────────────────────────────────────────────────────

function MarginsPanel({ onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAllMargins().then(setData).catch(() => toast.error('Failed to load margins'));
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-800">Profit Margin Analysis</h3>
            {data && <p className="text-sm text-gray-500">Avg margin: <strong>{data.avgMargin}%</strong></p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-5">
          {!data ? (
            <p className="text-center text-gray-400 py-8">Loading...</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left py-2">Item</th>
                  <th className="text-left py-2">Category</th>
                  <th className="text-right py-2">Price</th>
                  <th className="text-right py-2">Cost</th>
                  <th className="text-right py-2">Profit</th>
                  <th className="text-right py-2">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((r) => (
                  <tr key={r.menuItem.id} className="hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-800">{r.menuItem.name}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLORS[r.menuItem.category]}`}>
                        {r.menuItem.category}
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-700">{formatCurrency(r.sellingPrice)}</td>
                    <td className="py-2 text-right text-gray-500">
                      {r.totalCost !== null ? formatCurrency(r.totalCost) : '—'}
                    </td>
                    <td className="py-2 text-right text-gray-700">
                      {r.grossProfit !== null ? formatCurrency(r.grossProfit) : '—'}
                    </td>
                    <td className="py-2 text-right">
                      <MarginBadge pct={r.marginPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [itemModal, setItemModal] = useState(null);   // null | 'new' | item object
  const [recipeModal, setRecipeModal] = useState(null); // null | item object
  const [showMargins, setShowMargins] = useState(false);

  const load = useCallback(async () => {
    try {
      const [menuData, ingData] = await Promise.all([
        fetchMenuItems({ withRecipe: true }),
        fetchIngredients(),
      ]);
      setItems(menuData);
      setIngredients(ingData);
    } catch {
      toast.error('Failed to load menu');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this menu item?')) return;
    try {
      await deleteMenuItem(id);
      toast.success('Item deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  const displayed = categoryFilter ? items.filter((i) => i.category === categoryFilter) : items;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Menu</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMargins(true)}
            className="text-sm border border-orange-300 text-orange-600 px-3 py-1.5 rounded-lg hover:bg-orange-50"
          >📊 Margins</button>
          <button
            onClick={() => setItemModal('new')}
            className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600"
          >+ New Item</button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCategoryFilter('')}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${!categoryFilter ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >All</button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={`text-xs px-3 py-1 rounded-full border capitalize transition-colors ${categoryFilter === c ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >{c}</button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {displayed.map((item) => (
          <div key={item._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
            <MenuImage
              src={itemImageUrl(item)}
              alt={item.name}
              className="h-36 w-full rounded-lg"
            />

            {/* Top row */}
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${CATEGORY_COLORS[item.category]}`}>
                {item.category}
              </span>
            </div>

            {/* Tags */}
            {item.tags?.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {item.tags.map((t) => (
                  <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            )}

            {/* Price + margin row */}
            <div className="flex items-center justify-between">
              <span className="text-orange-500 font-bold text-lg">{formatCurrency(item.price)}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">⏱ {item.preparationTime}m</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${item.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {item.isAvailable ? 'Available' : 'Off menu'}
                </span>
              </div>
            </div>

            {/* Recipe status */}
            <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-2">
              <span className="text-gray-500">
                {item.recipe
                  ? `📋 ${item.recipe.ingredients.length} ingredient${item.recipe.ingredients.length !== 1 ? 's' : ''}`
                  : '📋 No recipe'}
              </span>
              <button
                onClick={() => setRecipeModal(item)}
                className="text-orange-500 hover:text-orange-600 font-medium"
              >{item.recipe ? 'Edit recipe' : 'Add recipe'}</button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setItemModal(item)}
                className="flex-1 text-xs border border-gray-200 text-gray-600 py-1.5 rounded-lg hover:bg-gray-50"
              >Edit</button>
              <button
                onClick={() => handleDelete(item._id)}
                className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50"
              >Delete</button>
            </div>
          </div>
        ))}

        {displayed.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            No menu items found
          </div>
        )}
      </div>

      {/* Modals */}
      {itemModal && (
        <ItemFormModal
          item={itemModal === 'new' ? null : itemModal}
          onClose={() => setItemModal(null)}
          onSaved={load}
        />
      )}

      {recipeModal && (
        <RecipeEditor
          item={recipeModal}
          ingredients={ingredients}
          onClose={() => setRecipeModal(null)}
          onSaved={load}
        />
      )}

      {showMargins && <MarginsPanel onClose={() => setShowMargins(false)} />}
    </div>
  );
}
