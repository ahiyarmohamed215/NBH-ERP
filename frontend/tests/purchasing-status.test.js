import test from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('Supplier and GRN status actions wait for a reason and preserve state on dismissal or failure',async()=>{
  const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  try {
    const apis=await server.ssrLoadModule('/src/api/apiClient.js');
    for(const [name,api] of Object.entries(apis)) if(name.endsWith('Api') && api && typeof api==='object') for(const method of Object.keys(api)) if(typeof api[method]==='function') api[method]=async()=>({data:[]});
    localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
    apis.authApi.getMe=async()=>({data:{username:'admin',roles:['ROLE_ADMIN'],permissions:[]}});
    let supplier={id:1,supplierCode:'SUP-1',name:'Test supplier',isActive:true},toggleCalls=0,fail=true;
    apis.supplierApi.getAll=async()=>({data:[{...supplier}]});
    apis.supplierApi.toggleActive=async(id,reason)=>{assert.equal(id,1);assert.equal(reason,'Account paused for review');toggleCalls++;if(fail) throw new Error('Status update failed');supplier={...supplier,isActive:!supplier.isActive};return {data:null};};
    const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const render=async(View,props={})=>act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(View,props)))));
    const {default:Masters}=await server.ssrLoadModule('/src/views/MastersView.jsx');await render(Masters,{activeSubTab:'suppliers',isStandalone:true,allowedTabs:['suppliers']});
    const enterReason=async(dialog,reason)=>act(async()=>{const textarea=dialog.querySelector('textarea');Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(textarea,reason);textarea.dispatchEvent(new window.Event('input',{bubbles:true}));});
    const confirmButton=dialog=>[...dialog.querySelectorAll('button')].find(button=>button.textContent==='Confirm status change');
    const row=[...host.querySelectorAll('tbody tr')].find(row=>row.textContent.includes('SUP-1'));assert.ok(row);
    await act(async()=>row.querySelector('[title^="Status:"]').click());let dialog=host.querySelector('[aria-label="Change Supplier status"]');assert.ok(dialog);assert.equal(toggleCalls,0);assert.equal(confirmButton(dialog).disabled,true);
    await act(async()=>[...dialog.querySelectorAll('button')].find(button=>button.textContent==='Back').click());assert.equal(toggleCalls,0);assert.equal(supplier.isActive,true);
    await act(async()=>row.click());const viewing=host.querySelector('.glass-modal');assert.ok(viewing);
    await act(async()=>viewing.querySelector('[title^="Status:"]').click());dialog=host.querySelector('[aria-label="Change Supplier status"]');
    await enterReason(dialog,'   ');assert.equal(confirmButton(dialog).disabled,true);
    await enterReason(dialog,'Account paused for review');await act(async()=>confirmButton(dialog).click());assert.equal(toggleCalls,1);assert.equal(supplier.isActive,true);assert.ok(host.querySelector('[aria-label="Change Supplier status"]'));assert.ok(viewing.querySelector('[title^="Status: Active"]'));
    fail=false;await act(async()=>confirmButton(dialog).click());assert.equal(toggleCalls,2);assert.equal(supplier.isActive,false);assert.equal(host.querySelector('[aria-label="Change Supplier status"]'),null);assert.ok(viewing.querySelector('[title^="Status: Inactive"]'));
    let grn={id:5,grnNumber:'GRN-5',status:'DRAFT',supplierName:'Test supplier',receivedDate:'2026-10-12',items:[{productId:1,productSku:'P-1',productName:'Product',quantityReceived:2,unitCost:4}]},processCalls=0;
    apis.grnApi.search=async()=>({data:{content:[grn]}});apis.grnApi.getById=async()=>({data:grn});
    apis.grnApi.process=async(id,reason)=>{assert.equal(id,5);assert.equal(reason,'Delivery verified');processCalls++;grn={...grn,status:'PROCESSED'};return {data:grn};};
    apis.grnApi.cancel=async(id,data)=>{assert.equal(data.reason,'Incorrect receipt');grn={...grn,status:'CANCELLED'};return {data:grn};};
    const {default:Grn}=await server.ssrLoadModule('/src/views/GrnView.jsx');await render(Grn);
    await act(async()=>host.querySelector('tbody tr').click());const action=text=>[...host.querySelectorAll('.purchase-inspection-actions button')].find(button=>button.textContent.trim()===text);
    await act(async()=>action('Process GRN').click());dialog=host.querySelector('[aria-label="Change GRN status"]');assert.ok(dialog);assert.equal(processCalls,0);assert.equal(grn.status,'DRAFT');assert.equal(confirmButton(dialog).disabled,true);
    await enterReason(dialog,'Delivery verified');await act(async()=>confirmButton(dialog).click());assert.equal(processCalls,1);assert.equal(grn.status,'PROCESSED');
    await act(async()=>action('Cancel GRN').click());const cancellation=host.querySelector('textarea[placeholder^="Enter cancellation reason"]');assert.ok(cancellation);
    await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(cancellation,'Incorrect receipt');cancellation.dispatchEvent(new window.Event('input',{bubbles:true}));});
    await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Confirm Cancellation').click());assert.equal(grn.status,'CANCELLED');
    await act(async()=>action('Reprocess GRN').click());dialog=host.querySelector('[aria-label="Change GRN status"]');assert.ok(dialog);assert.equal(confirmButton(dialog).disabled,true);
    await enterReason(dialog,'Delivery verified');await act(async()=>confirmButton(dialog).click());assert.equal(processCalls,2);assert.equal(grn.status,'PROCESSED');
  } finally {await act(async()=>new Promise(resolve=>setTimeout(resolve,5100)));await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];}
});
