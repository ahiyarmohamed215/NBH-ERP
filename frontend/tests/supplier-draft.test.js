import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';
test('supplier workspace saves partial drafts and preserves draft status when edited',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try {
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');
  for(const [name,api] of Object.entries(apis))if(name.endsWith('Api') && api && typeof api==='object')for(const method of Object.keys(api))if(typeof api[method]==='function')api[method]=async()=>({data:[]});
  localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);apis.authApi.getMe=async()=>({data:{username:'admin',roles:['ROLE_ADMIN'],permissions:[]}});
  let supplier,created,updated;const modes=[];apis.supplierApi.getAll=async()=>({data:supplier?[supplier]:[]});
  apis.supplierApi.create=async payload=>{created=payload;supplier={...payload,id:2,supplierCode:'SUPP-0002',isActive:false};return {data:supplier};};
  apis.supplierApi.update=async(id,payload)=>{assert.equal(id,2);updated=payload;supplier={...supplier,...payload};return {data:supplier};};
  const {default:Masters}=await server.ssrLoadModule('/src/views/MastersView.jsx');const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');const ref=React.createRef();
  await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(Masters,{ref,activeSubTab:'suppliers',isStandalone:true,allowedTabs:['suppliers'],onFormModeChange:open=>modes.push(open)})))));
  await act(async()=>ref.current.openAdd());assert.equal(host.querySelector('.modal-backdrop'),null);assert.ok(host.querySelector('[aria-label="Supplier summary"]'));assert.ok(modes.includes(true));
  const enter=async(name,value)=>act(async()=>{const field=host.querySelector(`[name="${name}"]`);Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new window.Event('input',{bubbles:true}));});
  const button=text=>[...host.querySelectorAll('button')].find(button=>button.textContent.trim()===text);
  await enter('contactPerson','Nimal');await act(async()=>button('Save draft').click());assert.equal(created.status,'DRAFT');assert.equal(created.name,null);assert.equal(created.contactPerson,'Nimal');assert.equal(host.querySelector('.supplier-workspace'),null);assert.equal(modes.at(-1),false);
  const row=host.querySelector('tbody tr');assert.ok(row.textContent.includes('DRAFT'));assert.equal(row.querySelector('[title="Status: DRAFT"]').tagName,'SPAN');
  await act(async()=>row.querySelector('[aria-label="Edit Supplier"]').click());await enter('name','Lanka Trading');await act(async()=>button('Save draft').click());assert.equal(updated.status,'DRAFT');assert.equal(updated.name,'Lanka Trading');assert.ok(host.querySelector('tbody').textContent.includes('Lanka Trading'));
 } finally {await act(async()=>new Promise(resolve=>setTimeout(resolve,5100)));await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
