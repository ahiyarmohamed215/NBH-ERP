import test from 'node:test';import assert from 'node:assert/strict';import React,{act} from 'react';import {createServer} from 'vite';import {Window} from 'happy-dom';

test('role changes refresh the session and older responses cannot restore revoked access',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,sessionStorage:window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const apis=await server.ssrLoadModule('/src/api/apiClient.js');
  localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
  const {AuthProvider,useAuth}=await server.ssrLoadModule('/src/context/AuthContext.jsx');
  const {canAccessModule}=await server.ssrLoadModule('/src/utils/moduleAccess.js');
  let context;function Session(){context=useAuth();return React.createElement('span',null,context.user?['inventory','purchasing','employees'].filter(module=>canAccessModule(context.user,module)).join(','):'signed-out');}
  let profile={username:'staff',roles:['ROLE_CUSTOM'],permissions:['PRODUCT_VIEW']};
  apis.authApi.getMe=async()=>({data:profile});apis.authApi.logout=async()=>({data:{}});
  await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(Session))));assert.equal(host.textContent,'inventory');
  let oldResponse;apis.authApi.getMe=()=>new Promise(resolve=>oldResponse=resolve);
  await act(async()=>window.dispatchEvent(new window.Event('erp:roles_updated')));
  profile={...profile,permissions:['ROLE_VIEW']};apis.authApi.getMe=async()=>({data:profile});
  await act(async()=>window.dispatchEvent(new window.Event('erp:roles_updated')));assert.equal(host.textContent,'employees');
  await act(async()=>oldResponse({data:{...profile,permissions:['PRODUCT_MANAGE','GRN_PROCESS']}}));assert.equal(host.textContent,'employees');
  profile={...profile,permissions:[]};await act(async()=>window.dispatchEvent(new window.Event('erp:users_updated')));assert.equal(host.textContent,'');
  apis.authApi.getMe=()=>new Promise(resolve=>oldResponse=resolve);await act(async()=>window.dispatchEvent(new window.Event('erp:roles_updated')));
  await act(async()=>context.logout());await act(async()=>oldResponse({data:profile}));assert.equal(host.textContent,'signed-out');assert.equal(localStorage.getItem('nbh_user'),null);
 }finally{await act(async()=>root.unmount());await server.close();await window.happyDOM.close();for(const key of ['window','document','localStorage','sessionStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];}
});
