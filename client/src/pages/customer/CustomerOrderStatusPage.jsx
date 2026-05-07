import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicOrderStatus, callPublicWaiter } from '../../api/public.api.js';
import usePublicOrderSocket from '../../hooks/usePublicOrderSocket.js';

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

const fmt = (n) => Number(n).toFixed(2);

// ─── Item status badge ────────────────────────────────────────────────────────

const ITEM_STATUS_STYLES = {
  pending:   'bg-gray-100 text-gray-500',
  preparing: 'bg-orange-100 text-orange-700',
  ready:     'bg-green-100 text-green-700',
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomerOrderStatusPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [waiterCooldown, setWaiterCooldown] = useState(0); // seconds remaining
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
              <span>${fmt(order.totalAmount)}</span>
            </div>
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
    </div>
  );
}
