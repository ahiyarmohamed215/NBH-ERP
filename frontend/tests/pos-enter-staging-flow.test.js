import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('POS sequences Route -> Customer -> Product, customer dropdown does NOT show on mount, and Enter moves Qty -> Disc % -> Disc Rs -> Add to table', async () => {
  const window = new Window();
  Object.assign(globalThis, {
    window,
    document: window.document,
    localStorage: window.localStorage,
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
      data: { username: 'cashier', roles: ['ROLE_CASHIER'], permissions: ['SALES_CREATE'] },
    });
    apis.warehouseApi.getActive = async () => ({
      data: [{ id: 1, code: 'WH-1', name: 'Main Warehouse' }],
    });
    apis.deliveryRouteApi.getActive = async () => ({
      data: [{ id: 10, routeCode: 'R-1', routeName: 'Route 1' }],
    });
    apis.customerApi.getPosCustomers = async () => ({
      data: [{ id: 1, name: 'Default Customer', customerCode: 'CUST-0001', deliveryRouteId: 10, creditLimit: 0, currentBalance: 0 }],
    });
    apis.inventoryApi.getBalances = async () => ({
      data: {
        content: [
          { productId: 1, warehouseId: 1, quantity: 20, availableQuantity: 20 },
        ],
      },
    });
    apis.productApi.searchActive = async () => ({
      data: [
        { id: 1, name: 'Product Alpha', sku: 'SKU-001', sellingPrice: 100, warehouseId: 1 },
      ],
    });
    apis.salesApi.getPosStockLimits = async () => ({ data: [] });
    apis.salesApi.getHeldWorkspace = async () => ({ data: { bills: [] } });
    apis.salesApi.getHeld = async () => ({ data: [] });

    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const { default: PosView } = await server.ssrLoadModule('/src/views/PosView.jsx');

    await act(async () => {
      root.render(
        React.createElement(AuthProvider, null,
          React.createElement(ToastProvider, null,
            React.createElement(PosView, { onExitPos: () => {} })
          )
        )
      );
    });

    // Wait for initial data load and focus sequencing
    await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));

    // 1. Initial State: Route search must be focused
    const routeInput = host.querySelector('[placeholder="Select Route..."]');
    assert.ok(routeInput, 'Route search input must exist');
    assert.equal(document.activeElement, routeInput, 'Route search input must have initial focus');

    // Customer search dropdown must NOT be open on POS open
    const initialCustDropdown = host.querySelector('.pos-customer-selection .pos-customer-search-dropdown');
    assert.equal(initialCustDropdown, null, 'Customer dropdown must NOT show when POS opens');

    // 2. Select route with Enter
    await act(async () => {
      routeInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));

    // Customer search input must now have focus and its dropdown must be open
    const customerInput = host.querySelector('[placeholder="Select Customer (F1)..."]');
    assert.equal(document.activeElement, customerInput, 'Customer search input must be focused after selecting route');
    const custDropdownAfterRoute = host.querySelector('.pos-customer-selection .pos-customer-search-dropdown');
    assert.ok(custDropdownAfterRoute, 'Customer dropdown must show after route is selected');

    // 3. Select customer with Enter
    await act(async () => {
      customerInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));

    // Customer dropdown should close and product search must be focused
    assert.equal(host.querySelector('.pos-customer-selection .pos-customer-search-dropdown'), null, 'Customer dropdown should close after customer selection');
    const catalogInput = host.querySelector('[aria-label="Search POS products"]');
    assert.equal(document.activeElement, catalogInput, 'Product search input must be focused after selecting customer');

    // 4. Select product in catalog to open staging
    const rowAlpha = host.querySelector('.pos-inventory-row');
    assert.ok(rowAlpha, 'Product row must exist');
    await act(async () => {
      rowAlpha.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));

    // Quantity input must be focused
    const qtyInput = host.querySelector('.pos-staging-fields input[type="number"][min="1"]');
    assert.ok(qtyInput, 'Quantity input must be present in staging workstation');
    assert.equal(document.activeElement, qtyInput, 'Pressing Enter on product must focus Qty input');

    // Find Disc (%) and Disc (Rs.) inputs
    const discPercentInput = host.querySelector('.pos-staging-fields input[placeholder="0%"]');
    const discAmountInput = host.querySelector('.pos-staging-fields input[placeholder="0.00"]');
    assert.ok(discPercentInput, 'Disc (%) input must exist');
    assert.ok(discAmountInput, 'Disc (Rs.) input must exist');

    // 5. Press Enter in Qty input -> Focus must move to Disc (%) input
    await act(async () => {
      qtyInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    assert.equal(document.activeElement, discPercentInput, 'Pressing Enter in Qty must focus Disc (%) input');

    // 6. Press Enter in Disc (%) input -> Focus must move to Disc (Rs.) input
    await act(async () => {
      discPercentInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    assert.equal(document.activeElement, discAmountInput, 'Pressing Enter in Disc (%) must focus Disc (Rs.) input');

    // 7. Press Enter in Disc (Rs.) input -> Product added to table, staging resets, catalog search focused
    await act(async () => {
      discAmountInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));

    // Staging fields should be cleared/disabled and product added to table
    const tableRows = host.querySelectorAll('.pos-cart-details-row');
    assert.equal(tableRows.length, 1, 'Product must be added to cart table');
    assert.equal(document.activeElement, catalogInput, 'Catalog search input must be refocused after adding item');

  } finally {
    await act(async () => root.unmount());
    await server.close();
    await window.happyDOM.close();
    for (const name of ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']) {
      delete globalThis[name];
    }
  }
});