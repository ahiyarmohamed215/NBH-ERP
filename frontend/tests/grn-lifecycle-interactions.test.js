import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('processed GRNs stay editable and cancelled GRNs have no status actions', async () => {
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
    localStorage.setItem('nbh_token', `header.${Buffer.from(JSON.stringify({ exp: 2200000000 })).toString('base64url')}.signature`);
    apis.authApi.getMe = async () => ({ data: { username: 'admin', roles: ['ROLE_ADMIN'] } });
    let grn = { id: 5, grnNumber: 'GRN-5', supplierId: 3, supplierName: 'Supplier', status: 'PROCESSED', receivedDate: '2026-10-10', notes: 'Check received items', items: [{ productId: 1, productSku: 'P-1', productName: 'Product', quantityReceived: 5, unitCost: 4, totalCost: 20 }] };
    apis.grnApi.search = async () => ({ data: { content: [grn] } });
    apis.grnApi.getById = async () => ({ data: grn });
    apis.supplierApi.getActive = async () => ({ data: [{ id: 3, name: 'Supplier' }] });
    apis.productApi.getProducts = async () => ({ data: { content: [{ id: 1, sku: 'P-1', name: 'Product', defaultWarehouseId: 10, costPrice: 4 }] } });
    let failEdit = true; let failCancel = true; let processCalls = 0;
    apis.grnApi.update = async () => {
      if (failEdit) throw { response: { data: { message: 'Cannot edit GRN: insufficient inventory.' } } };
      return { data: grn };
    };
    apis.grnApi.cancel = async () => {
      if (failCancel) throw { response: { data: { message: 'Cannot cancel GRN: insufficient inventory.' } } };
      grn = { ...grn, status: 'CANCELLED' }; return { data: grn };
    };
    apis.grnApi.process = async () => { processCalls++; grn = { ...grn, status: 'PROCESSED' }; return { data: grn }; };
    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const { default: GrnView } = await server.ssrLoadModule('/src/views/GrnView.jsx');
    await act(async () => root.render(React.createElement(AuthProvider, null, React.createElement(ToastProvider, null, React.createElement(GrnView)))));
    const button = (text) => [...host.querySelectorAll('button')].find((element) => element.textContent.trim() === text);
    const open = async () => act(async () => host.querySelector('tbody tr').click());
    assert.equal(host.querySelector('tbody [title="Cancel GRN"]'), null);
    assert.equal(host.querySelector('tbody [title="Process GRN"]'), null);
    await open();
    assert.ok(button('Edit GRN')); assert.ok(button('Cancel GRN'));
    const popup = host.querySelector('[role="dialog"]');
    assert.ok(popup.classList.contains('purchase-inspection-bottom-actions'));
    assert.deepEqual([...popup.querySelectorAll('th')].map(cell => cell.textContent.trim()), ['Product code', 'Product name', 'Qty', 'Unit price', 'MP%', 'Selling price']);
    assert.deepEqual([...popup.querySelectorAll('.purchase-inspection-details dt')].map(cell => cell.textContent), ['Supplier name', 'GRN date', 'Remarks']);
    assert.deepEqual([...popup.querySelectorAll('.purchase-inspection-details dd')].map(cell => cell.textContent), ['Supplier', '2026-10-10', 'Check received items']);
    await act(async () => button('Edit GRN').click());
    assert.ok(host.querySelector('.grn-page'));
    assert.equal(button('Save Draft'), undefined); assert.ok(button('Save Changes'));
    await act(async () => button('Save Changes').click());
    assert.ok((document.body.textContent || host.textContent).includes('Cannot edit GRN: insufficient inventory.'));
    assert.ok(host.querySelector('.grn-page'), 'Failed edits remain open');
    failEdit = false;
    await act(async () => button('Save Changes').click());
    assert.equal(host.querySelector('.grn-page'), null);
    await open(); await act(async () => button('Cancel GRN').click());
    await act(async () => {
      const input = host.querySelector('textarea');
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, 'Receipt correction');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await act(async () => button('Confirm Cancellation').click());
    assert.ok((document.body.textContent || host.textContent).includes('Cannot cancel GRN: insufficient inventory.'));
    assert.equal(grn.status, 'PROCESSED');
    failCancel = false;
    await act(async () => button('Confirm Cancellation').click());
    assert.equal(grn.status, 'CANCELLED'); assert.equal(button('Reprocess GRN'), undefined);
    assert.equal(button('Edit GRN'), undefined);
    assert.equal(host.querySelector('tbody [title="Edit GRN"]'), null);
    assert.equal(host.querySelector('tbody [title="Reprocess GRN"]'), null);
    assert.equal(processCalls, 0); assert.equal(grn.status, 'CANCELLED');
    assert.equal(button('Cancel GRN'), undefined);
    assert.equal(host.querySelector('.purchase-inspection-detail-actions button'), null);
  } finally {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5500)); root.unmount(); });
    await server.close(); await window.happyDOM.close();
    for (const key of ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];
  }
});
