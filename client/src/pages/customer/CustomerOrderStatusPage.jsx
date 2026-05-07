import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchPublicOrderStatus,
  fetchPublicBill,
  requestPublicBill,
  publicReceiptPdfUrl,
  callPublicWaiter,
} from '../../api/public.api.js';
import { initiatePublicPayment, verifyPublicPayment } from '../../api/payments.api.js';
import usePublicOrderSocket from '../../hooks/usePublicOrderSocket.js';
import formatCurrency from '../../utils/formatCurrency.js';

// ─── Status timeline config ───────────────────────────────────────────────────

const TIMELINE = [
  { key: 'pending',   label: 'Order Received',  icon: '📋' },
  { key: 'confirmed', label: 'Confirmed',        icon: '✅' },
  { key: 'preparing', label: 'Preparing',        icon: '👨‍🍳' },
  { key: 'ready',     label: 'Ready for Pickup', icon: '🔔' },
  { key: 'served',    label: 'Served',           icon: '🍽️' },
  { key: 'paid',      label: 'Paid',             icon: '💳' },
];

const STATUS_ORDER = TIMELINE.map((s) => s.key);

const STATUS_MESSAGES = {
  pending:   'Your order has been received. Hang tight!',
  confirmed: 'Your order is confirmed and will be prepared shortly.',
  preparing: 'The kitchen is preparing your order now.',
  ready:     '🔔 Your order is ready! A waiter will bring it to you.',
  served:    'Enjoy your meal! 😊',
  paid:      'Thank you for dining with us! See you again.',
  cancelled: 'Your order was cancelled. Please speak to a staff member.',
};

// ─── Item status badge ────────────────────────────────────────────────────────

const ITEM_STATUS_STYLES = {
  pending:   'bg-gray-100 text-gray-500',
  preparing: 'bg-orange-100 text-orange-700',
  ready:     'bg-green-100 text-green-700',
};

// ─── Prep time helpers ────────────────────────────────────────────────────────

/**
 * Returns minutes remaining until estimatedReadyAt.
 * Returns null if already past or no estimate.
 */
const getMinsRemaining = (estimatedReadyAt) => {
  if (!estimatedReadyAt) return null;
  const diff = new Date(estimatedReadyAt) - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 60000);
};

function PrepTimeCard({ order }) {
  const [minsLeft, setMinsLeft] = useState(() => getMinsRemaining(order.estimatedReadyAt));

  // Tick every 30 seconds so the countdown stays fresh without feeling jumpy.
  useEffect(() => {
    if (!order.estimatedReadyAt) return;
    const t = setInterval(() => setMinsLeft(getMinsRemaining(order.estimatedReadyAt)), 30000);
    return () => clearInterval(t);
  }, [order.estimatedReadyAt]);

  // Update when order changes (e.g. socket update)
  useEffect(() => {
    setMinsLeft(getMinsRemaining(order.estimatedReadyAt));
  }, [order.estimatedReadyAt, order.status]);

  if (order.status === 'ready') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-2xl">🔔</span>
        <div>
          <p className="font-bold text-green-700">Your order is ready</p>
          <p className="text-sm text-green-600">A waiter will bring it to your table.</p>
        </div>
      </div>
    );
  }

  if (['served', 'paid'].includes(order.status)) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-2xl">✓</span>
        <p className="font-bold text-green-700">Completed</p>
      </div>
    );
  }

  if (order.status === 'cancelled') return null;

  if (!order.estimatedPreparationTime) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-2xl">👨‍🍳</span>
        <p className="text-sm text-orange-700 font-medium">Kitchen is preparing your order</p>
      </div>
    );
  }

  const readyTime = order.estimatedReadyAt
    ? new Date(order.estimatedReadyAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">⏱️</span>
        <div className="flex-1">
          <p className="font-bold text-orange-700">
            {minsLeft !== null && minsLeft > 0
              ? `Estimated wait: ${minsLeft} min`
              : minsLeft === 0
              ? 'Almost ready'
              : `Estimated wait: ${order.estimatedPreparationTime} min`}
          </p>
          {readyTime && (
            <p className="text-xs text-orange-600 mt-0.5">
              Ready around {readyTime}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BillPreview({ bill, onClose }) {
  if (!bill) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-gray-800">Running Bill</h3>
            <p className="text-xs text-gray-500">{bill.orderNumber} · Table {bill.tableNumber}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>

        <div className="space-y-2">
          {bill.items.map((item, i) => (
            <div key={i} className="flex justify-between gap-3 text-sm">
              <span className="text-gray-700">{item.name} ×{item.quantity}</span>
              <span className="font-medium text-gray-800">{formatCurrency(item.lineTotal)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCurrency(bill.subtotal)}</span></div>
          <div className="flex justify-between text-gray-600"><span>Discount</span><span>{formatCurrency(bill.discount)}</span></div>
          <div className="flex justify-between text-gray-600"><span>Tax</span><span>{formatCurrency(bill.tax)}</span></div>
          <div className="flex justify-between text-gray-600"><span>Service charge</span><span>{formatCurrency(bill.serviceCharge)}</span></div>
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
            <span>Total</span><span>{formatCurrency(bill.totalAmount)}</span>
          </div>
          {bill.paymentMethod && (
            <div className="flex justify-between text-gray-600 capitalize"><span>Payment</span><span>{bill.paymentMethod}</span></div>
          )}
          {bill.transactionId && (
            <div className="flex justify-between text-gray-600"><span>Transaction ID</span><span>{bill.transactionId}</span></div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomerOrderStatusPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [waiterCooldown, setWaiterCooldown] = useState(0); // seconds remaining
  const [bill, setBill] = useState(null);
  const [billLoading, setBillLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState('');
  const [cashMessage, setCashMessage] = useState(false);
  const cooldownRef = useRef(null);

  // ─── Fetch order status ──────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const data = await fetchPublicOrderStatus(orderId);
      setOrder(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load order status.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Initial load
  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Poll every 10 seconds as fallback
  useEffect(() => {
    const t = setInterval(fetchStatus, 10000);
    return () => clearInterval(t);
  }, [fetchStatus]);

  // ─── Live socket updates ─────────────────────────────────────────────────

  usePublicOrderSocket(orderId, (payload) => {
    setOrder((prev) => prev ? { ...prev, ...payload } : payload);
  });

  // ─── Call waiter ─────────────────────────────────────────────────────────

  const handleCallWaiter = async () => {
    if (waiterCooldown > 0) return;
    try {
      await callPublicWaiter(orderId);
      // Start 60s cooldown
      setWaiterCooldown(60);
      clearInterval(cooldownRef.current);
      cooldownRef.current = setInterval(() => {
        setWaiterCooldown((prev) => {
          if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      alert('Could not reach the waiter. Please try again.');
    }
  };

  const handleViewBill = async () => {
    setBillLoading(true);
    try {
      setBill(await fetchPublicBill(orderId));
    } catch {
      alert('Could not load bill. Please try again.');
    } finally {
      setBillLoading(false);
    }
  };

  const handleRequestBill = async () => {
    try {
      await requestPublicBill(orderId);
      setOrder((prev) => prev ? { ...prev, billStatus: 'requested' } : prev);
      fetchStatus();
    } catch {
      alert('Could not request bill. Please call the waiter.');
    }
  };

  const handleMockPayment = async (method) => {
    setPaymentLoading(method);
    try {
      const { payment } = await initiatePublicPayment({
        orderId,
        method,
        source: 'customer_qr',
      });
      await verifyPublicPayment({
        paymentId: payment._id,
        status: 'success',
        transactionId: `${method.toUpperCase()}-MOCK-${Date.now()}`,
      });
      await fetchStatus();
      setBill(await fetchPublicBill(orderId));
    } catch (err) {
      alert(err.response?.data?.message || 'Mock payment failed. Please speak to staff.');
    } finally {
      setPaymentLoading('');
    }
  };

  useEffect(() => () => clearInterval(cooldownRef.current), []);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading order status…</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-xs">
          <p className="text-4xl">😕</p>
          <p className="text-gray-700 font-medium">{error || 'Order not found.'}</p>
          <button onClick={fetchStatus} className="text-sm text-orange-500 underline">Retry</button>
        </div>
      </div>
    );
  }

  const currentIdx = STATUS_ORDER.indexOf(order.status);
  const isClosed = ['paid', 'cancelled'].includes(order.status);

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-orange-500 text-white px-4 pt-10 pb-6">
        <div className="max-w-lg mx-auto">
          <p className="text-sm opacity-80 mb-1">Table {order.tableNumber}</p>
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-sm opacity-90 mt-1">{STATUS_MESSAGES[order.status] || 'Processing…'}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-5 mt-5">

        {/* Estimated prep time */}
        <PrepTimeCard order={order} />

        {/* Timeline */}
        {order.status !== 'cancelled' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Order Progress</h2>
            <div className="space-y-3">
              {TIMELINE.map((step, idx) => {
                const done = idx <= currentIdx;
                const active = idx === currentIdx;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 transition-all ${
                      done ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'
                    } ${active ? 'ring-2 ring-orange-300 ring-offset-1' : ''}`}>
                      {done ? step.icon : '○'}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${done ? 'text-gray-800' : 'text-gray-400'}`}>
                        {step.label}
                      </p>
                    </div>
                    {active && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                        Now
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cancelled state */}
        {order.status === 'cancelled' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <p className="text-2xl mb-2">❌</p>
            <p className="font-semibold text-red-700">Order Cancelled</p>
            <p className="text-sm text-red-500 mt-1">Please speak to a staff member for assistance.</p>
          </div>
        )}

        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Your Items</h2>
          <div className="space-y-2">
            {order.items?.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {item.name} <span className="text-gray-400">×{item.quantity}</span>
                  </p>
                  {item.notes && <p className="text-xs text-gray-400 italic">"{item.notes}"</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${ITEM_STATUS_STYLES[item.itemStatus] || 'bg-gray-100 text-gray-500'}`}>
                  {item.itemStatus}
                </span>
              </div>
            ))}
          </div>

          {/* Total */}
          {order.totalAmount != null && (
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between text-sm font-semibold text-gray-800">
              <span>Total</span>
              <span>{formatCurrency(order.totalAmount)}</span>
            </div>
          )}
        </div>

        {order.billStatus === 'requested' && order.paymentStatus !== 'paid' && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm font-medium text-blue-700">
            Bill requested. Staff will bring your bill soon.
          </div>
        )}

        {order.billStatus === 'presented' && order.paymentStatus !== 'paid' && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-sm font-medium text-purple-700">
            Bill presented. Please complete payment.
          </div>
        )}

        {order.paymentStatus === 'paid' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
            <p className="font-bold text-green-700">Payment completed</p>
            <a
              href={publicReceiptPdfUrl(orderId)}
              className="block text-center bg-green-500 text-white rounded-xl py-3 font-semibold"
            >
              Download Receipt PDF
            </a>
          </div>
        )}

        {order.paymentStatus !== 'paid' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Payment Options</h2>
              <p className="text-xs text-gray-400 mt-1">eSewa/Khalti are sandbox mock payments for development.</p>
            </div>
            <button
              onClick={() => setCashMessage(true)}
              className="w-full rounded-xl py-3 font-semibold bg-gray-100 text-gray-700"
            >
              Cash
            </button>
            {cashMessage && (
              <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl p-3">
                Please pay at counter or to waiter.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {['esewa', 'khalti'].map((method) => (
                <button
                  key={method}
                  onClick={() => handleMockPayment(method)}
                  disabled={!!paymentLoading}
                  className="rounded-xl py-3 font-semibold bg-green-500 text-white disabled:opacity-50 capitalize"
                >
                  {paymentLoading === method ? 'Processing...' : `Pay with ${method}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleViewBill}
            disabled={billLoading}
            className="rounded-2xl py-4 font-bold text-base bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95"
          >
            {billLoading ? 'Loading...' : 'View Bill'}
          </button>
          {order.paymentStatus !== 'paid' && (
            <button
              onClick={handleRequestBill}
              disabled={order.billStatus === 'requested' || order.billStatus === 'presented'}
              className="rounded-2xl py-4 font-bold text-base bg-white border-2 border-blue-400 text-blue-600 hover:bg-blue-50 active:scale-95 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200"
            >
              Request Bill
            </button>
          )}
        </div>

        {/* Call waiter */}
        {!isClosed && (
          <button
            onClick={handleCallWaiter}
            disabled={waiterCooldown > 0}
            className={`w-full rounded-2xl py-4 font-bold text-base transition-all ${
              waiterCooldown > 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white border-2 border-orange-400 text-orange-600 hover:bg-orange-50 active:scale-95'
            }`}
          >
            {waiterCooldown > 0
              ? `🔔 Waiter notified — wait ${waiterCooldown}s`
              : '🔔 Call Waiter'}
          </button>
        )}

        {/* Refresh hint */}
        <p className="text-center text-xs text-gray-400">
          Status updates automatically every 10 seconds
        </p>
      </div>
      <BillPreview bill={bill} onClose={() => setBill(null)} />
    </div>
  );
}
