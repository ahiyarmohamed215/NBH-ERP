import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import { Window } from 'happy-dom';
import { createServer } from 'vite';

test('authenticated employee navigation renders every tab and retired links fall back to the list', async () => {
  const window=new Window();Object.assign(globalThis,{window,document:window.document,localStorage:window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=await import('react-dom/client');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const server = await createServer({ server: { middlewareMode: true,hmr:false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const apis=await server.ssrLoadModule('/src/api/apiClient.js');for(const[name,api]of Object.entries(apis))if(name.endsWith('Api')&&api&&typeof api==='object')for(const method of Object.keys(api))if(typeof api[method]==='function')api[method]=async()=>({data:[]});
    localStorage.setItem('nbh_token',`test.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.sig`);apis.authApi.getMe=async()=>({data:{username:'admin',roles:['ROLE_ADMIN'],permissions:[]}});
    const { default: EmployeesHub } = await server.ssrLoadModule('/src/views/EmployeesHub.jsx');
    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    for (const activeSubTab of ['list', 'roles', 'pending-approvals', 'targets', 'attendance', 'payroll', 'commissions']) {
      await act(async()=>root.render(React.createElement(AuthProvider, null,
        React.createElement(ToastProvider, null, React.createElement(EmployeesHub, { activeSubTab })))));
      assert.ok(host.textContent.includes('Employee'), `Employee page should render for ${activeSubTab}`);
      assert.ok(!host.textContent.includes('FEATURE IN PROGRESS'));
      if (['targets', 'attendance', 'payroll', 'commissions'].includes(activeSubTab)) {
        assert.ok(host.querySelector('.erp-tab[data-active="true"]').textContent.includes('Employee List'), 'Removed modules must fall back to the list');
      }
    }
    const button=label=>[...host.querySelectorAll('button')].find(element=>element.textContent.trim()===label);
    for(const permission of ['ROLE_VIEW','ROLE_MANAGE']){
      apis.authApi.getMe=async()=>({data:{username:'role-staff',roles:['ROLE_LIMITED'],permissions:[permission]}});
      await act(async()=>window.dispatchEvent(new window.Event('erp:roles_updated')));
      assert.ok(host.querySelector('.erp-tab[data-active="true"]').textContent.includes('Employee Roles'));
      assert.equal(button('New Employee').disabled,true,'Role access must not grant employee creation');
      assert.equal(button('Create Employee Role').disabled,permission==='ROLE_VIEW');
    }
  } finally {
    await act(async()=>root.unmount());
    await server.close();
    await window.happyDOM.close();for(const key of ['window','document','localStorage','IS_REACT_ACT_ENVIRONMENT'])delete globalThis[key];
  }
});
