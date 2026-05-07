/**
 * Canonical event name registry.
 * Import this on both server and client to avoid string drift.
 *
 * Naming convention:  <domain>:<verb>
 * Server → Client:    domain:verb        (e.g. order:created)
 * Client → Server:    client:<verb>      (e.g. client:join_order)
 */

export const EVENTS = Object.freeze({
  // ─── Order lifecycle ──────────────────────────────────────────────────────
  ORDER_CREATED:            'order:created',
  ORDER_ITEMS_ADDED:        'order:items_added',
  ORDER_STATUS_CHANGED:     'order:status_changed',
  ORDER_ITEM_STATUS_CHANGED:'order:item_status_changed',
  ORDER_KOT_PRINTED:        'order:kot_printed',
  ORDER_PAID:               'order:paid',
  ORDER_CANCELLED:          'order:cancelled',

  // ─── Table ────────────────────────────────────────────────────────────────
  TABLE_STATUS_CHANGED:     'table:status_changed',

  // ─── Inventory ────────────────────────────────────────────────────────────
  INVENTORY_LOW_STOCK:      'inventory:low_stock',       // → manager, admin
  INVENTORY_STOCK_UPDATED:  'inventory:stock_updated',   // → chef, manager, admin

  // ─── Analytics ────────────────────────────────────────────────────────────
  ANALYTICS_SNAPSHOT:       'analytics:snapshot',        // → manager, admin

  // ─── System ───────────────────────────────────────────────────────────────
  CONNECTED:                'rms:connected',             // server → client on connect
  ERROR:                    'rms:error',

  // ─── Customer QR ─────────────────────────────────────────────────────────
  CUSTOMER_CALL_WAITER:     'customer:call_waiter',      // → pos room
  CUSTOMER_REQUEST_BILL:    'customer:request_bill',
  BILL_PRESENTED:           'bill:presented',

  // ─── Client → Server ─────────────────────────────────────────────────────
  CLIENT_JOIN_ORDER:        'client:join_order',
  CLIENT_LEAVE_ORDER:       'client:leave_order',
  CLIENT_JOIN_TABLE:        'client:join_table',
  CLIENT_LEAVE_TABLE:       'client:leave_table',
});

/**
 * Room name helpers — centralised so server and client always agree.
 */
export const ROOMS = Object.freeze({
  kitchen:          'kitchen',
  pos:              'pos',
  managers:         'managers',
  role:   (role) => `role:${role}`,
  order:  (id)   => `order:${id}`,
  table:  (id)   => `table:${id}`,
  branch: (id)   => `branch:${id}`,
});
