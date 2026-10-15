import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';
test('supplier remarks can be created, displayed beside status and edited',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try {
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');
  for(const [key,api] of Object.entries(apis))if(key.endsWith('Api') && api && typeof api==='object')for(const method of Object.keys(api))if(typeof api[method]==='function')api[method]=async()=>({data:[]});
  localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
  apis.authApi.getMe=async()=>({data:{username:'admin',roles:['ROLE_ADMIN'],permissions:[]}});
  let suppliers=[],saved;
  apis.supplierApi.getAll=async()=>({data:suppliers});apis.supplierApi.create=async data=>{saved=data;suppliers=[{...data,id:1,supplierCode:'SUPP-0001',isActive:true}];return {data:suppliers[0]};};apis.supplierApi.update=async(id,data)=>{saved=data;suppliers=[{...suppliers[0],...data}];return {data:suppliers[0]};};
  const {default:Masters}=await server.ssrLoadModule('/src/views/MastersView.jsx');const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');
  await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(Masters,{activeSubTab:'suppliers',isStandalone:true})))));
  const input=async(name,value)=>act(async()=>{const field=host.querySelector(`[name="${name}"]`);Object.getOwnPropertyDescriptor(field.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent.trim()==='Add Supplier').click());
  await input('name','Remarks supplier');await input('remarks','Deliver before noon');await act(async()=>host.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(saved.remarks,'Deliver before noon');const headings=[...host.querySelectorAll('thead th')].map(th=>th.textContent.trim());assert.equal(headings[headings.indexOf('STATUS')+1],'REMARKS');assert.ok(host.querySelector('tbody').textContent.includes('Deliver before noon'));
  await act(async()=>host.querySelector('[aria-label="Edit Supplier"]').click());assert.equal(host.querySelector('[name="remarks"]').value,'Deliver before noon');await input('remarks','Call before dispatch');await act(async()=>host.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));assert.equal(saved.remarks,'Call before dispatch');assert.ok(host.querySelector('tbody').textContent.includes('Call before dispatch'));
 } finally {await act(async()=>new Promise(resolve=>setTimeout(resolve,5100)));await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
