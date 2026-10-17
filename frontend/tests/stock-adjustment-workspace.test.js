import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('stock adjustments choose a type, search GRN-backed products and send quantity deltas',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');
  for(const [name,api] of Object.entries(apis))if(name.endsWith('Api') && api && typeof api==='object')for(const method of Object.keys(api))if(typeof api[method]==='function')api[method]=async()=>({data:[]});
  localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
  apis.authApi.getMe=async()=>({data:{username:'admin',roles:['ROLE_ADMIN'],permissions:[]}});
  apis.productApi.getProducts=async()=>({data:{content:[{id:1,name:'Test product',sku:'ADJ-1',costPrice:5,isActive:true}]}});
  apis.warehouseApi.getAll=async()=>({data:[{id:10,name:'North',isActive:true}]});
  apis.inventoryApi.getBalances=async()=>({data:{content:[{productId:1,warehouseId:10,quantity:20,availableQuantity:20}]}});
  const choices=[{productId:1,productName:'Test product',productCode:'ADJ-1',warehouseId:10,warehouseName:'North',availableStock:20,sourceGrnId:1,sourceGrnNumber:'GRN-001',unitCost:5},{productId:2,productName:'Zero stock product',productCode:'ADJ-2',warehouseId:10,warehouseName:'North',availableStock:0,sourceGrnId:2,sourceGrnNumber:'GRN-002',unitCost:7}];
  apis.adjustmentApi.searchProducts=async()=>({data:choices});
  const saved=[],processFlags=[];apis.adjustmentApi.create=async(payload,process)=>{processFlags.push(process);saved.push(payload);return {data:{id:1}};};
  const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');const {default:Inventory}=await server.ssrLoadModule('/src/views/InventoryHub.jsx');
  await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(Inventory,{activeSubTab:'adjustments'})))));
  const click=async element=>{assert.ok(element);await act(async()=>element.click());};
  const button=text=>[...host.querySelectorAll('button')].find(button=>button.textContent.trim()===text);
  const choose=async(label,value)=>{await click(host.querySelector(`[aria-label="${label}"]`));await click(document.querySelector(`[role="option"][data-value="${value}"]`));};
  const enter=async(label,value)=>act(async()=>{const field=host.querySelector(`[aria-label="${label}"]`);Object.getOwnPropertyDescriptor(field.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new window.Event('input',{bubbles:true}));});
  for(const [action,quantity,target,productId] of [['Addition','2',22,1],['Reduction','3',17,1],['Addition','4',4,2]]){
   await click(button('New Adjustment'));
   assert.ok(host.querySelector('[role="dialog"][aria-labelledby="adjustment-type-title"]'));
   assert.equal(host.querySelector('[aria-label="Search adjustment products"]'),null,'Type must be chosen first');
   await click([...host.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent.startsWith(action)));
   const form=host.querySelector('.adjustment-workspace');assert.ok(form);assert.equal(host.querySelector('.modal-backdrop'),null);
   assert.equal(form.querySelector('[type="submit"]').disabled,true);
   await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
   const name=choices.find(product=>product.productId===productId).productName;
   const option=[...form.querySelectorAll('[role="option"]')].find(option=>option.textContent.includes(name));assert.ok(option);assert.match(option.textContent,/ADJ-/);assert.match(option.textContent,/Available/);
   await click(option);await enter('Adjustment quantity',quantity);await enter('Remarks','Count verified');
   assert.equal(form.querySelector('[aria-label="Cost price per unit"]'),null,'GRN determines cost');
   assert.match(form.textContent,productId===1?/GRN-001/:/GRN-002/);
   const summary=[...form.querySelectorAll('dl>div')].find(row=>row.querySelector('dt').textContent==='Available after adjustment');assert.equal(summary.querySelector('dd').textContent,String(target));
   if(action==='Reduction'){await enter('Adjustment quantity','21');assert.equal(form.querySelector('[type="submit"]').disabled,true);await enter('Adjustment quantity',quantity);}
   await act(async()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
   assert.equal(host.querySelector('.adjustment-workspace'),null);assert.equal(saved.at(-1).items[0].quantity,Number(quantity));
   assert.equal(processFlags.at(-1),true);assert.equal(saved.at(-1).adjustmentType,action.toUpperCase());assert.equal('physicalQuantity' in saved.at(-1).items[0],false);
   assert.equal(saved.at(-1).warehouseId,10);assert.equal(saved.at(-1).items[0].productId,productId);assert.ok(saved.at(-1).reason.endsWith(': Count verified'));
   assert.equal('unitCost' in saved.at(-1).items[0],false);
  }
  await click(button('New Adjustment'));
  await click([...host.querySelectorAll('[role="dialog"] button')].find(button=>button.textContent.startsWith('Addition')));
  await act(async()=>new Promise(resolve=>setTimeout(resolve,250)));
  await click(host.querySelector('[role="option"]'));await enter('Adjustment quantity','2');
  await click(button('Save as draft'));assert.equal(processFlags.at(-1),false);assert.equal(saved.length,4);
  await click(button('New Adjustment'));await click(button('Cancel'));assert.equal(saved.length,4);assert.equal(host.querySelector('[aria-labelledby="adjustment-type-title"]'),null);
 }finally{await act(async()=>new Promise(resolve=>setTimeout(resolve,5100)));await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
