import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { fetchKitchenOrders, updateItemStatus, updateOrderStatus } from '../api/orders.api.js';
import { useSocketContext, useOrderEvents } from '../socket/SocketContext.jsx';
import { EVENTS } from '../socket/events.js';
import useNotificationSound from '../hooks/useNotificationSound.js';

// ─── Aging helpers ────────────────────────────────────────────────────────────

const getElapsed = (createdAt) => Math.floor((Date.now() - new Date(createdAt)) / 1000); // seconds

const getAgingStyle = (seconds) => {
  if (seconds < 600)  return { card: 'border-green-400 bg-green-50',  badge: 'bg-green-100 text-green-800',  label: 'On time' };
  if (seconds < 1200) return { card: 'border-yellow-400 bg-yellow-50',badge: 'bg-yellow-100 text-yellow-800',label: 'Running late' };
  return               { card: 'border-red-500 bg-red-50',            badge: 'bg-red-100 text-red-800',      label: 'Overdue' };
};

const formatElapsed = (seconds) => {
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

const getTableNumber = (order) => order.table?.number || order.tableNumber || '?';

function CustomerInfo({ order }) {
  if (order.source !== 'customer_qr') return null;
  if (!order.customerName && !order.customerPhone && !order.customerNote) return null;

  return (
    <div className="mt-2 rounded-lg bg-white/60 border border-black/10 px-3 py-2 text-xs text-gray-700 space-y-0.5">
      {order.customerName && <p><span className="font-semibold">Customer:</span> {order.customerName}</p>}
      {order.customerPhone && <p><span className="font-semibold">Phone:</span> {order.customerPhone}</p>}
      {order.customerNote && <p><span className="font-semibold">Note:</span> {order.customerNote}</p>}
    </div>
  );
}

// ─── Item status button ───────────────────────────────────────────────────────

const ITEM_STATUS_NEXT = { pending: 'preparing', preparing: 'ready' };
const ITEM_STATUS_STYLES = {
  pending:   'bg-gray-100 text-gray-600 border-gray-200',
  preparing: 'bg-orange-100 text-orange-700 border-orange-300',
  ready:     'bg-green-100 text-green-700 border-green-300',
};

function ItemRow({ item, orderId, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const next = ITEM_STATUS_NEXT[item.itemStatus];

  const advance = async () => {
    if (!next) return;
    setLoading(true);
    try {
      await updateItemStatus(orderId, item._id, next);
      onUpdate();
    } catch {
      toast.error('Failed to update item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${ITEM_STATUS_STYLES[item.itemStatus]}`}>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm">{item.name}</span>
        {item.notes && <span className="text-xs text-gray-500 ml-2 italic">"{item.notes}"</span>}
      </div>
      <div className="flex items-center gap-2 ml-2">
        <span className="text-sm font-bold">×{item.quantity}</span>
        {next && (
          <button
            onClick={advance}
            disabled={loading}
            className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-all disabled:opacity-40 ${
              next === 'preparing'
                ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                : 'bg-green-500 text-white border-green-500 hover:bg-green-600'
            }`}
          >
            {loading ? '...' : next === 'preparing' ? '▶ Start' : '✓ Done'}
          </button>
        )}
        {item.itemStatus === 'ready' && (
          <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">✓ Ready</span>
        )}
      </div>
    </div>
  );
}

// ─── KDS Order Card ───────────────────────────────────────────────────────────

function KDSCard({ order, onUpdate, highlighted }) {
  const [elapsed, setElapsed] = useState(getElapsed(order.createdAt));
  const aging = getAgingStyle(elapsed);

  // Live timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(getElapsed(order.createdAt)), 1000);
    return () => clearInterval(t);
  }, [order.createdAt]);

  const allReady = order.items.every((i) => i.itemStatus === 'ready');
  const anyPreparing = order.items.some((i) => i.itemStatus === 'preparing');

  const markPreparing = async () => {
    try {
      await updateOrderStatus(order._id, 'preparing');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const markReady = async () => {
    try {
      await updateOrderStatus(order._id, 'ready');
      toast.success(`Order ${order.orderNumber} marked ready`);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className={`rounded-2xl border-2 flex flex-col overflow-hidden shadow-sm transition-all ${aging.card} ${highlighted ? 'ring-4 ring-orange-300' : ''}`}>
      {/* Card header */}
      <div className="px-4 py-3 flex items-start justify-between gap-2 border-b border-black/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-lg">{order.kotNumber}</span>
            <span className="text-xs text-gray-500">{order.orderNumber}</span>
          </div>
          <p className="text-sm text-gray-600">
            Table <strong>{order.table?.number}</strong>
            {order.table?.location && <span className="text-gray-400"> · {order.table.location}</span>}
          </p>
          {order.waiter?.name && <p className="text-xs text-gray-400">{order.waiter.name}</p>}
          <CustomerInfo order={order} />
        </div>

        <div className="text-right shrink-0">
          {/* Aging timer */}
          <div className={`text-sm font-mono font-bold px-2 py-0.5 rounded-lg ${aging.badge}`}>
            Waiting {formatElapsed(elapsed)}
          </div>
          <div className="text-xs text-gray-500 mt-1 capitalize">{order.status}</div>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 p-3 space-y-2">
        {order.items.map((item) => (
          <ItemRow key={item._id} item={item} orderId={order._id} onUpdate={onUpdate} />
        ))}
      </div>

      {/* Footer actions */}
      <div className="px-3 pb-3 pt-1 flex gap-2">
        {order.status === 'confirmed' && (
          <button
            onClick={markPreparing}
            className="flex-1 bg-orange-500 text-white text-sm rounded-xl py-2 font-medium hover:bg-orange-600 transition-colors"
          >▶ Start Preparing</button>
        )}
        {order.status === 'preparing' && allReady && (
          <button
            onClick={markReady}
            className="flex-1 bg-green-500 text-white text-sm rounded-xl py-2 font-medium hover:bg-green-600 transition-colors"
          >✓ All Ready — Notify Waiter</button>
        )}
        {order.status === 'ready' && (
          <div className="flex-1 text-center text-sm font-semibold text-green-700 bg-green-100 rounded-xl py-2">
            ✓ Ready for pickup
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status column ────────────────────────────────────────────────────────────

function Column({ title, color, orders, onUpdate, highlightedOrderId }) {
  return (
    <div className="flex flex-col min-w-0">
      <div className={`flex items-center gap-2 mb-3 px-1`}>
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{title}</h3>
        <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{orders.length}</span>
      </div>
      <div className="space-y-4 overflow-y-auto flex-1">
        {orders.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8 border-2 border-dashed border-gray-200 rounded-2xl">
            No orders
          </div>
        )}
        {orders.map((o) => (
          <KDSCard
            key={o._id}
            order={o}
            onUpdate={onUpdate}
            highlighted={highlightedOrderId === o._id}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main KDS Page ────────────────────────────────────────────────────────────

export default function KDSPage() {
  const [orders, setOrders] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [newOrderNotice, setNewOrderNotice] = useState('');
  const [highlightedOrderId, setHighlightedOrderId] = useState(null);
  const { connected, socket } = useSocketContext();
  const playNotificationSound = useNotificationSound();
  const loadRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchKitchenOrders();
      setOrders(data);
      setLastUpdate(new Date());
    } catch {
      toast.error('Failed to load kitchen orders');
    }
  }, []);

  loadRef.current = load;

  useEffect(() => { load(); }, [load]);

  // Real-time order updates via shared socket context
  const notifyNewQrOrder = useCallback((order) => {
    const details = [order.customerName, order.customerPhone].filter(Boolean).join(' · ');
    const message = details
      ? `New QR order from Table ${getTableNumber(order)} — ${details}`
      : `New QR order from Table ${getTableNumber(order)}`;
    setNewOrderNotice(message);
    setHighlightedOrderId(order._id);
    toast.info(message);
    playNotificationSound();
    setTimeout(() => setNewOrderNotice(''), 5000);
    setTimeout(() => setHighlightedOrderId(null), 6000);
  }, [playNotificationSound]);

  const notifyWaiterCall = useCallback((payload) => {
    const details = [payload.customerName, payload.customerPhone].filter(Boolean).join(' · ');
    const message = details
      ? `Table ${payload.tableNumber || '?'} is calling waiter — ${details}`
      : `Table ${payload.tableNumber || '?'} is calling waiter`;
    setNewOrderNotice(message);
    setHighlightedOrderId(payload.orderId);
    toast.info(message);
    playNotificationSound();
    setTimeout(() => setNewOrderNotice(''), 5000);
    setTimeout(() => setHighlightedOrderId(null), 6000);
  }, [playNotificationSound]);

  const notifyBillRequest = useCallback((payload) => {
    const details = [payload.customerName, payload.customerPhone].filter(Boolean).join(' · ');
    const message = details
      ? `Table ${payload.tableNumber || '?'} requested bill — ${details}`
      : `Table ${payload.tableNumber || '?'} requested bill`;
    setNewOrderNotice(message);
    setHighlightedOrderId(payload.orderId);
    toast.info(message);
    playNotificationSound();
    setTimeout(() => setNewOrderNotice(''), 5000);
    setTimeout(() => setHighlightedOrderId(null), 6000);
  }, [playNotificationSound]);

  useEffect(() => {
    if (!socket) return;
    socket.on(EVENTS.CUSTOMER_CALL_WAITER, notifyWaiterCall);
    socket.on(EVENTS.CUSTOMER_REQUEST_BILL, notifyBillRequest);
    socket.on('waiter:called', notifyWaiterCall);
    return () => {
      socket.off(EVENTS.CUSTOMER_CALL_WAITER, notifyWaiterCall);
      socket.off(EVENTS.CUSTOMER_REQUEST_BILL, notifyBillRequest);
      socket.off('waiter:called', notifyWaiterCall);
    };
  }, [socket, notifyWaiterCall, notifyBillRequest]);

  useOrderEvents((event, updatedOrder) => {
    if (event === EVENTS.ORDER_CREATED && updatedOrder.source === 'customer_qr') {
      notifyNewQrOrder(updatedOrder);
    }

    setOrders((prev) => {
      const kitchenStatuses = ['pending', 'confirmed', 'preparing', 'ready'];

      if (!kitchenStatuses.includes(updatedOrder.status)) {
        return prev.filter((o) => o._id !== updatedOrder._id);
      }

      const exists = prev.find((o) => o._id === updatedOrder._id);
      if (exists) {
        return prev.map((o) => o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o);
      }
      return [...prev, updatedOrder].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });
    setLastUpdate(new Date());
  }, [notifyNewQrOrder]);

  const newOrders = orders.filter((o) => ['pending', 'confirmed'].includes(o.status));
  const preparing = orders.filter((o) => o.status === 'preparing');
  const ready     = orders.filter((o) => o.status === 'ready');

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-gray-100">
      {/* KDS Header */}
      <div className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold">👨‍🍳 Kitchen Display</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${connected ? 'bg-green-500' : 'bg-red-500'}`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          {lastUpdate && <span>Updated {lastUpdate.toLocaleTimeString()}</span>}
          <button onClick={load} className="text-gray-300 hover:text-white transition-colors">↻ Refresh</button>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> &lt;10m</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 10–20m</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &gt;20m</span>
          </div>
        </div>
      </div>

      {newOrderNotice && (
        <div className="bg-orange-100 border-b border-orange-200 text-orange-800 px-6 py-2 text-sm font-semibold">
          {newOrderNotice}
        </div>
      )}

      {/* Columns */}
      <div className="flex-1 overflow-hidden grid grid-cols-3 gap-4 p-4">
        <Column title="New Orders"  color="bg-blue-500"   orders={newOrders} onUpdate={load} highlightedOrderId={highlightedOrderId} />
        <Column title="Preparing"   color="bg-orange-500" orders={preparing} onUpdate={load} highlightedOrderId={highlightedOrderId} />
        <Column title="Ready"       color="bg-green-500"  orders={ready}     onUpdate={load} highlightedOrderId={highlightedOrderId} />
      </div>
    </div>
  );
}
