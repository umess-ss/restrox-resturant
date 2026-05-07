/**
 * Canonical event name registry — mirrors server/src/socket/events.js
 * Keep both files in sync.
 */

export const EVENTS = Object.freeze({
  ORDER_CREATED:            'order:created',
  ORDER_ITEMS_ADDED:        'order:items_added',
  ORDER_STATUS_CHANGED:     'order:status_changed',
  ORDER_ITEM_STATUS_CHANGED:'order:item_status_changed',
  ORDER_KOT_PRINTED:        'order:kot_printed',
  ORDER_PAID:               'order:paid',
  ORDER_CANCELLED:          'order:cancelled',

  TABLE_STATUS_CHANGED:     'table:status_changed',

  INVENTORY_LOW_STOCK:      'inventory:low_stock',
  INVENTORY_STOCK_UPDATED:  'inventory:stock_updated',

  ANALYTICS_SNAPSHOT:       'analytics:snapshot',

  CONNECTED:                'rms:connected',
  ERROR:                    'rms:error',

  CLIENT_JOIN_ORDER:        'client:join_order',
  CLIENT_LEAVE_ORDER:       'client:leave_order',
  CLIENT_JOIN_TABLE:        'client:join_table',
  CLIENT_LEAVE_TABLE:       'client:leave_table',
});

export const ROOMS = Object.freeze({
  kitchen:       'kitchen',
  pos:           'pos',
  managers:      'managers',
  role: (role) => `role:${role}`,
  order: (id)  => `order:${id}`,
  table: (id)  => `table:${id}`,
});
