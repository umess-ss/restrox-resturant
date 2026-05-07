import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { fetchOrders, updateOrderStatus } from '../api/orders.api.js';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-orange-100 text-orange-700',
  ready: 'bg-purple-100 text-purple-700',
  served: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};

const NEXT_STATUS = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'served',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);

  const load = () => fetchOrders().then(setOrders).catch(() => toast.error('Failed to load orders'));

  useEffect(() => { load(); }, []);

  const advance = async (id, current) => {
    const next = NEXT_STATUS[current];
    if (!next) return;
    try {
      await updateOrderStatus(id, next);
      toast.success(`Order moved to ${next}`);
      load();
    } catch {
      toast.error('Update failed');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Orders</h2>
      <div className="space-y-3">
        {orders.map((order) => (
          <div key={order._id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-800">Table {order.table?.number}</p>
              <p className="text-sm text-gray-500">{order.items.length} item(s) · ${order.totalAmount.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status]}`}>
                {order.status}
              </span>
              {NEXT_STATUS[order.status] && (
                <button
                  onClick={() => advance(order._id, order.status)}
                  className="text-xs bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600"
                >
                  → {NEXT_STATUS[order.status]}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
