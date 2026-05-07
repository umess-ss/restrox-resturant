import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import useAuthStore from '../store/authStore.js';
import { EVENTS } from './events.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// ─── Context ──────────────────────────────────────────────────────────────────

const SocketContext = createContext(null);

/**
 * SocketProvider
 *
 * - Creates ONE socket connection per authenticated session
 * - Reconnects automatically with exponential backoff
 * - Re-authenticates when the access token is refreshed
 * - Exposes { socket, connected, identity } to the whole app
 * - Shows a toast on low-stock alerts (managers/admins only)
 */
export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [identity, setIdentity] = useState(null); // { userId, name, role, rooms }
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  // ─── Connect / disconnect on auth state change ──────────────────────────

  useEffect(() => {
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
        setIdentity(null);
      }
      return;
    }

    // Avoid creating a second socket if one already exists
    if (socketRef.current?.connected) return;

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity, // keep trying — restaurant can't afford to go dark
    });

    // ─── Lifecycle events ─────────────────────────────────────────────────

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      // If server closed the connection (e.g. token invalidated), don't auto-reconnect
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('connect_error', async (err) => {
      setConnected(false);
      // Token expired mid-session — try to refresh and reauth
      if (err.message === 'Invalid token' || err.message === 'Authentication required') {
        try {
          const newToken = await refreshToken();
          socket.auth = { token: newToken };
          socket.connect();
        } catch {
          // Refresh failed — user will be logged out by axios interceptor
        }
      }
    });

    // ─── Server → Client events ───────────────────────────────────────────

    socket.on(EVENTS.CONNECTED, (data) => {
      setIdentity(data);
    });

    socket.on(EVENTS.ERROR, (data) => {
      console.error('[Socket]', data.message);
    });

    // Low-stock alerts — shown as persistent toasts for managers/admins
    socket.on(EVENTS.INVENTORY_LOW_STOCK, (ingredient) => {
      toast.warn(
        `⚠ Low stock: ${ingredient.name} — ${ingredient.quantity} ${ingredient.unit} remaining (need ${ingredient.threshold})`,
        { toastId: `low-stock-${ingredient._id}`, autoClose: false }
      );
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setIdentity(null);
    };
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Re-authenticate when token is refreshed ────────────────────────────

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !accessToken) return;
    // Send new token to server without disconnecting
    socket.emit('client:reauth', accessToken);
  }, [accessToken]);

  // ─── Helpers exposed to consumers ────────────────────────────────────────

  const joinOrder = useCallback((orderId) => {
    socketRef.current?.emit(EVENTS.CLIENT_JOIN_ORDER, orderId);
  }, []);

  const leaveOrder = useCallback((orderId) => {
    socketRef.current?.emit(EVENTS.CLIENT_LEAVE_ORDER, orderId);
  }, []);

  const joinTable = useCallback((tableId) => {
    socketRef.current?.emit(EVENTS.CLIENT_JOIN_TABLE, tableId);
  }, []);

  const leaveTable = useCallback((tableId) => {
    socketRef.current?.emit(EVENTS.CLIENT_LEAVE_TABLE, tableId);
  }, []);

  const value = {
    socket: socketRef.current,
    connected,
    identity,
    joinOrder,
    leaveOrder,
    joinTable,
    leaveTable,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

/**
 * useSocketContext
 * Primary hook for consuming the socket in any component.
 *
 * @example
 * const { socket, connected, joinOrder } = useSocketContext();
 */
export function useSocketContext() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketContext must be used inside <SocketProvider>');
  return ctx;
}

/**
 * useOrderEvents
 * Subscribes to all order-related events and calls the provided handler.
 * Automatically cleans up on unmount.
 *
 * @param {function} handler  - called with (event, payload)
 * @param {Array}    deps     - extra dependencies for the effect
 */
export function useOrderEvents(handler, deps = []) {
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!socket) return;

    const orderEvents = [
      EVENTS.ORDER_CREATED,
      EVENTS.ORDER_ITEMS_ADDED,
      EVENTS.ORDER_STATUS_CHANGED,
      EVENTS.ORDER_ITEM_STATUS_CHANGED,
      EVENTS.ORDER_KOT_PRINTED,
      EVENTS.ORDER_PAID,
      EVENTS.ORDER_CANCELLED,
    ];

    const listeners = orderEvents.map((event) => {
      const fn = (payload) => handler(event, payload);
      socket.on(event, fn);
      return { event, fn };
    });

    return () => listeners.forEach(({ event, fn }) => socket.off(event, fn));
  }, [socket, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * useTableEvents
 * Subscribes to table status changes.
 */
export function useTableEvents(handler, deps = []) {
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!socket) return;
    const fn = (payload) => handler(payload);
    socket.on(EVENTS.TABLE_STATUS_CHANGED, fn);
    return () => socket.off(EVENTS.TABLE_STATUS_CHANGED, fn);
  }, [socket, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * useInventoryEvents
 * Subscribes to stock update events (kitchen + managers).
 */
export function useInventoryEvents(handler, deps = []) {
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!socket) return;
    const fn = (payload) => handler(payload);
    socket.on(EVENTS.INVENTORY_STOCK_UPDATED, fn);
    return () => socket.off(EVENTS.INVENTORY_STOCK_UPDATED, fn);
  }, [socket, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * useAnalyticsEvents
 * Subscribes to analytics snapshot pushes (managers/admins).
 */
export function useAnalyticsEvents(handler, deps = []) {
  const { socket } = useSocketContext();

  useEffect(() => {
    if (!socket) return;
    const fn = (payload) => handler(payload);
    socket.on(EVENTS.ANALYTICS_SNAPSHOT, fn);
    return () => socket.off(EVENTS.ANALYTICS_SNAPSHOT, fn);
  }, [socket, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}
