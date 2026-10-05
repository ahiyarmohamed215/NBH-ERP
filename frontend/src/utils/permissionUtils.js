/**
 * permissionUtils.js
 * Centralized authorization & permissible staff check for ERP editing.
 * In NBH ERP:
 * 1. Permanent deletion is strictly prohibited across all records (backend enforces immutable audit ledger).
 * 2. Editing existing records is restricted to selected permissible staff:
 *    - Super Admin, Admin, Manager, Director
 *    - Or staff with explicit manage/edit permission for that specific module.
 */

export function canEditModule(user, module) {
  if (!user) return false;
  const roles = user.roles || [];
  const permissions = user.permissions || [];

  // Super Admin, Admin, or Manager can edit records
  const isPrivilegedStaff = roles.some((r) => {
    const s = String(r).toUpperCase();
    return (
      s.includes('ADMIN') ||
      s.includes('SUPER') ||
      s.includes('MANAGER') ||
      s.includes('DIRECTOR')
    );
  });
  if (isPrivilegedStaff) return true;

  const m = String(module || '').toUpperCase();
  const permissionsMap = {
    CUSTOMER: ['CUSTOMER_MANAGE', 'CUSTOMER_EDIT'],
    DELIVERY: ['DELIVERY_MANAGE', 'DELIVERY_EDIT'],
    PRODUCT: ['PRODUCT_MANAGE', 'PRODUCT_EDIT'],
    INVENTORY: ['INVENTORY_MANAGE', 'INVENTORY_ADJUST', 'PRODUCT_MANAGE', 'WAREHOUSE_MANAGE'],
    WAREHOUSE: ['WAREHOUSE_MANAGE', 'WAREHOUSE_EDIT'],
    SUPPLIER: ['SUPPLIER_MANAGE', 'SUPPLIER_EDIT'],
    USER: ['USER_MANAGE', 'USER_EDIT'],
    ROLE: ['ROLE_MANAGE', 'ROLE_EDIT'],
    SALES: ['SALES_EDIT', 'SALES_MANAGE'],
    PURCHASING: ['SUPPLIER_MANAGE', 'GRN_PROCESS', 'GTN_PROCESS', 'PRN_PROCESS'],
  };

  const required = permissionsMap[m] || [`${m}_MANAGE`, `${m}_EDIT`];
  return required.some((p) => permissions.includes(p));
}

/**
 * Determines whether the user has permission to view product & inventory cost prices.
 * Authorized staff include:
 * - Super Admin, Admin, Manager, Director
 * - Staff allocated with INVENTORY_COST_VIEW, INVENTORY_MANAGE, or PRODUCT_MANAGE permissions
 */
export function canViewCostPrice(user) {
  if (!user) return false;
  const roles = user.roles || [];
  const permissions = user.permissions || [];

  const isPrivilegedStaff = roles.some((r) => {
    const s = String(r).toUpperCase();
    return (
      s.includes('ADMIN') ||
      s.includes('SUPER') ||
      s.includes('MANAGER') ||
      s.includes('DIRECTOR')
    );
  });
  if (isPrivilegedStaff) return true;

  const allowedPerms = [
    'INVENTORY_COST_VIEW',
    'INVENTORY_MANAGE',
    'PRODUCT_MANAGE',
  ];
  return allowedPerms.some((p) => permissions.includes(p));
}
