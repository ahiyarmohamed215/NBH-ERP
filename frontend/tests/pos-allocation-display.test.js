import test from 'node:test';import assert from 'node:assert/strict';import React,{act} from 'react';import {createServer} from 'vite';import {Window} from 'happy-dom';
test('POS catalog and quantity entry use the signed-in staff allocation with physical-stock fallback',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{const apis=await server.ssrLoadModule('/src/api/apiClient.js');for(const [name,api] of Object.entries(apis))if(name.endsWith('Api') && api && typeof api==='object')for(const key of Object.keys(api))if(typeof api[key]==='function')api[key]=async()=>({data:[]});
 apis.setAccessToken(`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
 apis.authApi.getMe=async()=>({data:{id:4,username:'cashier',permissions:['SALES_CREATE']}});
 let assigned=true;let customer={id:1,name:'Credit customer',creditLimit:25,currentBalance:0};apis.customerApi.getPosCustomers=async()=>({data:assigned?[customer]:[]});
 apis.warehouseApi.getActive=async()=>({data:[{id:1,name:'Allocated warehouse'},{id:2,name:'Other warehouse'}]});
 apis.productApi.searchActive=async()=>({data:[{id:1,name:'Allocated product',sku:'A1',sellingPrice:10,warehouseId:2},{id:2,name:'Unallocated product',sku:'A2',sellingPrice:10,warehouseId:1}]});
 apis.inventoryApi.getBalances=async()=>({data:{content:[{productId:1,warehouseId:1,quantity:10},{productId:1,warehouseId:2,quantity:20},{productId:2,warehouseId:1,quantity:8}]}});
 apis.salesApi.getPosStockLimits=async()=>({data:[{productId:1,warehouseId:1,remainingQuantity:3}]});
 apis.customerApi.getActive=async()=>({data:[{id:99,name:'Unassigned customer'}]});
 const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');const {default:POS}=await server.ssrLoadModule('/src/views/PosView.jsx');
 await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(POS,{onExitPos:()=>{}})))));
 const allocated=()=>host.querySelector('[aria-label="Select Allocated product"]');assert.match(allocated().textContent,/Low Stock \(3\)/);assert.match(host.querySelector('[aria-label="Select Unallocated product"]').textContent,/In Stock \(8\)/);
 await act(async()=>allocated().click());
 const qty=host.querySelector('input[placeholder="Qty"]') || [...host.querySelectorAll('input[type="number"]')][0];assert.ok(qty);
 const fill=async value=>act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(qty,value);qty.dispatchEvent(new window.Event('input',{bubbles:true}));});
 await fill('4');const add=()=>[...host.querySelectorAll('button')].find(button=>button.textContent.trim()==='Add Product');assert.ok(add().disabled,'Cannot add more than the allocated quantity');
 await fill('2');await act(async()=>add().click());assert.equal(host.querySelectorAll('.pos-cart-table tbody tr').length,1);assert.match(allocated().textContent,/Low Stock \(1\)/);assert.match(host.querySelector('.pos-cart-table tbody').textContent,/Allocated product/);
 const customerSearch=host.querySelector('[placeholder="Select Customer (F1)..."]');await act(async()=>customerSearch.focus());assert.ok(!host.textContent.includes('Unassigned customer'));await act(async()=>customerSearch.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
 await act(async()=>host.querySelector('[aria-label="Select Unallocated product"]').click());await act(async()=>add().click());assert.equal(host.querySelectorAll('.pos-cart-table tbody tr').length,2,'Products exceeding remaining credit can be added to an on-hold bill');
 customer={...customer,creditLimit:0,currentBalance:100000};await act(async()=>window.dispatchEvent(new window.CustomEvent('erp:payments_updated')));await act(async()=>new Promise(resolve=>setTimeout(resolve,450)));
 assert.equal(host.querySelector('.pos-finance-credit strong').textContent,'No limit');await act(async()=>add().click());assert.equal(host.querySelectorAll('.pos-cart-table tbody tr').length,2,'Zero credit limit permits billing even with outstanding dues');
 customer={...customer,creditLimit:100,currentBalance:100};await act(async()=>window.dispatchEvent(new window.CustomEvent('erp:payments_updated')));await act(async()=>new Promise(resolve=>setTimeout(resolve,450)));
 await act(async()=>allocated().click());assert.equal(host.querySelector('[aria-label="Select Allocated product"]').getAttribute('aria-disabled'),'false');assert.match(host.querySelector('.pos-credit-block').textContent,/Credit limit reached/);assert.equal(add().disabled,false);

 assigned=false;await act(async()=>window.dispatchEvent(new window.CustomEvent('erp:customers_updated')));await act(async()=>new Promise(resolve=>setTimeout(resolve,450)));
 assert.equal(host.querySelector('[title="Save bill to Onhold Bills"]').disabled,true,'Assignment removal blocks the currently selected customer');

 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
