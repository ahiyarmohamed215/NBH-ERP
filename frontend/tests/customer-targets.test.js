import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

test('customer page renders Range & Targets tab without runtime errors', async () => {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
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

    const html = renderToString(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          ToastProvider,
          null,
          React.createElement(CustomersHub, { activeSubTab: 'targets' })
        )
      )
    );

    assert.ok(html.includes('Range &amp; Targets') || html.includes('Range & Targets'), 'CustomersHub should include Range & Targets tab');
    assert.ok(html.includes('Range &amp; Targets Management') || html.includes('Customer Range &amp; Targets') || html.includes('Customer Range & Targets'), 'CustomerTargetsTab should render header');
  } finally {
    await server.close();
  }
});
