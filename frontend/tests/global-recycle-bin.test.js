import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('profile opens a global bin with type filtering and isolated restore and permanent deletion',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try {
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');
  for(const [name,api] of Object.entries(apis))if(name.endsWith('Api') && api && typeof api==='object')for(const key of Object.keys(api))if(typeof api[key]==='function')api[key]=async()=>({data:[]});
  localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
  apis.authApi.getMe=async()=>({data:{id:100,username:'manager',fullName:'Bin manager',roles:['ROLE_ADMIN'],permissions:[]}});
  let rows=['SUPPLIER','BRAND','CATEGORY','WAREHOUSE','ALLOCATION','USER','CUSTOMER'].map(type=>({id:1,type,code:type+'-1',name:type+' record',deletedAt:'2026-10-14T10:00:00'}));let restored,purged;
  apis.recycleBinApi.getAll=async()=>({data:rows});apis.recycleBinApi.restore=async(type,id)=>{restored={type,id};rows=rows.filter(row=>row.type!==type);};apis.recycleBinApi.permanentlyDelete=async(type,id)=>{purged={type,id};rows=rows.filter(row=>row.type!==type);};
  const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');
  const {default:Profile}=await server.ssrLoadModule('/src/components/SidebarProfile.jsx');let destination;
  const render=component=>act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,component))));
  await render(React.createElement(Profile,{onNavigate:value=>destination=value}));
  await act(async()=>host.querySelector('[title="Click for profile settings & sign out"]').click());
  const binButton=[...host.querySelectorAll('button')].find(button=>button.textContent.trim()==='Recycle bin');assert.ok(binButton.closest('.sidebar-profile-menu'));assert.ok(binButton.querySelector('svg'));await act(async()=>binButton.click());assert.equal(destination,'recycle-bin');
  const {default:Bin}=await server.ssrLoadModule('/src/views/RecycleBinView.jsx');await render(React.createElement(Bin));assert.equal(host.querySelectorAll('tbody tr').length,7);
  await act(async()=>host.querySelector('[aria-label="Recycle bin record type"]').click());await act(async()=>document.querySelector('[role="option"][data-value="BRAND"]').click());assert.equal(host.querySelectorAll('tbody tr').length,1);assert.ok(host.querySelector('tbody').textContent.includes('BRAND record'));
  await act(async()=>host.querySelector('[aria-label="Restore BRAND BRAND-1"]').click());assert.deepEqual(restored,{type:'BRAND',id:1});assert.equal(rows.length,6);
  await act(async()=>host.querySelector('[aria-label="Recycle bin record type"]').click());await act(async()=>document.querySelector('[role="option"][data-value="ALL"]').click());
  await act(async()=>host.querySelector('[aria-label="Permanently delete CUSTOMER CUSTOMER-1"]').click());assert.equal(purged,undefined);
  await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Delete permanently').click());assert.deepEqual(purged,{type:'CUSTOMER',id:1});assert.equal(rows.length,5);assert.ok(rows.some(row=>row.type==='SUPPLIER'),'Same numeric IDs from other types remain intact');
  const {default:Supplier}=await server.ssrLoadModule('/src/components/SupplierDetailsModal.jsx');
  for(const status of ['DRAFT','ACTIVE','INACTIVE']) {
   await render(React.createElement(Supplier,{supplier:{id:2,supplierCode:'SUPP-2',status,name:null},canManage:true,onClose(){},onEdit(){},onPrint(){},onStatusChange(){},onDelete(){}}));
   const actions=[...host.querySelectorAll('.purchase-inspection-detail-actions button')].map(button=>button.textContent.trim());assert.ok(actions.includes('Edit Supplier'));assert.ok(actions.includes('Delete Supplier'));assert.ok(actions.includes(status==='ACTIVE'?'Deactivate Supplier':status==='INACTIVE'?'Reactivate Supplier':'Activate Supplier'));assert.equal(host.querySelector('.erp-dialog-title').textContent,'—');
  }
  const {default:Directory}=await server.ssrLoadModule('/src/components/MasterDirectoryTable.jsx');
  for(const type of ['brands','warehouses','categories']) {
   let selected;await render(React.createElement(Directory,{type,rows:[{id:9,code:'REC-9',name:'Record',isActive:true}],canEdit:true,isActive:()=>true,onView(){},onEdit(){},onDelete:record=>selected=record}));
   const deletion=host.querySelector('[data-tone="danger"]');assert.ok(deletion);await act(async()=>deletion.click());assert.equal(selected.id,9);
  }
  await render(React.createElement(Directory,{type:'brands',rows:[{id:9,code:'REC-9',name:'Record'}],canEdit:false,isActive:()=>true,onView(){},onEdit(){},onDelete(){}}));assert.equal(host.querySelector('[data-tone="danger"]'),null,'Read-only staff cannot delete');
 } finally {await act(async()=>new Promise(resolve=>setTimeout(resolve,5100)));await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
