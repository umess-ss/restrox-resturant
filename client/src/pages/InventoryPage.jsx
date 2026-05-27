import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  fetchIngredients,
  fetchLowStock,
  stockIn,
  stockOut,
  reportWastage,
  fetchStockSummary,
} from '../api/inventory.api.js';
import { useInventoryEvents } from '../socket/SocketContext.jsx';
import formatCurrency from '../utils/formatCurrency.js';

const UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'dozen', 'box'];
const WASTAGE_REASONS = ['expired', 'spoiled', 'damaged', 'spillage', 'other'];

const formatStock = (quantity, unit) => {
  const value = Number(quantity) || 0;
  if (unit === 'pcs') return `${Math.round(value)} ${unit}`;
  if (['kg', 'l'].includes(unit)) return `${Number(value.toFixed(2)).toLocaleString()} ${unit}`;
  return `${Number(value.toFixed(3)).toLocaleString()} ${unit}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StockBadge({ quantity, threshold }) {
  const low = quantity <= threshold;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${low ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
      {low ? '⚠ Low' : '✓ OK'}
    </span>
  );
}

function QuickActionModal({ ingredient, action, onClose, onDone }) {
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('expired');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!qty || Number(qty) <= 0) return toast.error('Enter a valid quantity');
    setLoading(true);
    try {
      if (action === 'stock_in') {
        await stockIn(ingredient._id, { quantity: Number(qty), notes });
        toast.success(`Stocked in ${qty} ${ingredient.unit} of ${ingredient.name}`);
      } else if (action === 'stock_out') {
        await stockOut(ingredient._id, { quantity: Number(qty), notes });
        toast.success(`Stocked out ${qty} ${ingredient.unit} of ${ingredient.name}`);
      } else if (action === 'wastage') {
        await reportWastage({ ingredientId: ingredient._id, quantity: Number(qty), reason, notes });
        toast.success(`Wastage recorded for ${ingredient.name}`);
      }
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const titles = { stock_in: '📦 Stock In', stock_out: '📤 Stock Out', wastage: '🗑 Report Wastage' };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <h3 className="font-semibold text-gray-800">{titles[action]} — {ingredient.name}</h3>
        <p className="text-sm text-gray-500">Current stock: <strong>{formatStock(ingredient.quantity, ingredient.unit)}</strong></p>

        <input
          type="number" step="0.001" min="0.001" required
          placeholder={`Quantity (${ingredient.unit})`}
          value={qty} onChange={(e) => setQty(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />

        {action === 'wastage' && (
          <select
            value={reason} onChange={(e) => setReason(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            {WASTAGE_REASONS.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
          </select>
        )}

        <input
          type="text" placeholder="Notes (optional)"
          value={notes} onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="flex-1 bg-orange-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
            {loading ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState([]);
  const [summary, setSummary] = useState(null);
  const [modal, setModal] = useState(null); // { ingredient, action }
  const [search, setSearch] = useState('');
  const [filterLow, setFilterLow] = useState(false);

  const load = useCallback(async () => {
    try {
      const [items, sum] = await Promise.all([fetchIngredients(), fetchStockSummary()]);
      setIngredients(items);
      setSummary(sum);
    } catch {
      toast.error('Failed to load inventory');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live stock updates — patch the ingredient in place without full reload
  useInventoryEvents((updated) => {
    setIngredients((prev) =>
      prev.map((i) => i._id === updated._id ? { ...i, ...updated } : i)
    );
  }, []);

  const displayed = ingredients.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchLow = filterLow ? i.quantity <= i.threshold : true;
    return matchSearch && matchLow;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Inventory</h2>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500">Total Value</p>
            <p className="text-2xl font-bold text-gray-800">{formatCurrency(summary.totalInventoryValue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500">Ingredients</p>
            <p className="text-2xl font-bold text-gray-800">{summary.items.length}</p>
          </div>
          <div className={`rounded-xl border shadow-sm p-4 ${summary.lowStockCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
            <p className="text-xs text-gray-500">Low Stock Alerts</p>
            <p className={`text-2xl font-bold ${summary.lowStockCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {summary.lowStockCount}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <input
          type="text" placeholder="Search ingredients..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={filterLow} onChange={(e) => setFilterLow(e.target.checked)} />
          Low stock only
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Ingredient</th>
              <th className="px-4 py-3 text-left">Stock</th>
              <th className="px-4 py-3 text-left">Threshold</th>
              <th className="px-4 py-3 text-left">Unit Cost</th>
              <th className="px-4 py-3 text-left">Supplier</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.map((item) => (
              <tr key={item._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                <td className="px-4 py-3 text-gray-700">{formatStock(item.quantity, item.unit)}</td>
                <td className="px-4 py-3 text-gray-500">{formatStock(item.threshold, item.unit)}</td>
                <td className="px-4 py-3 text-gray-500">{formatCurrency(item.costPerUnit)}</td>
                <td className="px-4 py-3 text-gray-500">{item.supplier?.name}</td>
                <td className="px-4 py-3">
                  <StockBadge quantity={item.quantity} threshold={item.threshold} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setModal({ ingredient: item, action: 'stock_in' })}
                      className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                    >+ In</button>
                    <button
                      onClick={() => setModal({ ingredient: item, action: 'stock_out' })}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                    >− Out</button>
                    <button
                      onClick={() => setModal({ ingredient: item, action: 'wastage' })}
                      className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                    >🗑</button>
                  </div>
                </td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No ingredients found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <QuickActionModal
          ingredient={modal.ingredient}
          action={modal.action}
          onClose={() => setModal(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
