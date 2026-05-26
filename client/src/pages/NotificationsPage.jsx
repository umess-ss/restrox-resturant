import { useEffect, useMemo, useState } from 'react';
import useNotificationStore from '../store/notificationStore.js';

const formatDate = (value) =>
  new Date(value).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

const formatTime = (value) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const groupLabel = (createdAt) => {
  const itemDay = startOfDay(new Date(createdAt));
  const today = startOfDay(new Date());
  const oneDay = 24 * 60 * 60 * 1000;
  if (itemDay === today) return 'Today';
  if (itemDay === today - oneDay) return 'Yesterday';
  return formatDate(createdAt);
};

const typeStyle = {
  waiter_call: {
    icon: '🛎',
    badge: 'bg-orange-500 text-white',
    label: 'Waiter Call',
  },
};

export default function NotificationsPage() {
  const notifications = useNotificationStore((s) => s.notifications);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clear = useNotificationStore((s) => s.clear);
  const [tab, setTab] = useState('activity');

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  const visible = useMemo(() => {
    if (tab === 'notifications') return notifications.filter((item) => !item.read);
    return notifications;
  }, [notifications, tab]);

  const grouped = useMemo(() => {
    return visible.reduce((acc, item) => {
      const label = groupLabel(item.createdAt);
      if (!acc[label]) acc[label] = [];
      acc[label].push(item);
      return acc;
    }, {});
  }, [visible]);

  return (
    <div className="min-h-full bg-gray-50 -m-6 p-6">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Notification</h1>
          <p className="mt-1 text-sm text-gray-500">Waiter calls and customer alerts from QR ordering.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={clear}
            disabled={notifications.length === 0}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-500 shadow-sm hover:border-red-200 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear all
          </button>
          <button
            type="button"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm"
          >
            Recently⌄
          </button>
        </div>
      </div>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100 md:p-7">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="inline-flex rounded-lg bg-gray-100 p-1">
            {[
              ['activity', 'Activity'],
              ['notifications', 'Notifications'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-md px-6 py-2 text-sm font-semibold transition-colors ${
                  tab === key ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-sm font-semibold text-gray-400">
            {visible.length} {visible.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {visible.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-2xl">
              🔔
            </div>
            <p className="font-bold text-gray-800">No notifications yet</p>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              When a customer taps call waiter from the QR page, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-9">
            {Object.entries(grouped).map(([label, items]) => (
              <div key={label}>
                <h2 className="mb-5 text-xl font-black text-gray-900">{label}</h2>
                <div className="relative space-y-0">
                  {items.map((item, index) => {
                    const style = typeStyle[item.type] || typeStyle.waiter_call;
                    return (
                      <div key={item.id} className="relative grid grid-cols-[44px_1fr_auto] gap-5 pb-8 last:pb-0">
                        {index !== items.length - 1 && (
                          <span className="absolute left-[21px] top-11 h-[calc(100%-44px)] w-px bg-gray-200" />
                        )}
                        <span className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-xl text-lg ${style.badge}`}>
                          {style.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-black text-gray-900">{item.title}</h3>
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">
                              {style.label}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-700">{item.summary}</p>
                          {item.detail && <p className="mt-1 text-sm text-gray-400">{item.detail}</p>}
                        </div>
                        <time className="hidden whitespace-nowrap pt-1 text-sm font-medium text-gray-400 md:block">
                          {formatTime(item.createdAt)}
                        </time>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
