const names=values=>(values || []).map(value=>String(typeof value==='string'?value:value?.name || '').trim().toUpperCase()).filter(Boolean);
export const permissionNames=user=>names(user?.permissions);
export const roleNames=user=>names(user?.roles);
export const isAdministrator=user=>Boolean(user && (String(user.username).toLowerCase()==='admin' || roleNames(user).some(role=>['ROLE_ADMIN','ROLE_SUPER_ADMIN','SUPER_ADMIN'].includes(role))));

// A module's write permission includes reading its own records, never unrelated modules.
const readAliases={
  USER_VIEW:['USER_MANAGE'], ROLE_VIEW:['ROLE_MANAGE','USER_MANAGE'],
  PRODUCT_VIEW:['PRODUCT_MANAGE'], BRAND_VIEW:['BRAND_MANAGE','PRODUCT_MANAGE'], CATEGORY_VIEW:['CATEGORY_MANAGE','PRODUCT_MANAGE'],
  WAREHOUSE_VIEW:['WAREHOUSE_MANAGE'], SUPPLIER_VIEW:['SUPPLIER_MANAGE','PURCHASE_MANAGE'], CUSTOMER_VIEW:['CUSTOMER_MANAGE'],
  CUSTOMER_TARGET_VIEW:['CUSTOMER_TARGET_MANAGE','CUSTOMER_MANAGE'],
  INVENTORY_VIEW:['INVENTORY_MANAGE','INVENTORY_ADJUST'], GRN_VIEW:['GRN_PROCESS'], GTN_VIEW:['GTN_PROCESS'], PRN_VIEW:['PRN_PROCESS'],
  SALES_VIEW:['SALES_VIEW_ALL','SALES_CREATE','SALES_EDIT'],
  QUOTATION_VIEW:['QUOTATION_MANAGE','SALES_CREATE','SALES_VIEW_ALL'],
  PAYMENT_VIEW:['PAYMENT_CREATE'], DELIVERY_VIEW:['DELIVERY_MANAGE'],
};
export function hasPermission(user,permission){
  if(isAdministrator(user))return true;
  const granted=permissionNames(user);
  return [permission,...(readAliases[permission] || [])].some(name=>granted.includes(name));
}

export const DEFAULT_MODULE_TABS={
  inventory:'inventory-list',
  purchasing:'suppliers',
  invoicing:'sales',
  customers:'list',
  employees:'list',
  delivery:'deliveries',
  payments:'payments',
  reports:'customer-reports',
};

export const moduleTabs={
  dashboard:{'':['DASHBOARD_VIEW','REPORT_VIEW','INVENTORY_VIEW']},
  customers:{list:['CUSTOMER_VIEW'],groups:['CUSTOMER_VIEW'],history:['CUSTOMER_VIEW'],targets:['CUSTOMER_TARGET_VIEW']},
  employees:{list:['USER_VIEW'],'pending-approvals':['USER_MANAGE'],roles:['ROLE_VIEW']},
  inventory:{'inventory-list':['INVENTORY_VIEW'],adjustments:['INVENTORY_VIEW','INVENTORY_ADJUST'],'pos-quotas':['INVENTORY_VIEW'],products:['PRODUCT_VIEW'],warehouses:['WAREHOUSE_VIEW'],brands:['BRAND_VIEW','PRODUCT_VIEW'],categories:['CATEGORY_VIEW','PRODUCT_VIEW']},
  purchasing:{suppliers:['SUPPLIER_VIEW'],grn:['GRN_VIEW'],gtn:['GTN_VIEW'],prn:['PRN_VIEW'],'purchase-orders':['SUPPLIER_VIEW','SUPPLIER_MANAGE','PURCHASE_MANAGE']},
  invoicing:{sales:['SALES_VIEW'],'hold-bills':['SALES_CREATE','SALES_EDIT'],'held-history':['SALES_VIEW'],refunds:['SALES_RETURN'],quotations:['QUOTATION_VIEW'],pos:['SALES_CREATE']},
  payments:{payments:['PAYMENT_VIEW'],'advance-payments':['PAYMENT_VIEW'],refunds:['PAYMENT_VIEW'],'outstanding-payments':['SALES_VIEW','PAYMENT_CREATE']},
  delivery:{deliveries:['DELIVERY_VIEW'],routes:['DELIVERY_VIEW'],vehicles:['DELIVERY_VIEW']},
  reports:{'customer-reports':['REPORT_VIEW'],'sales-reports':['REPORT_VIEW'],'inventory-reports':['REPORT_VIEW'],'purchase-reports':['REPORT_VIEW'],'day-summary':['REPORT_VIEW','AUDIT_VIEW']},
};
export const canAccessTab=(user,module,tab)=>(moduleTabs[module]?.[tab] || []).some(permission=>hasPermission(user,permission));
export const canAccessModule=(user,module)=>Object.keys(moduleTabs[module] || {}).some(tab=>canAccessTab(user,module,tab));
export function resolveModuleTab(user,module,requested,fallback){
  if(canAccessTab(user,module,requested))return requested;
  if(canAccessTab(user,module,fallback))return fallback;
  return Object.keys(moduleTabs[module] || {}).find(tab=>canAccessTab(user,module,tab)) ?? null;
}
export function canWriteTab(user,module,tab){
  const writes={
    customers:{targets:['CUSTOMER_TARGET_MANAGE','CUSTOMER_MANAGE'],'*':['CUSTOMER_MANAGE']},
    employees:{roles:['ROLE_MANAGE','USER_MANAGE'],'*':['USER_MANAGE']},
    inventory:{'inventory-list':['INVENTORY_ADJUST'],adjustments:['INVENTORY_ADJUST'],'pos-quotas':['INVENTORY_MANAGE'],products:['PRODUCT_MANAGE'],warehouses:['WAREHOUSE_MANAGE'],brands:['BRAND_MANAGE','PRODUCT_MANAGE'],categories:['CATEGORY_MANAGE','PRODUCT_MANAGE']},
    purchasing:{suppliers:['SUPPLIER_MANAGE'],grn:['GRN_PROCESS'],gtn:['GTN_PROCESS'],prn:['PRN_PROCESS'],'purchase-orders':['SUPPLIER_MANAGE','PURCHASE_MANAGE']},
    invoicing:{quotations:['QUOTATION_MANAGE','SALES_CREATE'],refunds:['SALES_RETURN'],'*':['SALES_CREATE']},
    delivery:{'*':['DELIVERY_MANAGE']},payments:{'*':['PAYMENT_CREATE']},
  };
  return (writes[module]?.[tab] || writes[module]?.['*'] || []).some(permission=>hasPermission(user,permission));
}
