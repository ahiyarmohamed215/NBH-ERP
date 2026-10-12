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
  apis.authApi.getMe=async()=>({data:{username:'inventory-clerk',roles:['ROLE_USER'],permissions:['INVENTORY_VIEW']}});
  const products=[{id:1,sku:'SKU-FIRST',name:'First item <unsafe>',costPrice:999991,sellingPrice:35,isActive:true,defaultWarehouseId:10,defaultWarehouseName:'North'},
    {id:2,sku:'SKU-SECOND',name:'Second item',costPrice:999992,sellingPrice:45,isActive:true,defaultWarehouseId:20,defaultWarehouseName:'South'}];
  apis.productApi.getProducts=async()=>({data:{content:products}});
  apis.warehouseApi.getAll=async()=>({data:[{id:10,code:'WH-10',name:'North',isActive:true},{id:20,code:'WH-20',name:'South',isActive:true}]});
  apis.brandApi.getAll=async()=>({data:[{id:1,code:'BRAND-1',name:'Test brand',markupPercent:25,isActive:true}]});
  apis.categoryApi.getAll=apis.categoryApi.getActive=async()=>({data:[{id:1,code:'CAT-1',name:'Test category',isActive:true}]});
  apis.inventoryApi.getBalances=async()=>({data:{content:products.map(product=>({productId:product.id,productSku:product.sku,productName:product.name,warehouseId:product.defaultWarehouseId,warehouseName:product.defaultWarehouseName,quantity:20,costPrice:product.costPrice,sellingPrice:product.sellingPrice}))}});
  apis.adjustmentApi.search=async()=>({data:{content:[{id:30,adjustmentNumber:'ADJ-30',adjustmentDate:'2026-10-12',warehouseName:'North',items:[{productId:1,productSku:'SKU-FIRST',productName:products[0].name,differenceQuantity:3,reason:'Count correction'}]}]}});
  apis.staffQuotaApi.search=async()=>({data:{content:[{id:40,productSku:'SKU-FIRST',productName:products[0].name,userFullName:'Test staff',username:'staff',allocatedQuantity:2,totalStockAvailable:20,isActive:true}]}});
  apis.staffQuotaApi.getSummary=async()=>({data:null});
  let printed='';window.open=()=>({document:{open(){},write(html){printed=html;},close(){}}});
  const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');const {default:Inventory}=await server.ssrLoadModule('/src/views/InventoryHub.jsx');
  for(const tab of ['inventory-list','pos-quotas','products','brands','warehouses','categories','adjustments']) {
   await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(Inventory,{key:tab,activeSubTab:tab})))));
   const toolbar=host.querySelector('.inventory-toolbar,.master-toolbar');assert.ok(toolbar);
   assert.equal(toolbar.querySelector('[title^="Export"]'),null,`${tab}: print replaces CSV export`);
   if(tab==='inventory-list') {
    assert.ok(!host.querySelector('thead').textContent.includes('COST PRICE'));
    await act(async()=>toolbar.querySelector('[aria-label="Filter by warehouse"]').click());
    await act(async()=>[...document.querySelectorAll('.modern-filter-options [role="option"]')].find(option=>option.textContent==='North').click());
    assert.equal(host.querySelectorAll('tbody tr').length,1);
   }
   const print=toolbar.querySelector('[title^="Print"]');assert.ok(print,`${tab}: print button present`);
   printed='';await act(async()=>print.click());assert.ok(printed.includes('<table>') && printed.includes('Total records'),`${tab}: prints a real report`);
   assert.ok(!printed.includes('999991') && !printed.includes('999992'),'Cost data hidden in the UI stays out of printed reports');
   if(tab==='inventory-list') {assert.ok(printed.includes('SKU-FIRST') && !printed.includes('SKU-SECOND'));assert.ok(printed.includes('&lt;unsafe&gt;') && !printed.includes('<unsafe>'));}
  }
 } finally {await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];}
});
