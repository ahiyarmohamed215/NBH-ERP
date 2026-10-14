import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('POS opens from invoicing, loads products, adds a priced item and exits',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try {
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');
  for(const [name,api] of Object.entries(apis))if(name.endsWith('Api') && api && typeof api==='object')for(const method of Object.keys(api))if(typeof api[method]==='function')api[method]=async()=>({data:[]});
  localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
  apis.authApi.getMe=async()=>({data:{username:'cashier',roles:['ROLE_CASHIER'],permissions:['SALES_CREATE']}});
  apis.warehouseApi.getActive=async()=>({data:[{id:1,code:'WH-1',name:'Main'}]});
  apis.customerApi.getActive=async()=>({data:[{id:1,name:'Walk-in customer',customerCode:'CUST-0001',creditLimit:0,currentBalance:0}]});
  apis.inventoryApi.getBalances=async()=>({data:{content:[{productId:1,warehouseId:1,quantity:10,availableQuantity:10}]}});
  apis.productApi.searchActive=async()=>({data:[{id:1,name:'POS test product',sku:'POS-1',sellingPrice:125,warehouseId:1}]});
  apis.customerMonthlyRangeApi.getCustomerProgress=async()=>({data:null});
  const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');const {default:Hub}=await server.ssrLoadModule('/src/views/InvoicingHub.jsx');
  await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(Hub)))));
  await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent.includes('Open POS')).click());
  assert.ok(host.querySelector('[title="Exit POS Mode (Esc)"]'));
  const search=host.querySelector('input[placeholder^="Search product code"]');assert.ok(search);
  await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(search,'POS-1');search.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await act(async()=>host.querySelector('[aria-label="Select POS test product"]').click());
  await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent.includes('Add to Table')).click());
  const row=[...host.querySelectorAll('tbody tr')].find(row=>row.textContent.includes('POS test product'));assert.ok(row);assert.match(row.textContent,/125\.00/);
  await act(async()=>host.querySelector('[title="Exit POS Mode (Esc)"]').click());
  assert.ok([...host.querySelectorAll('button')].some(button=>button.textContent.includes('Open POS')));
 } finally {await act(async()=>new Promise(resolve=>setTimeout(resolve,5100)));await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const name of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[name];}
});
