import test from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('supplier delete, restore and permanent deletion work without deleting linked records', async () => {
  const window = new Window();
  Object.assign(globalThis, {window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot} = await import('react-dom/client');
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const server = await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  try {
    const apis = await server.ssrLoadModule('/src/api/apiClient.js');
    for (const [name,api] of Object.entries(apis)) if (name.endsWith('Api') && api && typeof api === 'object') for (const method of Object.keys(api)) if (typeof api[method] === 'function') api[method] = async () => ({data:[]});
    localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
    apis.authApi.getMe = async () => ({data:{username:'manager',roles:[],permissions:['SUPPLIER_MANAGE']}});
    let supplier = {id:1,name:'Lanka Trading',supplierCode:'SUPP-0001',status:'ACTIVE',isActive:true};
    let deleted = false, purged = false, failRestore = true, deletes = 0;
    apis.supplierApi.getAll = async () => ({data:deleted ? [] : [supplier]});
    apis.supplierApi.getRecycleBin = async () => ({data:deleted && !purged ? [{...supplier,name:'Lanka Trading (deleted from the system)',deletedAt:'2026-10-14T10:00:00'}] : []});
    apis.supplierApi.delete = async id => {assert.equal(id,1);deleted = true;deletes++;return {};};
    apis.supplierApi.restore = async id => {assert.equal(id,1);if (failRestore) throw new Error('Restore temporarily unavailable');deleted = false;return {data:supplier};};
    apis.supplierApi.permanentlyDelete = async id => {assert.equal(id,1);purged = true;return {};};
    const {default:Masters} = await server.ssrLoadModule('/src/views/MastersView.jsx');
    const {AuthProvider} = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const {ToastProvider} = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    await act(async () => root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,React.createElement(Masters,{activeSubTab:'suppliers',isStandalone:true,allowedTabs:['suppliers']})))));
    const button = text => [...host.querySelectorAll('button')].find(item => item.textContent.trim() === text);
    await act(async () => host.querySelector('[aria-label="Delete Supplier"]').click());
    assert.equal(deletes,0,'Opening confirmation does not delete the supplier');
    assert.ok(host.querySelector('[aria-label="Delete supplier"]'));
    await act(async () => button('Back').click()); assert.equal(deletes,0);
    await act(async () => host.querySelector('[aria-label="Delete Supplier"]').click());
    await act(async () => button('Move to recycle bin').click());
    assert.equal(deletes,1); assert.equal(host.querySelector('[aria-label="Delete Supplier"]'),null);
    await act(async () => button('Recycle bin').click());
    assert.ok(host.querySelector('tbody').textContent.includes('Lanka Trading (deleted from the system)'));
    await act(async () => host.querySelector('[aria-label="Restore SUPP-0001"]').click());
    assert.ok(document.body.textContent.includes('Restore temporarily unavailable'));assert.ok(host.querySelector('[aria-label="Restore SUPP-0001"]'));
    failRestore = false;
    await act(async () => host.querySelector('[aria-label="Restore SUPP-0001"]').click());
    assert.ok(host.textContent.includes('Recycle bin is empty.'));
    await act(async () => button('Supplier list').click());assert.ok(host.querySelector('tbody').textContent.includes('Lanka Trading'));
    await act(async () => host.querySelector('[aria-label="Delete Supplier"]').click());
    await act(async () => button('Move to recycle bin').click());
    await act(async () => button('Recycle bin').click());
    await act(async () => host.querySelector('[aria-label="Permanently delete SUPP-0001"]').click());
    assert.equal(purged,false);assert.ok(host.querySelector('[role="dialog"]').textContent.includes('cannot be restored'));
    await act(async () => button('Delete permanently').click());
    assert.equal(purged,true);assert.ok(host.textContent.includes('Recycle bin is empty.'));
    assert.equal(host.querySelector('[role="dialog"]'),null);
  } finally {
    await act(async () => new Promise(resolve => setTimeout(resolve,5100)));
    await act(async () => root.unmount()); await server.close(); await window.happyDOM.close();
    for (const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];
  }
});
