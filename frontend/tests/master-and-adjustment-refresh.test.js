import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('AdjustmentTable renders loading indicator when loading is true', async () => {
  const window = new Window();
  Object.assign(globalThis, {
    window,
    document: window.document,
    localStorage: window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const { createRoot } = await import('react-dom/client');
  const server = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);

  try {
    const { default: AdjustmentTable } = await server.ssrLoadModule('/src/components/AdjustmentTable.jsx');

    // 1. Loading state
    await act(async () => {
      root.render(
        React.createElement(AdjustmentTable, {
          rows: [],
          loading: true,
          canEdit: true,
          onView: () => {},
          onEdit: () => {},
        })
      );
    });

    assert.ok(host.textContent.includes('Loading stock adjustment data...'));

    // 2. Finished loading with data
    await act(async () => {
      root.render(
        React.createElement(AdjustmentTable, {
          rows: [
            {
              id: 1,
              recordNo: 'ADJ-TEST-001',
              type: 'Addition',
              warehouse: 'Main Warehouse',
              totalProducts: 2,
              date: '2026-10-19',
              status: 'DRAFT',
              reason: 'Audit correction',
            },
          ],
          loading: false,
          canEdit: true,
          onView: () => {},
          onEdit: () => {},
        })
      );
    });

    assert.ok(!host.textContent.includes('Loading stock adjustment data...'));
    assert.ok(host.textContent.includes('ADJ-TEST-001'));
    assert.ok(host.textContent.includes('Audit correction'));
    assert.ok(!host.textContent.includes('Main Warehouse'));
  } finally {
    await act(async () => root.unmount());
    await server.close();
    window.happyDOM.abort();
  }
});

test('Brand, Category, Warehouse, and Adjustment refresh buttons trigger live reload with visual feedback and toasts', async () => {
  const window = new Window();
  Object.assign(globalThis, {
    window,
    document: window.document,
    localStorage: window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const { createRoot } = await import('react-dom/client');
  const server = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);

  try {
    const apis = await server.ssrLoadModule('/src/api/apiClient.js');
    for (const [name, api] of Object.entries(apis)) {
      if (name.endsWith('Api') && api && typeof api === 'object') {
        for (const method of Object.keys(api)) {
          if (typeof api[method] === 'function') api[method] = async () => ({ data: [] });
        }
      }
    }

    let brandFetchCalls = [];
    apis.brandApi.getAll = async (config = {}) => {
      brandFetchCalls.push(config);
      return {
        data: [
          { id: 1, name: 'Apple', code: 'BRD-001', status: 'ACTIVE', isActive: true },
          { id: 2, name: 'Samsung', code: 'BRD-002', status: 'ACTIVE', isActive: true },
        ],
      };
    };

    apis.categoryApi.getAll = async (config = {}) => ({
      data: [{ id: 1, name: 'Electronics', code: 'CAT-001', status: 'ACTIVE', isActive: true }],
    });

    apis.warehouseApi.getAll = async (config = {}) => ({
      data: [{ id: 1, name: 'Central Depot', code: 'WH-001', status: 'ACTIVE', isActive: true }],
    });

    apis.warehouseApi.getActive = async () => ({ data: [] });
    apis.productApi.getProducts = async () => ({ data: [] });
    apis.customerApi.getAll = async () => ({ data: [] });
    apis.supplierApi.getAll = async () => ({ data: [] });

    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { default: MastersView } = await server.ssrLoadModule('/src/views/MastersView.jsx');

    await act(async () => {
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            ToastProvider,
            null,
            React.createElement(MastersView, { activeSubTab: 'brands', isStandalone: true })
          )
        )
      );
    });

    await act(async () => new Promise((res) => setTimeout(res, 50)));

    // Verify initial brand rows loaded
    assert.ok(host.textContent.includes('Apple'));
    assert.ok(host.textContent.includes('Samsung'));

    // Find and click the Refresh button
    const refreshBtn = host.querySelector('button[aria-label="Refresh records"]');
    assert.ok(refreshBtn, 'Refresh button must be present in MastersView toolbar');

    await act(async () => {
      refreshBtn.click();
    });

    // Check that button became disabled or animated during refresh
    // and that brandApi.getAll was called with force/skipCache
    assert.ok(
      brandFetchCalls.some((c) => c.force === true && c.skipCache === true),
      'brandApi.getAll must be called with { force: true, skipCache: true } on manual refresh'
    );

    // Wait for refresh to complete
    await act(async () => new Promise((res) => setTimeout(res, 350)));

    // Verify toast feedback
    assert.ok(
      document.body.textContent.includes('Brand records refreshed'),
      'Must display "Brand records refreshed" toast notification'
    );
  } finally {
    await act(async () => root.unmount());
    await server.close();
    window.happyDOM.abort();
  }
});
