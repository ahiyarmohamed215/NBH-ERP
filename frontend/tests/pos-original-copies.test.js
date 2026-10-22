import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('POS Onhold list and details use immutable copies after office quantities change',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const {salesApi}=await server.ssrLoadModule('/src/api/apiClient.js');let liveReads=0,workspaceReads=0;
  const original={id:7,heldNumber:'HLD-ORIGINAL',status:'STOCK_ADJUSTED',originalCopy:true,canResume:true,createdBy:'cashier',createdByName:'Nimal Perera',createdByEmployeeCode:'EMP-0042',customerName:'Original customer',notes:'Deliver after 3 pm\nWarehouse review: Checked',posRemarks:'Deliver after 3 pm',netTotal:250,items:[{id:1,productSku:'P-1',productName:'Original product',warehouseId:1,warehouseName:'Main',quantity:2,unitPrice:150,discountRate:0,discountAmount:50,totalPrice:250}]};
  const scopes=[];const other={...original,id:8,heldNumber:'HLD-OTHER',createdBy:'other-cashier'};
  salesApi.getHeldOriginals=async params=>{scopes.push(params.scope);return {data:{bills:params.scope==='all'?[original,other]:params.scope==='others'?[other]:[original],mineCount:1,mineAmount:250,othersCount:1,othersAmount:250}};};
  salesApi.getHeldWorkspace=async params=>{assert.equal(params.history,true);workspaceReads++;return {data:{bills:[{...original,originalCopy:false,status:'INVOICE_CREATED',netTotal:125,items:[{...original.items[0],quantity:1,totalPrice:125}]}]}};};
  salesApi.getById=async()=>{liveReads++;return {data:{...original,netTotal:125,items:[{...original.items[0],quantity:1,totalPrice:125}]}};};
  const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');const {default:Held}=await server.ssrLoadModule('/src/components/PosHeldBills.jsx');
  await act(async()=>root.render(React.createElement(ToastProvider,null,React.createElement(Held,{user:{username:'cashier',permissions:['SALES_CREATE']},onClose:()=>{}}))));
  await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
  assert.equal(scopes[0],'mine','My bills remains the default');
  await act(async()=>document.querySelector('[aria-label="Onhold bill owner"]').click());
  assert.deepEqual([...document.querySelectorAll('[role="option"]')].map(option=>option.getAttribute('data-value')),['mine','others','all']);
  await act(async()=>document.querySelector('[role="option"][data-value="all"]').click());
  await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
  assert.equal(scopes.at(-1),'all');assert.equal(document.querySelectorAll('tbody tr').length,2);
  await act(async()=>document.querySelector('[title="Reset all filters to default"]').click());
  await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
  assert.equal(scopes.at(-1),'mine','Reset restores the default owner');
  let printedHtml='';window.open=()=>({document:{open:()=>{},write:html=>{printedHtml=html;},close:()=>{}}});
  await act(async()=>document.querySelector('[aria-label="Print bill directory (A4)"]').click());
  assert.match(printedHtml,/HLD-ORIGINAL/);assert.doesNotMatch(printedHtml,/HLD-OTHER/);
  assert.match(document.body.querySelector('tbody').textContent,/250.00/);assert.equal(workspaceReads,0);
  assert.ok(![...document.querySelectorAll('thead th')].some(cell=>cell.textContent==='Remarks'));
  assert.equal(document.querySelector('tbody .onhold-remarks'),null);
  await act(async()=>document.querySelector('[aria-label="Print HLD-ORIGINAL"]').click());
  assert.match(printedHtml,/Deliver after 3 pm/);assert.doesNotMatch(printedHtml,/Warehouse review:/);
  assert.match(printedHtml,/Original product/);assert.match(printedHtml,/150.00/);
  assert.match(document.querySelector('tbody .onhold-staff').textContent,/Nimal PereraEMP-0042/);assert.match(printedHtml,/Nimal Perera/);assert.match(printedHtml,/EMP-0042/);
  assert.match(document.body.querySelector('tbody').textContent,/BILLED/);
  await act(async()=>document.querySelector('[aria-label="Onhold bill status"]').click());
  assert.deepEqual([...document.querySelectorAll('[role="option"]')].map(option=>option.getAttribute('data-value')),['ALL','BILLED','CANCELLED']);
  await act(async()=>document.querySelector('[role="option"][data-value="ALL"]').click());

  await act(async()=>document.body.querySelector('[aria-label="View onhold bill HLD-ORIGINAL"]').click());
  const detail=document.body.querySelector('[aria-label="POS Onhold Bill HLD-ORIGINAL"]');assert.ok(detail);assert.match(detail.textContent,/Nimal Perera · EMP-0042/);assert.equal(detail.querySelector('[data-status="BILLED"]').textContent,'BILLED');assert.equal(document.body.querySelector('[aria-labelledby="pos-held-title"]'),null,'The list popup must not cover the details popup');assert.match(detail.textContent,/Selling qty/);assert.match(detail.textContent,/250.00/);
  assert.deepEqual([...detail.querySelectorAll('thead th')].map(cell=>cell.textContent),['Product','Unit price','Selling qty','Sub line total','Discount %','Discount Rs.','Line total']);
  assert.deepEqual([...detail.querySelector('tbody tr').children].map(cell=>cell.textContent),['Original productP-1','150.00','2','300.00','16.67%','50.00','250.00']);
  await act(async()=>detail.querySelector('[aria-label="Print held bill"]').click());assert.match(printedHtml,/Held Bill HLD-ORIGINAL/);assert.equal(detail.querySelector('tbody tr').children[2].textContent,'2');assert.equal(liveReads,0,'Original popup must never replace saved lines with live invoice data');
  assert.ok(!detail.textContent.includes('Warehouse Review'));
  await act(async()=>detail.querySelector('[aria-label="Close held bill"]').click());
  assert.equal(document.querySelector('[aria-label="Held bill type"]'),null,'Held Bills contains POS copies only');
  assert.equal(workspaceReads,0);
  assert.ok(document.querySelector('[aria-label="Print HLD-ORIGINAL"]'));
  original.status='INVOICE_CANCELLED';original.cancellationReason='Invoice cancelled';
  await act(async()=>document.querySelector('[aria-label="Refresh onhold bills"]').click());
  await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
  assert.equal(document.querySelector('tbody .onhold-remarks'),null);
  assert.equal(document.querySelector('tbody .onhold-cancellation-reason'),null);
  assert.ok(![...document.querySelectorAll('thead th')].some(cell=>cell.textContent==='Cancellation reason'));
  await act(async()=>document.querySelector('[aria-label="Print bill directory (A4)"]').click());
  assert.doesNotMatch(printedHtml,/Cancellation reason|Invoice cancelled|Deliver after 3 pm/);
  assert.match(document.querySelector('.onhold-directory-table').textContent,/CANCELLED/);
  assert.match(document.querySelector('.onhold-directory-table').textContent,/250.00/);
  await act(async()=>document.querySelector('[aria-label="View onhold bill HLD-ORIGINAL"]').click());
  assert.equal(document.querySelector('[aria-label="Print warehouse sheets"]'),null);
  assert.doesNotMatch(document.querySelector('[aria-label="POS Onhold Bill HLD-ORIGINAL"]').textContent,/Cancel Onhold Bill|Warehouse Review/);
  const field=(dialog,label)=>[...dialog.querySelectorAll('dt')].find(node=>node.textContent===label)?.nextElementSibling?.textContent;
  const cancelledPopup=document.querySelector('[aria-label="POS Onhold Bill HLD-ORIGINAL"]');
  assert.equal(field(cancelledPopup,'Remarks'),'Deliver after 3 pm');assert.equal(field(cancelledPopup,'Cancellation reason'),'Invoice cancelled');
  const {default:Table}=await server.ssrLoadModule('/src/components/OnholdBillsTable.jsx');
  const statuses=['YET_TO_PRINT','SENT_TO_WAREHOUSE','STOCK_ADJUSTED','INVOICE_CREATED','INVOICE_CANCELLED','CANCELLED'];
  const props={bills:statuses.map((status,index)=>({...original,id:index+1,heldNumber:`HLD-${status}`,originalCopy:false,status,canResume:true})),user:{permissions:['SALES_EDIT']},scope:'mine',onScopeChange:()=>{},query:'',onQueryChange:()=>{},onRefresh:()=>{},onView:()=>{},onSelect:()=>{},onStatusChange:()=>{}};
  await act(async()=>root.render(React.createElement(Table,{...props,status:'ALL'})));
  assert.equal(host.querySelectorAll('tbody tr').length,6,'The live workspace keeps every lifecycle stage');
  assert.ok(host.querySelector('[aria-label="Adjust HLD-SENT_TO_WAREHOUSE"]'));
  assert.equal(host.querySelector('input[type="checkbox"]'),null,'All Statuses does not show the Select column');
  assert.match(host.querySelector('tbody .onhold-staff').textContent,/Nimal PereraEMP-0042/,'Onhold bills show full name and employee ID too');
  assert.equal(host.querySelector('[data-status="STOCK_ADJUSTED"]').textContent,'WAREHOUSE REVIEWED');
  await act(async()=>root.render(React.createElement(Table,{...props,status:'STOCK_ADJUSTED'})));
  assert.equal(host.querySelectorAll('tbody tr').length,1);
  assert.equal(host.querySelector('[aria-label="Select HLD-STOCK_ADJUSTED"]').disabled,false);
  let cleared=null;await act(async()=>root.render(React.createElement(Table,{...props,status:'STOCK_ADJUSTED',selected:[3],onSelect:value=>{cleared=value;}})));
  assert.match(host.querySelector('.onhold-selection').textContent,/warehouse-reviewed/);
  await act(async()=>host.querySelector('[title="Reset all filters to default"]').click());assert.deepEqual(cleared,[],'Reset clears invoice selection');
  await act(async()=>host.querySelector('[aria-label="Onhold bill status"]').click());
  for(const status of statuses)assert.ok(document.querySelector(`[role="option"][data-value="${status}"]`),`Status filter includes ${status}`);
  await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  await act(async()=>root.render(React.createElement(Table,{...props,status:'INVOICE_CREATED'})));
  assert.equal(host.querySelectorAll('tbody tr').length,1);assert.equal(host.querySelector('input[type="checkbox"]'),null);assert.equal(host.querySelector('.onhold-selection'),null);
  assert.match(host.querySelector('tbody').textContent,/HLD-INVOICE_CREATED/);
  await act(async()=>host.querySelector('[aria-label="Print bill directory (A4)"]').click());
  assert.match(printedHtml,/HLD-INVOICE_CREATED/);assert.doesNotMatch(printedHtml,/HLD-SENT_TO_WAREHOUSE/);
  assert.ok(host.querySelector('[title="Reset all filters to default"]'),'A status filter exposes Reset');
  assert.ok(host.querySelector('[aria-label="Refresh onhold bills"]'));
  const {default:Details}=await server.ssrLoadModule('/src/components/HeldBillDetails.jsx');
  for(const cancelled of [false,true]){
    const bill={...original,originalCopy:false,canResume:false,createdBy:'another-staff',status:cancelled?'CANCELLED':'STOCK_ADJUSTED'};
    await act(async()=>root.render(React.createElement(Details,{key:String(cancelled),bill,user:{username:'viewer',permissions:[]},onClose:()=>{}})));
    assert.equal(field(document.querySelector('[aria-label="Onhold bill HLD-ORIGINAL"]'),'Remarks'),'Deliver after 3 pm');
    assert.equal(field(document.querySelector('[aria-label="Onhold bill HLD-ORIGINAL"]'),'Cancellation reason'),cancelled?'Invoice cancelled':undefined);
  }





 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const name of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[name];}
});
