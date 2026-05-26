import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { fetchTables } from '../api/tables.api.js';
import { fetchMenuItems } from '../api/menu.api.js';
import { createOrder, addItemsToOrder, printKOT } from '../api/orders.api.js';
import { useSocketContext, useOrderEvents, useTableEvents } from '../socket/SocketContext.jsx';
import { EVENTS } from '../socket/events.js';
import formatCurrency from '../utils/formatCurrency.js';

const CATEGORY_ICONS = {
  appetizer: '🥗', main: '🍽️', dessert: '🍰', beverage: '🥤', special: '⭐',
};

// ─── Cart ─────────────────────────────────────────────────────────────────────

function Cart({ cart, onQtyChange, onRemove, onSubmit, onKOT, activeOrder, selectedTable, loading }) {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-100 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">Order Details</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {activeOrder ? activeOrder.orderNumber : 'New Order'}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {selectedTable ? `Table ${selectedTable.number} · ${selectedTable.location || 'Dining floor'}` : 'Select a table to begin'}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${activeOrder ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
            {activeOrder ? 'Active' : 'Draft'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {cart.length === 0 && (
          <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-gray-700">Cart is empty</p>
            <p className="mt-1 text-xs text-gray-400">Add menu items from the left panel.</p>
          </div>
        )}
        <div className="space-y-3">
          {cart.map((item) => (
            <div key={item._id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900">{item.name}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatCurrency(item.price)} each</p>
                </div>
                <button
                  onClick={() => onRemove(item._id)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-red-50 text-lg leading-none text-red-400 hover:bg-red-100 hover:text-red-600"
                >
                  ×
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center rounded-xl bg-gray-50 p-1">
                  <button
                    onClick={() => onQtyChange(item._id, item.qty - 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-gray-600 hover:bg-white hover:shadow-sm"
                  >−</button>
                  <span className="w-8 text-center text-sm font-bold text-gray-900">{item.qty}</span>
                  <button
                    onClick={() => onQtyChange(item._id, item.qty + 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-gray-600 hover:bg-white hover:shadow-sm"
                  >+</button>
                </div>
                <span className="text-base font-extrabold text-gray-900">
                  {formatCurrency(item.price * item.qty)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-100 px-6 py-5">
        <div className="rounded-2xl bg-gray-50 p-4">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Items</span>
            <span>{cart.reduce((sum, item) => sum + item.qty, 0)}</span>
          </div>
          <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900">
            <span>Total</span>
            <span className="text-orange-500">{formatCurrency(subtotal)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          {activeOrder && (
            <button
              onClick={onKOT}
              disabled={loading || cart.length === 0}
              className="flex-1 rounded-xl border border-orange-300 bg-white py-3 text-sm font-bold text-orange-600 hover:bg-orange-50 disabled:opacity-40"
            >Send KOT</button>
          )}
          <button
            onClick={onSubmit}
            disabled={loading || cart.length === 0}
            className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 hover:bg-orange-600 disabled:opacity-40"
          >{loading ? 'Placing...' : activeOrder ? 'Add Items' : 'Place Order'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main POS ─────────────────────────────────────────────────────────────────

export default function POSPage() {
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null); // existing order on table
  const [cart, setCart] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { connected, joinOrder, leaveOrder } = useSocketContext();

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([fetchTables(), fetchMenuItems()]);
    setTables(t);
    setMenuItems(m);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live table status updates — update table chips without full reload
  useTableEvents((updatedTable) => {
    setTables((prev) =>
      prev.map((t) => t._id === updatedTable._id ? { ...t, ...updatedTable } : t)
    );
  }, []);

  // Listen for real-time order status changes on the active order
  useOrderEvents((event, updated) => {
    if (!activeOrder?._id || updated._id !== activeOrder._id) return;

    setActiveOrder(updated);

    if (event === EVENTS.ORDER_ITEM_STATUS_CHANGED) {
      const allReady = updated.items?.every((i) => i.itemStatus === 'ready');
      if (allReady) toast.info(`🍽 All items ready for ${updated.orderNumber}`);
    }
    if (updated.status === 'ready') {
      toast.success(`✅ Order ${updated.orderNumber} is ready for pickup!`, { autoClose: false });
    }
    if (event === EVENTS.ORDER_PAID || event === EVENTS.ORDER_CANCELLED) {
      setActiveOrder(null);
      load();
    }
  }, [activeOrder?._id]);

  // Join/leave the active order room when it changes
  useEffect(() => {
    if (!activeOrder?._id) return;
    joinOrder(activeOrder._id);
    return () => leaveOrder(activeOrder._id);
  }, [activeOrder?._id, joinOrder, leaveOrder]);

  const selectTable = (table) => {
    setSelectedTable(table);
    setCart([]);
    // If table has an active order, load it
    if (table.currentOrder) {
      setActiveOrder(table.currentOrder);
    } else {
      setActiveOrder(null);
    }
  };

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c._id === item._id);
      if (existing) return prev.map((c) => c._id === item._id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { _id: item._id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  const changeQty = (id, qty) => {
    if (qty <= 0) return setCart((prev) => prev.filter((c) => c._id !== id));
    setCart((prev) => prev.map((c) => c._id === id ? { ...c, qty } : c));
  };

  const submitOrder = async () => {
    if (!selectedTable) return toast.error('Select a table first');
    if (!cart.length) return toast.error('Cart is empty');
    setLoading(true);
    try {
      const items = cart.map((c) => ({ menuItem: c._id, quantity: c.qty }));
      let order;
      if (activeOrder?._id) {
        order = await addItemsToOrder(activeOrder._id, items);
        toast.success('Items added to order');
      } else {
        order = await createOrder({ table: selectedTable._id, items });
        toast.success(`Order ${order.orderNumber} created`);
      }
      setActiveOrder(order);
      setCart([]);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const sendKOT = async () => {
    if (!activeOrder?._id) return;
    setLoading(true);
    try {
      const kot = await printKOT(activeOrder._id);
      toast.success(`KOT ${kot.kotNumber} sent to kitchen`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'KOT failed');
    } finally {
      setLoading(false);
    }
  };

  const categories = [...new Set(menuItems.map((m) => m.category))];
  const displayed = menuItems.filter((m) => {
    const matchCat = !categoryFilter || m.category === categoryFilter;
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    return m.isAvailable && matchCat && matchSearch;
  });

  const TABLE_COLORS = {
    available: 'border-green-300 bg-green-50 text-green-800',
    occupied: 'border-red-300 bg-red-50 text-red-800',
    reserved: 'border-yellow-300 bg-yellow-50 text-yellow-800',
    cleaning: 'border-blue-300 bg-blue-50 text-blue-800',
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] overflow-hidden bg-[#f7f7f7] p-4 lg:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">Restaurant POS</p>
          <h1 className="text-3xl font-extrabold text-gray-900">Orders</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${connected ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
          {selectedTable && (
            <span className="rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm">
              Table {selectedTable.number}
            </span>
          )}
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-10rem)] gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="grid min-h-0 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col rounded-3xl bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="text-xl font-extrabold text-gray-900">Order in</h2>
              <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl bg-gray-100 p-1 text-xs font-bold text-gray-400">
                <button className="rounded-lg bg-orange-500 py-2 text-white shadow-sm">Tables</button>
                <button className="rounded-lg py-2">Active</button>
                <button className="rounded-lg py-2">Ready</button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
              {tables.map((t) => (
                <button
                  key={t._id}
                  onClick={() => selectTable(t)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all hover:border-orange-300 hover:shadow-md ${
                    selectedTable?._id === t._id
                      ? 'border-orange-300 bg-orange-50 shadow-sm'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-extrabold text-gray-900">Table #{t.number}</p>
                      <p className="mt-1 text-xs text-gray-400">{t.location || 'Dining floor'} · {t.capacity} seats</p>
                    </div>
                    <span className={`rounded-xl border px-2.5 py-1 text-xs font-bold capitalize ${TABLE_COLORS[t.status] || 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                      {t.status}
                    </span>
                  </div>
                  {t.currentOrder && (
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-xs">
                      <span className="font-semibold text-gray-500">Active order</span>
                      <span className="font-bold text-orange-600">{t.currentOrder.orderNumber || 'Open'}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-3xl bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900">Menu</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    {displayed.length} available item{displayed.length === 1 ? '' : 's'}
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="Search menu..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100 xl:w-64"
                />
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setCategoryFilter('')}
                  className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                    !categoryFilter ? 'border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-100' : 'border-gray-200 bg-white text-gray-500 hover:border-orange-200 hover:bg-orange-50'
                  }`}
                >All</button>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-bold capitalize transition ${
                      categoryFilter === c ? 'border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-100' : 'border-gray-200 bg-white text-gray-500 hover:border-orange-200 hover:bg-orange-50'
                    }`}
                  >
                    {CATEGORY_ICONS[c]} {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {displayed.map((item) => {
                  const inCart = cart.find((c) => c._id === item._id);
                  return (
                    <button
                      key={item._id}
                      onClick={() => { if (!selectedTable) { toast.warn('Select a table first'); return; } addToCart(item); }}
                      className="group rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-100 active:scale-95"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-xl">
                          {CATEGORY_ICONS[item.category] || '🍴'}
                        </span>
                        {inCart && (
                          <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
                            ×{inCart.qty}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold capitalize text-gray-400">{item.category}</p>
                      <p className="mt-1 min-h-[2.5rem] text-base font-extrabold leading-tight text-gray-900">{item.name}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-lg font-extrabold text-orange-500">{formatCurrency(item.price)}</span>
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gray-50 text-lg font-bold text-gray-500 group-hover:bg-orange-500 group-hover:text-white">+</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <section className="min-h-[520px] overflow-hidden rounded-3xl bg-white shadow-sm xl:sticky xl:top-6 xl:h-[calc(100vh-8rem)]">
          <Cart
            cart={cart}
            onQtyChange={changeQty}
            onRemove={(id) => setCart((p) => p.filter((c) => c._id !== id))}
            onSubmit={submitOrder}
            onKOT={sendKOT}
            activeOrder={activeOrder}
            selectedTable={selectedTable}
            loading={loading}
          />
        </section>
      </div>
    </div>
  );
}
