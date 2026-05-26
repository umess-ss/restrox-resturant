import { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
  fetchOrders,
  fetchKitchenOrders,
  updateOrderStatus,
  printKOT,
  fetchBill,
  markBillPresented,
  cancelOrder,
} from '../api/orders.api.js';
import { initiatePayment, verifyPayment } from '../api/payments.api.js';
import { useSocketContext, useOrderEvents } from '../socket/SocketContext.jsx';
import { EVENTS } from '../socket/events.js';
import useNotificationSound from '../hooks/useNotificationSound.js';
import formatCurrency from '../utils/formatCurrency.js';

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

const PAYMENT_METHODS = ['cash', 'esewa', 'khalti', 'qr', 'card'];

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
  const [transactionId, setTransactionId] = useState('');
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
      const { payment } = await initiatePayment({
        orderId,
        method: paymentMethod,
        transactionId: transactionId || undefined,
        source: 'pos',
      });
      await verifyPayment({ paymentId: payment._id, status: 'success', transactionId: transactionId || undefined });
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
                  <span>{formatCurrency(item.lineTotal)}</span>
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
                  <option value="flat">Flat (Rs)</option>
                  <option value="percent">Percent (%)</option>
                </select>
                {discountType !== 'none' && (
                  <input
                    type="number" min="0" step="0.01"
                    placeholder={discountType === 'percent' ? '%' : 'Rs'}
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
                <span>Subtotal</span><span>{formatCurrency(bill.subtotal)}</span>
              </div>
              {bill.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount ({bill.discountType === 'percent' ? `${bill.discountValue}%` : formatCurrency(bill.discountValue)})</span>
                  <span>−{formatCurrency(bill.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Tax ({(bill.taxRate * 100).toFixed(0)}%)</span>
                <span>{formatCurrency(bill.taxAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-200">
                <span>Total</span><span>{formatCurrency(bill.totalAmount)}</span>
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

            {['esewa', 'khalti', 'qr', 'card'].includes(paymentMethod) && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">TRANSACTION ID</label>
                <input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Manual payment reference"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            )}

            <button
              onClick={handleCheckout} disabled={loading}
              className="w-full bg-green-500 text-white rounded-xl py-3 font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors"
            >{loading ? 'Processing...' : `Collect ${formatCurrency(bill.totalAmount)}`}</button>
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
            Table {order.table?.number} · {order.items?.length} item(s) · {formatCurrency(order.totalAmount)}
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

function formatOrderDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function OrderStatusButton({ order }) {
  const status = order.paymentStatus === 'paid' ? 'paid' : order.status;
  const statusClass = {
    pending: 'border-yellow-300 bg-yellow-50 text-yellow-700',
    confirmed: 'border-orange-300 bg-orange-50 text-orange-700',
    preparing: 'border-blue-300 bg-blue-50 text-blue-700',
    ready: 'border-sky-300 bg-sky-50 text-sky-700',
    served: 'border-orange-300 bg-orange-50 text-orange-700',
    paid: 'border-green-300 bg-green-50 text-green-700',
    cancelled: 'border-red-300 bg-red-50 text-red-600',
  }[status] || 'border-gray-200 bg-gray-50 text-gray-500';

  const label = status === 'confirmed'
    ? 'Delivering to you'
    : status === 'preparing'
      ? 'Order being prepared'
      : STATUS_META[status]?.label || status;

  return (
    <span className={`block rounded-xl border px-4 py-2 text-center text-xs font-bold capitalize ${statusClass}`}>
      {label}
    </span>
  );
}

function FoodOrderCard({ order, selected, highlighted, onSelect }) {
  const visibleItems = order.items?.slice(0, 2) || [];

  return (
    <button
      onClick={() => onSelect(order._id)}
      className={`flex h-full flex-col rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-100 ${
        selected ? 'border-orange-300 ring-4 ring-orange-100' : 'border-transparent'
      } ${highlighted ? 'ring-4 ring-orange-300' : ''}`}
    >
      <div className="text-center">
        <h3 className="text-base font-extrabold text-gray-900">{order.orderNumber}</h3>
        <p className="mt-1 text-xs text-gray-400">{formatOrderDate(order.createdAt)}</p>
      </div>

      <div className="my-4 border-t border-gray-100" />

      <div>
        <p className="text-sm font-extrabold text-gray-900">Table {getTableNumber(order)}</p>
        <p className="mt-2 text-xs text-gray-400">
          <span className="text-orange-500">★</span> {order.waiter?.name || order.customerName || 'Restaurant order'}
        </p>
      </div>

      <div className="my-4 grid grid-cols-2 gap-2 border-y border-gray-100 py-3 text-xs">
        <span className="text-gray-400">Order time</span>
        <span className="text-right font-bold text-gray-900">{order.preparationTime || 10} Min</span>
        <span className="text-gray-400">Items</span>
        <span className="text-right font-bold text-gray-900">{order.items?.length || 0}</span>
      </div>

      <div className="flex-1">
        <p className="mb-3 text-sm font-extrabold text-gray-900">Order Menu</p>
        <div className="space-y-3">
          {visibleItems.map((item) => (
            <div key={item._id || item.menuItem} className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-50 text-xl">🍽️</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-extrabold text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-400">x{item.quantity}</p>
              </div>
              <p className="text-xs font-extrabold text-gray-900">
                <span className="text-orange-500">+</span>{formatCurrency((item.price || 0) * (item.quantity || 0))}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900">Total</span>
          <span className="text-base font-extrabold text-gray-900">
            <span className="text-orange-500">{formatCurrency(order.totalAmount).slice(0, 1)}</span>{formatCurrency(order.totalAmount).slice(1)}
          </span>
        </div>
        <OrderStatusButton order={order} />
      </div>
    </button>
  );
}

function OrderTrackerPanel({ order, onAdvance, onBill, onCancel, onKOT, onBillPresented }) {
  if (!order) {
    return (
      <aside className="rounded-3xl bg-white p-8 text-center shadow-sm">
        <p className="font-bold text-gray-700">No order selected</p>
        <p className="mt-1 text-sm text-gray-400">Select an order to view its tracker.</p>
      </aside>
    );
  }

  const nextStatus = NEXT_STATUS[order.status];
  const total = formatCurrency(order.totalAmount);

  return (
    <aside className="rounded-3xl bg-white p-6 shadow-sm xl:sticky xl:top-6">
      <h2 className="text-xl font-extrabold text-gray-900">Order Tracker</h2>

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
        <div className="relative h-56 bg-[linear-gradient(90deg,#e5e7eb_1px,transparent_1px),linear-gradient(#e5e7eb_1px,transparent_1px)] bg-[length:34px_34px]">
          <div className="absolute left-1/2 top-8 h-32 w-1 -translate-x-1/2 rounded-full bg-orange-400" />
          <div className="absolute left-[26%] top-[70%] h-1 w-[48%] rounded-full bg-orange-400" />
          <div className="absolute left-1/2 top-8 h-5 w-5 -translate-x-1/2 rounded-full border-4 border-orange-100 bg-orange-500 shadow-lg" />
          <div className="absolute left-[26%] top-[66%] grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-xs font-bold text-white shadow-lg">›</div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold text-gray-400">Table Address</p>
        <p className="mt-2 text-sm font-extrabold text-gray-900">
          <span className="text-orange-500">⌖</span> Table {getTableNumber(order)}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">
          {order.customerNote || order.customerName || order.waiter?.name || 'Restaurant floor order'}
        </p>
        <CustomerInfo order={order} />
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-extrabold text-gray-900">Order Menu</h3>
        <div className="mt-4 space-y-4">
          {order.items?.map((item) => (
            <div key={item._id || item.menuItem} className="flex items-center gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-orange-50 text-2xl">🍽️</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-400">x{item.quantity}</p>
              </div>
              <p className="text-sm font-extrabold text-gray-900">
                <span className="text-orange-500">+</span>{formatCurrency((item.price || 0) * (item.quantity || 0))}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-gray-900">Total</span>
          <span className="text-2xl font-extrabold text-gray-900">
            <span className="text-orange-500">{total.slice(0, 1)}</span>{total.slice(1)}
          </span>
        </div>
        <div className="mt-5">
          <OrderStatusButton order={order} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {nextStatus && (
          <button
            onClick={() => onAdvance(order._id, order.status)}
            className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 hover:bg-orange-600"
          >Mark {nextStatus}</button>
        )}
        {order.status === 'confirmed' && (
          <button
            onClick={() => onKOT(order._id)}
            className="rounded-xl border border-orange-300 bg-white px-4 py-3 text-sm font-bold text-orange-600 hover:bg-orange-50"
          >Send KOT</button>
        )}
        {order.source === 'customer_qr' && order.billStatus === 'requested' && (
          <button
            onClick={() => onBillPresented(order._id)}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-600 hover:bg-blue-100"
          >Bill Presented</button>
        )}
        {['served', 'ready'].includes(order.status) && order.paymentStatus !== 'paid' && (
          <button
            onClick={() => onBill(order._id)}
            className="rounded-xl bg-green-500 px-4 py-3 text-sm font-bold text-white hover:bg-green-600"
          >Bill / Checkout</button>
        )}
        {!['paid', 'cancelled'].includes(order.status) && (
          <button
            onClick={() => onCancel(order._id)}
            className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50"
          >Cancel Order</button>
        )}
      </div>
    </aside>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [view, setView] = useState('orders'); // 'orders' | 'kitchen'
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
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
  const ordersArray = useMemo(() => Array.isArray(orders) ? orders : [], [orders]);
  const displayedOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ordersArray.filter((order) => {
      const searchable = [
        order.orderNumber,
        getTableNumber(order),
        order.customerName,
        order.customerPhone,
        order.waiter?.name,
        order.status,
      ].filter(Boolean).join(' ').toLowerCase();
      return !query || searchable.includes(query);
    });
  }, [ordersArray, search]);
  const selectedOrder = useMemo(
    () => displayedOrders.find((order) => order._id === selectedOrderId) || displayedOrders[0] || null,
    [displayedOrders, selectedOrderId]
  );

  useEffect(() => {
    if (!displayedOrders.length) {
      setSelectedOrderId(null);
      return;
    }
    if (!selectedOrderId || !displayedOrders.some((order) => order._id === selectedOrderId)) {
      setSelectedOrderId(displayedOrders[0]._id);
    }
  }, [displayedOrders, selectedOrderId]);

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] bg-[#f7f7f7] p-4 lg:-m-6 lg:p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">Restaurant orders</p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-gray-900">Food Order</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${connected ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
              {connected ? '● Live' : '○ Offline'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-orange-400">⌕</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order"
              className="h-12 w-full rounded-2xl border border-transparent bg-white pl-12 pr-4 text-sm text-gray-800 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-orange-200 focus:ring-4 focus:ring-orange-100 sm:w-80"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setView('orders')}
              className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${view === 'orders' ? 'border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-200' : 'border-gray-200 bg-white text-gray-600 hover:bg-orange-50'}`}
            >All Orders</button>
            <button
              onClick={() => setView('kitchen')}
              className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${view === 'kitchen' ? 'border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-200' : 'border-gray-200 bg-white text-gray-600 hover:bg-orange-50'}`}
            >Kitchen {kitchenOrders.length > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">{kitchenOrders.length}</span>}</button>
          </div>
        </div>
      </div>

      {newOrderNotice && (
        <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-3 text-sm font-bold text-orange-800">
          {newOrderNotice}
        </div>
      )}

      {view === 'orders' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <main className="min-w-0">
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s || 'all'}
                  onClick={() => setStatusFilter(s)}
                  className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-bold capitalize transition ${statusFilter === s ? 'border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-100' : 'border-gray-200 bg-white text-gray-500 hover:border-orange-200 hover:bg-orange-50'}`}
                >{s || 'All'}</button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {displayedOrders.map((order) => (
                <FoodOrderCard
                  key={order._id}
                  order={order}
                  selected={selectedOrder?._id === order._id}
                  highlighted={highlightedOrderId === order._id}
                  onSelect={setSelectedOrderId}
                />
              ))}
            </div>

            {displayedOrders.length === 0 && (
              <div className="rounded-3xl border border-dashed border-orange-200 bg-white py-16 text-center shadow-sm">
                <p className="font-bold text-gray-700">No orders found</p>
                <p className="mt-1 text-sm text-gray-400">Try another search or status filter.</p>
              </div>
            )}
          </main>

          <OrderTrackerPanel
            order={selectedOrder}
            onAdvance={advance}
            onBill={setBillOrderId}
            onCancel={cancel}
            onKOT={sendKOT}
            onBillPresented={presentBill}
          />
        </div>
      )}

      {view === 'kitchen' && (
        <div>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-gray-900">Kitchen Queue</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${connected ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {kitchenOrders.length === 0 && (
              <div className="col-span-full rounded-3xl border border-dashed border-orange-200 bg-white py-16 text-center text-gray-400 shadow-sm">
                No active kitchen orders
              </div>
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
