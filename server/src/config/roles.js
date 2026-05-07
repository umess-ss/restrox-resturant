/**
 * Role hierarchy and permission definitions.
 * Higher index = more privilege.
 */
export const ROLES = Object.freeze({
  CHEF: 'chef',
  WAITER: 'waiter',
  MANAGER: 'manager',
  ADMIN: 'admin',
});

// Ordered from least to most privileged
const ROLE_HIERARCHY = [ROLES.CHEF, ROLES.WAITER, ROLES.MANAGER, ROLES.ADMIN];

/**
 * Returns true if `userRole` meets or exceeds `requiredRole` in the hierarchy.
 */
export const hasMinRole = (userRole, requiredRole) => {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(requiredRole);
};

/**
 * Fine-grained permission map per resource + action.
 * Used by the `can()` middleware for explicit permission checks.
 */
export const PERMISSIONS = {
  // Menu
  'menu:read':   [ROLES.CHEF, ROLES.WAITER, ROLES.MANAGER, ROLES.ADMIN],
  'menu:write':  [ROLES.MANAGER, ROLES.ADMIN],
  'menu:delete': [ROLES.ADMIN],

  // Orders
  'orders:read':   [ROLES.CHEF, ROLES.WAITER, ROLES.MANAGER, ROLES.ADMIN],
  'orders:write':  [ROLES.WAITER, ROLES.MANAGER, ROLES.ADMIN],
  'orders:delete': [ROLES.MANAGER, ROLES.ADMIN],
  'orders:pay':    [ROLES.MANAGER, ROLES.ADMIN],

  // Tables
  'tables:read':   [ROLES.WAITER, ROLES.MANAGER, ROLES.ADMIN],
  'tables:write':  [ROLES.MANAGER, ROLES.ADMIN],
  'tables:delete': [ROLES.ADMIN],

  // Staff / Users
  'staff:read':   [ROLES.MANAGER, ROLES.ADMIN],
  'staff:write':  [ROLES.MANAGER, ROLES.ADMIN],
  'staff:delete': [ROLES.ADMIN],
};
