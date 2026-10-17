import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('all Inventory tabs print their filtered visible tables without exposing hidden cost prices',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try {
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');
  for(const [name,api] of Object.entries(apis)) if(name.endsWith('Api') && api && typeof api==='object') for(const method of Object.keys(api)) if(typeof api[method]==='function') api[method]=async()=>({data:[]});
  localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
  apis.authApi.getMe=async()=>({data:{username:'inventory-clerk',roles:['ROLE_USER'],permissions:['INVENTORY_VIEW','PRODUCT_VIEW','WAREHOUSE_VIEW','BRAND_VIEW','CATEGORY_VIEW']}});
  const products=[{id:1,sku:'SKU-FIRST',name:'First item <unsafe>',costPrice:999991,sellingPrice:35,brandName:'Brand 1',isActive:true,defaultWarehouseId:10,defaultWarehouseName:'North'},
    {id:2,sku:'SKU-SECOND',name:'Second item',costPrice:999992,sellingPrice:45,brandName:'Brand 2',isActive:true,defaultWarehouseId:20,defaultWarehouseName:'South'}];
  apis.productApi.getProducts=async()=>({data:{content:products}});
  apis.warehouseApi.getAll=async()=>({data:[{id:10,code:'WH-10',name:'North',isActive:true},{id:20,code:'WH-20',name:'South',isActive:true}]});
  apis.brandApi.getAll=apis.brandApi.getActive=async()=>({data:[{id:1,code:'BRAND-1',name:'Brand 1',markupPercent:25,isActive:true},{id:2,code:'BRAND-2',name:'Brand 2',isActive:true}]});
  apis.categoryApi.getAll=apis.categoryApi.getActive=async()=>({data:[{id:1,code:'CAT-1',name:'Test category',isActive:true}]});
  apis.inventoryApi.getBalances=async(params,config)=>{assert.equal(config.force,true,'Inventory refresh bypasses stale cached prices');return {data:{content:products.map(product=>({productId:String(product.id),productSku:product.sku,productName:product.name,brandName:product.brandName,warehouseId:product.defaultWarehouseId,warehouseName:product.defaultWarehouseName,quantity:20,minStockLevel:0,reservedQuantity:3,availableQuantity:17,costPrice:product.costPrice,sellingPrice:0}))}};};
  apis.adjustmentApi.search=async()=>({data:{content:[{id:30,adjustmentNumber:'ADJ-30',adjustmentDate:'2026-10-12',warehouseName:'North',items:[{productId:1,productSku:'SKU-FIRST',productName:products[0].name,differenceQuantity:3,reason:'Count correction'}]},{id:31,adjustmentNumber:'ADJ-OLD',adjustmentDate:'2026-10-09',warehouseName:'South',items:[{productId:2,productSku:'SKU-SECOND',productName:products[1].name,differenceQuantity:2,reason:'Opening stock'}]}]}});
  apis.staffQuotaApi.search=async()=>({data:{content:[{id:41,createdAt:'2026-10-09T08:00:00',productSku:'SKU-SECOND',productName:'Older allocation',userFullName:'Test staff',allocatedQuantity:1,totalStockAvailable:20,isActive:true},{id:40,createdAt:'2026-10-12T09:00:00',productSku:'SKU-FIRST',productName:products[0].name,userFullName:'Test staff',username:'staff',allocatedQuantity:2,totalStockAvailable:20,isActive:true}]}});
  apis.staffQuotaApi.getSummary=async()=>({data:null});
  let printed='';window.open=()=>({document:{open(){},write(html){printed=html;},close(){}}});
  const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');const {default:Inventory}=await server.ssrLoadModule('/src/views/InventoryHub.jsx');
  for(const tab of ['inventory-list','pos-quotas','products','brands','warehouses','categories','adjustments']) {
   await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(Inventory,{key:tab,activeSubTab:tab})))));
   const toolbar=host.querySelector('.inventory-toolbar,.master-toolbar');assert.ok(toolbar);
   assert.equal(toolbar.querySelector('[title^="Export"]'),null,`${tab}: print replaces CSV export`);
   const cellCount=host.querySelector('tbody tr').cells.length;
   for(let index=0;index<cellCount;index++){
    const cell=host.querySelector('tbody tr').cells[index];
    // Include badge/text clicks and the empty area around action buttons.
    const target=cell.querySelector('.erp-status-badge') || (index===cellCount-1?cell:cell.firstElementChild || cell);
    await act(async()=>target.click());
    const dialog=host.querySelector('[role="dialog"]');assert.ok(dialog,`${tab}: clicking column ${index+1} opens the record`);
    await act(async()=>[...dialog.querySelectorAll('button')].find(button=>button.textContent.trim()==='Close').click());
   }
   const expectedHeaders={
    'inventory-list':['Code / Product name','Brand / Category','Warehouse','Qty','Selling price','Status','Actions'],
    'pos-quotas':['Allocation code','Staff member','Total products','Date','Status','Remarks','Actions'],
    products:['Code / Product name','Brand / Category','Warehouse','Min stock','Status','Remarks','Actions'],
    brands:['Brand code','Brand name','MP%','Status','Remarks','Actions'],
    warehouses:['Warehouse code','Warehouse name','Address','Contact number','Status','Remarks','Actions'],
    categories:['Category code','Category name','Status','Remarks','Actions'],
   };
   if(expectedHeaders[tab])assert.deepEqual([...host.querySelectorAll('thead th')].map(th=>th.textContent),expectedHeaders[tab],`${tab}: requested column order`);
   if(tab==='pos-quotas'){
    assert.equal(host.querySelectorAll('tbody tr').length,2);
    const selectDate=async()=>{
     await act(async()=>host.querySelector('[aria-label="Inventory allocation date range"]').click());
     const calendar=document.querySelector('[aria-label="Choose Inventory allocation date range"]');assert.ok(calendar);
     const now=new Date(),offset=(2026-now.getFullYear())*12+9-now.getMonth();
     for(let step=0;step<Math.abs(offset);step++)await act(async()=>calendar.querySelector(`[aria-label="${offset<0?'Previous':'Next'} month"]`).click());
     await act(async()=>calendar.querySelector('[aria-label="12 October 2026"]').click());
     await act(async()=>calendar.querySelector('[aria-label="12 October 2026"]').click());
    };
    await selectDate();assert.equal(host.querySelectorAll('tbody tr').length,1);
    assert.equal(host.querySelector('tbody tr td:nth-child(4)').textContent,'2026-10-12');
    const staffCell=host.querySelector('tbody tr td:nth-child(2)').textContent;assert.ok(staffCell.includes('Test staff'));
    await act(async()=>host.querySelector('[title="Reset allocation filters"]').click());assert.equal(host.querySelectorAll('tbody tr').length,2);
    await selectDate();
   }
   if(tab==='products'){
    assert.ok(host.querySelector('tbody tr td').textContent.includes('SKU-SECOND') && host.querySelector('tbody tr td').textContent.includes('Second item'),'Code and name share the first cell');
    assert.ok(!host.querySelector('table').textContent.includes('Selling price:'),'Product directory omits the selling price');
   }
   if(tab==='inventory-list') {
    assert.ok(!host.querySelector('thead').textContent.includes('COST PRICE'));
    assert.equal(toolbar.querySelectorAll('.inventory-full-label-filter').length,3,'Three inventory filters show full labels');
    assert.ok(toolbar.textContent.includes('All Brands') && toolbar.textContent.includes('All Categories') && toolbar.textContent.includes('All Stock Levels'));
    await act(async()=>toolbar.querySelector('[title="Filter by brand"]').click());
    await act(async()=>[...document.querySelectorAll('.modern-filter-options [role="option"]')].find(option=>option.textContent==='Brand 1').click());
    assert.equal(host.querySelectorAll('tbody tr').length,1);
    assert.match(host.querySelector('tbody tr td:nth-child(5)').textContent,/35\.00/,'A zero balance price falls back to the product selling price');
    const rowActions=host.querySelector('tbody tr td:last-child');
    assert.deepEqual([...rowActions.querySelectorAll('button')].map(button=>button.getAttribute('aria-label')),['Print Inventory']);
    assert.ok(rowActions.querySelector('button').classList.contains('erp-table-icon-action'));
    await act(async()=>rowActions.querySelector('button').click());
    assert.equal(host.querySelector('[role="dialog"]'),null,'Printing a row does not open its detail view');
    assert.ok(printed.includes('SKU-FIRST') && !printed.includes('SKU-SECOND') && !printed.includes('999991'),'Row print includes only the selected visible record');
    await act(async()=>host.querySelector('tbody tr').click());
    const popup=host.querySelector('[role="dialog"]');assert.ok(popup.classList.contains('purchase-inspection'));
    assert.ok(popup.textContent.includes('LKR 35.00'));
    assert.ok(!popup.textContent.includes('999991') && !popup.textContent.includes('Unit cost'));
    const field=label=>[...popup.querySelectorAll('dl>div')].find(row=>row.querySelector('dt').textContent===label).querySelector('dd').textContent;
    const value=field;
    assert.match(value('Available quantity'),/^17/);assert.match(value('Reserved quantity'),/^3/);
    assert.match(value('Minimum stock level'),/^0/,'A zero backend threshold is preserved');
    assert.ok(popup.querySelector('.purchase-inspection-details-card'));
    assert.equal(popup.querySelector('.purchase-inspection-table-toolbar'),null);
    assert.equal(popup.querySelector('table'),null);
    assert.ok(popup.querySelector('.purchase-inspection-header-controls [aria-label="Print Inventory"]'));
    assert.equal(popup.querySelector('[aria-label="Print Inventory"]').textContent.trim(),'Print');
    assert.equal(field('Warehouse code'),'WH-10','Warehouse code is resolved from the matching warehouse');
    assert.ok(!popup.textContent.includes('Potential Retail Revenue') && !popup.textContent.includes('Gross Margin') && !popup.textContent.includes('Manufacturer'));
    assert.ok(popup.querySelector('[aria-label="Close Inventory details"]'));
    const bottomClose=popup.querySelector('.inventory-stock-summary-footer button');assert.equal(bottomClose.textContent,'Close');
    assert.equal(bottomClose.closest('footer').parentElement,popup,'Close footer is outside the flexible summary content');
    await act(async()=>bottomClose.click());
    assert.equal(host.querySelector('[role="dialog"]'),null);
   }
   if(tab==='adjustments') {
    await act(async()=>host.querySelector('tbody tr').click());
    const view=host.querySelector('[aria-label="Stock adjustment details"]');assert.ok(view);
    assert.ok(view.classList.contains('record-details-compact'));
    const detail=label=>[...view.querySelectorAll('dl>div')].find(row=>row.querySelector('dt').textContent===label)?.querySelector('dd').textContent;
    assert.equal(detail('Record number'),'ADJ-30');assert.equal(detail('Quantity adjusted'),'+3');assert.equal(detail('Reason'),'Count correction');
    assert.equal(view.querySelector('[aria-label="Edit Adjustment"]'),null,'Read-only users cannot edit adjustments');
    await act(async()=>[...view.querySelectorAll('button')].find(button=>button.textContent.trim()==='Print').click());
    assert.ok(printed.includes('ADJ-30') && printed.includes('Count correction') && !printed.includes('<unsafe>'));
    await act(async()=>view.querySelector('[aria-label="Close stock adjustment details"]').click());
   }
   if(tab==='adjustments') {
    assert.ok(!toolbar.textContent.includes('All Reasons'));
    const date=toolbar.querySelector('[aria-label="Stock adjustment date range"]');assert.ok(date);assert.equal(date.parentElement.firstElementChild,date,'Date range is the first filter');
    assert.equal(host.querySelectorAll('tbody tr').length,2);
    await act(async()=>date.click());
    const calendar=document.querySelector('[aria-label="Choose Stock adjustment date range"]');assert.ok(calendar);
    const now=new Date(),offset=(2026-now.getFullYear())*12+9-now.getMonth();
    for(let step=0;step<Math.abs(offset);step++)await act(async()=>calendar.querySelector(`[aria-label="${offset<0?'Previous':'Next'} month"]`).click());
    await act(async()=>calendar.querySelector('[aria-label="12 October 2026"]').click());
    await act(async()=>calendar.querySelector('[aria-label="12 October 2026"]').click());
    assert.equal(host.querySelectorAll('tbody tr').length,1);assert.match(host.querySelector('tbody').textContent,/ADJ-30/);
   }
   const print=toolbar.querySelector('[title^="Print"]');assert.ok(print,`${tab}: print button present`);
   printed='';await act(async()=>print.click());assert.ok(printed.includes('<table>') && printed.includes('Total records'),`${tab}: prints a real report`);
   assert.ok(!printed.includes('999991') && !printed.includes('999992'),'Cost data hidden in the UI stays out of printed reports');
   if(tab==='inventory-list') {assert.ok(printed.includes('SKU-FIRST') && !printed.includes('SKU-SECOND'));assert.ok(printed.includes('&lt;unsafe&gt;') && !printed.includes('<unsafe>'));}
   if(tab==='adjustments') {assert.ok(printed.includes('ADJ-30') && !printed.includes('ADJ-OLD'));await act(async()=>toolbar.querySelector('[title="Reset all filters to default"]').click());assert.equal(host.querySelectorAll('tbody tr').length,2);}
  }
 } finally {await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];}
});
