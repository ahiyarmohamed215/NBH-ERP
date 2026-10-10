import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('GTN, PRN and PO popups keep the product table and controls on the right', async () => {
  const window = new Window();
  Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import('react-dom/client');
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    const apis = await server.ssrLoadModule('/src/api/apiClient.js');
    for (const [name, api] of Object.entries(apis)) {
      if (!name.endsWith('Api') || !api || typeof api !== 'object') continue;
      for (const method of Object.keys(api)) if (typeof api[method] === 'function') api[method] = async () => ({ data: [] });
    }
    const item = { id: 1, productId: 1, productSku: 'TEST-1', sku: 'TEST-1', productName: 'Test product', quantityTransferred: 2, quantityReturned: 2, quantity: 2, unitCost: 5, totalCost: 10 };
    const docs = {
      GTN: { id: 1, gtnNumber: 'GTN-1', sourceWarehouseName: 'North', destinationWarehouseName: 'South', status: 'TRANSFERRED', items: [item] },
      PRN: { id: 2, prnNumber: 'PRN-2', supplierName: 'Supplier', warehouseName: 'North', returnDate: '2026-10-10', status: 'PROCESSED', totalAmount: 10, items: [item] },
      PO: { id: 3, poNumber: 'PO-3', supplierName: 'Supplier', warehouseName: 'North', orderDate: '2026-10-10', status: 'PENDING', totalAmount: 10, items: [item] },
    };
    for (const [name, api] of [['GTN', apis.gtnApi], ['PRN', apis.prnApi], ['PO', apis.purchaseOrderApi]]) {
      api.search = async () => ({ data: { content: [docs[name]] } });
      api.getById = async () => ({ data: docs[name] });
    }
    let printed = '';
    window.open = () => ({ document: { open() {}, write(html) { printed = html; }, close() {} } });
    apis.pdfApi.printGtn = () => { printed = 'GTN-1'; };
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    for (const [type, name] of [['GTN', 'GtnView'], ['PRN', 'PrnView'], ['PO', 'PurchaseOrdersView']]) {
      const { default: View } = await server.ssrLoadModule(`/src/views/${name}.jsx`);
      await act(async () => root.render(React.createElement(ToastProvider, null, React.createElement(View, { key: type }))));
      const row = [...host.querySelectorAll('tbody tr')].find((row) => row.textContent.includes(type + '-'));
      assert.ok(row, `${type} record is visible`);
      await act(async () => row.click());
      const popup = host.querySelector('[role="dialog"]');
      assert.ok(popup, `${type} popup opens`);
      assert.ok(popup.querySelector('.purchase-inspection-items table').textContent.includes('Test product'));
      const actions = popup.querySelector('.purchase-inspection-actions');
      assert.ok(actions, `${type} has a right action panel`);
      assert.equal(popup.querySelectorAll(`[title="Print ${type}"]`).length, 1);
      assert.ok(!popup.textContent.includes('PDF'));
      assert.equal(popup.querySelector('footer'), null);
      assert.ok(!popup.textContent.includes('Total Order Value') && !popup.textContent.includes('TOTAL INWARD VALUE'));
      printed = '';
      await act(async () => actions.querySelector(`[title="Print ${type}"]`).click());
      assert.ok(printed.includes(type + '-'), `${type} prints the selected document`);
      await act(async () => popup.querySelector(`[aria-label="Close ${type} details"]`).click());
      assert.equal(host.querySelector('[role="dialog"]'), null);
    }
  } finally {
    await act(async () => root.unmount()); await server.close(); await window.happyDOM.close();
    for (const key of ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];
  }
});
