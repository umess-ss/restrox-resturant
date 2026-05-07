import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  fetchOrders,
  fetchKitchenOrders,
  updateOrderStatus,
  printKOT,
  fetchBill,
  markBillPresented,
  checkoutOrder,
  cancelOrder,
} from '../api/orders.api.js';
import { useSocketContext, useOrderEvents } from '../socket/SocketContext.jsx';
import { EVENTS } from '../socket/events.js';
import useNotificationSound from '../hooks/useNotificationSound.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META = {
  pending:   { color: 'bg-yellow-100 text-yellow-700 border-yellow-200',  label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-700 border-blue-200',        label: 'Confirmed' },
  preparing: { color: 'bg-orange-100 text-orange-700 border-orange-200',  label: 'Preparing' },
  ready:     { color: 'bg-purple-100 text-purple-700 border-purple-200',  label: 'Ready' },
  served:    { color: 'bg-teal-100 text-teal-700 border-teal-200',        label: 'Served' },
  paid:      { color: 'bg-green-100 text-green-700 border-green-200',     label: 'Paid' },
  cancelled: { color: 'bg-red-100 text-red-600 border-red-200',           label: 'Cancelled' },
};

const NEXT_STATUS = {
  pending: 'confirmed', confirmed: 'preparing',
  preparing: 'ready',   ready: 'served',
};

const PAYMENT_METHODS = ['cash', 'card', 'upi', 'wallet', 'complimentary'];

const BILL_STATUS_LABELS = {
  not_requested: 'Bill not requested',
  requested: 'Bill requested',
  presented: 'Bill presented',
  paid: 'Bill paid',
};

const getTableNumber = (order) => order.table?.number || order.tableNumber || '?';

function CustomerInfo({ order }) {
  if (order.source !== 'customer_qr') return null;
  if (!order.customerName && !order.customerPhone && !order.customerNote) return null;

  return (
    <div className="mt-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-xs text-gray-700 space-y-0.5">
      {order.customerName && <p><span className="font-semibold">Customer:</span> {order.customerName}</p>}
      {order.customerPhone && <p><span className="font-semibold">Phone:</span> {order.customerPhone}</p>}
      {order.customerNote && <p><span className="font-semibold">Note:</span> {order.customerNote}</p>}
    </div>
  );
}

// ─── Bill / Checkout Modal ────────────────────────────────────────────────────

function BillModal({ orderId, onClose, onPaid }) {
  const [bill, setBill] = useState(null);
  const [discountType, setDiscountType] = useState('none');
  const [discountValue, setDiscountValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);

  const loadBill = useCallback(async () => {
    try {
      const params = {};
      if (discountType !== 'none' && discountValue) {
        params.discountType = discountType;
        params.discountValue = discountValue;
      }
      const data = await fetchBill(orderId, params);
      setBill(data);
    } catch {
      toast.error('Failed to load bill');
    }
  }, [orderId, discountType, discountValue]);

  useEffect(() => { loadBill(); }, [loadBill]);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      await checkoutOrder(orderId, {
        paymentMethod,
        discountType: discountType !== 'none' ? discountType : undefined,
        discountValue: discountValue ? Number(discountValue) : 0,
      });
      toast.success('Payment recorded');
      onPaid();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-800">Bill</h3>
            {bill && <p className="text-xs text-gray-500">{bill.billNumber} · Table {bill.table?.number}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {!bill ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Items */}
            <div className="space-y-1">
              {bill.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm text-gray-700">
                  <span>{item.name} × {item.quantity}</span>
                  <span>${item.lineTotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Discount */}
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-500">DISCOUNT</p>
              <div className="flex gap-2">
                <select
                  value={discountType} onChange={(e) => setDiscountType(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="none">No discount</option>
                  <option value="flat">Flat ($)</option>
                  <option value="percent">Percent (%)</option>
                </select>
                {discountType !== 'none' && (
                  <input
                    type="number" min="0" step="0.01"
                    placeholder={discountType === 'percent' ? '%' : '$'}
                    value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                )}
                <button onClick={loadBill} className="text-xs text-orange-500 hover:text-orange-600 font-medium px-2">Apply</button>
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>${bill.subtotal.toFixed(2)}</span>
              </div>
              {bill.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount ({bill.discountType === 'percent' ? `${bill.discountValue}%` : `$${bill.discountValue}`})</span>
                  <span>−${bill.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Tax ({(bill.taxRate * 100).toFixed(0)}%)</span>
                <span>${bill.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-200">
                <span>Total</span><span>${bill.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">PAYMENT METHOD</p>
              <div className="flex gap-2 flex-wrap">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors ${paymentMethod === m ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >{m}</button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCheckout} disabled={loading}
              className="w-full bg-green-500 text-white rounded-xl py-3 font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors"
            >{loading ? 'Processing...' : `Collect $${bill.totalAmount.toFixed(2)}`}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KOT Card ─────────────────────────────────────────────────────────────────

function KOTCard({ order, onAdvance, highlighted }) {
  const elapsed = Math.floor((Date.now() - new Date(order.createdAt)) / 60000);
  const urgent = elapsed > 20;

  return (
    <div className={`bg-white rounded-xl border-2 p-4 space-y-3 transition-all ${urgent ? 'border-red-300' : 'border-gray-200'} ${highlighted ? 'ring-4 ring-orange-300' : ''}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-gray-800">{order.kotNumber}</p>
          <p className="text-xs text-gray-500">Table {order.table?.number} · {order.waiter?.name}</p>
          <CustomerInfo order={order} />
        </div>
        <div className="text-right">
          <span className={`text-xs font-semibold ${urgent ? 'text-red-600' : 'text-gray-500'}`}>
            {elapsed}m ago
          </span>
          <div className={`text-xs px-2 py-0.5 rounded-full mt-1 capitalize ${STATUS_META[order.status]?.color}`}>
            {order.status}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {order.items.map((item) => (
          <div key={item._id} className="flex justify-between text-sm">
            <span className="text-gray-700">{item.name}</span>
            <span className="font-semibold text-gray-800">×{item.quantity}</span>
          </div>
        ))}
      </div>

      {NEXT_STATUS[order.status] && (
        <button
          onClick={() => onAdvance(order._id, order.status)}
          className="w-full text-sm bg-orange-500 text-white rounded-lg py-1.5 hover:bg-orange-600 capitalize"
        >→ Mark {NEXT_STATUS[order.status]}</button>
      )}
    </div>
  );
}

// ─── Order Row ────────────────────────────────────────────────────────────────

function OrderRow({ order, onAdvance, onBill, onCancel, onKOT, onBillPresented, highlighted }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 transition-all ${highlighted ? 'ring-4 ring-orange-300' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800">{order.orderNumber}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${STATUS_META[order.status]?.color}`}>
              {order.status}
            </span>
            {order.paymentStatus === 'paid' && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Paid</span>
            )}
            {order.source === 'customer_qr' && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {BILL_STATUS_LABELS[order.billStatus] || 'Bill not requested'}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Table {order.table?.number} · {order.items?.length} item(s) · ${order.totalAmount?.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400">{order.waiter?.name} · {new Date(order.createdAt).toLocaleTimeString()}</p>
          <CustomerInfo order={order} />
        </div>

        <div className="flex gap-1.5 flex-wrap justify-end">
          {NEXT_STATUS[order.status] && (
            <button
              onClick={() => onAdvance(order._id, order.status)}
              className="text-xs bg-orange-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-orange-600 capitalize"
            >→ {NEXT_STATUS[order.status]}</button>
          )}
          {order.status === 'confirmed' && (
            <button
              onClick={() => onKOT(order._id)}
              className="text-xs border border-orange-300 text-orange-600 px-2.5 py-1.5 rounded-lg hover:bg-orange-50"
            >🖨 KOT</button>
          )}
          {order.source === 'customer_qr' && order.billStatus === 'requested' && (
            <button
              onClick={() => onBillPresented(order._id)}
              className="text-xs bg-blue-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-600"
            >Mark Bill Presented</button>
          )}
          {['served', 'ready'].includes(order.status) && order.paymentStatus !== 'paid' && (
            <button
              onClick={() => onBill(order._id)}
              className="text-xs bg-green-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-600"
            >💳 Bill</button>
          )}
          {!['paid', 'cancelled'].includes(order.status) && (
            <button
              onClick={() => onCancel(order._id)}
              className="text-xs border border-red-200 text-red-500 px-2.5 py-1.5 rounded-lg hover:bg-red-50"
            >✕</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [view, setView] = useState('orders'); // 'orders' | 'kitchen'
  const [statusFilter, setStatusFilter] = useState('');
  const [billOrderId, setBillOrderId] = useState(null);
  const [newOrderNotice, setNewOrderNotice] = useState('');
  const [highlightedOrderId, setHighlightedOrderId] = useState(null);
  const { connected, socket } = useSocketContext();
  const playNotificationSound = useNotificationSound();

  const load = useCallback(async () => {
    try {
      const [o, k] = await Promise.all([
        fetchOrders({ status: statusFilter || undefined }),
        fetchKitchenOrders(),
      ]);
      setOrders(o.orders || o);
      setKitchenOrders(k);
    } catch {
      toast.error('Failed to load orders');
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Fallback polling every 60s (socket is primary)
  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

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

  // Real-time updates — reload list on any order event
  useOrderEvents((event, payload) => {
    if (event === EVENTS.ORDER_CREATED && payload.source === 'customer_qr') {
      notifyNewQrOrder(payload);
    }
    load();
  }, [load, notifyNewQrOrder]);

  const advance = async (id, current) => {
    try {
      await updateOrderStatus(id, NEXT_STATUS[current]);
      toast.success(`Moved to ${NEXT_STATUS[current]}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const sendKOT = async (id) => {
    try {
      const kot = await printKOT(id);
      toast.success(`KOT ${kot.kotNumber} sent`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'KOT failed');
    }
  };

  const presentBill = async (id) => {
    try {
      await markBillPresented(id);
      toast.success('Bill marked presented');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update bill');
    }
  };

  const cancel = async (id) => {
    if (!confirm('Cancel this order?')) return;
    try {
      await cancelOrder(id, 'Cancelled by staff');
      toast.success('Order cancelled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancel failed');
    }
  };

  const STATUS_FILTERS = ['', 'pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-800">Orders</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('orders')}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${view === 'orders' ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >📋 All Orders</button>
          <button
            onClick={() => setView('kitchen')}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${view === 'kitchen' ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >👨‍🍳 Kitchen {kitchenOrders.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">{kitchenOrders.length}</span>}</button>
        </div>
      </div>

      {newOrderNotice && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-xl px-4 py-2 text-sm font-semibold">
          {newOrderNotice}
        </div>
      )}

      {view === 'orders' && (
        <>
          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1 rounded-full border capitalize transition-colors ${statusFilter === s ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >{s || 'All'}</button>
            ))}
          </div>

          {/* Orders list */}
          <div className="space-y-2">
            {(Array.isArray(orders) ? orders : []).map((order) => (
              <OrderRow
                key={order._id}
                order={order}
                onAdvance={advance}
                onBill={setBillOrderId}
                onCancel={cancel}
                onKOT={sendKOT}
                onBillPresented={presentBill}
                highlighted={highlightedOrderId === order._id}
              />
            ))}
            {orders.length === 0 && (
              <div className="text-center py-12 text-gray-400">No orders found</div>
            )}
          </div>
        </>
      )}

      {view === 'kitchen' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kitchenOrders.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-400">No active kitchen orders</div>
          )}
          {kitchenOrders.map((order) => (
            <KOTCard
              key={order._id}
              order={order}
              onAdvance={advance}
              highlighted={highlightedOrderId === order._id}
            />
          ))}
        </div>
      )}

      {billOrderId && (
        <BillModal
          orderId={billOrderId}
          onClose={() => setBillOrderId(null)}
          onPaid={load}
        />
      )}
    </div>
  );
}
