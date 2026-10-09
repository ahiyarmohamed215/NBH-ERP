import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

test('CustomerMonthlyRangeHub and customerMonthlyRangeApi test suite', async () => {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });

  try {
    const { customerMonthlyRangeApi } = await server.ssrLoadModule('/src/api/apiClient.js');
    const { default: CustomerMonthlyRangeHub } = await server.ssrLoadModule('/src/views/CustomerMonthlyRangeHub.jsx');
    const { default: CustomersHub } = await server.ssrLoadModule('/src/views/CustomersHub.jsx');
    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');

    // 1. Check all API methods are properly exported
    assert.ok(customerMonthlyRangeApi, 'customerMonthlyRangeApi should be exported');
    assert.equal(typeof customerMonthlyRangeApi.getAllRanges, 'function');
    assert.equal(typeof customerMonthlyRangeApi.createRange, 'function');
    assert.equal(typeof customerMonthlyRangeApi.updateRange, 'function');
    assert.equal(typeof customerMonthlyRangeApi.toggleStatus, 'function');
    assert.equal(typeof customerMonthlyRangeApi.getAuditTrail, 'function');
    assert.equal(typeof customerMonthlyRangeApi.getCustomerProgress, 'function');
    assert.equal(typeof customerMonthlyRangeApi.getCustomerHistory, 'function');
    assert.equal(typeof customerMonthlyRangeApi.getMyTargets, 'function');
    assert.equal(typeof customerMonthlyRangeApi.getNearTargets, 'function');
    assert.equal(typeof customerMonthlyRangeApi.getManagerDashboard, 'function');
    assert.equal(typeof customerMonthlyRangeApi.getStaffPerformance, 'function');
    assert.equal(typeof customerMonthlyRangeApi.assignStaff, 'function');
    assert.equal(typeof customerMonthlyRangeApi.syncMonth, 'function');

    // 2. Render CustomerMonthlyRangeHub directly
    const hubHtml = renderToString(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          ToastProvider,
          null,
          React.createElement(CustomerMonthlyRangeHub, {
            customers: [{ id: 1, name: 'Kamal Perera', customerCode: 'CUST-001' }],
            salesmen: [{ id: 10, username: 'saman', fullName: 'Saman Silva' }],
            canEdit: true,
          })
        )
      )
    );

    assert.ok(hubHtml.includes('Customer Range &amp; Targets Management'), 'Should render Customer Range & Targets Management header');
    assert.ok(hubHtml.includes('Customer Dashboard'), 'Should have Customer Dashboard sub-tab');
    assert.ok(hubHtml.includes('Range Setup'), 'Should have Range Setup sub-tab');
    assert.ok(hubHtml.includes('Monthly Reports'), 'Should have Monthly Reports sub-tab');
    assert.ok(hubHtml.includes('Promotional Campaigns'), 'Should have Promotional Campaigns sub-tab');
    assert.ok(hubHtml.includes('Calculation Period'), 'Should render calculation period selector');

    // 3. Render through CustomersHub Tab 4
    const customersHubHtml = renderToString(
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

    assert.ok(customersHubHtml.includes('Customer Range &amp; Targets Management'), 'CustomersHub should embed CustomerMonthlyRangeHub');
  } finally {
    await server.close();
  }
});
