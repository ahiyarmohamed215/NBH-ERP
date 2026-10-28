import {roleNames,permissionNames} from './moduleAccess';
export function canUseRecycleBin(user) {
  if (!user) return false;
  if (roleNames(user).some(role => ['ROLE_ADMIN','ROLE_SUPER_ADMIN','ADMIN','SUPER_ADMIN'].includes(role))) return true;
  return permissionNames(user).some(permission => /^(PRODUCT|SUPPLIER|BRAND|WAREHOUSE|CATEGORY|INVENTORY|USER|CUSTOMER|DELIVERY)_(MANAGE|EDIT|ADJUST)$/.test(permission));
}
