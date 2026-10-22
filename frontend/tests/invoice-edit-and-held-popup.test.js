import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('HeldInvoiceDialog has Set All to 0 button which fills all packing inputs with 0 and enables submit', async () => {
  const window = new Window();
  Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
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
    const { default: Dialog } = await server.ssrLoadModule('/src/components/HeldInvoiceDialog.jsx');
    let submitted = null;
    const props = {
      preview: {
        customerName: 'Colombo Auto Mart',
        sourceBillIds: [1, 2],
        sourceBills: ['HLD-001', 'HLD-002'],
        date: '2026-10-22',
        totalAmount: 45000,
        items: [
          { productName: 'Piston Ring', productSku: 'PR-101', warehouseName: 'Main WH', quantity: 2, unitPrice: 15000, totalPrice: 30000 },
          { productName: 'Brake Pad', productSku: 'BP-202', warehouseName: 'East WH', quantity: 3, unitPrice: 5000, totalPrice: 15000 },
        ],
      },
      onClose: () => {},
      onConfirm: (packing) => {
        submitted = packing;
      },
    };

    await act(async () => root.render(React.createElement(Dialog, props)));
    const form = document.querySelector('[role="dialog"]');
    const submitBtn = form.querySelector('[type="submit"]');
    assert.ok(submitBtn.disabled, 'Submit button should initially be disabled until counts are set');

    // Click "Set All to 0"
    const setAllZeroBtn = form.querySelector('.held-quick-zero-btn');
    assert.ok(setAllZeroBtn, 'Set All to 0 button should exist');
    await act(async () => {
      setAllZeroBtn.click();
    });

    assert.equal(document.getElementById('packing-boxes').value, '0');
    assert.equal(document.getElementById('packing-bags').value, '0');
    assert.equal(document.getElementById('packing-pBags').value, '0');
    assert.equal(document.getElementById('packing-others').value, '0');
    assert.equal(submitBtn.disabled, false, 'Submit button should be enabled after Set All to 0');

    // Submit form
    await act(async () => {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    });
    assert.deepEqual(submitted, { boxes: 0, bags: 0, pBags: 0, others: 0 });
  } finally {
    await act(async () => root.unmount());
    await server.close();
    await window.happyDOM.close();
    for (const key of ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];
  }
});

test('Edit Invoice modal provides notes editing, displays invoice items and financial summary', async () => {
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

  const origSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => {
    if (typeof ms === 'number' && ms >= 1000) return 0;
    return origSetTimeout(fn, ms);
  };

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
      data: { username: 'admin', roles: ['ROLE_ADMIN'], permissions: ['SALES_VIEW', 'SALES_EDIT'] },
    });

    let updatedPayload = null;
    const testInvoice = {
      id: 88,
      invoiceNumber: 'INV-2026-0088',
      customerName: 'Prime Motors',
      customerId: 5,
      invoiceDate: '2026-10-22T10:00:00',
      paymentMethod: 'Cash',
      paymentType: 'CASH',
      netTotal: 12000,
      paidAmount: 12000,
      balanceAmount: 0,
      status: 'PAID',
      notes: 'Initial test note',
      items: [{ id: 1, code: 'SKU-88', name: 'Shock Absorber', quantity: 2, unitPrice: 6000, totalPrice: 12000 }],
    };

    apis.salesApi.search = async () => ({ data: { content: [testInvoice] } });
    apis.salesApi.getById = async () => ({ data: testInvoice });
    apis.salesApi.update = async (id, payload) => {
      updatedPayload = { id, payload };
      return { data: { ...testInvoice, ...payload } };
    };

    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const { default: InvoicingHub } = await server.ssrLoadModule('/src/views/InvoicingHub.jsx');

    await act(async () =>
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(
            ToastProvider,
            null,
            React.createElement(InvoicingHub, { activeSubTab: 'sales' })
          )
        )
      )
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));

    // Open Edit modal via Edit button on the row
    const editBtn = host.querySelector('button[aria-label="Edit Invoice"]');
    assert.ok(editBtn, 'Edit Invoice button should exist on row');
    await act(async () => {
      editBtn.click();
    });

    // Check modal appears
    const modal = host.querySelector('.erp-edit-invoice-modal');
    assert.ok(modal, 'Edit Invoice modal should be open');
    assert.ok(modal.textContent.includes('INV-2026-0088'), 'Modal shows invoice number');
    assert.ok(modal.textContent.includes('Prime Motors'), 'Modal shows customer name');
    assert.ok(modal.textContent.includes('Shock Absorber'), 'Modal lists line items');

    // Check editable textarea
    const notesTextarea = modal.querySelector('#edit-invoice-notes');
    assert.ok(notesTextarea, 'Editable notes textarea must exist');
    assert.equal(notesTextarea.value, 'Initial test note');

    // Update notes
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(
        notesTextarea,
        'Urgent delivery required by Friday afternoon'
      );
      notesTextarea.dispatchEvent(new window.Event('input', { bubbles: true }));
    });

    // Save changes
    const submitBtn = modal.querySelector('button[type="submit"]');
    await act(async () => {
      submitBtn.click();
    });

    assert.ok(updatedPayload, 'salesApi.update should be called');
    assert.equal(String(updatedPayload.id), '88');
    assert.equal(updatedPayload.payload.notes, 'Urgent delivery required by Friday afternoon');

    await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
  } finally {
    globalThis.setTimeout = origSetTimeout;
    await act(async () => root.unmount());
    await new Promise((resolve) => setTimeout(resolve, 50));
    await server.close();
    await window.happyDOM.close();
    for (const key of ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']) {
      delete globalThis[key];
    }
  }
});
