import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('warehouse print popup groups 25 products and confirms sent status only after staff acknowledgement',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const api=await server.ssrLoadModule('/src/api/apiClient.js'),{default:Dialog}=await server.ssrLoadModule('/src/components/HeldBillPrintDialog.jsx');
  let confirmations=0,printed=0,closed=0,changed=0,html='',fail=true;
  api.salesApi.printHeld=async id=>{confirmations++;assert.equal(id,25);if(fail)throw new Error('Connection lost');return {data:{id,status:'SENT_TO_WAREHOUSE'}};};
  const bill={id:25,status:'YET_TO_PRINT',heldNumber:'HLD-25',customerName:'Customer',items:Array.from({length:25},(_,i)=>({id:i+1,warehouseId:i<10?1:i<15?2:3,warehouseName:`Warehouse ${i<10?1:i<15?2:3}`,productSku:`P-${i}`,productName:`Product ${i}`,quantity:2}))};
  const props={bill,onClose:()=>{closed++;},onPrinted:saved=>{changed++;assert.equal(saved.status,'SENT_TO_WAREHOUSE');}};
  await act(async()=>root.render(React.createElement(Dialog,props)));
  const panel=()=>document.querySelector('[aria-label="Print Onhold Bill"]'),confirm=()=>document.querySelector('[aria-label="Confirm warehouse sheets printed"]');
  assert.deepEqual([...panel().querySelectorAll('tbody tr')].map(row=>row.lastElementChild.textContent),['10','5','10']);assert.equal(confirm().disabled,true);assert.equal(confirmations,0);
  window.open=()=>null;
  await act(async()=>[...panel().querySelectorAll('button')].find(b=>b.textContent.includes('Print All Warehouse Sheets')).click());
  assert.match(panel().querySelector('[role="alert"]').textContent,/pop-ups/);assert.equal(confirm().disabled,true);assert.equal(confirmations,0);
  window.open=()=>({document:{write:value=>{html=value;},close:()=>{}},focus:()=>{},print:()=>{printed++;}});
  await act(async()=>[...panel().querySelectorAll('button')].find(b=>b.textContent.includes('Print All Warehouse Sheets')).click());
  assert.equal(printed,1);assert.equal((html.match(/<section>/g)||[]).length,3);assert.equal((html.match(/<tr><td>/g)||[]).length,25);
  assert.equal(confirmations,0,'Opening or cancelling the native print dialog must not change server status');
  await act(async()=>[...panel().querySelectorAll('button')].find(b=>b.textContent==='Print Later').click());assert.equal(closed,1);assert.equal(confirmations,0);
  await act(async()=>confirm().click());assert.match(panel().querySelector('[role="alert"]').textContent,/Connection lost/);assert.equal(changed,0);
  fail=false;await act(async()=>confirm().click());assert.equal(confirmations,2);assert.equal(changed,1);
 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const name of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[name];}
});
