import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { fetchTables } from '../api/tables.api.js';
import { fetchMenuItems } from '../api/menu.api.js';
import { createOrder, addItemsToOrder, printKOT } from '../api/orders.api.js';
import useSocket from '../hooks/useSocket.js';

const CATEGORY_ICONS = {
  appetizer: '🥗', main: '🍽️', dessert: '🍰', beverage: '🥤', special: '⭐',
};

// ─── Cart ─────────────────────────────────────────────────────────────────────

function Cart({ cart, onQtyChange, onRemove, onSubmit, onKOT, activeOrder, loading }) {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">
          {activeOrder ? `Order ${activeOrder.orderNumber}` : 'New Order'}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {cart.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">Cart is empty</p>
        )}
        {cart.map((item) => (
          <div key={item._id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
              <p className="text-xs text-gray-500">${item.price.toFixed(2)} each</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onQtyChange(item._id, item.qty - 1)}
                className="w-6 h-6 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold"
              >−</button>
              <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
              <button
                onClick={() => onQtyChange(item._id, item.qty + 1)}
                className="w-6 h-6 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold"
              >+</button>
            </div>
            <span className="text-sm font-semibold text-gray-700 w-14 text-right">
              ${(item.price * item.qty).toFixed(2)}
            </span>
            <button onClick={() => onRemove(item._id)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-100 space-y-3">
        <div className="flex justify-between text-sm font-semibold text-gray-800">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex gap-2">
          {activeOrder && (
            <button
              onClick={onKOT}
              disabled={loading || cart.length === 0}
              className="flex-1 border border-orange-400 text-orange-600 rounded-lg py-2 text-sm font-medium hover:bg-orange-50 disabled:opacity-40"
            >🖨 Send KOT</button>
          )}
          <button
            onClick={onSubmit}
            disabled={loading || cart.length === 0}
            className="flex-1 bg-orange-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-40"
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
  const { socket, connected } = useSocket();

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([fetchTables(), fetchMenuItems()]);
    setTables(t);
    setMenuItems(m);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Listen for real-time order status changes on the active order
  useEffect(() => {
    if (!socket || !activeOrder?._id) return;
    socket.emit('join:order', activeOrder._id);

    const handleUpdate = (updated) => {
      if (updated._id === activeOrder._id || updated._id === activeOrder) {
        setActiveOrder(updated);
        if (updated.status === 'ready') toast.success(`Order ${updated.orderNumber} is ready!`);
        if (updated.status === 'paid') { setActiveOrder(null); load(); }
      }
    };

    socket.on('order:status_changed', handleUpdate);
    socket.on('order:item_status_changed', handleUpdate);

    return () => {
      socket.emit('leave:order', activeOrder._id);
      socket.off('order:status_changed', handleUpdate);
      socket.off('order:item_status_changed', handleUpdate);
    };
  }, [socket, activeOrder?._id]);

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
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden gap-0">
      {/* Left: Table + Menu */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Table picker */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 font-medium">SELECT TABLE</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {connected ? '● Live' : '○ Offline'}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {tables.map((t) => (
              <button
                key={t._id}
                onClick={() => selectTable(t)}
                className={`border-2 rounded-xl px-3 py-2 text-center transition-all min-w-[60px] ${TABLE_COLORS[t.status]} ${selectedTable?._id === t._id ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
              >
                <p className="font-bold text-sm">{t.number}</p>
                <p className="text-xs opacity-70">{t.capacity}p</p>
              </button>
            ))}
          </div>
          {selectedTable && (
            <p className="text-xs text-gray-500 mt-2">
              Table <strong>{selectedTable.number}</strong> · {selectedTable.location}
              {activeOrder && <span className="ml-2 text-orange-600 font-medium">Active: {activeOrder.orderNumber || activeOrder}</span>}
            </p>
          )}
        </div>

        {/* Menu */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center">
            <input
              type="text" placeholder="Search..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={() => setCategoryFilter('')}
              className={`text-xs px-3 py-1 rounded-full border ${!categoryFilter ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600'}`}
            >All</button>
            {categories.map((c) => (
              <button key={c} onClick={() => setCategoryFilter(c)}
                className={`text-xs px-3 py-1 rounded-full border capitalize ${categoryFilter === c ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600'}`}
              >{CATEGORY_ICONS[c]} {c}</button>
            ))}
          </div>

          {/* Item grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayed.map((item) => (
              <button
                key={item._id}
                onClick={() => { if (!selectedTable) { toast.warn('Select a table first'); return; } addToCart(item); }}
                className="bg-white border border-gray-100 rounded-xl p-3 text-left hover:border-orange-300 hover:shadow-md transition-all active:scale-95"
              >
                <p className="text-xs text-gray-400 capitalize mb-1">{CATEGORY_ICONS[item.category]} {item.category}</p>
                <p className="font-medium text-gray-800 text-sm leading-tight">{item.name}</p>
                <p className="text-orange-500 font-bold mt-1">${item.price.toFixed(2)}</p>
                {cart.find((c) => c._id === item._id) && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                    ×{cart.find((c) => c._id === item._id).qty}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-72 border-l border-gray-200 bg-white flex flex-col">
        <Cart
          cart={cart}
          onQtyChange={changeQty}
          onRemove={(id) => setCart((p) => p.filter((c) => c._id !== id))}
          onSubmit={submitOrder}
          onKOT={sendKOT}
          activeOrder={activeOrder}
          loading={loading}
        />
      </div>
    </div>
  );
}
