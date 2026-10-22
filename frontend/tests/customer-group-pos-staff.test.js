import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('customer group staff choices come only from the POS-authorized lookup',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');for(const [name,api] of Object.entries(apis))if(name.endsWith('Api') && api && typeof api==='object')for(const key of Object.keys(api))if(typeof api[key]==='function')api[key]=async()=>({data:[]});
  apis.setAccessToken(`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
  apis.authApi.getMe=async()=>({data:{username:'admin',roles:['ROLE_ADMIN']}});
  let posReads=0,otherReads=0;apis.salesmanApi.getPosStaff=async()=>{posReads++;return {data:[{id:7,username:'cashier',fullName:'Assigned POS staff',employeeCode:'EMP-0007',isActive:true}]};};
  apis.salesmanApi.getAll=apis.userApi.getStaffLookup=async()=>{otherReads++;return {data:[{id:8,fullName:'Staff without POS access'}]};};
  const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');const {default:Customers}=await server.ssrLoadModule('/src/views/CustomersHub.jsx');
  await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(Customers,{activeSubTab:'groups'})))));
  const create=[...host.querySelectorAll('button')].find(button=>button.textContent.includes('Create Customer Group'));assert.ok(create);await act(async()=>create.click());
  const search=host.querySelector('[placeholder="Search staff by name, code, role..."]');assert.ok(search);await act(async()=>search.focus());
  assert.ok(posReads>0);assert.equal(otherReads,0);assert.match(host.textContent,/Assigned POS staff/);assert.match(host.textContent,/EMP-0007/);assert.doesNotMatch(host.textContent,/Staff without POS access/);
 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
