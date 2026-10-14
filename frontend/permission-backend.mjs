import fs from 'node:fs';
const root='../src/main/java/com/nbh/erp';
const controllers={
 'user/controller/UserController':'USER','role/controller/RoleController':'ROLE',
 'product/controller/ProductController':'PRODUCT','brand/controller/BrandController':'BRAND','category/controller/CategoryController':'CATEGORY',
 'warehouse/controller/WarehouseController':'WAREHOUSE','supplier/controller/SupplierController':'SUPPLIER',
 'customer/controller/CustomerController':'CUSTOMER','customergroup/controller/CustomerGroupController':'CUSTOMER',
 'grn/controller/GrnController':'GRN','gtn/controller/GtnController':'GTN','purchasereturn/controller/PurchaseReturnController':'PRN',
 'quotation/controller/QuotationController':'QUOTATION','dashboard/controller/DashboardController':'DASHBOARD',
 'payment/controller/PaymentController':'PAYMENT','stockadjustment/controller/StockAdjustmentController':'STOCK_ADJUSTMENT',
 'inventory/controller/StockController':'INVENTORY','inventory/controller/ProductStaffQuotaController':'INVENTORY',
 'delivery/controller/DeliveryController':'DELIVERY','delivery/controller/DeliveryRouteController':'DELIVERY','delivery/controller/VehicleController':'DELIVERY',
};
for(const [relative,module]of Object.entries(controllers)){
 const path=`${root}/${relative}.java`;let s=fs.readFileSync(path,'utf8');
 const condition=`T(com.nbh.erp.security.SecurityUtils).canRead('${module}')`;
 if(relative.endsWith('StockController'))s=s.replace(/@PreAuthorize\("[^"\n]+"\)/,`@PreAuthorize("${condition}")`);
 else s=s.replace(/(@GetMapping[^\r\n]*\r?\n)([\s\S]*?)(?=    public )/g,(_all,mapping,annotations)=>{
  annotations=annotations.replace(/    @PreAuthorize\("[^"\r\n]+"\)\r?\n/g,'');
  return `${mapping}    @PreAuthorize("${condition}")\n${annotations}`;
 });
 if(relative.startsWith('role/'))s=s.replaceAll("hasAuthority('ROLE_ADMIN') or hasAuthority('USER_MANAGE')","hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','ROLE_MANAGE','USER_MANAGE')");
 if(relative.startsWith('quotation/'))s=s.replaceAll("hasAuthority('ROLE_SUPER_ADMIN') or hasAuthority('ROLE_ADMIN') or hasAuthority('SALES_CREATE')","hasAnyAuthority('ROLE_SUPER_ADMIN','ROLE_ADMIN','QUOTATION_MANAGE','SALES_CREATE')");
 fs.writeFileSync(path,s);
}
for(const [relative,oldModule,module]of [['brand/service/BrandService','PRODUCT','BRAND'],['category/service/CategoryService','PRODUCT','CATEGORY']]){
 const path=`${root}/${relative}.java`;let s=fs.readFileSync(path,'utf8');s=s.replaceAll(`enforceCanEdit("${oldModule}"`, `enforceCanEdit("${module}"`);fs.writeFileSync(path,s);
}
