import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('POS route search bar sequences focus to customer and product, filtering customers strictly by selected route', async () => {
  const window = new Window({ url: 'http://localhost/#view=invoicing&tab=sales' });
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
    apis.setAccessToken(
      `test.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.sig`
    );
    apis.authApi.getMe = async () => ({
      data: { username: 'cashier', roles: ['ROLE_CASHIER'], permissions: ['SALES_CREATE'] },
    });

    const routes = [
      { id: 101, routeCode: 'DR-01', routeName: 'Colombo North', area: 'Western', assignedStaffName: 'Sunil Perera', startLocation: 'Depot A', endLocation: 'Pettah', deliveryDays: 'Mon, Wed, Fri' },
      { id: 102, routeCode: 'DR-02', routeName: 'Kandy Central', area: 'Central', assignedStaffName: 'Nimal Silva', startLocation: 'Main Store', endLocation: 'Peradeniya', deliveryDays: 'Tue, Thu' },
    ];
    apis.deliveryRouteApi.getActive = async () => ({ data: routes });

    const assignedCustomers = [
      { id: 1, customerCode: 'CUST-001', name: 'Colombo Hardware', deliveryRouteId: 101, currentBalance: 0, creditLimit: 50000 },
      { id: 2, customerCode: 'CUST-002', name: 'Negombo Traders', deliveryRouteId: 101, currentBalance: 0, creditLimit: 50000 },
      { id: 3, customerCode: 'CUST-003', name: 'Kandy Stores', deliveryRouteId: 102, currentBalance: 0, creditLimit: 50000 },
    ];

    apis.customerApi.getPosCustomers = async (paramsOrConfig) => {
      const routeId = typeof paramsOrConfig === 'number' || typeof paramsOrConfig === 'string'
        ? paramsOrConfig
        : paramsOrConfig?.params?.deliveryRouteId;
      if (routeId) {
        return { data: assignedCustomers.filter(c => String(c.deliveryRouteId) === String(routeId)) };
      }
      return { data: assignedCustomers };
    };

    apis.productApi.searchActive = async () => ({
      data: [{ id: 10, sku: 'PROD-1', name: 'Cement 50kg', sellingPrice: 2200, warehouseId: 1, brandId: 1, categoryId: 1, unitOfMeasure: 'BAG' }],
    });
    apis.inventoryApi.getBalances = async () => ({
      data: { content: [{ productId: 10, warehouseId: 1, quantity: 50, availableQuantity: 50 }] },
    });
    apis.warehouseApi.getActive = async () => ({ data: [{ id: 1, name: 'Main Warehouse' }] });
    apis.brandApi.getActive = async () => ({ data: [{ id: 1, name: 'Tokyo Super' }] });
    apis.categoryApi.getActive = async () => ({ data: [{ id: 1, name: 'Cement' }] });

    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const { default: Hub } = await server.ssrLoadModule('/src/App.jsx');

    await act(async () =>
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(AuthProvider, null, React.createElement(ToastProvider, null, React.createElement(Hub)))
        )
      )
    );

    const open = () => [...host.querySelectorAll('button')].find(button => button.textContent.includes('Open POS'));
    for (let attempt = 0; attempt < 50 && !open(); attempt++) {
      await act(async () => new Promise(resolve => setTimeout(resolve, 100)));
    }
    assert.ok(open(), 'POS button must be available');
    await act(async () => open().click());

    // 1. Verify Route Search Input exists and was auto-focused
    const routeInput = host.querySelector('[placeholder="Select Route..."]');
    assert.ok(routeInput, 'Route search input must exist');
    await act(async () => new Promise(resolve => setTimeout(resolve, 200)));
    assert.equal(document.activeElement, routeInput, 'Route search must receive initial focus on mount');

    // 1b. Verify no 'Select delivery route first' message in POS UI
    assert.equal(host.textContent.includes('Select delivery route first'), false, 'UI must not display "Select delivery route first"');

    // 2. Open Route dropdown and verify rich route card layout and width
    await act(async () => routeInput.focus());
    const routeDropdown = host.querySelector('.pos-route-search-dropdown');
    assert.ok(routeDropdown, 'Route dropdown must be open');
    assert.equal(routeDropdown.style.width, '100%', 'Route dropdown width must match search bar (width: 100%)');

    const firstRouteRow = routeDropdown.querySelector('.pos-customer-drop-row');
    assert.ok(firstRouteRow, 'First route row must exist');
    assert.ok(firstRouteRow.querySelector('.pos-route-area-badge'), 'Area badge must exist in route dropdown');
    assert.ok(firstRouteRow.textContent.includes('Western'), 'Area must be displayed');
    assert.ok(firstRouteRow.textContent.includes('Sunil Perera'), 'Assigned staff must be displayed in route dropdown');
    assert.ok(firstRouteRow.textContent.includes('Depot A → Pettah'), 'Route path must be displayed in route dropdown');
    assert.ok(firstRouteRow.textContent.includes('Mon, Wed, Fri'), 'Delivery days must be displayed in route dropdown');

    // Select Colombo North (Route 101)
    await act(async () => routeInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));

    assert.equal(routeInput.value, 'Colombo North', 'Selected route name must populate route search');

    // 3. Auto-jump focus to Customer Search input
    const customerInput = host.querySelector('[placeholder="Select Customer (F1)..."]');
    assert.ok(customerInput, 'Customer search input must exist');
    await act(async () => new Promise(resolve => setTimeout(resolve, 100)));
    assert.equal(document.activeElement, customerInput, 'Customer search must be focused after selecting route');

    // 4. Verify Customer dropdown shows ONLY customers for Route 101 and no route warning
    await act(async () => customerInput.focus());
    assert.equal(host.textContent.includes('Please select a Delivery Route first'), false, 'Customer dropdown must not display "Please select a Delivery Route first"');
    const dropRows = [...host.querySelectorAll('.pos-customer-drop-row')];
    const customerNames = dropRows.map(r => r.querySelector('.pos-cdr-name')?.textContent.trim() || r.textContent);
    assert.ok(customerNames.some(n => n.includes('Colombo Hardware')), 'Must show Colombo Hardware');
    assert.ok(customerNames.some(n => n.includes('Negombo Traders')), 'Must show Negombo Traders');
    assert.ok(!customerNames.some(n => n.includes('Kandy Stores')), 'Must NOT show Kandy Stores from Route 102');

    // 5. Select Colombo Hardware -> Focus must auto-advance to Product Search
    await act(async () => customerInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
    assert.equal(customerInput.value, 'Colombo Hardware', 'Selected customer name must populate');

    const productInput = host.querySelector('[aria-label="Search POS products"]');
    assert.ok(productInput, 'Product search input must exist');
    await act(async () => new Promise(resolve => setTimeout(resolve, 100)));
    assert.equal(document.activeElement, productInput, 'Product search must be focused after selecting customer');

    // 6. Test Performance Dialog with Ranking Navigation Bar
    const performanceBtn = host.querySelector('[title="View monthly POS performance"]');
    assert.ok(performanceBtn, 'Performance button must exist');
    await act(async () => performanceBtn.click());

    const dialog = document.querySelector('.pos-performance-dialog');
    assert.ok(dialog, 'Performance dialog must be rendered');
    assert.ok(dialog.querySelector('#tab-pos-rankings'), 'Rankings tab must exist');
    assert.ok(dialog.querySelector('#tab-pos-held'), 'Onhold Bills tab must exist');
    assert.equal(dialog.querySelector('#pos-performance-title')?.textContent.trim(), 'Staff Rankings');

    // Switch to Onhold Bills tab
    await act(async () => dialog.querySelector('#tab-pos-held').click());
    assert.equal(dialog.querySelector('#pos-held-title')?.textContent.trim(), 'Held Bills');

    // Switch back to Staff Rankings tab
    await act(async () => dialog.querySelector('#tab-pos-rankings').click());
    assert.equal(dialog.querySelector('#pos-performance-title')?.textContent.trim(), 'Staff Rankings');

    // Close performance dialog
    await act(async () => dialog.querySelector('[aria-label="Close performance"]').click());
    assert.equal(document.querySelector('.pos-performance-dialog'), null, 'Performance dialog should close');

  } finally {
    await act(async () => root.unmount());
    await server.close();
    await window.happyDOM.close();
  }
});
