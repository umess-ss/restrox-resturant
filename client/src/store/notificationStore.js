import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const buildWaiterNotification = (payload) => {
  const tableNumber = payload.tableNumber || '?';
  const createdAt = payload.createdAt || new Date().toISOString();
  return {
    id: `${payload.orderId || tableNumber}-${createdAt}-${Date.now()}`,
    type: 'waiter_call',
    title: `Table ${tableNumber} has called you`,
    summary: `Table ${tableNumber} is calling waiter`,
    detail: [payload.customerName, payload.customerPhone].filter(Boolean).join(' · '),
    tableNumber,
    orderId: payload.orderId,
    orderNumber: payload.orderNumber,
    createdAt,
    read: false,
  };
};

const useNotificationStore = create(
  persist(
    (set, get) => ({
      notifications: [],

      addWaiterCall: (payload) => {
        const notification = buildWaiterNotification(payload);
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50),
        }));
      },

      markAllRead: () => {
        set((state) => ({
          notifications: state.notifications.map((item) => ({ ...item, read: true })),
        }));
      },

      clear: () => set({ notifications: [] }),

      unreadCount: () => get().notifications.filter((item) => !item.read).length,
    }),
    {
      name: 'rms-notifications',
      partialize: (state) => ({ notifications: state.notifications }),
    }
  )
);

export default useNotificationStore;
