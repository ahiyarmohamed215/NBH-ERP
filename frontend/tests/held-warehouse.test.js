import test from 'node:test';
import assert from 'node:assert/strict';
import {warehouseGroups,heldWarehouseHtml} from '../src/utils/heldWarehousePrint.js';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('25 held bill products print as three isolated warehouse sheets with safe content',()=>{
 const bill={heldNumber:'HLD-25',customerName:'<script>bad()</script>',createdBy:'cashier',assignedStaff:'reviewer',items:Array.from({length:25},(_,i)=>({id:i+1,warehouseId:i<10?1:i<15?2:3,warehouseName:`Warehouse ${i<10?1:i<15?2:3}`,productSku:`SKU-${i+1}`,productName:`Product ${i+1}`,quantity:2}))};
 assert.deepEqual(warehouseGroups(bill).map(g=>g.items.length),[10,5,10]);
 const html=heldWarehouseHtml(bill);assert.equal((html.match(/<section>/g)||[]).length,3);assert.equal((html.match(/<tr><td>/g)||[]).length,25);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/@page\{size:A4/);assert.doesNotMatch(html,/Total physical stock|total physical stock count/);
 const warehouse=heldWarehouseHtml(bill,'2');assert.equal((warehouse.match(/<tr><td>/g)||[]).length,5);assert.ok(!warehouse.includes('SKU-1<'));assert.ok(!warehouse.includes('SKU-16<'));assert.match(warehouse,/SKU-11/);assert.ok(!warehouse.includes("Assigned staff"));
 assert.equal((html.match(/Packing counts/g)||[]).length,3);
 for(const label of ['Box','Bag','P. Bag','Others'])assert.match(warehouse,new RegExp(`<span class="packing-label">${label.replace('.','\\.')}:</span>`));
 assert.match(html,/Confidential/);assert.match(html,/Checked by \/ warehouse keeper/);assert.match(html,/thead\{display:table-header-group\}/);
 const reprint=heldWarehouseHtml({...bill,warehousePacking:{2:{boxes:4,bags:0,pBags:2,others:1}}},'2');assert.match(reprint,/<div class="packing-val">4<\/div>/);
 assert.match(heldWarehouseHtml({ ...bill, status: 'YET_TO_PRINT' }), /Sent to warehouse/);
 assert.match(heldWarehouseHtml({ ...bill, status: 'SENT_TO_WAREHOUSE' }), /Sent to warehouse/);
 assert.doesNotMatch(html, /Gate \/ Signature/);
 assert.doesNotMatch(html, /Warehouse Supervisor/);
 assert.doesNotMatch(html, /Not a tax invoice/);
 assert.match(html, /Start time/);
 assert.match(html, /Name &amp; Signature/);
 assert.match(html, /sig-name-label/);
 assert.match(html, /sig-detail-label/);
 assert.match(html, /Page 1 of 1/);
 assert.match(html, /<strong>Remarks<\/strong>/);
 assert.match(html, /warehouse-highlight-badge/);
 assert.doesNotMatch(html, /warehouse-highlight-badge[^>]*>\s*<span class="status-dot">/);
 assert.doesNotMatch(html, /WAREHOUSE:/);
 assert.match(html, /Customer details/);
 assert.doesNotMatch(html, /Customer address|Code:/);
 assert.match(warehouse, /WAREHOUSE 2/);
 assert.match(html, /<th>Requested qty<\/th>/);
 assert.equal((html.match(/style="width:2cm"/g)||[]).length,6);
 assert.match(html, /style="width:0.7cm"/);
 assert.doesNotMatch(html, /<th>Remarks<\/th>/);
 assert.match(html, /style="width:3.3cm"/);
 assert.match(html, /total-remarks-cell/);
 const multiBill = { heldNumber: 'HLD-MULTI', customerName: 'Customer', createdBy: 'cashier', items: Array.from({ length: 25 }, (_, i) => ({ id: i + 1, warehouseId: 1, warehouseName: 'Warehouse 1', productSku: `SKU-${i+1}`, productName: `Product ${i+1}`, quantity: 2 })) };
 const multiHtml = heldWarehouseHtml(multiBill);
 assert.equal((multiHtml.match(/<section>/g) || []).length, 2);
 assert.equal((multiHtml.match(/<header class="document-header">/g) || []).length, 2);
 assert.doesNotMatch(multiHtml, /Page quantity/);
 assert.match(multiHtml, /Total quantity/);
 assert.match(multiHtml, /height:0.8cm/);
 assert.doesNotMatch(multiHtml, /upper-packing|width:2in/);
});

test('warehouse collection sheets keep eighteen products with full sign-off on every page', () => {
 for (const count of [1, 17, 18, 19, 25, 35, 36, 37]) {
  const bill = {heldNumber: 'HLD-PAGES', warehouseId: 1, warehouseName: 'Main warehouse',
   customerName: 'Page customer', customerCode: 'CUS-01', customerAddress: 'Colombo', createdBy: 'sales',
   items: Array.from({length: count}, (_, i) => ({productSku: `SKU-${i + 1}`, productName: `Product ${i + 1}`, quantity: 2}))};
  const window = new Window();
  window.document.write(heldWarehouseHtml(bill));
  const sheets = [...window.document.querySelectorAll('section')];
  assert.equal(sheets.length, Math.ceil(count / 18));
  const printedSkus = [];
  sheets.forEach((sheet, page) => {
   const rows = [...sheet.querySelectorAll('tbody tr:not(.fill-row)')];
   assert.equal(rows.length, Math.min(18, count - page * 18));
   assert.equal(sheet.querySelectorAll('tbody tr').length, 18);
   rows.forEach((row, i) => assert.equal(row.cells[0].textContent, String(page * 18 + i + 1)));
   printedSkus.push(...rows.map(row => row.querySelector('.product-code').textContent));
   assert.match(sheet.querySelector('header').textContent, /HLD-PAGES/);
   assert.match(sheet.querySelector('.document-meta').textContent, /Page customer/);
   const customer=sheet.querySelector('.meta-customer');
   assert.equal(customer.querySelector('.meta-label').textContent,'Customer details');
   assert.equal(customer.querySelector('.customer-identity .meta-sub').textContent,'CUS-01');
   assert.equal(customer.querySelector('.customer-identity .meta-value').textContent,'Page customer');
   assert.equal(customer.querySelector('.meta-address-val').textContent,'Colombo');
   assert.deepEqual([...sheet.querySelectorAll('.meta-staff .meta-label')].map(label=>label.textContent),['Prepared by','Billed at']);
   assert.match(sheet.querySelector('.document-footer').textContent, new RegExp(`Page ${page + 1} of ${sheets.length}`));
   assert.equal(sheet.querySelectorAll('.packing-box').length, 4);
   assert.deepEqual([...sheet.querySelectorAll('.packing-label')].map(label => label.textContent), ['Box:', 'Bag:', 'P. Bag:', 'Others:']);
   assert.equal(sheet.querySelector('.packing-instructions'), null);
   assert.equal(sheet.querySelector('.packing-caption').textContent, 'Package quantities');
   assert.ok(sheet.innerHTML.indexOf('packing-panel') < sheet.innerHTML.indexOf('<table>'));
   assert.ok(sheet.querySelector('.upper-grid > .packing-panel'));
   const roles = [...sheet.querySelectorAll('.sig-name-block')];
   assert.equal(roles.length, 2);
   assert.match(roles[0].textContent, /Collected by/);
   assert.match(roles[1].textContent, /Checked by/);
   assert.equal(sheet.querySelectorAll('.sig-detail').length, 6);
   for (const role of roles) {
    assert.equal(role.firstElementChild.className, 'sig-details-row');
    assert.deepEqual([...role.querySelectorAll('.sig-detail-label')].map(label => label.textContent), ['Start time', 'End time', 'Date']);
    for (const field of role.querySelectorAll('.sig-detail')) assert.ok(field.querySelector('.sig-detail-box'));
   }
  });
  assert.deepEqual(printedSkus, bill.items.map(item => item.productSku));
  window.happyDOM.abort();
 }
});

test('saved time stays distinct from generated time and both use Sri Lanka AM/PM', t => {
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-24T14:35:00Z').getTime()});
 const bill={heldNumber:'HLD-TIME',warehouseId:1,warehouseName:'Main',createdAt:'2026-10-23T08:10:00',heldSavedAt:'2026-10-24T15:45:00',items:[{productName:'Product',quantity:1}]};
 const page = value => {const window=new Window();window.document.write(heldWarehouseHtml(value));return window;};
 const savedText = window => [...window.document.querySelectorAll('.meta-card')].find(card=>card.querySelector('.meta-label').textContent==='Billed at').querySelector('.meta-value').textContent;
 const current=page(bill);
 assert.match(savedText(current),/24 Oct 2026,? 03:45\s+PM/);
 assert.match(current.document.querySelector('.document-footer').textContent,/Generated 24 Oct 2026,? 08:05\s+PM/);
 current.happyDOM.abort();
 const legacy=page({...bill,heldSavedAt:null});
 assert.match(savedText(legacy),/23 Oct 2026,? 08:10\s+AM/);
 legacy.happyDOM.abort();
 const midnight=page({...bill,heldSavedAt:'2026-10-23T18:30:00Z'});
 assert.match(savedText(midnight),/24 Oct 2026,? 12:00\s+AM/);
 midnight.happyDOM.abort();
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
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Warehouse Review')).click());assert.equal(edited.id,91);
  await act(async()=>root.render(React.createElement(Details,{...props,posOnly:true})));
  assert.ok(!host.textContent.includes('Warehouse Review'),'POS staff never receive the office edit action');
  await act(async()=>root.render(React.createElement(Details,{...props,key:'original',bill:{...bill,originalCopy:true}})));
  assert.ok(!host.textContent.includes('Warehouse Review'));assert.match(host.textContent,/Selling qty/);
 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const name of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[name];}
});

test('Warehouse review removes products and changes quantities without physical stock inputs',async()=>{
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
  assert.equal(host.querySelector('[role="dialog"]'),null,'Editing must use a page');assert.match(host.textContent,/Warehouse Review/);assert.match(host.textContent,/HLD-EDIT/);
  await act(async()=>host.querySelector('[aria-label="Remove SKU-1"]').click());assert.ok(host.querySelector('[aria-label="Restore SKU-1"]'));
  const quantity=host.querySelector('[aria-label="Approved quantity SKU-2"]');await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(quantity,'1');quantity.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await act(async()=>host.querySelector('[aria-label="Review warehouse filter"]').click());await act(async()=>document.querySelector('[role="option"][data-value="2"]').click());assert.equal(host.querySelectorAll('tbody tr').length,5);
  assert.equal(host.querySelector('textarea'),null);
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Save review')).click());
  assert.ok(saved);assert.equal(submitted.items.length,25);assert.equal(submitted.expectedVersion,7);assert.equal(submitted.items[0].approvedQuantity,0);assert.equal(submitted.items[1].approvedQuantity,1);assert.ok(submitted.items.every(i=>!('physicalStock' in i)));
  assert.ok(!host.textContent.includes('Total physical stock'));
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
