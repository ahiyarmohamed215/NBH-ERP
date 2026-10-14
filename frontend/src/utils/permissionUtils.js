/**
 * permissionUtils.js
 * Centralized authorization & permissible staff check for ERP editing.
 * In NBH ERP:
 * 1. Historical transaction references are retained. Supplier recycle bin actions require supplier management access.
 * 2. Administrators can edit records; other staff need the module's write permission.
 */

import {roleNames,permissionNames} from './moduleAccess';

export function isSuperAdmin(user) {
  if (!user) return false;
  if (String(user.username).toLowerCase() === 'admin') return true;
  const roles = user.roles || [];
  return roles.some((r) => {
    const s = String(typeof r === 'string' ? r : r?.name || '').toUpperCase();
    return s === 'ROLE_SUPER_ADMIN' || s === 'SUPER_ADMIN';
  });
}

export function canEditModule(user, module) {
  if (!user) return false;
  if (isSuperAdmin(user)) return true; // Super Admin has permanent full access to edit all modules
  const roles = roleNames(user);
  const permissions = permissionNames(user);

  // Administrator roles have unrestricted editing access.
  const isPrivilegedStaff = roles.some((r) => {
    const s = String(r).toUpperCase();
    return (
      s === 'ROLE_ADMIN' ||
      s === 'ROLE_SUPER_ADMIN' ||
      s === 'ADMIN'
    );
  });
  if (isPrivilegedStaff) return true;

  const m = String(module || '').toUpperCase();
  const permissionsMap = {
    CUSTOMER: ['CUSTOMER_MANAGE', 'CUSTOMER_EDIT'],
    DELIVERY: ['DELIVERY_MANAGE', 'DELIVERY_EDIT'],
    PRODUCT: ['PRODUCT_MANAGE', 'PRODUCT_EDIT'],
    INVENTORY: ['INVENTORY_MANAGE', 'INVENTORY_ADJUST'],
    WAREHOUSE: ['WAREHOUSE_MANAGE', 'WAREHOUSE_EDIT'],
    SUPPLIER: ['SUPPLIER_MANAGE', 'SUPPLIER_EDIT'],
    USER: ['USER_MANAGE', 'USER_EDIT'],
    ROLE: ['ROLE_MANAGE', 'ROLE_EDIT','USER_MANAGE'],
    SALES: ['SALES_EDIT', 'SALES_MANAGE'],
    GRN: ['GRN_PROCESS'], GTN: ['GTN_PROCESS'], PRN: ['PRN_PROCESS'],
    PAYMENT: ['PAYMENT_CREATE'], QUOTATION: ['QUOTATION_MANAGE', 'SALES_CREATE'],
    BRAND: ['BRAND_MANAGE'], CATEGORY: ['CATEGORY_MANAGE'],
    CUSTOMER_TARGET: ['CUSTOMER_TARGET_MANAGE','CUSTOMER_MANAGE'],
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
  if (isSuperAdmin(user)) return true;
  const roles = roleNames(user);
  const permissions = permissionNames(user);

  const isPrivilegedStaff = roles.some((r) => {
    const s = String(r).toUpperCase();
    return (
      s === 'ROLE_ADMIN' ||
      s === 'ROLE_SUPER_ADMIN' ||
      s === 'ROLE_MANAGER' ||
      s === 'ROLE_DIRECTOR'
    );
  });
  if (isPrivilegedStaff) return true;

  const allowedPerms = [
    'INVENTORY_COST_VIEW',
    'INVENTORY_MANAGE',
    'PRODUCT_MANAGE',
    'GRN_PROCESS',
    'PRN_PROCESS',
  ];
  return allowedPerms.some((p) => permissions.includes(p));
}
