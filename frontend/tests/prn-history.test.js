import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('PRN shows purchase history for adjusted stock and shares its remaining quantity across warehouses',async()=>{
  const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  try {
    const apis=await server.ssrLoadModule('/src/api/apiClient.js');
    for(const [name,api] of Object.entries(apis)) if(name.endsWith('Api') && api && typeof api==='object') for(const method of Object.keys(api)) if(typeof api[method]==='function') api[method]=async()=>({data:[]});
    apis.productApi.getProducts=async()=>({data:[{id:1,sku:'ADJ-P',name:'Adjusted product',costPrice:99}]});
    apis.warehouseApi.getActive=async()=>({data:[{id:1,name:'Original warehouse'},{id:2,name:'Adjusted warehouse'}]});
    apis.inventoryApi.getBalances=async()=>({data:[{productId:1,warehouseId:1,quantity:10},{productId:1,warehouseId:2,quantity:10}]});
    apis.prnApi.getReturnSources=async()=>({data:[1,2].map(warehouseId=>({productId:1,sourceGrnId:7,originalGrnNumber:'GRN-7',supplierId:8,supplierName:'Historical supplier',warehouseId,warehouseName:warehouseId===1?'Original warehouse':'Adjusted warehouse',costPrice:4,sellingPrice:4,returnableQuantity:5}))});
    const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');const {default:View}=await server.ssrLoadModule('/src/views/PrnView.jsx');const ref=React.createRef();
    await act(async()=>root.render(React.createElement(ToastProvider,null,React.createElement(View,{ref}))));await act(async()=>ref.current.openCreate());
    const search=host.querySelector('.purchase-product-search input');
    await act(async()=>search.focus());
    await act(async()=>[...host.querySelectorAll('[role="option"]')].find(option=>option.textContent.includes('Adjusted warehouse')).click());
    const card=host.querySelector('.prn-return-card');assert.ok(card.textContent.includes('GRN-7'));assert.ok(card.textContent.includes('Historical supplier'));assert.ok(card.textContent.includes('Adjusted warehouse'));assert.ok(card.textContent.includes('LKR 4.00'));
    const setInput=async(input,value)=>act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});
    const reason=[...host.querySelectorAll('label')].find(label=>label.textContent.startsWith('Return reason')).querySelector('input');
    await setInput(reason,'Damaged');await setInput(host.querySelector('.purchase-entry-fields input'),'3');await act(async()=>host.querySelector('.purchase-entry > .btn').click());
    assert.equal(host.querySelectorAll('tbody tr').length,1);
    await act(async()=>{search.blur();search.focus();});
    const original=[...host.querySelectorAll('[role="option"]')].find(option=>option.textContent.includes('Original warehouse'));
    assert.ok(original.textContent.includes('Available: 2'),'The same GRN has only two units left even in another warehouse');
  } finally {await act(async()=>root.unmount());await server.close();await window.happyDOM.close();}
});
