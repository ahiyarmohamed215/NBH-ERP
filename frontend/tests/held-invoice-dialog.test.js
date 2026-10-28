import test from 'node:test';import assert from 'node:assert/strict';import React,{act} from 'react';import {createServer} from 'vite';import {Window} from 'happy-dom';
test('invoice confirmation requires all packing counts, accepts zero and submits numeric quantities',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true});const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{const {default:Dialog}=await server.ssrLoadModule('/src/components/HeldInvoiceDialog.jsx');let submitted;const props={preview:{customerName:'Test customer',sourceBillIds:[1],sourceBills:['HLD-1'],date:'2026-10-21',totalAmount:100,items:[]},onClose:()=>{},onConfirm:packing=>{submitted=packing;}};
 await act(async()=>root.render(React.createElement(Dialog,props)));
 const form=document.querySelector('[role="dialog"]'),submit=form.querySelector('[type="submit"]');assert.ok(submit.disabled);
 const fill=async(id,value)=>act(async()=>{const input=document.getElementById(id);Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});
 await fill('packing-boxes','2');await fill('packing-bags','3');await fill('packing-pBags','1');assert.ok(submit.disabled);
 await fill('packing-others','-1');assert.ok(submit.disabled);
 await fill('packing-others','0.5');assert.ok(submit.disabled);
 await fill('packing-others','0');assert.equal(submit.disabled,false);
 await act(async()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));assert.deepEqual(submitted,{boxes:2,bags:3,pBags:1,others:0});
 await act(async()=>root.render(React.createElement(Dialog,{...props,busy:true})));assert.ok(document.querySelector('[type="submit"]').disabled);assert.ok(document.getElementById('packing-boxes').disabled);
 const combined={boxes:7,bags:4,pBags:3,others:2};
 await act(async()=>root.render(React.createElement(Dialog,{...props,preview:{...props.preview,packing:combined}})));
 assert.deepEqual(['boxes','bags','pBags','others'].map(key=>document.getElementById(`packing-${key}`).value),['7','4','3','2']);
 assert.ok(document.getElementById('packing-boxes').readOnly);assert.equal(document.querySelector('[title="Fill all packing counts with 0"]'),null);
 assert.match(form.textContent,/Combined counts/);assert.equal(submit.disabled,false);
 await act(async()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));assert.deepEqual(submitted,combined);
 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
