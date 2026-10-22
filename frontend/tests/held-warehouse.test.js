import test from 'node:test';
import assert from 'node:assert/strict';
import {warehouseGroups,heldWarehouseHtml} from '../src/utils/heldWarehousePrint.js';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('25 held bill products print as three isolated warehouse sheets with safe content',()=>{
 const bill={heldNumber:'HLD-25',customerName:'<script>bad()</script>',createdBy:'cashier',assignedStaff:'reviewer',items:Array.from({length:25},(_,i)=>({id:i+1,warehouseId:i<10?1:i<15?2:3,warehouseName:`Warehouse ${i<10?1:i<15?2:3}`,productSku:`SKU-${i+1}`,productName:`Product ${i+1}`,quantity:2}))};
 assert.deepEqual(warehouseGroups(bill).map(g=>g.items.length),[10,5,10]);
 const html=heldWarehouseHtml(bill);assert.equal((html.match(/<section>/g)||[]).length,3);assert.equal((html.match(/<tr><td>/g)||[]).length,25);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/@page\{size:A4/);
 const warehouse=heldWarehouseHtml(bill,'2');assert.equal((warehouse.match(/<tr><td>/g)||[]).length,5);assert.ok(!warehouse.includes('SKU-1<'));assert.ok(!warehouse.includes('SKU-16<'));assert.match(warehouse,/SKU-11/);assert.ok(!warehouse.includes("Assigned staff"));
});

test('held details use GRN controls, filter warehouse sheets, and open the office review page',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');let retried=0,edited=null,printed=null;
  const bill={id:91,recordVersion:4,heldNumber:'HLD-25',status:'SENT_TO_WAREHOUSE',customerName:'Customer',createdBy:'cashier',assignedStaff:'reviewer',canResume:false,netTotal:500,items:Array.from({length:25},(_,i)=>({id:i+1,warehouseId:i<10?1:i<15?2:3,warehouseName:`Warehouse ${i<10?1:i<15?2:3}`,productSku:`SKU-${i+1}`,productName:`Product ${i+1}`,quantity:2,unitPrice:10,totalPrice:20}))};
  apis.salesApi.getHeldPrintJobs=async()=>({data:[{id:1,warehouseId:2,status:'FAILED',errorMessage:'Printer offline'}]});
  apis.salesApi.getById=async()=>({data:bill});apis.salesApi.retryHeldPrint=async()=>{retried++;return {data:{}};};
  apis.salesApi.printHeld=async(id,warehouse)=>{printed={id,warehouse};return {data:[]};};
  const {default:Details}=await server.ssrLoadModule('/src/components/HeldBillDetails.jsx');
  const props={bill,user:{username:'different-editor',permissions:['SALES_EDIT','INVENTORY_ADJUST']},onClose:()=>{},onChanged:()=>{},onEdit:saved=>{edited=saved;}};
  await act(async()=>root.render(React.createElement(Details,props)));
  assert.ok(host.querySelector('.purchase-inspection-details-card'));assert.equal(host.querySelector('[aria-label="Responsible staff username"]'),null);assert.equal(host.querySelectorAll('tbody tr').length,25);
  window.open=()=>({document:{write:()=>{},close:()=>{}},focus:()=>{},print:()=>{}});
  assert.equal(host.querySelector('.onhold-print-status'),null,'Server-side office printer status removed');
  await act(async()=>host.querySelector('[aria-label="Warehouse filter"]').click());
  await act(async()=>document.querySelector('[role="option"][data-value="2"]').click());assert.equal(host.querySelectorAll('tbody tr').length,5);
  await act(async()=>host.querySelector('[aria-label="Print warehouse sheets"]').click());assert.deepEqual(printed,{id:91,warehouse:'2'});
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Record Warehouse Adjustments')).click());assert.equal(edited.id,91);
  await act(async()=>root.render(React.createElement(Details,{...props,posOnly:true})));
  assert.ok(!host.textContent.includes('Record Warehouse Adjustments'),'POS staff never receive the office edit action');
  await act(async()=>root.render(React.createElement(Details,{...props,key:'original',bill:{...bill,originalCopy:true}})));
  assert.ok(!host.textContent.includes('Record Warehouse Adjustments'));assert.match(host.textContent,/Selling qty/);
 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const name of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[name];}
});

test('Onhold editor removes products and changes quantities across warehouse filters with inventory source evidence',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');let submitted=null,saved=false;
  const bill={id:92,recordVersion:7,heldNumber:'HLD-EDIT',status:'SENT_TO_WAREHOUSE',customerName:'Test customer',assignedStaff:'reviewer',netTotal:500,items:Array.from({length:25},(_,i)=>({id:i+1,productId:i+1,warehouseId:i<10?1:i<15?2:3,warehouseName:`Warehouse ${i<10?1:i<15?2:3}`,productSku:`SKU-${i+1}`,productName:`Product ${i+1}`,quantity:2,unitPrice:10,discountAmount:0,totalPrice:20}))};
  apis.salesApi.getHeldReviewLimits=async()=>({data:{limits:[],stock:bill.items.map(i=>({productId:i.productId,warehouseId:i.warehouseId,availableForBill:2,otherReserved:0}))}});
  apis.salesApi.reviewHeld=async(id,data)=>{submitted=data;return {data:{...bill,status:'STOCK_ADJUSTED'}};};
  const {default:Editor}=await server.ssrLoadModule('/src/views/OnholdBillEditor.jsx');
  await act(async()=>root.render(React.createElement(Editor,{bill,user:{permissions:['SALES_EDIT','INVENTORY_ADJUST']},onBack:()=>{},onSaved:()=>{saved=true;}})));
  assert.equal(host.querySelector('[role="dialog"]'),null,'Editing must use a page');assert.match(host.textContent,/Edit Onhold Bill HLD-EDIT/);
  await act(async()=>host.querySelector('[aria-label="Remove SKU-1"]').click());assert.ok(host.querySelector('[aria-label="Restore SKU-1"]'));
  const quantity=host.querySelector('[aria-label="Approved quantity SKU-2"]');await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(quantity,'1');quantity.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await act(async()=>host.querySelector('[aria-label="Review warehouse filter"]').click());await act(async()=>document.querySelector('[role="option"][data-value="2"]').click());assert.equal(host.querySelectorAll('tbody tr').length,5);
  const remarks=host.querySelector('textarea');await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(remarks,'Returned sheets checked');remarks.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Save review')).click());
  assert.ok(saved);assert.equal(submitted.items.length,25);assert.equal(submitted.expectedVersion,7);assert.equal(submitted.items[0].approvedQuantity,0);assert.equal(submitted.items[1].approvedQuantity,1);assert.ok(submitted.items.every(i=>i.physicalStock===null));
  const {default:Table}=await server.ssrLoadModule('/src/components/AdjustmentTable.jsx');
  await act(async()=>root.render(React.createElement(Table,{rows:[{id:1,recordNo:'ADJ-1',type:'Bill quantity',warehouse:'Warehouse 1',sourceHeldBillId:92,sourceHeldBillNumber:'HLD-EDIT',status:'PROCESSED'}],canEdit:true,onView:()=>{},onEdit:()=>{}})));
  assert.match(host.textContent,/Adjusted through/);assert.match(host.textContent,/Onhold Bill/);assert.match(host.textContent,/HLD-EDIT/);assert.equal(host.querySelector('[aria-label="Edit Adjustment"]'),null);
 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const name of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[name];}
});

 test('invoice lists individual merged bills with guarded cancel actions',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{const {default:Sources}=await server.ssrLoadModule('/src/components/MergedHeldBills.jsx');let cancelled=null,viewed=null;
 const bills=[{id:1,number:'HLD-A',amount:20,status:'INVOICE_CREATED',recordVersion:6},{id:2,number:'HLD-B',amount:30,status:'INVOICE_CREATED',recordVersion:7}];
 const props={bills,user:{permissions:['SALES_EDIT']},onView:b=>{viewed=b.id;},onCancel:b=>{cancelled=b;}};
 await act(async()=>root.render(React.createElement(Sources,props)));assert.equal(host.querySelectorAll('tbody tr').length,2);
 await act(async()=>host.querySelector('[aria-label="Cancel HLD-A from invoice"]').click());assert.equal(cancelled.id,1);assert.equal(cancelled.heldNumber,'HLD-A');assert.equal(cancelled.recordVersion,6);
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='HLD-B').click());assert.equal(viewed,2);
 await act(async()=>root.render(React.createElement(Sources,{...props,user:{permissions:['SALES_VIEW']}})));assert.equal(host.querySelector('[aria-label^="Cancel "]'),null);
 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const name of ['window','document','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[name];}
 });
