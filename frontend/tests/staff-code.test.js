import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('staff screens show assigned and legacy staff codes, and search by code',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');
  for(const[name,api]of Object.entries(apis))if(name.endsWith('Api') && api && typeof api==='object')for(const method of Object.keys(api))if(typeof api[method]==='function')api[method]=async()=>({data:[]});
  localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
  apis.authApi.getMe=async()=>({data:{username:'admin',roles:['ROLE_ADMIN']}});
  apis.userApi.getAll=async()=>({data:{content:[{id:7,username:'cashier',fullName:'Test cashier',employeeCode:'STAFF-007',isActive:true,approvalStatus:'APPROVED',roles:['ROLE_CASHIER']},{id:8,username:'legacy',fullName:'Legacy staff',employeeCode:null,isActive:true,approvalStatus:'APPROVED',roles:['ROLE_CASHIER']}]}});
  const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');const {default:Employees}=await server.ssrLoadModule('/src/views/EmployeesHub.jsx');
  await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(Employees,{activeSubTab:'list'})))));
  const rows=host.querySelectorAll('tbody tr');assert.equal(rows.length,2);assert.ok(rows[0].textContent.includes('STAFF-007'));assert.ok(rows[1].textContent.includes('EMP-0008'));
  const search=host.querySelector('input[placeholder^="Search employees"]');
  await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(search,'EMP-0008');search.dispatchEvent(new window.Event('input',{bubbles:true}));});
  assert.equal(host.querySelectorAll('tbody tr').length,1);assert.ok(host.querySelector('tbody tr').textContent.includes('Legacy staff'));
  await act(async()=>host.querySelector('tbody tr').click());
  const popup=host.querySelector('.glass-modal');assert.ok(popup.textContent.includes('Staff code'));assert.ok(popup.textContent.includes('EMP-0008'));
  await act(async()=>[...popup.querySelectorAll('button')].find(button=>button.textContent.trim()==='Edit').click());
  const code=host.querySelector('[aria-label="Staff code"]');assert.equal(code.value,'EMP-0008');assert.equal(code.readOnly,true);
  const {staffCode}=await server.ssrLoadModule('/src/utils/staffCode.js');assert.equal(staffCode({id:7,employeeCode:'STAFF-007'}),'STAFF-007');assert.equal(staffCode({id:8,employeeCode:' '}),'EMP-0008');assert.equal(staffCode(null),'—');
 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();}
});
