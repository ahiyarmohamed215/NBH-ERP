import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('refreshes coalesce, respect topics, serialize requests and defer retained workspaces', async () => {
  const window=new Window();
  Object.assign(globalThis,{window,document:window.document,CustomEvent:window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');
  const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const {useDataSync}=await server.ssrLoadModule('/src/hooks/useDataSync.js');
  const {WorkspaceActivity}=await server.ssrLoadModule('/src/components/RetainedWorkspaces.jsx');
  const wait=()=>new Promise(resolve=>setTimeout(resolve,300));
  let calls=0,release;
  function View(){useDataSync(()=>{calls++;return new Promise(resolve=>{release=resolve;});},[],[],['orders']);return null;}
  const render=active=>root.render(React.createElement(WorkspaceActivity,{active},React.createElement(View)));
  const change=topics=>window.dispatchEvent(new CustomEvent('erp:realtime_sync',{detail:{topics}}));
  try {
    await act(async()=>render(true));
    await act(async()=>{change(['inventory']);await wait();});assert.equal(calls,0);
    await act(async()=>{change(['orders']);change(['orders']);await wait();});assert.equal(calls,1);
    await act(async()=>{change(['orders']);await wait();});assert.equal(calls,1);
    await act(async()=>{release();await wait();});assert.equal(calls,2);
    await act(async()=>release());await act(async()=>render(false));
    await act(async()=>{change(['orders']);await wait();});assert.equal(calls,2);
    await act(async()=>render(true));await act(async()=>wait());assert.equal(calls,3);
    await act(async()=>release());
  } finally {await act(async()=>root.unmount());await server.close();window.happyDOM.abort();}
});
