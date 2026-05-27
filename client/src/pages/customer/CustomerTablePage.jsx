import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPublicTable, fetchPublicMenu, placePublicOrder } from '../../api/public.api.js';
import formatCurrency from '../../utils/formatCurrency.js';

const CAT_META = {
  appetizer: { icon: '🥗', label: 'Starters' },
  main: { icon: '🍽', label: 'Main Dishes' },
  dessert: { icon: '🍰', label: 'Desserts' },
  beverage: { icon: '🥤', label: 'Drinks' },
  special: { icon: '⭐', label: 'Specials' },
};

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
];

const itemImageUrl = (item, index = 0) =>
  item?.imageUrl || item?.image || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];

function DishImage({ item, index = 0, className = '' }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? FALLBACK_IMAGES[index % FALLBACK_IMAGES.length] : itemImageUrl(item, index);

  return (
    <img
      src={src}
      alt={item?.name || 'Menu item'}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
      loading="lazy"
    />
  );
}

function QtyControl({ qty = 0, onAdd, onMinus, onPlus, compact = false }) {
  if (!qty) {
    return (
      <button
        onClick={onAdd}
        className={compact
          ? 'grid h-8 w-8 place-items-center rounded-full bg-black text-sm font-bold text-white transition hover:bg-red-600'
          : 'rounded-full bg-black px-7 py-3 text-sm font-bold text-white transition hover:bg-red-600'}
      >
        {compact ? '+' : 'Add to order'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={onMinus} className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 font-bold text-gray-700 transition hover:bg-gray-200">−</button>
      <span className="w-6 text-center text-sm font-extrabold text-gray-900">{qty}</span>
      <button onClick={onPlus} className="grid h-8 w-8 place-items-center rounded-full bg-black font-bold text-white transition hover:bg-red-600">+</button>
    </div>
  );
}

function NotesModal({ item, current, onSave, onClose }) {
  const [notes, setNotes] = useState(current || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-gray-950">Order note</h3>
            <p className="text-sm text-gray-500">{item.name}</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-xl text-gray-500 hover:text-gray-900">×</button>
        </div>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="No onions, extra spicy, less salt..."
          maxLength={100}
          className="w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100"
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-full border border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => { onSave(notes.trim()); onClose(); }}
            className="rounded-full bg-red-600 py-3 text-sm font-bold text-white shadow-lg shadow-red-100 hover:bg-red-700"
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [notesModal, setNotesModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNote, setCustomerNote] = useState('');

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
        const cats = Object.keys(menuData.grouped || {});
        if (cats.length) setActiveCategory(cats[0]);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load menu. Please scan the QR code again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [restaurantId, branchId, tableId]);

  const addToCart = useCallback((item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c._id === item._id);
      if (existing) return prev.map((c) => c._id === item._id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { _id: item._id, name: item.name, price: item.price, qty: 1, notes: '', imageUrl: itemImageUrl(item) }];
    });
  }, []);

  const changeQty = useCallback((id, qty) => {
    if (qty <= 0) return setCart((prev) => prev.filter((c) => c._id !== id));
    setCart((prev) => prev.map((c) => c._id === id ? { ...c, qty } : c));
  }, []);

  const saveNotes = useCallback((id, notes) => {
    setCart((prev) => prev.map((c) => c._id === id ? { ...c, notes } : c));
  }, []);

  const categories = Object.keys(menu.grouped || {});
  const displayedItems = useMemo(() => {
    const source = search ? menu.items : (menu.grouped[activeCategory] || []);
    return source.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
  }, [activeCategory, menu.grouped, menu.items, search]);

  const featured = displayedItems[0] || menu.items[0];
  const supportingItems = displayedItems.filter((item) => item._id !== featured?._id);
  const recommended = (supportingItems.length ? supportingItems : menu.items.filter((item) => item._id !== featured?._id)).slice(0, 3);
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const cartQty = (id) => cart.find((item) => item._id === id)?.qty || 0;

  const submitOrder = async () => {
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
      alert(err.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f4f7]">
        <div className="text-center">
          <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
          <p className="mt-4 text-sm font-semibold text-gray-500">Opening menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f4f7] p-6">
        <div className="max-w-sm rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <p className="text-4xl">!</p>
          <p className="mt-3 font-bold text-gray-900">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-5 rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-auto bg-[#e9e9f1] px-8 py-8 text-gray-950">
      <div className="mx-auto min-w-[1120px] max-w-[1440px] rounded-[2rem] bg-white/80 p-5 shadow-2xl shadow-gray-300/70 ring-1 ring-white">
        <header className="mb-4 flex h-16 items-center gap-5 rounded-[1.5rem] bg-white px-5 shadow-sm">
          <div className="mr-3 text-xl font-black tracking-tight text-red-600">
            {tableInfo?.restaurant?.name || 'RestroX'}
          </div>

          <nav className="flex flex-1 items-center gap-2 overflow-hidden">
            {categories.map((cat) => {
              const meta = CAT_META[cat] || { icon: '🍴', label: cat };
              return (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setSearch(''); }}
                  className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold capitalize transition ${
                    activeCategory === cat && !search
                      ? 'bg-red-50 text-red-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-950'
                  }`}
                >
                  <span>{meta.icon}</span>
                  {meta.label}
                </button>
              );
            })}
          </nav>

          <label className="relative w-72">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes"
              className="h-11 w-full rounded-full bg-gray-50 pl-10 pr-4 text-sm font-semibold outline-none ring-1 ring-gray-100 focus:ring-red-200"
            />
          </label>

          <div className="rounded-full bg-red-600 px-5 py-3 text-sm font-extrabold text-white">
            Cart {cartCount}
          </div>
        </header>

        <div className="grid grid-cols-[1fr_360px] gap-4">
          <main className="min-h-[720px] rounded-[1.5rem] bg-[#fbfbfc] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-red-600">Meal Category</p>
                <h1 className="mt-1 text-2xl font-black capitalize text-gray-950">
                  {search ? 'Search Results' : (CAT_META[activeCategory]?.label || activeCategory || 'Menu')}
                </h1>
              </div>
              <p className="rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-500 shadow-sm">
                {tableInfo?.branch?.name} · Table {tableInfo?.table?.number}
              </p>
            </div>

            <div className="mb-5 flex gap-2 overflow-hidden">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setSearch(''); }}
                  className={`rounded-full px-4 py-2 text-xs font-bold capitalize transition ${
                    activeCategory === cat && !search ? 'bg-black text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {featured ? (
              <section className="grid grid-cols-[46%_1fr] gap-8 rounded-[1.5rem] bg-white p-6 shadow-sm">
                <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-[1.25rem] bg-red-50">
                  <div className="absolute inset-10 rounded-full bg-red-100" />
                  <DishImage item={featured} className="relative h-80 w-80 rounded-full shadow-2xl shadow-red-100" />
                </div>

                <div className="flex flex-col justify-center">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-400">
                    {featured.category || 'Featured'}
                  </p>
                  <h2 className="max-w-lg text-5xl font-black leading-tight tracking-tight text-gray-950">
                    {featured.name}
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-6 text-gray-500">
                    {featured.description || 'Freshly prepared by the kitchen and ready to add to your table order.'}
                  </p>

                  <div className="mt-7 flex items-center gap-3">
                    <span className="rounded-full bg-gray-100 px-4 py-2 text-xs font-bold text-gray-500">
                      {featured.preparationTime || 15} min
                    </span>
                    <span className="rounded-full bg-gray-100 px-4 py-2 text-xs font-bold capitalize text-gray-500">
                      {featured.category || 'dish'}
                    </span>
                    <span className="rounded-full bg-gray-100 px-4 py-2 text-xs font-bold text-gray-500">
                      Table {tableInfo?.table?.number}
                    </span>
                  </div>

                  <div className="mt-8 flex items-center gap-5">
                    <span className="text-xl font-black text-red-600">{formatCurrency(featured.price)}</span>
                    <QtyControl
                      qty={cartQty(featured._id)}
                      onAdd={() => addToCart(featured)}
                      onMinus={() => changeQty(featured._id, cartQty(featured._id) - 1)}
                      onPlus={() => changeQty(featured._id, cartQty(featured._id) + 1)}
                    />
                  </div>
                </div>
              </section>
            ) : (
              <div className="grid h-[360px] place-items-center rounded-[1.5rem] bg-white text-gray-400">
                No menu items available
              </div>
            )}

            {recommended.length > 0 && (
              <section className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wide text-gray-500">Recommended Pairings</h3>
                  <span className="text-xs font-bold text-gray-400">{recommended.length} items</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {recommended.map((item, index) => (
                    <div key={item._id} className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white p-3">
                      <DishImage item={item} index={index + 1} className="h-20 w-20 rounded-full" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-gray-950">{item.name}</p>
                        <p className="mt-1 text-xs font-bold text-red-600">{formatCurrency(item.price)}</p>
                      </div>
                      <QtyControl
                        compact
                        qty={cartQty(item._id)}
                        onAdd={() => addToCart(item)}
                        onMinus={() => changeQty(item._id, cartQty(item._id) - 1)}
                        onPlus={() => changeQty(item._id, cartQty(item._id) + 1)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {supportingItems.length > 0 && (
              <section className="mt-5">
                <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-gray-500">More Dishes</h3>
                <div className="grid grid-cols-2 gap-3">
                  {supportingItems.slice(0, 8).map((item, index) => (
                    <div key={item._id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                      <DishImage item={item} index={index + 2} className="h-20 w-20 rounded-2xl" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-gray-950">{item.name}</p>
                        <p className="line-clamp-1 text-xs text-gray-400">{item.description || item.category}</p>
                        <p className="mt-1 text-sm font-black text-red-600">{formatCurrency(item.price)}</p>
                      </div>
                      <QtyControl
                        compact
                        qty={cartQty(item._id)}
                        onAdd={() => addToCart(item)}
                        onMinus={() => changeQty(item._id, cartQty(item._id) - 1)}
                        onPlus={() => changeQty(item._id, cartQty(item._id) + 1)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </main>

          <aside className="rounded-[1.5rem] bg-[#fbfbfc] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-950">My Order</h2>
              <span className="text-sm font-semibold text-gray-400">{cart.length} positions</span>
            </div>

            <div className="max-h-[330px] space-y-3 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm font-semibold text-gray-400">
                  Add dishes to start your order.
                </div>
              ) : cart.map((item, index) => (
                <div key={item._id} className="rounded-2xl border border-dashed border-gray-200 bg-white p-3">
                  <div className="flex items-center gap-3">
                    <DishImage item={item} index={index} className="h-16 w-16 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-gray-950">{item.name}</p>
                      <p className="text-xs font-bold text-red-600">{formatCurrency(item.price * item.qty)}</p>
                      {item.notes && <p className="mt-0.5 truncate text-xs italic text-gray-400">{item.notes}</p>}
                    </div>
                    <QtyControl
                      compact
                      qty={item.qty}
                      onAdd={() => addToCart(item)}
                      onMinus={() => changeQty(item._id, item.qty - 1)}
                      onPlus={() => changeQty(item._id, item.qty + 1)}
                    />
                  </div>
                  <button
                    onClick={() => setNotesModal(item)}
                    className="mt-2 text-xs font-bold text-gray-400 hover:text-red-600"
                  >
                    {item.notes ? 'Edit note' : '+ Add note'}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3 rounded-2xl bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">Your details</p>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Name optional"
                maxLength={60}
                className="h-11 w-full rounded-xl bg-gray-50 px-3 text-sm font-semibold outline-none ring-1 ring-gray-100 focus:ring-red-200"
              />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone optional"
                maxLength={20}
                className="h-11 w-full rounded-xl bg-gray-50 px-3 text-sm font-semibold outline-none ring-1 ring-gray-100 focus:ring-red-200"
              />
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Table note optional"
                maxLength={200}
                rows={2}
                className="w-full resize-none rounded-xl bg-gray-50 px-3 py-3 text-sm font-semibold outline-none ring-1 ring-gray-100 focus:ring-red-200"
              />
            </div>

            <div className="mt-5 space-y-3 border-t border-dashed border-gray-200 pt-5">
              <div className="flex justify-between text-sm font-bold text-gray-500">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-500">
                <span>Service</span>
                <span>Calculated at bill</span>
              </div>
              <div className="flex justify-between text-lg font-black text-gray-950">
                <span>Total</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <button
                onClick={submitOrder}
                disabled={submitting || cart.length === 0}
                className="mt-4 w-full rounded-full bg-red-600 py-4 text-sm font-black text-white shadow-xl shadow-red-100 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
              >
                {submitting ? 'Confirming...' : 'Confirm Order'}
              </button>
            </div>
          </aside>
        </div>
      </div>

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
