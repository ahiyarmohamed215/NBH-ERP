import test from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('profile changes and automatic refresh do not restart idle time; offline logout clears the UI immediately', async () => {
  const window = new Window();
  Object.assign(globalThis, {window, document: window.document, localStorage: window.localStorage,
    sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true});
  const {createRoot} = await import('react-dom/client');
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const server = await createServer({server: {middlewareMode: true, hmr: false}, appType: 'custom', optimizeDeps: {noDiscovery: true, include: []}});
  const originalNow = Date.now;
  try {
    const apis = await server.ssrLoadModule('/src/api/apiClient.js');
    const {AuthProvider, useAuth} = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    apis.beginUserSession();
    apis.setAccessToken(`test.${Buffer.from(JSON.stringify({exp: Math.floor(Date.now()/1000)+7200})).toString('base64url')}.sig`);
    const startedAt = apis.getLastUserActivity();
    let profileCalls = 0, context, releaseLogout, interaction, heartbeats = 0;
    const addListener = window.addEventListener.bind(window);
    window.addEventListener = (type, listener, options) => {
      if (type === 'mousedown') interaction = listener;
      addListener(type, listener, options);
    };
    apis.authApi.getMe = async () => { profileCalls++; return {data: {username: 'staff', fullName: 'Staff'}}; };
    apis.authApi.logout = () => new Promise(resolve => {releaseLogout = resolve;});
    apis.authApi.activity = async () => {heartbeats++; return {data: {}};};
    function Session() {context = useAuth(); return React.createElement('span', null, context.user?.fullName || 'signed-out');}
    await act(async () => root.render(React.createElement(AuthProvider, null, React.createElement(Session))));
    assert.equal(profileCalls, 1, 'profile object changes must not start another profile fetch');
    Date.now = () => startedAt + 29*60000;
    await act(async () => {context.updateUser({fullName: 'Updated'});});
    assert.equal(apis.getLastUserActivity(), startedAt, 'editing a profile must not restart the idle effect');
    await act(async () => window.dispatchEvent(new window.Event('erp:roles_updated')));
    assert.equal(profileCalls, 2);
    assert.equal(apis.getLastUserActivity(), startedAt, 'background profile fetch is not user activity');
    await act(async () => window.dispatchEvent(new window.Event('mousemove')));
    assert.equal(apis.getLastUserActivity(), startedAt, 'synthetic UI events must not count as activity');
    // Exercise the native listener with trusted input supplied by the test harness.
    await act(async () => interaction({isTrusted: true}));
    assert.equal(apis.getLastUserActivity(), startedAt + 29*60000);
    assert.equal(heartbeats, 1, 'actual interaction must update the server activity deadline');
    Date.now = () => startedAt + apis.IDLE_TIMEOUT_MS;
    await act(async () => window.dispatchEvent(new window.Event('focus')));
    assert.ok(context.user, 'working employees remain signed in beyond 30 minutes from login');
    Date.now = () => startedAt + 29*60000 + apis.IDLE_TIMEOUT_MS;
    await act(async () => window.dispatchEvent(new window.Event('focus')));
    assert.equal(host.textContent, 'signed-out', 'logout must not wait for server response');
    assert.equal(apis.getAccessToken(), null);
    assert.match(sessionStorage.getItem('nbh_session_expired'), /30 minutes of inactivity/);
    await act(async () => releaseLogout({data: {}}));
  } finally {
    Date.now = originalNow;
    await act(async () => root.unmount()); await server.close(); await window.happyDOM.close();
    for (const key of ['window','document','localStorage','sessionStorage','IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];
  }
});
