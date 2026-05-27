import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  appendPublicOrderItems,
  fetchPublicTable,
  fetchPublicMenu,
  fetchPublicOrderStatus,
  placePublicOrder,
} from '../../api/public.api.js';
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

const TRACK_STEPS = [
  { key: 'pending', label: 'Order received', icon: '📋' },
  { key: 'confirmed', label: 'Confirmed', icon: '✅' },
  { key: 'preparing', label: 'Preparing', icon: '👨‍🍳' },
  { key: 'ready', label: 'Ready', icon: '🔔' },
  { key: 'served', label: 'Served', icon: '🍽' },
  { key: 'paid', label: 'Paid', icon: '💳' },
];

const TRACK_ORDER = TRACK_STEPS.map((step) => step.key);

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

function TrackPanel({ order, loading, onRefresh }) {
  if (loading) {
    return (
      <section className="rounded-[1.5rem] bg-[#fbfbfc] p-5 shadow-sm">
        <div className="grid min-h-[360px] place-items-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
            <p className="mt-3 text-sm font-bold text-gray-400">Loading order progress...</p>
          </div>
        </div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="rounded-[1.5rem] bg-[#fbfbfc] p-5 shadow-sm">
        <div className="grid min-h-[360px] place-items-center rounded-[1.25rem] bg-white p-6 text-center">
          <div>
            <p className="text-4xl">⌁</p>
            <h2 className="mt-3 text-xl font-black text-gray-950">No active order yet</h2>
            <p className="mt-2 text-sm font-semibold text-gray-400">Add dishes and confirm your order to start tracking.</p>
          </div>
        </div>
      </section>
    );
  }

  const activeIndex = TRACK_ORDER.indexOf(order.status);
  const isClosed = ['paid', 'cancelled'].includes(order.status);

  return (
    <section className="rounded-[1.5rem] bg-[#fbfbfc] p-4 shadow-sm sm:p-5">
      <div className="overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-red-500 to-orange-400 p-5 text-white shadow-xl shadow-red-100 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-white/80">Table {order.tableNumber || '-'}</p>
            <h2 className="mt-1 text-3xl font-black">{order.orderNumber}</h2>
            <p className="mt-2 max-w-md text-sm font-semibold text-white/85">
              {isClosed ? 'Thanks for dining with us.' : 'Track your food while you keep browsing the menu.'}
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="rounded-full bg-white/20 px-4 py-2 text-xs font-black text-white backdrop-blur hover:bg-white/30"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[1.25rem] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-wide text-gray-500">Order Progress</h3>
          <div className="mt-5 space-y-4">
            {TRACK_STEPS.map((step, index) => {
              const done = activeIndex >= index;
              const active = activeIndex === index;
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm ${
                    done ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-400'
                  } ${active ? 'ring-4 ring-red-100' : ''}`}>
                    {done ? step.icon : '○'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-black ${done ? 'text-gray-950' : 'text-gray-400'}`}>{step.label}</p>
                    {active && <p className="text-xs font-bold text-red-500">Current status</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.25rem] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-wide text-gray-500">Your Items</h3>
          <div className="mt-4 space-y-3">
            {order.items?.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex justify-between gap-3 text-sm">
                <span className="font-bold text-gray-700">{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold capitalize text-gray-500">{item.itemStatus}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-dashed border-gray-200 pt-4">
            <div className="flex justify-between text-base font-black text-gray-950">
              <span>Total</span>
              <span>{formatCurrency(order.totalAmount || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QrPaymentSheet({ order, tableInfo, onClose }) {
  const amount = order?.totalAmount || 0;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 sm:items-center">
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-red-600">QR Payment</p>
            <h3 className="mt-1 text-xl font-black text-gray-950">
              {amount ? formatCurrency(amount) : 'No bill yet'}
            </h3>
            <p className="mt-1 text-sm font-semibold text-gray-400">
              {tableInfo?.branch?.name || 'Branch'} · Table {tableInfo?.table?.number || '-'}
            </p>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-xl text-gray-500">×</button>
        </div>

        <div className="mx-auto grid aspect-square w-56 place-items-center rounded-[1.5rem] bg-white p-4 ring-1 ring-gray-100">
          <div className="grid h-full w-full grid-cols-5 grid-rows-5 gap-1 rounded-xl bg-gray-950 p-2">
            {Array.from({ length: 25 }).map((_, index) => (
              <span
                key={index}
                className={`rounded-sm ${[0, 1, 3, 5, 6, 8, 10, 12, 13, 16, 18, 19, 21, 23, 24].includes(index) ? 'bg-white' : 'bg-gray-950'}`}
              />
            ))}
          </div>
        </div>

        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-600">
          Scan at counter or show this to staff for payment.
        </p>
        {order?.orderNumber && (
          <button
            onClick={onClose}
            className="mt-3 w-full rounded-full bg-red-600 py-4 text-sm font-black text-white shadow-xl shadow-red-100"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

export default function CustomerTablePage() {
  const { restaurantId, branchId, tableId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appendOrderId = searchParams.get('orderId');
  const isAppendMode = Boolean(appendOrderId);

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
  const [activeTab, setActiveTab] = useState('menu');
  const [currentOrderId, setCurrentOrderId] = useState(appendOrderId || '');
  const [currentOrder, setCurrentOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [showQrPayment, setShowQrPayment] = useState(false);

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

  useEffect(() => {
    setCurrentOrderId(appendOrderId || '');
  }, [appendOrderId]);

  const loadCurrentOrder = useCallback(async ({ silent = false } = {}) => {
    if (!currentOrderId) {
      setCurrentOrder(null);
      return;
    }
    if (!silent) setOrderLoading(true);
    try {
      setCurrentOrder(await fetchPublicOrderStatus(currentOrderId));
    } catch {
      setCurrentOrder(null);
    } finally {
      if (!silent) setOrderLoading(false);
    }
  }, [currentOrderId]);

  useEffect(() => {
    loadCurrentOrder();
    if (!currentOrderId) return undefined;
    const timer = setInterval(() => loadCurrentOrder({ silent: true }), 10000);
    return () => clearInterval(timer);
  }, [currentOrderId, loadCurrentOrder]);

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
      const items = cart.map((c) => ({
        menuItem: c._id,
        quantity: c.qty,
        notes: c.notes || undefined,
      }));

      if (isAppendMode) {
        const updatedOrder = await appendPublicOrderItems(appendOrderId, { items });
        setCurrentOrder(updatedOrder);
        setCart([]);
        setActiveTab('track');
        return;
      }

      const result = await placePublicOrder({
        restaurantId,
        branchId,
        tableId,
        items,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        customerNote: customerNote || undefined,
      });
      setCurrentOrderId(result.orderId);
      setActiveTab('track');
      setCart([]);
      navigate(`/customer/${restaurantId}/${branchId}/table/${tableId}?orderId=${result.orderId}`, { replace: true });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update order. Please try again.');
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
    <div className="min-h-screen bg-[#e9e9f1] px-3 pb-28 pt-3 text-gray-950 sm:px-5 sm:py-5 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1440px] rounded-[1.25rem] bg-white/80 p-3 shadow-2xl shadow-gray-300/70 ring-1 ring-white sm:rounded-[2rem] sm:p-5">
        <header className="mb-4 flex flex-wrap items-center gap-3 rounded-[1.25rem] bg-white px-3 py-3 shadow-sm sm:rounded-[1.5rem] sm:px-5 lg:flex-nowrap">
          <div className="mr-auto min-w-0 text-lg font-black tracking-tight text-red-600 sm:mr-3 sm:text-xl">
            {tableInfo?.restaurant?.name || 'RestroX'}
          </div>

          <nav className="order-3 flex w-full items-center gap-2 overflow-x-auto pb-1 lg:order-none lg:w-auto lg:flex-1">
            {categories.map((cat) => {
              const meta = CAT_META[cat] || { icon: '🍴', label: cat };
              return (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setSearch(''); }}
                  className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-bold capitalize transition sm:px-4 sm:text-sm ${
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

          <label className="relative order-4 w-full sm:order-none sm:w-72">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes"
              className="h-11 w-full rounded-full bg-gray-50 pl-10 pr-4 text-sm font-semibold outline-none ring-1 ring-gray-100 focus:ring-red-200"
            />
          </label>

          <div className="shrink-0 rounded-full bg-red-600 px-4 py-3 text-xs font-extrabold text-white sm:px-5 sm:text-sm">
            {isAppendMode ? 'Add More' : 'Cart'} {cartCount}
          </div>
        </header>

        <section className="mb-4 rounded-[1.25rem] bg-white p-4 shadow-sm sm:hidden">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red-50 text-lg font-black text-red-600">
              {(customerName || tableInfo?.restaurant?.name || 'G').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-gray-950">
                {customerName || 'Guest customer'}
              </p>
              <p className="truncate text-xs font-bold text-gray-400">
                {tableInfo?.restaurant?.name || 'Restaurant'} · Table {tableInfo?.table?.number || '-'}
              </p>
            </div>
            <button
              onClick={() => setShowQrPayment(true)}
              className="rounded-full bg-gray-950 px-4 py-3 text-xs font-black text-white"
            >
              QR Pay
            </button>
          </div>
        </section>

        <div className="mb-4 hidden grid-cols-3 gap-2 rounded-[1.25rem] bg-white p-2 shadow-sm sm:grid">
          {[
            { key: 'menu', label: 'Menu' },
            { key: 'order', label: 'Order' },
            { key: 'track', label: 'Track' },
          ].map((tab) => {
            const disabled = tab.key === 'track' && !currentOrderId;
            return (
              <button
                key={tab.key}
                onClick={() => !disabled && setActiveTab(tab.key)}
                disabled={disabled}
                className={`rounded-full px-3 py-3 text-sm font-black transition ${
                  activeTab === tab.key
                    ? 'bg-red-600 text-white shadow-lg shadow-red-100'
                    : 'text-gray-500 hover:bg-gray-50'
                } disabled:cursor-not-allowed disabled:text-gray-300`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'track' ? (
          <TrackPanel order={currentOrder} loading={orderLoading} onRefresh={loadCurrentOrder} />
        ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className={`${activeTab === 'menu' ? 'block' : 'hidden'} min-h-[520px] rounded-[1.25rem] bg-[#fbfbfc] p-3 shadow-sm sm:rounded-[1.5rem] sm:p-5 xl:block`}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-red-600">Meal Category</p>
                <h1 className="mt-1 text-2xl font-black capitalize text-gray-950 sm:text-3xl lg:text-2xl">
                  {search ? 'Search Results' : (CAT_META[activeCategory]?.label || activeCategory || 'Menu')}
                </h1>
              </div>
              <p className="w-fit rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-500 shadow-sm">
                {tableInfo?.branch?.name} · Table {tableInfo?.table?.number}
              </p>
            </div>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setSearch(''); }}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold capitalize transition ${
                    activeCategory === cat && !search ? 'bg-black text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {featured ? (
              <section className="grid gap-5 rounded-[1.25rem] bg-white p-4 shadow-sm lg:grid-cols-[42%_1fr] lg:gap-8 lg:p-6">
                <div className="relative flex aspect-[4/3] min-h-[220px] items-center justify-center overflow-hidden rounded-[1.25rem] bg-red-50 sm:min-h-[300px] lg:min-h-[360px]">
                  <div className="absolute inset-6 rounded-full bg-red-100 sm:inset-10" />
                  <DishImage item={featured} className="relative h-56 w-56 rounded-full shadow-2xl shadow-red-100 sm:h-72 sm:w-72 lg:h-80 lg:w-80" />
                </div>

                <div className="flex flex-col justify-center">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-400">
                    {featured.category || 'Featured'}
                  </p>
                  <h2 className="max-w-lg text-3xl font-black leading-tight tracking-tight text-gray-950 sm:text-4xl lg:text-5xl">
                    {featured.name}
                  </h2>
                  <p className="mt-4 max-w-md text-sm leading-6 text-gray-500">
                    {featured.description || 'Freshly prepared by the kitchen and ready to add to your table order.'}
                  </p>

                  <div className="mt-7 flex flex-wrap items-center gap-3">
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

                  <div className="mt-8 flex flex-wrap items-center gap-5">
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
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black uppercase tracking-wide text-gray-500">Recommended Pairings</h3>
                  <span className="text-xs font-bold text-gray-400">{recommended.length} items</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {recommended.map((item, index) => (
                    <div key={item._id} className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white p-3">
                      <DishImage item={item} index={index + 1} className="h-16 w-16 rounded-full sm:h-20 sm:w-20" />
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
                <div className="grid gap-3 lg:grid-cols-2">
                  {supportingItems.slice(0, 8).map((item, index) => (
                    <div key={item._id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                      <DishImage item={item} index={index + 2} className="h-16 w-16 rounded-2xl sm:h-20 sm:w-20" />
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

          <aside className={`${activeTab === 'order' ? 'block' : 'hidden'} rounded-[1.25rem] bg-[#fbfbfc] p-4 shadow-sm sm:rounded-[1.5rem] sm:p-5 xl:sticky xl:top-5 xl:block xl:self-start`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-950">My Order</h2>
              <span className="text-sm font-semibold text-gray-400">{cart.length} positions</span>
            </div>

            <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1 xl:max-h-[330px]">
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
              {isAppendMode && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                  Adding items to your current order.
                </p>
              )}
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Name optional"
                disabled={isAppendMode}
                maxLength={60}
                className="h-11 w-full rounded-xl bg-gray-50 px-3 text-sm font-semibold outline-none ring-1 ring-gray-100 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone optional"
                disabled={isAppendMode}
                maxLength={20}
                className="h-11 w-full rounded-xl bg-gray-50 px-3 text-sm font-semibold outline-none ring-1 ring-gray-100 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Table note optional"
                disabled={isAppendMode}
                maxLength={200}
                rows={2}
                className="w-full resize-none rounded-xl bg-gray-50 px-3 py-3 text-sm font-semibold outline-none ring-1 ring-gray-100 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
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
                {submitting ? 'Confirming...' : isAppendMode ? 'Add Items to Order' : 'Confirm Order'}
              </button>
              {currentOrderId && (
                <button
                  onClick={() => setActiveTab('track')}
                  className="w-full rounded-full bg-white py-4 text-sm font-black text-red-600 ring-1 ring-red-100 transition hover:bg-red-50"
                >
                  Track Current Order
                </button>
              )}
            </div>
          </aside>
        </div>
        )}
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 items-end rounded-[2rem] bg-white px-3 pb-3 pt-2 shadow-2xl shadow-gray-400/40 ring-1 ring-gray-100 sm:hidden">
        {[
          { key: 'menu', label: 'Home', icon: '⌂' },
          { key: 'order', label: 'Cart', icon: '☰' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`grid justify-items-center gap-1 rounded-2xl px-2 py-2 text-xs font-black ${
              activeTab === tab.key ? 'text-red-600' : 'text-gray-400'
            }`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}

        <button
          onClick={() => setShowQrPayment(true)}
          className="-mt-8 grid h-16 w-16 place-items-center justify-self-center rounded-full bg-red-600 text-2xl font-black text-white shadow-xl shadow-red-200 ring-4 ring-[#e9e9f1]"
          aria-label="Open QR payment"
        >
          ▦
        </button>

        {[
          { key: 'track', label: 'Track', icon: '◷', disabled: !currentOrderId },
          { key: 'user', label: 'User', icon: '◉' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              if (tab.disabled) return;
              if (tab.key === 'user') {
                setActiveTab('order');
                return;
              }
              setActiveTab(tab.key);
            }}
            disabled={tab.disabled}
            className={`grid justify-items-center gap-1 rounded-2xl px-2 py-2 text-xs font-black ${
              activeTab === tab.key ? 'text-red-600' : 'text-gray-400'
            } disabled:text-gray-200`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {showQrPayment && (
        <QrPaymentSheet
          order={currentOrder}
          tableInfo={tableInfo}
          onClose={() => setShowQrPayment(false)}
        />
      )}

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
