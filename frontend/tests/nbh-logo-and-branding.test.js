import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';
import fs from 'node:fs';

test('NBH Brand Luxury Lettermark with Registered Emblem (®) renders in Login, Signup, and Sidebar, with white background favicon', async () => {
  const window = new Window({ url: 'http://localhost/#view=dashboard' });
  Object.assign(globalThis, {
    window,
    document: window.document,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    history: window.history,
    IS_REACT_ACT_ENVIRONMENT: true,
  });

  const { createRoot } = await import('react-dom/client');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);

  const server = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });

  try {
    const apis = await server.ssrLoadModule('/src/api/apiClient.js');
    for (const [name, api] of Object.entries(apis)) {
      if (name.endsWith('Api') && api && typeof api === 'object') {
        for (const method of Object.keys(api)) {
          if (typeof api[method] === 'function') api[method] = async () => ({ data: [] });
        }
      }
    }

    localStorage.setItem(
      'nbh_token',
      `test.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.sig`
    );
    apis.authApi.getMe = async () => ({
      data: { id: 1, username: 'admin', fullName: 'Admin User', roles: ['ROLE_ADMIN'], permissions: [] },
    });

    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const { default: NbhLogo } = await server.ssrLoadModule('/src/components/NbhLogo.jsx');

    // 1. Verify NbhLogo component renders blue NBH lettermark with registered emblem (®) and without background box
    await act(async () => {
      root.render(React.createElement(NbhLogo, { size: 24 }));
    });

    const svg = host.querySelector('svg[aria-label="NBH® Logo"]');
    assert.ok(svg, 'NbhLogo SVG must render with accessible aria-label="NBH® Logo"');
    
    // Check "NBH" lettermark
    const texts = [...host.querySelectorAll('text')].map(t => t.textContent.trim());
    assert.ok(texts.includes('NBH'), 'NbhLogo must have NBH lettermark');
    assert.ok(texts.includes('R'), 'NbhLogo must have registered trademark R emblem');

    // Verify there is NO background box (no rects) on the main logo
    const rects = host.querySelectorAll('rect');
    assert.equal(rects.length, 0, 'Pure luxury lettermark must not have background container box');

    // Verify registered circle emblem exists
    const regCircle = host.querySelector('circle');
    assert.ok(regCircle, 'Registered trademark circle must exist in top right');

    // 2. Verify Favicon SVG has white background
    const faviconContent = fs.readFileSync('public/favicon.svg', 'utf8');
    assert.ok(faviconContent.includes('fill="#ffffff"'), 'Favicon SVG must have white background');
    assert.ok(faviconContent.includes('NBH'), 'Favicon SVG must have NBH lettermark');

    // 3. Verify LoginView renders luxury blue NBH® logo and removed "Three-Wheel Parts"
    const { default: LoginView } = await server.ssrLoadModule('/src/views/LoginView.jsx');
    await act(async () => {
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(ToastProvider, null, React.createElement(LoginView, { onSwitchToSignup: () => {} }))
        )
      );
    });

    const loginLogo = host.querySelector('svg[aria-label="NBH® Logo"]');
    assert.ok(loginLogo, 'LoginView must render luxury NBH® letter logo');
    assert.equal(host.textContent.includes('Three-Wheel Parts'), false, 'LoginView must not have Three-Wheel Parts text');

    // 4. Verify SignupView renders luxury blue NBH® logo and removed "Three-Wheel Parts"
    const { default: SignupView } = await server.ssrLoadModule('/src/views/SignupView.jsx');
    await act(async () => {
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(ToastProvider, null, React.createElement(SignupView, { onSwitchToLogin: () => {} }))
        )
      );
    });

    const signupLogo = host.querySelector('svg[aria-label="NBH® Logo"]');
    assert.ok(signupLogo, 'SignupView must render luxury NBH® letter logo');
    assert.equal(host.textContent.includes('Three-Wheel Parts'), false, 'SignupView must not have Three-Wheel Parts text');

    // 5. Verify Sidebar renders luxury blue NBH® logo in both expanded and compact modes without "Three-Wheel Parts"
    const { default: App } = await server.ssrLoadModule('/src/App.jsx');

    await act(async () => {
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(ToastProvider, null, React.createElement(App))
        )
      );
    });

    const sidebarLogo = host.querySelector('aside.glass-sidebar svg[aria-label="NBH® Logo"]');
    assert.ok(sidebarLogo, 'Sidebar must render luxury NBH® letter logo');
    assert.equal(host.querySelector('aside.glass-sidebar').textContent.includes('Three-Wheel Parts'), false, 'Sidebar must not have Three-Wheel Parts text');
  } finally {
    await act(async () => root.unmount());
    await server.close();
    await window.happyDOM.close();
    for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'history', 'IS_REACT_ACT_ENVIRONMENT']) {
      delete globalThis[key];
    }
  }
});
