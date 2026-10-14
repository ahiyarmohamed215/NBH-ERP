import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('SupplierDetailsModal Minimalist Floating Card renders and behaves correctly', async () => {
  const window = new Window();
  Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
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
    const { default: SupplierDetailsModal } = await server.ssrLoadModule('/src/components/SupplierDetailsModal.jsx');

    const supplier = {
      id: 1,
      name: 'Acme Industrial Solutions',
      code: 'SUP-001',
      contactPerson: 'Jane Doe',
      phone: '+94 77 123 4567',
      email: 'jane@acme.com',
      address: '123 Galle Road, Colombo 03',
      status: 'ACTIVE',
    };

    let printCalls = 0;
    let closeCalls = 0;
    let editCalls = 0;
    let statusChangeTarget = null;

    await act(async () => {
      root.render(
        React.createElement(SupplierDetailsModal, {
          supplier,
          active: true,
          onPrint: () => printCalls++,
          onClose: () => closeCalls++,
          onEdit: () => editCalls++,
          onStatusChange: (status) => (statusChangeTarget = status),
          canManage: true,
        })
      );
    });

    const modal = host.querySelector('.glass-modal');
    assert.ok(modal, 'Modal should render');
    assert.ok(modal.classList.contains('supplier-floating-card'));
    assert.ok(modal.classList.contains('supplier-inspection'));

    // Initials
    const avatar = modal.querySelector('.supplier-floating-avatar');
    assert.equal(avatar.textContent.trim(), 'AI', 'Avatar should display initials of Acme Industrial');

    // Supplier Name & Code
    assert.ok(modal.querySelector('.supplier-floating-title').textContent.includes('Acme Industrial Solutions'));
    assert.ok(modal.querySelector('.supplier-floating-code').textContent.includes('SUP-001'));

    // Status Badge
    const statusBadge = modal.querySelector('.erp-status-badge');
    assert.ok(statusBadge, 'Status badge must exist');
    assert.ok(statusBadge.textContent.includes('ACTIVE'));

    // Detail content
    assert.ok(modal.textContent.includes('Jane Doe'));
    assert.ok(modal.textContent.includes('+94 77 123 4567'));
    assert.ok(modal.textContent.includes('jane@acme.com'));
    assert.ok(modal.textContent.includes('123 Galle Road, Colombo 03'));

    // Phone and Email links
    const phoneLink = modal.querySelector('a[href="tel:+94 77 123 4567"]');
    assert.ok(phoneLink, 'Should have clickable tel: link');
    const emailLink = modal.querySelector('a[href="mailto:jane@acme.com"]');
    assert.ok(emailLink, 'Should have clickable mailto: link');

    // Print button
    const printBtn = modal.querySelector('[title="Print Supplier Details (A4)"]');
    assert.ok(printBtn, 'Print button should exist');
    await act(async () => printBtn.click());
    assert.equal(printCalls, 1, 'onPrint should be called');

    // Edit button
    const editBtn = [...modal.querySelectorAll('button')].find((b) => b.textContent.includes('Edit Supplier'));
    assert.ok(editBtn, 'Edit Supplier button should exist');
    await act(async () => editBtn.click());
    assert.equal(editCalls, 1, 'onEdit should be called');

    // Deactivate / Cancel Supplier
    const cancelBtn = [...modal.querySelectorAll('button')].find((b) => b.textContent.includes('Cancel Supplier'));
    assert.ok(cancelBtn, 'Cancel Supplier button should exist for ACTIVE status');
    await act(async () => cancelBtn.click());
    assert.equal(statusChangeTarget, 'INACTIVE', 'onStatusChange should receive INACTIVE');

    // Test inactive status button
    await act(async () => {
      root.render(
        React.createElement(SupplierDetailsModal, {
          supplier: { ...supplier, status: 'INACTIVE' },
          active: false,
          onPrint: () => {},
          onClose: () => closeCalls++,
          onEdit: () => {},
          onStatusChange: (status) => (statusChangeTarget = status),
          canManage: true,
        })
      );
    });

    const processBtn = [...modal.querySelectorAll('button')].find((b) => b.textContent.includes('Process Supplier'));
    assert.ok(processBtn, 'Process Supplier button should exist for INACTIVE status');
    await act(async () => processBtn.click());
    assert.equal(statusChangeTarget, 'ACTIVE', 'onStatusChange should receive ACTIVE');

    // Close button
    const closeBtn = modal.querySelector('[aria-label="Close supplier details"]');
    assert.ok(closeBtn, 'Close button with aria-label should exist');
    await act(async () => closeBtn.click());
    assert.equal(closeCalls, 1, 'onClose should be called');
  } finally {
    await act(async () => root.unmount());
    await server.close();
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
