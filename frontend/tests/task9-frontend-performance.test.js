import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act, useState } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';
import fs from 'node:fs';
import path from 'node:path';

test('TASK 9: React Initial Loading, Code Splitting, and Retained Workspaces Verification', async (t) => {
  const window = new Window();
  Object.assign(globalThis, {
    window,
    document: window.document,
    CustomEvent: window.CustomEvent,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
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
    const { lazyWithRetry } = await server.ssrLoadModule('/src/utils/lazyWithRetry.js');
    const { default: RetainedWorkspaces, WorkspaceActivity } = await server.ssrLoadModule('/src/components/RetainedWorkspaces.jsx');
    const { default: WorkspaceFallback } = await server.ssrLoadModule('/src/components/WorkspaceFallback.jsx');
    const { moduleLoaders } = await server.ssrLoadModule('/src/App.jsx');

    await t.test('1. lazyWithRetry loads dynamic modules and retries on transient chunk load failure', async () => {
      let attempts = 0;
      const MockComponent = () => React.createElement('div', { id: 'mock-target' }, 'Loaded Content');

      const resilientImporter = () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error('Failed to fetch dynamically imported module /src/views/MockView.js');
          err.name = 'TypeError';
          throw err;
        }
        return Promise.resolve({ default: MockComponent });
      };

      const LazyComp = lazyWithRetry(resilientImporter);
      assert.ok(LazyComp, 'lazyWithRetry creates a valid React lazy component');

      // Mount inside React Suspense
      await act(async () => {
        root.render(
          React.createElement(React.Suspense, { fallback: React.createElement('div', { id: 'fallback' }, 'Loading') },
            React.createElement(LazyComp)
          )
        );
      });

      // After retry delay (1000ms), wait for component to resolve
      await new Promise((r) => setTimeout(r, 1100));
      await act(async () => {});

      assert.equal(attempts, 2, 'Importer was retried after chunk error');
      const target = document.getElementById('mock-target');
      assert.ok(target, 'Target component mounted successfully after chunk retry');
    });

    await t.test('2. RetainedWorkspaces only mounts active workspace initially; unvisited workspaces are not mounted', async () => {
      let dashboardMounts = 0;
      let inventoryMounts = 0;

      function Dashboard() {
        React.useEffect(() => {
          dashboardMounts++;
        }, []);
        return React.createElement('div', { id: 'dashboard-content' }, 'Dashboard View');
      }

      function Inventory() {
        React.useEffect(() => {
          inventoryMounts++;
        }, []);
        return React.createElement('div', { id: 'inventory-content' }, 'Inventory View');
      }

      const allowed = ['dashboard', 'inventory', 'invoicing'];

      // Render with current="dashboard"
      await act(async () => {
        root.render(
          React.createElement(RetainedWorkspaces, {
            current: 'dashboard',
            allowed,
            render: (id) => (id === 'dashboard' ? React.createElement(Dashboard) : React.createElement(Inventory)),
          })
        );
      });

      assert.equal(dashboardMounts, 1, 'Dashboard mounted once');
      assert.equal(inventoryMounts, 0, 'Unvisited Inventory workspace was NEVER mounted');
      assert.ok(document.getElementById('dashboard-content'), 'Dashboard is in DOM');
      assert.equal(document.getElementById('inventory-content'), null, 'Inventory is NOT in DOM');

      // Navigate to "inventory"
      await act(async () => {
        root.render(
          React.createElement(RetainedWorkspaces, {
            current: 'inventory',
            allowed,
            render: (id) => (id === 'dashboard' ? React.createElement(Dashboard) : React.createElement(Inventory)),
          })
        );
      });

      assert.equal(dashboardMounts, 1, 'Dashboard did not remount');
      assert.equal(inventoryMounts, 1, 'Inventory mounted upon first navigation');

      // Both are in DOM, but dashboard is hidden
      const dashSection = document.querySelector('[data-workspace="dashboard"]');
      const invSection = document.querySelector('[data-workspace="inventory"]');
      assert.ok(dashSection, 'Dashboard section retained in DOM');
      assert.equal(dashSection.getAttribute('hidden'), '', 'Dashboard section is hidden');
      assert.equal(dashSection.style.display, 'none', 'Dashboard section display is none');
      assert.ok(invSection, 'Inventory section is in DOM');
      assert.equal(invSection.getAttribute('hidden'), null, 'Inventory section is visible');
      assert.equal(invSection.style.display, 'flex', 'Inventory section display is flex');

      // Return to "dashboard"
      await act(async () => {
        root.render(
          React.createElement(RetainedWorkspaces, {
            current: 'dashboard',
            allowed,
            render: (id) => (id === 'dashboard' ? React.createElement(Dashboard) : React.createElement(Inventory)),
          })
        );
      });

      assert.equal(dashboardMounts, 1, 'Dashboard preserved instance (0 remounts)');
      assert.equal(inventoryMounts, 1, 'Inventory preserved instance (0 remounts)');
      assert.equal(dashSection.style.display, 'flex', 'Dashboard restored to display flex');
      assert.equal(invSection.style.display, 'none', 'Inventory set to display none');
    });

    await t.test('3. Changing user session key discards retained workspaces preventing cross-employee leakage', async () => {
      let renderCount = 0;
      function TestWorkspace() {
        React.useEffect(() => {
          renderCount++;
        }, []);
        return React.createElement('div', null, 'Workspace');
      }

      // User A logged in
      await act(async () => {
        root.render(
          React.createElement(
            'div',
            { key: 'user-A' },
            React.createElement(RetainedWorkspaces, {
              current: 'dashboard',
              allowed: ['dashboard', 'inventory'],
              render: () => React.createElement(TestWorkspace),
            })
          )
        );
      });

      assert.equal(renderCount, 1, 'Workspace mounted for User A');

      // User A logs out and User B logs in (key changes)
      await act(async () => {
        root.render(
          React.createElement(
            'div',
            { key: 'user-B' },
            React.createElement(RetainedWorkspaces, {
              current: 'dashboard',
              allowed: ['dashboard', 'inventory'],
              render: () => React.createElement(TestWorkspace),
            })
          )
        );
      });

      assert.equal(renderCount, 2, 'Previous retained instance was destroyed and fresh instance mounted for User B');
    });

    await t.test('4. Smart prefetching moduleLoaders exports valid dynamic import functions for all top-level modules', () => {
      assert.ok(moduleLoaders, 'moduleLoaders mapping exists');
      const expectedModules = ['dashboard', 'inventory', 'purchasing', 'invoicing', 'payments', 'employees', 'reports', 'customers', 'delivery', 'recycle-bin'];
      for (const mod of expectedModules) {
        assert.equal(typeof moduleLoaders[mod], 'function', `moduleLoaders contains loader for ${mod}`);
      }
    });

    await t.test('5. WorkspaceFallback renders accessible loading spinner without layout jump', async () => {
      await act(async () => {
        root.render(React.createElement(WorkspaceFallback, { id: 'inventory-hub' }));
      });

      const statusEl = document.querySelector('[role="status"]');
      assert.ok(statusEl, 'Fallback has role="status"');
      assert.equal(statusEl.getAttribute('aria-live'), 'polite', 'Fallback has aria-live="polite"');
      assert.ok(statusEl.textContent.includes('Loading Inventory Hub...'), 'Displays formatted module label');
    });

    await t.test('6. Production build artifacts verify code splitting and vendor separation', () => {
      const distDir = path.resolve('dist/assets');
      assert.ok(fs.existsSync(distDir), 'dist/assets directory exists');

      const files = fs.readdirSync(distDir);
      const jsFiles = files.filter(f => f.endsWith('.js'));

      // Check chunk count
      assert.ok(jsFiles.length > 10, `Expected > 10 code-split chunks, found ${jsFiles.length}`);

      // Verify specific code-split chunks exist
      const hasDashboard = jsFiles.some(f => f.startsWith('DashboardView'));
      const hasInventory = jsFiles.some(f => f.startsWith('InventoryHub'));
      const hasInvoicing = jsFiles.some(f => f.startsWith('InvoicingHub'));
      const hasVendorReact = jsFiles.some(f => f.startsWith('vendor-react'));
      const hasVendorAxios = jsFiles.some(f => f.startsWith('vendor-axios'));

      assert.ok(hasDashboard, 'DashboardView is split into its own chunk');
      assert.ok(hasInventory, 'InventoryHub is split into its own chunk');
      assert.ok(hasInvoicing, 'InvoicingHub is split into its own chunk');
      assert.ok(hasVendorReact, 'vendor-react chunk exists');
      assert.ok(hasVendorAxios, 'vendor-axios chunk exists');

      // Verify index.js size is well below 500 kB
      const indexFile = jsFiles.find(f => f.startsWith('index-'));
      assert.ok(indexFile, 'index-* entry chunk exists');
      const indexStats = fs.statSync(path.join(distDir, indexFile));
      const indexKb = indexStats.size / 1024;
      assert.ok(indexKb < 250, `Initial entry bundle is ${indexKb.toFixed(2)} KB (target < 250 KB)`);
    });
  } finally {
    await act(async () => {
      root.unmount();
    });
    await server.close();
    window.happyDOM.abort();
  }
});
