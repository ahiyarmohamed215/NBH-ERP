import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('delivery workspace removes select-all button, provides Add Special Invoice modal, marks special invoices prominently, and passes specialInvoiceIds', async () => {
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
      data: { username: 'admin', roles: ['ROLE_ADMIN'], permissions: ['DELIVERY_VIEW', 'DELIVERY_MANAGE'] }
    });

    const { default: DeliveryWorkspace } = await server.ssrLoadModule('/src/components/DeliveryWorkspace.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');

    const pendingInvoices = [
      { id: 101, invoiceNumber: 'INV-101', customerId: 1, customerName: 'Alpha Store', customerCode: 'C-01', netTotal: 5000, customerAddress: 'Route A Road' },
      { id: 102, invoiceNumber: 'INV-102', customerId: 1, customerName: 'Alpha Store', customerCode: 'C-01', netTotal: 7500, customerAddress: 'Route A Road' },
      { id: 201, invoiceNumber: 'INV-201', customerId: 99, customerName: 'Urgent Client', customerCode: 'C-99', netTotal: 12000, customerAddress: 'Downtown Express' },
    ];

    let savedPayload = null;
    let workspaceForm = {
      routeId: '1',
      vehicleId: '10',
      driverId: '2',
      assistantStaffId: '3',
      scheduledDate: '2026-10-26',
      departureTime: '',
      notes: '',
      selectedInvoiceIds: [101],
      specialInvoiceIds: [],
    };

    await act(async () => {
      root.render(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(DeliveryWorkspace, {
            open: true,
            onClose: () => {},
            warehouses: [{ id: 1, name: 'Main Depot' }],
            routes: [{ id: 1, routeName: 'Route 1 - Urban', customerIds: ['1'] }],
            vehicles: [{ id: 10, vehicleNumber: 'WP-CAB-1234', status: 'AVAILABLE' }],
            employees: [
              { id: 2, fullName: 'John Driver' },
              { id: 3, fullName: 'Sam Assistant' },
            ],
            customers: [{ id: 1, name: 'Alpha Store', routeId: 1 }],
            invoices: pendingInvoices,
            form: workspaceForm,
            setForm: (update) => {
              if (typeof update === 'function') workspaceForm = update(workspaceForm);
              else workspaceForm = { ...workspaceForm, ...update };
            },
            busy: false,
            onSave: async (event, opts) => {
              savedPayload = opts;
            },
          })
        )
      );
    });

    // 1. Verify that "Select all" button is completely removed
    const selectAllBtn = Array.from(host.querySelectorAll('button')).find(
      b => /select all|deselect all/i.test(b.textContent.trim())
    );
    assert.equal(selectAllBtn, undefined, 'Select all / Deselect all button must be removed from invoice toolbar');

    // 2. Verify that select all checkbox is removed from table header
    const tableHeaderCheckbox = host.querySelector('.delivery-items table thead input[type="checkbox"]');
    assert.equal(tableHeaderCheckbox, null, 'Select all checkbox must be removed from delivery table header');

    // 3. Verify that "Add Special Invoice" button exists
    const addSpecialBtn = host.querySelector('button[aria-label="Add special invoice"]');
    assert.ok(addSpecialBtn, 'Add Special Invoice button must exist in toolbar');
    assert.match(addSpecialBtn.textContent, /Add Special Invoice/);

    // 4. Click "Add Special Invoice" to open the modal
    await act(async () => {
      addSpecialBtn.click();
    });

    const modal = host.querySelector('[role="dialog"][aria-label="Add Special Invoices Modal"]');
    assert.ok(modal, 'Special Invoices Modal must open on button click');
    assert.match(modal.textContent, /Add Special Invoice/);

    // 5. In modal, find invoice INV-201 and add it as special
    const addSpecialItemBtn = modal.querySelector('button[aria-label="Add special invoice INV-201"]');
    assert.ok(addSpecialItemBtn, 'Add special invoice button for INV-201 must exist in modal');

    await act(async () => {
      addSpecialItemBtn.click();
    });

    // Verify special counter updated
    assert.match(modal.textContent, /1 special invoice.*added/i);

    // 6. Close the modal
    const doneBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.trim() === 'Done');
    assert.ok(doneBtn, 'Done button must exist');
    await act(async () => {
      doneBtn.click();
    });

    // Re-render DeliveryWorkspace with the updated workspaceForm
    await act(async () => {
      root.render(
        React.createElement(
          ToastProvider,
          null,
          React.createElement(DeliveryWorkspace, {
            open: true,
            onClose: () => {},
            routes: [{ id: 1, routeName: 'Route 1 - Urban', customerIds: ['1'] }],
            vehicles: [{ id: 10, vehicleNumber: 'WP-CAB-1234', status: 'AVAILABLE' }],
            employees: [
              { id: 2, fullName: 'John Driver' },
              { id: 3, fullName: 'Sam Assistant' },
            ],
            customers: [{ id: 1, name: 'Alpha Store', routeId: 1 }],
            invoices: pendingInvoices,
            form: workspaceForm,
            setForm: (update) => {
              if (typeof update === 'function') workspaceForm = update(workspaceForm);
              else workspaceForm = { ...workspaceForm, ...update };
            },
            busy: false,
            onSave: async (event, opts) => {
              savedPayload = opts;
            },
          })
        )
      );
    });

    // 7. Verify INV-201 is now loaded in the table and marked with Special Invoice badge
    const tableText = host.querySelector('.delivery-items table')?.textContent;
    assert.ok(tableText.includes('INV-201'), 'INV-201 must be loaded in the delivery items table');
    assert.ok(tableText.includes('Special Invoice'), '⚡ Special Invoice badge must be displayed');

    // 8. Submit form and verify specialInvoiceIds is sent in payload
    const form = host.querySelector('form.delivery-workspace');
    await act(async () => {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    });

    assert.ok(savedPayload, 'onSave must have been triggered');
    assert.deepEqual(savedPayload.specialInvoiceIds, [201], 'specialInvoiceIds must contain [201]');
  } finally {
    await server.close();
  }
});
