import test from 'node:test';
import assert from 'node:assert/strict';
import {canAccessModule,canAccessTab,canWriteTab,resolveModuleTab,isAdministrator} from '../src/utils/moduleAccess.js';
import {isSuperAdmin,canEditModule,canViewCostPrice} from '../src/utils/permissionUtils.js';

test('administrator usernames do not grant roles, module access, edit access or cost access',()=>{
 for(const username of ['admin','ADMIN','aDmIn']){
  const user={username,roles:[],permissions:[]};
  assert.equal(isAdministrator(user),false);
  assert.equal(isSuperAdmin(user),false);
  assert.equal(canAccessModule(user,'employees'),false);
  assert.equal(canEditModule(user,'USER'),false);
  assert.equal(canViewCostPrice(user),false);
 }
 const assigned={username:'ordinary-name',roles:['ROLE_ADMIN'],permissions:[]};
 assert.equal(isAdministrator(assigned),true);
 assert.equal(canAccessModule(assigned,'employees'),true);
 assert.equal(canEditModule(assigned,'USER'),true);
 assigned.roles=[];
 assert.equal(isAdministrator(assigned),false);
 assert.equal(canEditModule(assigned,'USER'),false);
});

const staff=permissions=>({username:'assigned-staff',roles:['ROLE_CUSTOM'],permissions});
test('assigned view permissions open the correct module and keep actions read-only',()=>{
 const cases=[['dashboard','','DASHBOARD_VIEW'],['customers','list','CUSTOMER_VIEW'],['employees','list','USER_VIEW'],['inventory','products','PRODUCT_VIEW'],['purchasing','grn','GRN_VIEW'],['invoicing','quotations','QUOTATION_VIEW'],['payments','payments','PAYMENT_VIEW'],['delivery','deliveries','DELIVERY_VIEW'],['reports','day-summary','AUDIT_VIEW']];
 for(const[module,tab,permission]of cases){const user=staff([permission]);assert.equal(canAccessModule(user,module),true,permission);assert.equal(canAccessTab(user,module,tab),true,permission);assert.equal(canWriteTab(user,module,tab),false,permission);}
 assert.equal(canAccessModule(staff(['ROLE_VIEW']),'employees'),true);
 assert.equal(resolveModuleTab(staff(['ROLE_VIEW']),'employees','list','list'),'roles');
 assert.equal(canAccessTab(staff(['PRODUCT_VIEW']),'inventory','adjustments'),false);
 assert.equal(canAccessTab(staff(['INVENTORY_VIEW']),'inventory','adjustments'),true);
 assert.equal(canWriteTab(staff(['INVENTORY_VIEW']),'inventory','adjustments'),false);
 assert.equal(canAccessModule(staff([]),'purchasing'),false);
});
test('single workflow permissions grant their own actions without unrelated writes',()=>{
 const cases=[['customers','targets','CUSTOMER_TARGET_MANAGE'],['employees','roles','ROLE_MANAGE'],['inventory','adjustments','INVENTORY_ADJUST'],['purchasing','grn','GRN_PROCESS'],['purchasing','gtn','GTN_PROCESS'],['purchasing','prn','PRN_PROCESS'],['invoicing','refunds','SALES_RETURN'],['invoicing','quotations','QUOTATION_MANAGE'],['payments','payments','PAYMENT_CREATE'],['delivery','vehicles','DELIVERY_MANAGE']];
 for(const[module,tab,permission]of cases){const user=staff([permission]);assert.equal(canAccessTab(user,module,tab),true,permission);assert.equal(canWriteTab(user,module,tab),true,permission);if(module!=='employees')assert.equal(canWriteTab(user,'employees','roles'),false,permission);}
 assert.equal(canAccessTab(staff(['INVENTORY_ADJUST']),'inventory','inventory-list'),true);
 assert.equal(canWriteTab(staff(['SALES_CREATE']),'invoicing','refunds'),false);
});
