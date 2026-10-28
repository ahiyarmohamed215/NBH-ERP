import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('SupplierDetailsModal floating card renders readable layout and all interactions work', async () => {
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
      remarks: 'Deliveries before noon',
    };

    let printCalls = 0, closeCalls = 0, editCalls = 0, deleteCalls=0, statusTarget = null;

    await act(async () => {
      root.render(
        React.createElement(SupplierDetailsModal, {
          supplier,
          active: true,
          onPrint: () => printCalls++,
          onClose: () => closeCalls++,
          onEdit: () => editCalls++,
          onDelete: () => deleteCalls++,
          onStatusChange: (s) => (statusTarget = s),
          canManage: true,
        })
      );
    });

    const modal = host.querySelector('.glass-modal');
    assert.ok(modal, 'Modal renders');
    assert.ok(modal.classList.contains('supplier-floating-card'), 'Has floating-card class');
    assert.ok(modal.classList.contains('supplier-inspection'), 'Has supplier-inspection class');

    // Test-required selectors
    assert.ok(modal.querySelector('.master-details-body'), 'purchase-inspection-details-card exists');
    assert.ok(modal.querySelector('.purchase-inspection-detail-actions'), 'purchase-inspection-detail-actions exists');

    assert.equal(modal.querySelector('.supplier-card-avatar'), null);
    assert.equal(modal.querySelector('[title^="Copy"], [aria-label^="Copy"]'), null);

    // Name + code
    assert.ok(modal.querySelector('.master-details-heading h2').textContent.includes('Acme Industrial Solutions'));
    assert.ok(modal.querySelector('.master-details-meta').textContent.includes('SUP-001'));

    // Status badge
    const badge = modal.querySelector('.erp-status-badge');
    assert.ok(badge);
    assert.equal(modal.querySelector('.master-details-heading h2').nextElementSibling,badge);
    assert.equal(modal.querySelector('.master-details-heading [aria-label="Delete Supplier"]'),null);
    const deleteButton=[...modal.querySelectorAll('.supplier-card-actions button')].find(button=>button.textContent.includes('Delete Supplier'));assert.ok(deleteButton);
    assert.ok(deleteButton.previousElementSibling.textContent.includes('Deactivate Supplier'));
    await act(async()=>deleteButton.click());assert.equal(deleteCalls,1);
    assert.ok(modal.textContent.includes('Deliveries before noon'));

    // Contact details are readable
    assert.ok(modal.textContent.includes('Jane Doe'));
    assert.ok(modal.textContent.includes('+94 77 123 4567'));
    assert.ok(modal.textContent.includes('jane@acme.com'));
    assert.ok(modal.textContent.includes('123 Galle Road, Colombo 03'));

    // Clickable links
    assert.ok(modal.querySelector('a[href="tel:+94 77 123 4567"]'));
    assert.ok(modal.querySelector('a[href="mailto:jane@acme.com"]'));

    // Details use the same compact grid as the product popup
    const rows = modal.querySelectorAll('.master-details-grid>div');
    assert.ok(rows.length >= 4, 'At least 4 detail rows');

    // Print action
    const printBtn = modal.querySelector('[title="Print Supplier Details (A4)"]');
    assert.ok(printBtn);
    await act(async () => printBtn.click());
    assert.equal(printCalls, 1);

    // Edit action
    const editBtn = [...modal.querySelectorAll('.purchase-inspection-detail-actions button')]
      .find(b => b.textContent.includes('Edit Supplier'));
    assert.ok(editBtn);
    await act(async () => editBtn.click());
    assert.equal(editCalls, 1);

    // Deactivate Supplier (deactivate)
    const cancelBtn = [...modal.querySelectorAll('.purchase-inspection-detail-actions button')]
      .find(b => b.textContent.includes('Deactivate Supplier'));
    assert.ok(cancelBtn);
    assert.ok(cancelBtn.classList.contains('purchase-inspection-warning'));
    await act(async () => cancelBtn.click());
    assert.equal(statusTarget, 'INACTIVE');

    // Close button
    const closeBtn = modal.querySelector('[aria-label="Close supplier details"]');
    assert.ok(closeBtn);
    await act(async () => closeBtn.click());
    assert.equal(closeCalls, 1);

    // Render with INACTIVE status → Reactivate Supplier button
    await act(async () => {
      root.render(
        React.createElement(SupplierDetailsModal, {
          supplier: { ...supplier, status: 'INACTIVE' },
          active: false,
          onPrint: () => {},
          onClose: () => {},
          onEdit: () => {},
          onStatusChange: (s) => (statusTarget = s),
          canManage: true,
        })
      );
    });

    const processBtn = [...host.querySelectorAll('.purchase-inspection-detail-actions button')]
      .find(b => b.textContent.includes('Reactivate Supplier'));
    assert.ok(processBtn);
    await act(async () => processBtn.click());
    assert.equal(statusTarget, 'ACTIVE');
    await act(async()=>root.render(React.createElement(SupplierDetailsModal,{
      supplier:{...supplier,status:'DRAFT'},canManage:true,onClose:()=>{},onEdit:()=>{},onDelete:()=>{},onStatusChange:()=>{},onPrint:()=>{},
    })));
    assert.deepEqual([...host.querySelectorAll('.record-actions button')].map(button=>button.getAttribute('aria-label')),['Edit Supplier','Activate Supplier','Delete Supplier']);
    assert.equal(host.querySelector('[title="Print Supplier Details (A4)"]'),null);

  } finally {
    await act(async () => root.unmount());
    await server.close();
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
