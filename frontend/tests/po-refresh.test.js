import test from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('PO refresh updates records when supporting product data fails', async () => {
  const window = new Window();
  Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');
  const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try {
    const apis=await server.ssrLoadModule('/src/api/apiClient.js');
    for(const [name,api] of Object.entries(apis)) if(name.endsWith('Api') && api && typeof api==='object')
      for(const method of Object.keys(api)) if(typeof api[method]==='function') api[method]=async()=>({data:[]});
    let refreshing=false,productsFail=true,release;
    const check=config=>{if(refreshing) assert.deepEqual(config,{skipCache:true,skipDedupe:true});};
    apis.purchaseOrderApi.search=async(params,config)=>{
      check(config);
      if(refreshing) await new Promise(resolve=>{release=resolve;});
      return {data:{content:[{id:1,poNumber:refreshing?'PO-NEW':'PO-OLD',status:'DRAFT',createdAt:'2026-10-12T10:00:00',items:[]}]}};
    };
    apis.productApi.getProducts=async(params,config)=>{check(config);if(refreshing && productsFail) throw new Error('Product service unavailable');return {data:[]};};
    apis.supplierApi.getActive=async config=>{check(config);return {data:[]};};
    apis.warehouseApi.getActive=async config=>{check(config);return {data:[]};};
    apis.inventoryApi.getBalances=async(params,config)=>{check(config);return {data:[]};};
    const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const {default:View}=await server.ssrLoadModule('/src/views/PurchaseOrdersView.jsx');
    await act(async()=>root.render(React.createElement(ToastProvider,null,React.createElement(View))));
    assert.ok(host.textContent.includes('PO-OLD'));
    refreshing=true;
    const button=host.querySelector('button[aria-label="Refresh records"]');
    await act(async()=>button.click());
    assert.equal(button.disabled,true);
    assert.equal(button.getAttribute('aria-busy'),'true');
    assert.ok(button.querySelector('.animate-spin'));
    assert.ok(host.querySelector('tbody').textContent.includes('Loading purchase orders'));
    assert.ok(!host.querySelector('tbody').textContent.includes('PO-OLD'),'Old rows are hidden during refresh');
    await act(async()=>release());
    assert.ok(host.textContent.includes('PO-NEW'));
    assert.ok(!host.textContent.includes('PO-OLD'));
    assert.equal(button.disabled,false);
    assert.ok(document.body.textContent.includes('could not refresh products'));
    productsFail=false;
    await act(async()=>button.click());assert.equal(button.disabled,true);
    await act(async()=>release());assert.equal(button.disabled,false);
    assert.ok(!document.body.textContent.includes('Purchase orders refreshed.'),'Successful refresh is silent');

  } finally {
    await act(async()=>root.unmount());await server.close();window.happyDOM.abort();
  }
});
