import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';
test('inventory master forms create and edit inline with summaries, validation and row printing',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try {
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');for(const [key,api] of Object.entries(apis))if(key.endsWith('Api') && api && typeof api==='object')for(const method of Object.keys(api))if(typeof api[method]==='function')api[method]=async()=>({data:[]});
  localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);apis.authApi.getMe=async()=>({data:{username:'admin',roles:['ROLE_ADMIN'],permissions:[]}});
  const lists={products:[{id:1,sku:'P-01',name:'Existing product',brandId:1,categoryId:1,warehouseId:1,isActive:true}],brands:[{id:1,code:'BR-01',name:'Existing brand',markupPercent:20,isActive:true}],categories:[{id:1,code:'CT-01',name:'Existing category',isActive:true}],warehouses:[{id:1,code:'WH-01',name:'Existing warehouse',phone:'0771234567',isActive:true}]};
  let saved,print='';window.open=()=>({document:{open(){},write(html){print=html;},close(){}}});
  for(const [type,key] of Object.entries({products:'productApi',brands:'brandApi',categories:'categoryApi',warehouses:'warehouseApi'})){
   const api=apis[key];api[type==='products'?'getProducts':'getAll']=async()=>({data:type==='products'?{content:lists[type]}:lists[type]});
   const create=async payload=>{saved=payload;lists[type]=[...lists[type],{...payload,id:2,isActive:true}];return {data:lists[type].at(-1)};};api[type==='products'?'create':'create']=create;api.update=async(id,payload)=>{saved=payload;lists[type]=lists[type].map(row=>row.id===id?{...row,...payload}:row);return {data:lists[type].find(row=>row.id===id)};};
  }
  const {default:Inventory}=await server.ssrLoadModule('/src/views/InventoryHub.jsx');const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');
  const enter=async(name,value)=>act(async()=>{const input=host.querySelector(`[name="${name}"]`);Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});
  for(const [type,name] of Object.entries({products:'Product',warehouses:'Warehouse',brands:'Brand',categories:'Category'})){
   await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(Inventory,{key:type,activeSubTab:type})))));
   await act(async()=>[...host.querySelectorAll('.inventory-page-header button')].find(button=>button.textContent.trim()===`New ${name}`).click());
   const workspace=host.querySelector('.master-workspace');assert.ok(workspace);assert.equal(host.querySelector('.modal-backdrop'),null);assert.ok(host.querySelector('.inventory-allocation-focus'));assert.ok(workspace.querySelector(`[aria-label="${name} summary"]`));
   const submit=async()=>act(async()=>workspace.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));saved=null;await submit();assert.equal(saved,null);assert.ok(workspace.querySelector('[aria-invalid="true"]'));
   await enter(type==='products'?'sku':'code','NEW-02');await enter('name',`New ${name}`);if(type==='warehouses')await enter('contactNumber','0771234567');if(type==='brands')await enter('markupPercent','35.5');if(type==='products'){await enter('minStockLevel','');await submit();assert.equal(saved,null);await enter('minStockLevel','10');}
   assert.ok(workspace.querySelector(`[aria-label="${name} summary"]`).textContent.includes(`New ${name}`));await submit();assert.equal(saved.name,`New ${name}`);assert.equal(host.querySelector('.master-workspace'),null);if(type==='brands')assert.equal(saved.markupPercent,35.5);if(type==='products'){assert.equal(saved.brandId,1);assert.equal(saved.categoryId,1);assert.equal(saved.warehouseId,1);assert.equal(saved.minStockLevel,10);}
   const row=[...host.querySelectorAll('tbody tr')].find(row=>row.textContent.includes(`New ${name}`));assert.ok(row);assert.equal(row.querySelector('.erp-status-badge').tagName,'SPAN');print='';await act(async()=>row.querySelector(`[title="Print ${name}"]`).click());assert.ok(print.includes(`New ${name}`));assert.ok(!print.includes(`Existing ${name.toLowerCase()}`));
   await act(async()=>row.querySelector(`[title="Edit ${name}"]`).click());assert.equal(host.querySelector('[name="name"]').value,`New ${name}`);if(type==='warehouses'){assert.equal(host.querySelector('[name="contactNumber"]').value,'0771234567');await enter('contactNumber','');await act(async()=>host.querySelector('.master-workspace').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));assert.equal(saved.phone,'');await act(async()=>host.querySelector(`[title="Edit ${name}"]`).click());}await act(async()=>host.querySelector(`[aria-label="Close ${name.toLowerCase()} editor"]`).click());assert.equal(host.querySelector('.master-workspace'),null);
  }
 } finally {await act(async()=>new Promise(resolve=>setTimeout(resolve,5100)));await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
