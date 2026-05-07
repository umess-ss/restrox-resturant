/**
 * usePublicOrderSocket
 *
 * Lightweight unauthenticated socket hook for the customer order status page.
 * Connects without a JWT token — the server's socket auth middleware requires
 * a token, so this hook connects to the public HTTP polling fallback instead
 * of the authenticated socket.
 *
 * Strategy: poll REST every 10s as the primary mechanism.
 * If the existing socket is available (staff is logged in on same device),
 * also subscribe to order events for instant updates.
 */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { EVENTS } from '../socket/events.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

/**
 * @param {string}   orderId   - order to watch
 * @param {function} onUpdate  - called with the updated order payload
 */
export default function usePublicOrderSocket(orderId, onUpdate) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!orderId) return;

    // Try to connect without auth — server will reject with 'Authentication required'
    // We catch that silently and fall back to polling (handled in the page component).
    // If the server ever supports anonymous socket connections this will work automatically.
    const socket = io(SOCKET_URL, {
      auth: {},                          // no token
      transports: ['websocket', 'polling'],
      reconnection: false,               // don't retry — polling is the fallback
      timeout: 3000,
    });

    socket.on('connect_error', () => {
      // Expected for unauthenticated connections — polling handles updates
      socket.disconnect();
    });

    socket.on('connect', () => {
      // If server allows anonymous connections in future, join the order room
      socket.emit(EVENTS.CLIENT_JOIN_ORDER, orderId);
    });

    const handleUpdate = (payload) => {
      if (payload._id === orderId || payload.orderId === orderId) {
        onUpdate(payload);
      }
    };

    socket.on(EVENTS.ORDER_STATUS_CHANGED, handleUpdate);
    socket.on(EVENTS.ORDER_ITEM_STATUS_CHANGED, handleUpdate);
    socket.on(EVENTS.ORDER_PAID, handleUpdate);
    socket.on(EVENTS.BILL_PRESENTED, handleUpdate);

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps
}
