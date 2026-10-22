import test from 'node:test';import assert from 'node:assert/strict';import React,{act} from 'react';import {createServer} from 'vite';import {Window} from 'happy-dom';import {onholdReviewMaximum} from '../src/utils/onholdReviewMaximum.js';
test('review maximum uses allocation, physical counts and other approved rows without double counting',()=>{
 const a={id:1,productId:1,warehouseId:1,approvedQuantity:'2',physicalStock:''};const review={limits:[{productId:1,warehouseId:null,remainingQuantity:5}],stock:[{productId:1,warehouseId:1,availableForBill:8,otherReserved:2},{productId:1,warehouseId:2,availableForBill:10,otherReserved:0}]};
 assert.equal(onholdReviewMaximum(a,[a],review),5);const b={...a,id:2,warehouseId:2};assert.equal(onholdReviewMaximum(a,[a,b],review),3);
 assert.equal(onholdReviewMaximum({...a,physicalStock:'5'},[{...a,physicalStock:'5'}],review),3);
 assert.equal(onholdReviewMaximum(a,[a],{...review,limits:[]}),8);
});
test('office editor permits increasing up to allocation and warehouse stock, and blocks an over-limit save',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true});const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{const {salesApi}=await server.ssrLoadModule('/src/api/apiClient.js');const {default:Editor}=await server.ssrLoadModule('/src/views/OnholdBillEditor.jsx');let saved;
 salesApi.getHeldReviewLimits=async()=>({data:{limits:[{productId:1,warehouseId:1,remainingQuantity:5}],stock:[{productId:1,warehouseId:1,availableForBill:4,otherReserved:0}]}});
 salesApi.reviewHeld=async(id,payload)=>{saved=payload;return {data:{id}};};
 const bill={id:1,heldNumber:'HLD-1',recordVersion:1,status:'SENT_TO_WAREHOUSE',items:[{id:1,productId:1,warehouseId:1,productSku:'SKU',productName:'Product',quantity:2,unitPrice:10}]};
 await act(async()=>root.render(React.createElement(Editor,{bill,user:{permissions:['SALES_EDIT','INVENTORY_ADJUST']},onBack:()=>{},onSaved:()=>{}})));
 const saveButton=()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Save review');
 assert.equal(saveButton().disabled,false,'An unchanged review can be saved without remarks');
 assert.equal(host.querySelector('.onhold-editor-instructions'),null);
 await act(async()=>saveButton().click());assert.equal(saved.items[0].approvedQuantity,2);assert.equal(saved.items[0].physicalStock,null);assert.equal(saved.remarks,'Reviewed with no changes.');
 const quantity=host.querySelector('[aria-label="Approved quantity SKU"]');assert.equal(quantity.max,'4');
 const fill=async(input,value)=>act(async()=>{Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});
 await fill(host.querySelector('textarea'),'Warehouse checked');await fill(quantity,'5');const save=()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Save review');assert.ok(save().disabled);
 await fill(quantity,'4');assert.equal(save().disabled,false);
 await fill(host.querySelector('[aria-label="Physical stock SKU"]'),'10');assert.equal(quantity.max,'5');
 await fill(quantity,'5');await act(async()=>save().click());assert.equal(saved.items[0].approvedQuantity,5);assert.equal(saved.items[0].physicalStock,10);
 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
