import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {Window} from 'happy-dom';
import { createServer } from 'vite';

test('target-only roles can view or manage ranges without customer creation access', async () => {
  const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const server = await createServer({
    server: { middlewareMode: true,hmr:false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const apis=await server.ssrLoadModule('/src/api/apiClient.js');for(const[name,api]of Object.entries(apis))if(name.endsWith('Api')&&api&&typeof api==='object')for(const method of Object.keys(api))if(typeof api[method]==='function')api[method]=async()=>({data:[]});
    localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);
    let permission='CUSTOMER_TARGET_VIEW';apis.authApi.getMe=async()=>({data:{username:'target-staff',roles:['ROLE_TARGET'],permissions:[permission]}});
    const { default: CustomersHub } = await server.ssrLoadModule('/src/views/CustomersHub.jsx');
    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const { customerTargetApi } = await server.ssrLoadModule('/src/api/apiClient.js');

    assert.ok(customerTargetApi, 'customerTargetApi should be exported');
    assert.equal(typeof customerTargetApi.getAll, 'function');
    assert.equal(typeof customerTargetApi.getCustomerProgress, 'function');
    assert.equal(typeof customerTargetApi.create, 'function');
    assert.equal(typeof customerTargetApi.update, 'function');
    assert.equal(typeof customerTargetApi.toggleActive, 'function');

    await act(async()=>root.render(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          ToastProvider,
          null,
          React.createElement(CustomersHub, { activeSubTab: 'targets' })
        )
      )
    ));
    const button=label=>[...host.querySelectorAll('button')].find(element=>element.textContent.trim().startsWith(label));
    assert.ok(host.querySelector('.erp-tab[data-active="true"]').textContent.includes('Range & Targets'));
    assert.equal(button('New Customer').disabled,true);
    await act(async()=>button('Range Tiers Setup').click());
    assert.equal(button('New Range Tier'),undefined,'View permission does not grant range creation');
    permission='CUSTOMER_TARGET_MANAGE';await act(async()=>window.dispatchEvent(new window.Event('erp:roles_updated')));
    assert.equal(button('New Customer').disabled,true);
    assert.ok(button('New Range Tier'));assert.equal(button('New Range Tier').disabled,false);
  } finally {
    await act(async()=>root.unmount());
    await server.close();
    await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];
  }
});
