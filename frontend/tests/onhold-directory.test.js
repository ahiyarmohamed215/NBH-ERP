import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act,useState} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('onhold directory uses GRN filters, date ranges, row details and adjusted-only selection',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const {default:Table}=await server.ssrLoadModule('/src/components/OnholdBillsTable.jsx');
  const today=new Date(),date=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const base={customerId:1,customerName:'Customer',createdBy:'cashier',canResume:true,netTotal:50,items:[{id:1}]};
  const bills=[{...base,id:1,heldNumber:'HLD-1',status:'YET_TO_PRINT',createdAt:date+'T10:00:00'},
   {...base,id:2,heldNumber:'HLD-2',status:'STOCK_ADJUSTED',createdAt:'2020-01-01T10:00:00'},
   {...base,id:3,heldNumber:'WORKING',status:'HELD',createdAt:date+'T10:00:00'},
   {...base,id:4,heldNumber:'COPY',status:'SENT_TO_WAREHOUSE',originalCopy:true,createdAt:date+'T10:00:00'},
   {...base,id:5,heldNumber:'COPY-INVOICED',status:'INVOICE_CREATED',originalCopy:true,createdAt:date+'T10:00:00'},
   {...base,id:6,heldNumber:'COPY-VOIDED',status:'INVOICE_CANCELLED',originalCopy:true,createdAt:date+'T10:00:00'}];
  let viewed=null,printed=null,cancelled=null;
  function Harness({archive=false}){const[status,setStatus]=useState('ALL'),[selected,setSelected]=useState([]),[view,setView]=useState('POS_ONHOLD');return React.createElement(Table,{bills,archive:archive && view==='POS_ONHOLD',history:archive,historyView:view,onHistoryViewChange:archive?setView:undefined,scope:'mine',query:'',status,onStatusChange:setStatus,onScopeChange:()=>{},onQueryChange:()=>{},user:{username:'cashier',permissions:['SALES_CREATE','SALES_EDIT']},onRefresh:()=>{},onView:b=>{viewed=b.id;},onPrint:b=>{printed=b.id;},onCancel:b=>{cancelled=b.id;},selected,onSelect:setSelected,onMerge:()=>{}});}
  await act(async()=>root.render(React.createElement(Harness)));
  assert.equal(host.querySelectorAll('tbody tr').length,2);assert.ok(!host.textContent.includes('WORKING'));assert.ok(!host.textContent.includes('COPY'));
  await act(async()=>host.querySelector('[aria-label="Onhold bill status"]').click());
  for(const value of ['SENT_TO_WAREHOUSE','STOCK_ADJUSTED'])assert.ok(document.querySelector(`[role="option"][data-value="${value}"]`));
  await act(async()=>document.querySelector('[role="option"][data-value="ALL"]').click());
  assert.equal(host.querySelector('[aria-label="Select HLD-2"]'),null);
  assert.equal(host.querySelector('[aria-label^="View onhold bill"] button[title="View"]'),null);
  await act(async()=>host.querySelector('tbody tr').click());assert.equal(viewed,1);
  await act(async()=>host.querySelector('[aria-label="Print HLD-1"]').click());assert.equal(printed,1);
  assert.equal(host.querySelector('[aria-label="Cancel HLD-1"]'),null,'Cancel action icon must be removed from table row');
  const {default:Details}=await server.ssrLoadModule('/src/components/HeldBillDetails.jsx');
  await act(async()=>root.render(React.createElement(Details,{bill:bills[0],user:{username:'cashier',permissions:['SALES_CREATE','SALES_EDIT']},onClose:()=>{},onCancel:b=>{cancelled=b.id;}})));
  const cancelBtn=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Cancel Onhold Bill'));
  assert.ok(cancelBtn,'Cancel button must be kept in popup view');
  await act(async()=>cancelBtn.click());assert.equal(cancelled,1);
  await act(async()=>root.render(React.createElement(Harness)));
  await act(async()=>host.querySelector('[aria-label="Onhold bill status"]').click());
  await act(async()=>document.querySelector('[role="option"][data-value="STOCK_ADJUSTED"]').click());assert.match(host.querySelector('tbody').textContent,/HLD-2/);assert.ok(!host.querySelector('tbody').textContent.includes('HLD-1'));
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Reset').click());
  await act(async()=>host.querySelector('[aria-label="Onhold bills date range"]').click());
  const label=today.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  await act(async()=>document.querySelector(`[aria-label="${label}"]`).click());
  await act(async()=>document.querySelector(`[aria-label="${label}"]`).click());
  assert.match(host.querySelector('tbody').textContent,/HLD-1/);assert.ok(!host.querySelector('tbody').textContent.includes('HLD-2'));
  await act(async()=>root.render(React.createElement(Harness,{key:'archive',archive:true})));
  assert.match(host.querySelector('tbody').textContent,/COPY/);assert.equal(host.querySelector('input[type="checkbox"]'),null);assert.equal(host.querySelector('[aria-label="Cancel COPY-INVOICED"]'),null);assert.equal(host.querySelector('[aria-label="Cancel COPY-VOIDED"]'),null);
  await act(async()=>host.querySelector('[aria-label="Onhold bill status"]').click());
  await act(async()=>document.querySelector('[role="option"][data-value="CANCELLED"]').click());
  assert.equal(host.querySelectorAll('tbody tr').length,1);assert.match(host.querySelector('tbody').textContent,/COPY-VOIDED/);
  await act(async()=>host.querySelector('[aria-label="Onhold bill status"]').click());
  await act(async()=>document.querySelector('[role="option"][data-value="BILLED"]').click());
  assert.ok(!host.querySelector('tbody').textContent.includes('COPY-VOIDED'));
 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const name of ['window','document','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[name];}
});
