import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('delivery routes share the group workspace without staff and preserve route settings on save',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');
  for(const [name,api] of Object.entries(apis))if(name.endsWith('Api') && api && typeof api==='object')for(const key of Object.keys(api))if(typeof api[key]==='function')api[key]=async()=>({data:[]});
  apis.setAccessToken(`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
  const user={username:'delivery-manager',roles:[],permissions:['DELIVERY_VIEW','DELIVERY_MANAGE']};
  apis.authApi.getMe=async()=>({data:user});
  let staffReads=0,groupReads=0,created,updated;
  apis.salesmanApi.getPosStaff=async()=>{staffReads++;return {data:[]};};
  apis.customerGroupApi.getAll=async()=>{groupReads++;return {data:[]};};
  apis.customerApi.getAll=async()=>({data:[{id:1,name:'First customer',customerCode:'C-001',isActive:true},{id:2,name:'Second customer',customerCode:'C-002',isActive:true}]});
  let routes=[{id:10,routeName:'Western route',routeCode:'DR-010',description:'Existing route',area:'Colombo',deliveryDays:'Monday',startLocation:'Depot',endLocation:'Town',estimatedDurationMinutes:90,estimatedDistanceKm:25,assignedStaffId:77,assignedStaffName:'Legacy staff',customerIds:[1],isActive:true}];
  apis.deliveryRouteApi.getAll=async()=>({data:routes});
  apis.deliveryRouteApi.update=async(id,payload)=>{updated=payload;routes=routes.map(route=>route.id===id?{...payload,id}:route);return {data:routes.find(route=>route.id===id)};};
  apis.deliveryRouteApi.changeStatus=async(id,status,reason)=>{assert.equal(reason,'Route maintenance');routes=routes.map(route=>route.id===id?{...route,isActive:status==='ACTIVE'}:route);return {data:routes.find(route=>route.id===id)};};
  apis.deliveryRouteApi.create=async payload=>{created=payload;const route={...payload,id:11,routeCode:'DR-011'};routes.push(route);return {data:route};};
  const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');const {default:Customers}=await server.ssrLoadModule('/src/views/CustomersHub.jsx');
  const render=()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(Customers,{activeSubTab:'groups',deliveryMode:true}))));
  await act(async()=>render());
  const button=text=>[...host.querySelectorAll('button')].find(node=>node.textContent.trim()===text);
  const dialog=()=>host.querySelector('[role="dialog"]');
  const change=async(input,value)=>act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});
  assert.equal(host.querySelector('.customers-page').style.getPropertyValue('--erp-page-padding'),'0px');
  assert.equal(staffReads,0);assert.equal(groupReads,0);assert.doesNotMatch(host.textContent,/Legacy staff|Assigned Staff/);
  await act(async()=>[...host.querySelectorAll('h3')].find(node=>node.textContent==='Western route').click());
  assert.equal(dialog().classList.contains('supplier-floating-card'),false,'Delivery routes use the same split popup as Customer Groups');
  assert.equal(dialog().style.maxWidth,'1040px');
  assert.ok(dialog().querySelector('[aria-label="Search route customers"]'));
  const print=dialog().querySelector('[aria-label="Print Delivery Route"]');assert.ok(print);assert.equal(print.textContent.trim(),'Print');assert.ok(print.classList.contains('purchase-inspection-table-print'));
  assert.equal(dialog().querySelector('[aria-label="Delete Delivery Route"]').getAttribute('data-tone'),'danger');assert.match(dialog().querySelector('[aria-label="Delete Delivery Route"]').textContent,/Delete Route/);
  assert.match(dialog().textContent,/First customer|Colombo|Monday/);assert.doesNotMatch(dialog().textContent,/Assigned Staff|Customer Group/);
  await act(async()=>button('Edit Delivery Route').click());
  assert.equal(host.querySelector('[placeholder="Search staff by name, code, role..."]'),null);
  await change(dialog().querySelector('[aria-label="Route area"]'),'Gampaha');
  await act(async()=>dialog().querySelector('[aria-label="Remove customer from route"]').click());
  await act(async()=>button('Save Changes').click());
  assert.equal(updated.area,'Gampaha');assert.equal(updated.deliveryDays,'Monday');assert.equal(updated.startLocation,'Depot');assert.equal(updated.endLocation,'Town');assert.equal(updated.estimatedDistanceKm,25);assert.equal(updated.assignedStaffId,null);assert.deepEqual(updated.customerIds,[]);

  await act(async()=>host.querySelector('[aria-label="Deactivate Delivery Route"]').click());
  const reason=host.querySelector('[aria-label="Status change reason"]');
  await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(reason,'Route maintenance');reason.dispatchEvent(new window.Event('input',{bubbles:true}));});
  await act(async()=>host.querySelector('[aria-label="Confirm status change"]').click());
  assert.equal(routes[0].isActive,false);assert.equal(routes[0].area,'Gampaha');assert.equal(routes[0].startLocation,'Depot');await act(async()=>button('Close').click());assert.equal(host.querySelector('[title="Status: Inactive"]').tagName.toLowerCase(),'span');
  await act(async()=>button('Create Delivery Route').click());
  await change(dialog().querySelector('[placeholder="e.g. Colombo Western Corridor"]'),'New route');
  const search=dialog().querySelector('[placeholder="Search customer by name, code, phone to add to route..."]');
  await act(async()=>search.focus());
  await act(async()=>[...dialog().querySelectorAll('div')].find(node=>node.textContent==='Second customer').click());
  await act(async()=>button('Save New Delivery Route').click());
  assert.equal(created.routeName,'New route');assert.equal(created.assignedStaffId,null);assert.deepEqual(created.customerIds,[2]);assert.match(dialog().textContent,/Second customer/);await act(async()=>button('Close').click());

  let deleted;apis.recycleBinApi.delete=async(type,id)=>{deleted={type,id};routes=routes.filter(route=>route.id!==id);return {data:null};};
  await act(async()=>[...host.querySelectorAll('h3')].find(node=>node.textContent==='New route').click());
  assert.ok(host.querySelector('[aria-label="Edit Delivery Route"]'));assert.ok(host.querySelector('[aria-label="Deactivate Delivery Route"]'));
  await act(async()=>host.querySelector('[aria-label="Delete Delivery Route"]').click());
  assert.equal(deleted,undefined);await act(async()=>button('Move to recycle bin').click());
  assert.deepEqual(deleted,{type:'DELIVERY_ROUTE',id:11});assert.equal(host.querySelector('[aria-label="Delivery Route Details"]'),null);
  user.permissions=['DELIVERY_VIEW'];
  await act(async()=>window.dispatchEvent(new window.Event('erp:permissions_updated')));
  // A fresh authenticated mount verifies delivery-only readers cannot create routes.
  await act(async()=>root.render(null));await act(async()=>render());
  assert.equal(button('Create Delivery Route').disabled,true);
 }finally{await act(async()=>new Promise(resolve=>setTimeout(resolve,5100)));await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
