import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('range dashboard shows load errors, retries and supports read-only refresh without a sync mutation',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try {
  const {customerMonthlyRangeApi:api}=await server.ssrLoadModule('/src/api/apiClient.js');let fail=true,loads=0,syncs=0;
  api.getManagerDashboard=async()=>{loads++;if(fail)throw new Error('Unable to load ranges');return {data:{totalActiveCustomers:1,totalElements:1,totalPages:1,customers:[{customerId:1,customerName:'Dashboard customer',customerCode:'CUSTOMER-01',monthlyPurchases:120000,currentRangeCode:'RANGE_1',currentRangeName:'Range 1',remainingAmount:30000,progressPercentage:80,nextRangeName:'Range 2',nextTargetAmount:150000}],configuredRanges:[]}};};
  api.syncMonth=async()=>{syncs++;return {data:null};};
  const {default:Hub}=await server.ssrLoadModule('/src/views/CustomerMonthlyRangeHub.jsx');
  await act(async()=>root.render(React.createElement(Hub,{canEdit:false,salesmen:[{id:1,name:'Staff'}]})));
  assert.ok(host.querySelector('[role="alert"]').textContent.includes('Unable to load ranges'));assert.ok(!host.textContent.includes('No customers found matching'));
  fail=false;await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Retry loading customer ranges').click());
  assert.equal(host.querySelector('[role="alert"]'),null);assert.ok(host.querySelector('tbody').textContent.includes('Dashboard customer'));assert.ok(host.querySelector('tbody').textContent.includes('120,000'));
  const before=loads;await act(async()=>host.querySelector('[title="Refresh customer ranges"]').click());assert.ok(loads>before);assert.equal(syncs,0);
  await act(async()=>root.render(React.createElement(Hub,{canEdit:true,salesmen:[{id:1,name:'Staff'}]})));await act(async()=>host.querySelector('[title="Synchronize & Recalculate Month"]').click());assert.equal(syncs,1);
 } finally {await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
