import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

test('employee page renders every navigation tab without runtime errors', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { default: EmployeesHub } = await server.ssrLoadModule('/src/views/EmployeesHub.jsx');
    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    for (const activeSubTab of ['list', 'roles', 'pending-approvals', 'targets', 'attendance', 'payroll', 'commissions']) {
      const html = renderToString(React.createElement(AuthProvider, null,
        React.createElement(ToastProvider, null, React.createElement(EmployeesHub, { activeSubTab }))));
      assert.ok(html.includes('Employee'), `Employee page should render for ${activeSubTab}`);
      assert.ok(!html.includes('FEATURE IN PROGRESS'));
      if (['targets', 'attendance', 'payroll', 'commissions'].includes(activeSubTab)) {
        assert.ok(html.includes('Loading employee records'), 'Removed modules must fall back to the list');
      }
    }
  } finally {
    await server.close();
  }
});
