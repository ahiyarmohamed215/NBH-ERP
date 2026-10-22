import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('inventory New stock transfer opens GTN creation directly, including repeat navigation',async()=>{
 const window=new Window({url:'http://localhost/#view=inventory&tab=inventory-list'});
 Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,history:window.history,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');
  for(const[name,api]of Object.entries(apis))if(name.endsWith('Api') && api && typeof api==='object')for(const method of Object.keys(api))if(typeof api[method]==='function')api[method]=async()=>({data:[]});
  localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
  apis.authApi.getMe=async()=>({data:{id:1,username:'admin',fullName:'Admin',roles:['ROLE_ADMIN'],permissions:[]}});
  const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');
  const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');
  const {QueryClientProvider}=await import('@tanstack/react-query');
  const {queryClient}=await server.ssrLoadModule('/src/queryClient.js');
  const {default:App}=await server.ssrLoadModule('/src/App.jsx');
  await act(async()=>root.render(
    React.createElement(QueryClientProvider,{client:queryClient},
      React.createElement(AuthProvider,null,
        React.createElement(ToastProvider,null,
          React.createElement(App)
        )
      )
    )
  ));
  assert.equal(host.querySelector('[aria-label="Enter full screen"]'),null,'Sidebar fullscreen control was removed');
  const button=(scope,text)=>[...(scope?.querySelectorAll('button')||[])].find(button=>button.textContent.trim()===text);

  const waitFor=async(fn)=>{
    for(let i=0;i<40;i++){
      const res=fn();
      if(res)return res;
      await act(async()=>new Promise(r=>setTimeout(r,100)));
    }
    return fn();
  };

  const open=async()=>{
   const shortcut=await waitFor(()=>{
     const inventory=host.querySelector('[data-workspace="inventory"]');
     return button(inventory,'New Stock Transfer');
   });
   assert.ok(shortcut,'New Stock Transfer button found in inventory');
   await act(async()=>shortcut.click());
   const purchasing=await waitFor(()=>{
     const p=host.querySelector('[data-workspace="purchasing"]');
     return (p && !p.hidden && p.querySelector('.purchase-document')) ? p : null;
   });
   assert.ok(purchasing && !purchasing.hidden);
   assert.ok(purchasing.querySelector('.purchase-document'));
   assert.ok(purchasing.textContent.includes('New Stock Transfer (GTN)'));
   assert.ok(purchasing.querySelector('[aria-label="Search products"]'));
   assert.ok(button(purchasing,'Back to list'));
   return purchasing;
  };
  let purchasing=await open();
  await act(async()=>button(purchasing,'Back to list').click());
  await waitFor(()=>purchasing.querySelector('.purchase-document')===null);
  assert.equal(purchasing.querySelector('.purchase-document'),null,'Closing create returns to the normal GTN list');
  // Navigate using the existing sidebar without remounting either workspace.
  const inventoryNavigation=[...host.querySelectorAll('button')].find(button=>button.textContent.trim()==='Inventory');assert.ok(inventoryNavigation);
  await act(async()=>inventoryNavigation.click());
  purchasing=await open();
  assert.ok(purchasing.querySelector('.purchase-document'),'The consumed request does not prevent a later shortcut from opening creation');
 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();}
});
