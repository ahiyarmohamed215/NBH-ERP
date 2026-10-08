import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('all purchasing creation forms use inline workspaces and report focus mode', async () => {
  const window = new Window();
  Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');
  const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try {
    const apis=await server.ssrLoadModule('/src/api/apiClient.js');
    for (const [name,api] of Object.entries(apis)) {
      if (!name.endsWith('Api') || !api || typeof api !== 'object') continue;
      for (const method of Object.keys(api)) if(typeof api[method]==='function') api[method]=async()=>({data:[]});
    }
    apis.productApi.getProducts=async()=>({data:{content:[{id:1,sku:'TEST-1',name:'Test product',costPrice:4}]}});
    const {AuthProvider}=await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const {ToastProvider}=await server.ssrLoadModule('/src/context/ToastContext.jsx');
    for (const name of ['GrnView','GtnView','PrnView','PurchaseOrdersView']) {
      const {default:View}=await server.ssrLoadModule(`/src/views/${name}.jsx`);
      const ref=React.createRef();let focused=false;
      await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(ToastProvider,null,
        React.createElement(View,{key:name,ref,onFormModeChange:value=>{focused=value;}})))));
      await act(async()=>ref.current.openCreate());
      assert.equal(focused,true,`${name} should hide hub navigation`);
      const form=host.querySelector('.purchase-document,.grn-page');
      assert.ok(form,`${name} should have an inline editor`);
      assert.notEqual(form.style.position,'fixed');
      assert.ok(form.querySelector('input'),'Header fields should be visible');
      assert.ok(/Save (as )?Draft/.test(host.textContent),`${name}: save action should be visible`);
      assert.equal(host.querySelector('.modal-backdrop'),null);
      if (name !== 'GrnView') {
        const productSelect=form.querySelector('.purchase-entry select');
        await act(async()=>{productSelect.value='1';productSelect.dispatchEvent(new window.Event('change',{bubbles:true}));});
        const add=form.querySelector('.purchase-entry > button');
        assert.equal(add.disabled,false,`${name}: selected product can be added`);
        await act(async()=>add.click());
        assert.equal(form.querySelectorAll('tbody tr').length,1,`${name}: item appears in table`);
        assert.ok(form.querySelector('tbody').textContent.includes('Test product'));
        const remove=form.querySelector('[aria-label="Remove item 1"]');
        await act(async()=>remove.click());
        assert.equal(form.querySelectorAll('tbody tr').length,0);
      }
      const back=[...form.querySelectorAll('button')].find(button=>/Back to/.test(button.textContent));
      assert.ok(back,`${name} should have a back action`);
      await act(async()=>back.click());
      assert.equal(focused,false);
      assert.equal(host.querySelector('.purchase-document,.grn-page'),null);
    }
  } finally {
    await act(async()=>root.unmount());await server.close();await window.happyDOM.close();
    for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];
  }
});
