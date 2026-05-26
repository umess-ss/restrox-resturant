import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import useTenantStore from '../../store/tenantStore.js';
import useNotificationStore from '../../store/notificationStore.js';
import { useSocketContext } from '../../socket/SocketContext.jsx';
import { EVENTS } from '../../socket/events.js';

const formatTime = (value) => {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function Header() {
  const { user, logout } = useAuthStore();
  const restaurant = useTenantStore((s) => s.restaurant);
  const { socket } = useSocketContext();
  const notifications = useNotificationStore((s) => s.notifications);
  const addWaiterCall = useNotificationStore((s) => s.addWaiterCall);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clearNotifications = useNotificationStore((s) => s.clear);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (!socket) return;

    const handleWaiterCall = (payload) => {
      addWaiterCall(payload);
    };

    socket.on(EVENTS.CUSTOMER_CALL_WAITER, handleWaiterCall);
    socket.on('waiter:called', handleWaiterCall);

    return () => {
      socket.off(EVENTS.CUSTOMER_CALL_WAITER, handleWaiterCall);
      socket.off('waiter:called', handleWaiterCall);
    };
  }, [socket, addWaiterCall]);

  const toggleNotifications = () => {
    setShowNotifications((open) => {
      const next = !open;
      if (next) markAllRead();
      return next;
    });
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-gray-700 font-semibold text-sm">{restaurant?.name || 'Restaurant'}</span>
        {restaurant?.plan && (
          <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${
            restaurant.plan === 'trial' ? 'bg-yellow-100 text-yellow-700' :
            restaurant.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
            'bg-green-100 text-green-700'
          }`}>
            {restaurant.plan}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={toggleNotifications}
            className="relative h-9 w-9 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-colors"
            aria-label="Notifications"
          >
            <span className="text-lg leading-none">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-[18px] text-white shadow">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-bold text-gray-800">Notifications</p>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearNotifications}
                    className="text-xs font-medium text-gray-400 hover:text-red-500"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-400">No waiter calls yet</p>
                ) : (
                  notifications.slice(0, 6).map((notification) => (
                    <div key={notification.id} className="border-b border-gray-100 px-4 py-3 last:border-b-0">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm text-orange-600">
                          🛎
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800">{notification.title}</p>
                          {notification.detail && (
                            <p className="mt-0.5 truncate text-xs text-gray-500">{notification.detail}</p>
                          )}
                          <p className="mt-1 text-[11px] font-medium text-gray-400">{formatTime(notification.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Link
                to="/notifications"
                onClick={() => setShowNotifications(false)}
                className="block border-t border-gray-100 bg-gray-50 px-4 py-3 text-center text-xs font-bold text-orange-600 hover:bg-orange-50"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
        <span className="text-sm font-medium text-gray-700">{user?.name}</span>
        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full capitalize">
          {user?.role}
        </span>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-red-500 transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
