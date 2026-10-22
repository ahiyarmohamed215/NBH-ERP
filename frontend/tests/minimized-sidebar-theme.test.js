import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('Sidebar minimize switches to ~92px rail layout (+0.3cm) with icon on top, standard caption label below, full-width small-height active line, and no scrolling', async () => {
  const window = new Window({ url: 'http://localhost/#view=dashboard' });
  Object.assign(globalThis, {
    window,
    document: window.document,
    localStorage: window.localStorage,
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

    const sidebar = host.querySelector('aside.glass-sidebar');
    assert.ok(sidebar, 'Sidebar must exist');
    assert.equal(sidebar.style.width, '92px', 'Sidebar must start minimized');
    assert.ok(sidebar.classList.contains('collapsed'));
    await act(async()=>host.querySelector('div[title="Click to expand sidebar (Ctrl+B)"]').click());
    assert.equal(sidebar.style.width, '205px', 'Expanded sidebar width should be 205px');

    // Find the minimize button
    const minimizeBtn = host.querySelector('button[title="Minimize Sidebar (Ctrl+B)"]');
    assert.ok(minimizeBtn, 'Minimize button must exist when sidebar is expanded');

    // 1. Click minimize button
    await act(async () => {
      minimizeBtn.click();
    });

    // 2. Verify collapsed state and width
    assert.ok(sidebar.classList.contains('collapsed'), 'Sidebar must have collapsed class');
    assert.equal(sidebar.style.width, '92px', 'Collapsed sidebar width must be 92px (~80px + 0.3 cm)');
    assert.equal(sidebar.style.minWidth, '92px');

    // Verify container has overflowY: 'hidden' to prevent scrolling
    const navContainer = sidebar.querySelector('div:first-child');
    assert.equal(navContainer.style.overflowY, 'hidden', 'Collapsed nav container must prevent scrolling');

    // 3. Verify each navigation button has column layout with icon on top and label below
    const navButtons = host.querySelectorAll('nav.erp-sidebar-nav button');
    assert.ok(navButtons.length > 0, 'Nav buttons must be present');

    const expectedLabels = ['Dashboard', 'Sales', 'Customers', 'Employees', 'Inventory', 'Purchasing', 'Delivery', 'Payment', 'Reports'];

    for (const btn of navButtons) {
      assert.equal(btn.style.flexDirection, 'column', 'Nav button in collapsed sidebar must have column direction');
      assert.equal(btn.style.alignItems, 'center', 'Nav button in collapsed sidebar must center items');

      // Check icon presence inside centered pill
      const iconPill = btn.querySelector('div');
      assert.ok(iconPill, 'Icon pill wrapper must exist');
      const icon = iconPill.querySelector('svg');
      assert.ok(icon, 'SVG icon must exist inside button');

      // Check label presence down below with standard caption font size
      const labelSpan = [...btn.querySelectorAll('span')].find(s => expectedLabels.includes(s.textContent.trim()));
      assert.ok(labelSpan, 'Label span must exist in collapsed mode');
      assert.equal(labelSpan.style.textAlign, 'center', 'Label must be centered');
      assert.equal(labelSpan.style.fontSize, 'var(--erp-text-caption, 11px)', 'Label must use standard caption font');
    }

    // 4. Verify Active Selection Line is FULL-WIDTH with SMALL HEIGHT (2px)
    const activeButton = [...navButtons].find(btn => btn.getAttribute('aria-current') === 'page');
    assert.ok(activeButton, 'Active button must exist');
    const activeIndicatorLine = activeButton.querySelector('span[style*="height: 2px"]');
    assert.ok(activeIndicatorLine, 'Active selection line must exist with 2px small height');
    assert.equal(activeIndicatorLine.style.left, '0px', 'Active line must span from left: 0');
    assert.equal(activeIndicatorLine.style.right, '0px', 'Active line must span to right: 0 (full width, not half)');
    assert.equal(activeIndicatorLine.style.height, '2px', 'Active line must have small height of 2px');

    // 5. Verify Profile trigger in collapsed state has avatar and small "Profile" label below
    const profileTrigger = host.querySelector('div[aria-label="Open profile menu"]');
    assert.ok(profileTrigger, 'Profile trigger must exist');
    assert.equal(profileTrigger.style.flexDirection, 'column', 'Profile trigger in collapsed state must have column direction');
    const profileLabel = [...profileTrigger.querySelectorAll('span')].find(span => span.textContent.trim() === 'Profile');
    assert.ok(profileLabel, 'Profile label span must exist');
    assert.equal(profileLabel.textContent.trim(), 'Profile', 'Profile label text must be "Profile"');
    assert.equal(profileLabel.style.fontSize, 'var(--erp-text-caption, 11px)', 'Profile label must use standard caption font');

    // 6. Click the logo package box to expand the sidebar back
    const logoBox = host.querySelector('div[title="Click to expand sidebar (Ctrl+B)"]');
    assert.ok(logoBox, 'Clickable logo to expand sidebar must exist');

    await act(async () => {
      logoBox.click();
    });

    assert.equal(sidebar.style.width, '205px', 'Sidebar expands back to 205px');
    assert.ok(!sidebar.classList.contains('collapsed'), 'Sidebar no longer has collapsed class');
  } finally {
    await act(async () => root.unmount());
    await server.close();
    await window.happyDOM.close();
    for (const key of ['window', 'document', 'localStorage', 'history', 'IS_REACT_ACT_ENVIRONMENT']) {
      delete globalThis[key];
    }
  }
});
