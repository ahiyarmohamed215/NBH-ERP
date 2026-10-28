import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('all four master directories save partial drafts, filter them and require reasons for status changes',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try {
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');
  for(const [key,api] of Object.entries(apis))if(key.endsWith('Api') && api && typeof api==='object')for(const method of Object.keys(api))if(typeof api[method]==='function')api[method]=async()=>({data:[]});
  localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
  apis.authApi.getMe=async()=>({data:{username:'admin',roles:['ROLE_ADMIN'],permissions:[]}});
  const lists={products:[],brands:[{id:1,name:'Brand',code:'BR-01',isActive:true}],categories:[{id:1,name:'Category',code:'CAT-01',isActive:true}],warehouses:[{id:1,name:'Warehouse',code:'WH-01',isActive:true}]};
  const changes=[];let deleted;
  apis.recycleBinApi.delete=async(type,id)=>{deleted={type,id};const key={PRODUCT:'products',BRAND:'brands',WAREHOUSE:'warehouses',CATEGORY:'categories'}[type];lists[key]=lists[key].filter(row=>row.id!==id);};
  for(const [type,key] of Object.entries({products:'productApi',brands:'brandApi',categories:'categoryApi',warehouses:'warehouseApi'})){
   const api=apis[key];api[type==='products'?'getProducts':'getAll']=async()=>({data:type==='products'?{content:lists[type]}:lists[type]});
   api.create=async payload=>{const row={...payload,id:99,code:payload.code || 'DRAFT-99',sku:payload.sku || 'DRAFT-99',isActive:payload.status==='ACTIVE'};lists[type].push(row);return {data:row};};
   api.update=async(id,payload)=>{const row=lists[type].find(row=>row.id===id);Object.assign(row,payload);return {data:row};};
   api.changeStatus=async(id,status,reason)=>{assert.ok(reason);changes.push({type,status,reason});const row=lists[type].find(row=>row.id===id);Object.assign(row,{status,isActive:status==='ACTIVE'});return {data:row};};
  }
  const {default:Masters}=await server.ssrLoadModule('/src/views/MastersView.jsx');const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');
  const click=async button=>{assert.ok(button);await act(async()=>button.click());};
  const findButton=(text,scope=host)=>[...scope.querySelectorAll('button')].find(button=>(button.getAttribute('aria-label') || button.textContent.trim())===text);
  const enter=async(input,value)=>act(async()=>{Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});
  for(const [type,name] of Object.entries({products:'Product',warehouses:'Warehouse',brands:'Brand',categories:'Category'})){
   await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(Masters,{key:type,activeSubTab:type,isStandalone:true})))));
   await click(findButton(`New ${name}`));
   const form=host.querySelector('.master-workspace');assert.ok(form);
   assert.equal(form.querySelector('[aria-label="Description / notes"]'),null);
   await enter(form.querySelector('[aria-label="Remarks"]'),'Complete record later');
   assert.ok(form.querySelector('.allocation-receipt-notes').textContent.includes('Complete record later'));
   await click(findButton('Save draft',form));assert.equal(lists[type].find(row=>row.id===99).status,'DRAFT');assert.equal(lists[type].find(row=>row.id===99)[type==='warehouses'?'remarks':'description'],'Complete record later');assert.equal(host.querySelector('.master-workspace'),null);
   assert.ok(host.querySelector('tbody tr').textContent.includes('DRAFT-99'),'New drafts appear first');
   let row=[...host.querySelectorAll('tbody tr')].find(row=>row.textContent.includes('DRAFT-99'));assert.ok(row);assert.ok(row.querySelector(`[aria-label="Print ${name}"]`),'Draft table rows have print actions');assert.equal(row.querySelector('.erp-status-badge').textContent.trim(),'DRAFT');
   const filter=host.querySelector('[title="Filter records by status"]');assert.ok(filter);await click(filter);await click([...document.querySelectorAll('[role="option"]')].find(option=>option.textContent.trim()==='Draft'));
   assert.equal(host.querySelectorAll('tbody tr').length,1);
   await click(row.querySelector(`[title="Edit ${name}"]`));await enter(host.querySelector('[name="name"]'),`Completed ${name}`);
   await act(async()=>host.querySelector('.master-workspace').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
   assert.equal(lists[type].find(row=>row.id===99).status,'DRAFT');
   row=[...host.querySelectorAll('tbody tr')].find(row=>row.textContent.includes(`Completed ${name}`));await click(row);
   const remarks=[...host.querySelectorAll('.master-details-grid>div')].find(row=>row.querySelector('dt').textContent==='Remarks');assert.ok(remarks);assert.equal(remarks.querySelector('dd').textContent,'Complete record later');
   assert.equal(host.querySelector('[role="dialog"]').textContent.includes('Description / notes'),false);
   assert.deepEqual([...host.querySelectorAll('.record-actions button')].map(button=>button.getAttribute('aria-label')),[`Edit ${name}`,`Activate ${name}`,`Delete ${name}`]);
   assert.equal(findButton('Print'),undefined,'Drafts have only edit, activate and delete record actions');
   await click(findButton('Close'));
   // Existing active records still support deactivation and reactivation.
   Object.assign(lists[type].find(row=>row.id===99),{status:'ACTIVE',isActive:true});
   await click(host.querySelector('[title="Filter records by status"]'));await click(document.querySelector('[role="option"][data-value="ALL"]'));
   await click(host.querySelector('[title="Refresh records"]'));
   await act(async()=>new Promise(resolve=>setTimeout(resolve,350)));
   row=[...host.querySelectorAll('tbody tr')].find(row=>row.textContent.includes(`Completed ${name}`));await click(row);
   for(const [action,target] of [[`Deactivate ${name}`,'INACTIVE'],[`Reactivate ${name}`,'ACTIVE']]){
    await click(findButton(action));const dialog=host.querySelector('[aria-label="Change '+name+' status"]');assert.ok(dialog);
    const confirm=dialog.querySelector('[aria-label="Confirm status change"]');assert.equal(confirm.disabled,true);
    await enter(dialog.querySelector('textarea'),'Details reviewed');assert.equal(confirm.disabled,false);await click(confirm);
    assert.equal(changes.at(-1).target ?? changes.at(-1).status,target);assert.equal(lists[type].find(row=>row.id===99).status,target);
   }
   assert.equal(findButton('Return to draft'),undefined);await click(findButton('Close'));
   await click(host.querySelector('[title="Filter records by status"]'));await click(document.querySelector('[role="option"][data-value="ALL"]'));
   if(type==='products'){
    await click(host.querySelector('[title="Delete Product"]'));const dialog=host.querySelector('[aria-label="Delete product"]');assert.ok(dialog);assert.equal(deleted,undefined);await click(findButton('Move to recycle bin',dialog));assert.deepEqual(deleted,{type:'PRODUCT',id:99});assert.equal(host.querySelector('[title="Delete Product"]'),null);
   }
   lists[type]=lists[type].filter(row=>row.id!==99);
  }
  assert.equal(changes.length,8);
 } finally {
  await act(async()=>root.unmount());
  await server.close();
  await window.happyDOM.close();
  for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];
 }
});
