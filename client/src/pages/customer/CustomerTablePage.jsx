import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPublicTable, fetchPublicMenu, placePublicOrder } from '../../api/public.api.js';
import formatCurrency from '../../utils/formatCurrency.js';

// ─── Category icons ───────────────────────────────────────────────────────────

const CAT_ICONS = {
  appetizer: '🥗', main: '🍽️', dessert: '🍰', beverage: '🥤', special: '⭐',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const itemImageUrl = (item) => item?.imageUrl || item?.image || '';

function MenuItemImage({ item }) {
  const [failed, setFailed] = useState(false);
  const src = itemImageUrl(item);

  if (!src || failed) {
    return (
      <div className="w-20 h-20 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 shrink-0 sm:w-24 sm:h-24">
        <span className="text-lg">🍽️</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={item.name}
      onError={() => setFailed(true)}
      className="w-20 h-20 rounded-xl object-cover shrink-0 sm:w-24 sm:h-24"
      loading="lazy"
    />
  );
}

// ─── Item notes modal ─────────────────────────────────────────────────────────

function NotesModal({ item, current, onSave, onClose }) {
  const [notes, setNotes] = useState(current || '');
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
        <h3 className="font-semibold text-gray-800">Notes for {item.name}</h3>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. no onions, extra spicy…"
          maxLength={100}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-xl py-2 text-sm text-gray-600">Cancel</button>
          <button onClick={() => { onSave(notes.trim()); onClose(); }}
            className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium">Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Cart drawer ──────────────────────────────────────────────────────────────

function CartDrawer({ cart, onQty, onNotes, onClose, onSubmit, submitting, tableInfo }) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNote, setCustomerNote] = useState('');

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-lg">Your Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {cart.map((item) => (
            <div key={item._id} className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm">{item.name}</p>
                <p className="text-orange-500 text-sm font-semibold">{formatCurrency(item.price)}</p>
                {item.notes && (
                  <p className="text-xs text-gray-400 italic mt-0.5">"{item.notes}"</p>
                )}
                <button
                  onClick={() => onNotes(item)}
                  className="text-xs text-blue-500 mt-0.5 hover:underline"
                >
                  {item.notes ? 'Edit note' : '+ Add note'}
                </button>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onQty(item._id, item.qty - 1)}
                  className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200"
                >−</button>
                <span className="w-5 text-center text-sm font-semibold">{item.qty}</span>
                <button
                  onClick={() => onQty(item._id, item.qty + 1)}
                  className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-bold text-sm hover:bg-orange-200"
                >+</button>
              </div>
              <span className="text-sm font-semibold text-gray-700 w-14 text-right shrink-0">
                {formatCurrency(item.price * item.qty)}
              </span>
            </div>
          ))}

          {/* Customer info */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your details (optional)</p>
            <input
              type="text" placeholder="Your name" maxLength={60}
              value={customerName} onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <input
              type="tel" placeholder="Phone number" maxLength={20}
              value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <textarea
              rows={2} placeholder="Any special requests?" maxLength={200}
              value={customerNote} onChange={(e) => setCustomerNote(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-6 pt-3 border-t border-gray-100 space-y-3">
          <div className="flex justify-between text-sm font-semibold text-gray-800">
            <span>Subtotal (excl. tax)</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <button
            onClick={() => onSubmit({ customerName, customerPhone, customerNote })}
            disabled={submitting || cart.length === 0}
            className="w-full bg-orange-500 text-white rounded-2xl py-3.5 font-bold text-base hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Placing order…' : `Place Order · ${formatCurrency(subtotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomerTablePage() {
  const { restaurantId, branchId, tableId } = useParams();
  const navigate = useNavigate();

  const [tableInfo, setTableInfo] = useState(null);
  const [menu, setMenu] = useState({ items: [], grouped: {} });
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [notesModal, setNotesModal] = useState(null); // item in cart
  const [submitting, setSubmitting] = useState(false);

  // ─── Load table + menu ──────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [tableData, menuData] = await Promise.all([
          fetchPublicTable(restaurantId, branchId, tableId),
          fetchPublicMenu(restaurantId, branchId),
        ]);
        setTableInfo(tableData);
        setMenu(menuData);
        const cats = Object.keys(menuData.grouped);
        if (cats.length) setActiveCategory(cats[0]);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load menu. Please scan the QR code again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [restaurantId, branchId, tableId]);

  // ─── Cart helpers ────────────────────────────────────────────────────────

  const addToCart = useCallback((item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c._id === item._id);
      if (existing) return prev.map((c) => c._id === item._id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { _id: item._id, name: item.name, price: item.price, qty: 1, notes: '' }];
    });
  }, []);

  const changeQty = useCallback((id, qty) => {
    if (qty <= 0) return setCart((prev) => prev.filter((c) => c._id !== id));
    setCart((prev) => prev.map((c) => c._id === id ? { ...c, qty } : c));
  }, []);

  const saveNotes = useCallback((id, notes) => {
    setCart((prev) => prev.map((c) => c._id === id ? { ...c, notes } : c));
  }, []);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // ─── Submit order ────────────────────────────────────────────────────────

  const submitOrder = async ({ customerName, customerPhone, customerNote }) => {
    if (submitting || !cart.length) return;
    setSubmitting(true);
    try {
      const result = await placePublicOrder({
        restaurantId,
        branchId,
        tableId,
        items: cart.map((c) => ({
          menuItem: c._id,
          quantity: c.qty,
          notes: c.notes || undefined,
        })),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        customerNote: customerNote || undefined,
      });
      navigate(`/customer/order/${result.orderId}/status`, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to place order. Please try again.';
      alert(msg); // simple alert — no toast dependency on customer pages
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Filtered items ──────────────────────────────────────────────────────

  const displayedItems = search
    ? menu.items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : (menu.grouped[activeCategory] || []);

  const categories = Object.keys(menu.grouped);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading menu…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-xs">
          <p className="text-4xl">😕</p>
          <p className="text-gray-700 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-orange-500 underline"
          >Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-800 text-base">{tableInfo?.restaurant?.name}</p>
              <p className="text-xs text-gray-500">
                {tableInfo?.branch?.name} · Table {tableInfo?.table?.number}
              </p>
            </div>
            {tableInfo?.table?.hasActiveOrder && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                Order in progress
              </span>
            )}
          </div>
          {/* Search */}
          <input
            type="text"
            placeholder="Search menu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
          />
        </div>

        {/* Category tabs — hidden when searching */}
        {!search && categories.length > 0 && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                  activeCategory === cat
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'border-gray-300 text-gray-600 bg-white'
                }`}
              >
                {CAT_ICONS[cat]} {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Menu items */}
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {displayedItems.length === 0 && (
          <p className="text-center text-gray-400 py-12">No items found</p>
        )}
        {displayedItems.map((item) => {
          const inCart = cart.find((c) => c._id === item._id);
          return (
            <div
              key={item._id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3"
            >
              <MenuItemImage item={item} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {item.tags?.map((t) => (
                    <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t}</span>
                  ))}
                  {item.preparationTime && (
                    <span className="text-xs text-gray-400">⏱ {item.preparationTime}m</span>
                  )}
                </div>
                <p className="text-orange-500 font-bold mt-1">{formatCurrency(item.price)}</p>
              </div>

              {/* Add / qty control */}
              {inCart ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => changeQty(item._id, inCart.qty - 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold hover:bg-gray-200"
                  >−</button>
                  <span className="w-5 text-center font-semibold text-sm">{inCart.qty}</span>
                  <button
                    onClick={() => changeQty(item._id, inCart.qty + 1)}
                    className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold hover:bg-orange-600"
                  >+</button>
                </div>
              ) : (
                <button
                  onClick={() => addToCart(item)}
                  className="shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white font-bold text-lg hover:bg-orange-600 flex items-center justify-center"
                >+</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-40 px-4">
          <button
            onClick={() => setShowCart(true)}
            className="bg-orange-500 text-white rounded-2xl px-6 py-3.5 font-bold shadow-xl hover:bg-orange-600 flex items-center gap-3 max-w-sm w-full justify-between"
          >
            <span className="bg-white/20 rounded-xl px-2 py-0.5 text-sm font-bold">{cartCount}</span>
            <span>View Order</span>
            <span>{formatCurrency(cart.reduce((s, i) => s + i.price * i.qty, 0))}</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <CartDrawer
          cart={cart}
          onQty={changeQty}
          onNotes={(item) => setNotesModal(item)}
          onClose={() => setShowCart(false)}
          onSubmit={submitOrder}
          submitting={submitting}
          tableInfo={tableInfo}
        />
      )}

      {/* Notes modal */}
      {notesModal && (
        <NotesModal
          item={notesModal}
          current={cart.find((c) => c._id === notesModal._id)?.notes || ''}
          onSave={(notes) => saveNotes(notesModal._id, notes)}
          onClose={() => setNotesModal(null)}
        />
      )}
    </div>
  );
}
