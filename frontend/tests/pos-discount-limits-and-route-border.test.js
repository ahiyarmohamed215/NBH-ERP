import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('POS route down card has complete border styling and max 20% discount (% and Rs combined) is enforced', async () => {
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
      data: [{ id: 10, routeCode: 'R-NORTH', routeName: 'North Route' }],
    });
    apis.customerApi.getPosCustomers = async () => ({
      data: [{ id: 1, name: 'Sample Customer', customerCode: 'CUST-0001', deliveryRouteId: 10, creditLimit: 0, currentBalance: 0 }],
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
        { id: 1, name: 'Beverage Can', sku: 'BEV-001', sellingPrice: 100, costPrice: 60, unitOfMeasure: 'CAN', isActive: true, warehouseId: 1 },
      ],
    });
    apis.productApi.getAll = async () => ({
      data: [
        { id: 1, name: 'Beverage Can', sku: 'BEV-001', sellingPrice: 100, costPrice: 60, unitOfMeasure: 'CAN', isActive: true, warehouseId: 1 },
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

    await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

    // 1. Verify Route Down Card before selection:
    const routeMetaBar = host.querySelector('.pos-route-selection .pos-customer-meta-bar');
    assert.ok(routeMetaBar, 'Route meta bar container exists');
    assert.equal(routeMetaBar.style.height, '20px', 'Route meta bar has 20px unclipped height');
    assert.equal(routeMetaBar.style.overflow, 'visible', 'Route meta bar has overflow visible');

    const routeEmptyCard = host.querySelector('.pos-route-selection .pos-meta-pill');
    assert.ok(routeEmptyCard, 'Route meta pill down card exists');
    assert.ok(routeEmptyCard.style.border.includes('1px solid'), 'Route down card has full 1px solid border');

    // 2. Select Route with Enter
    const routeInput = host.querySelector('[placeholder="Select Route..."]');
    assert.ok(routeInput);
    await act(async () => {
      routeInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));

    // Verify selected route down card
    const selectedRoutePill = host.querySelector('.pos-route-selection .pos-route-pill-selected');
    assert.ok(selectedRoutePill, 'Selected route down card exists');
    assert.ok(selectedRoutePill.style.border.includes('1px solid #99f6e4'), 'Selected route pill has solid border');
    assert.equal(selectedRoutePill.style.height, '20px', 'Selected route pill is 20px high');

    // 3. Select Customer with Enter
    const customerInput = host.querySelector('[placeholder="Select Customer (F1)..."]');
    assert.ok(customerInput);
    await act(async () => {
      customerInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));

    // 4. Select product in catalog to open staging (Price = 100, Qty = 2 -> Gross = 200)
    const rowAlpha = host.querySelector('.pos-inventory-row');
    assert.ok(rowAlpha, 'Product row exists');
    await act(async () => {
      rowAlpha.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));

    const qtyInput = host.querySelector('.pos-staging-fields input[type="number"][min="1"]');
    assert.ok(qtyInput, 'Quantity input exists');
    await act(async () => {
      nativeSetter.call(qtyInput, '2');
      qtyInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      qtyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    });

    const rateInput = host.querySelector('.pos-staging-fields input[placeholder="0%"]');
    const cashInput = host.querySelector('.pos-staging-fields input[placeholder="0.00"]');
    assert.ok(rateInput, 'Rate input exists');
    assert.ok(cashInput, 'Cash input exists');

    // Test A: Rate > 20% must be capped to 20%
    await act(async () => {
      nativeSetter.call(rateInput, '25');
      rateInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      rateInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    assert.equal(rateInput.value, '20', 'Rate > 20% is capped to 20%');

    // Test B: User sets rate to 15% (15% of 200 = 30 Rs discount).
    // Remaining cash discount allowed = 20% - 15% = 5% of gross = Rs. 10!
    await act(async () => {
      nativeSetter.call(rateInput, '15');
      rateInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      rateInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    assert.equal(rateInput.value, '15');

    // Now user types Rs. 20 into cash discount field.
    // Since only Rs. 10 (5% of gross) is remaining, cash discount must be capped to 10!
    await act(async () => {
      nativeSetter.call(cashInput, '20');
      cashInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      cashInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    assert.equal(cashInput.value, '10', 'Cash discount is capped to remaining 5% budget (10 Rs)');

    // Line total: gross 200 - (30 + 10) = 160
    const addBtn = host.querySelector('button[title="Add Product"]') || Array.from(host.querySelectorAll('.pos-staging-fields button')).find(b => b.textContent.includes('Add'));
    assert.ok(addBtn, 'Add button exists');
    await act(async () => {
      addBtn.click();
    });

    // Verify cart table row
    const cartRow = host.querySelector('.pos-cart-details-row');
    assert.ok(cartRow, 'Product added to cart table');
    assert.ok(cartRow.textContent.includes('BEV-001'));
    // Line total 160.00
    assert.ok(cartRow.textContent.includes('160.00'), 'Line total reflects exact 20% total discount');

  } finally {
    await act(async () => {
      root.unmount();
    });
    await server.close();
  }
});
