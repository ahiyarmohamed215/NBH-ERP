import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';

test('Draft-only adjustment buttons, Employee workspace fix, and 2-column CustomerEditorModal', async () => {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  try {
    const { Window } = await import('happy-dom');
    const window = new Window({ url: 'http://localhost:3000' });
    const document = window.document;

    globalThis.window = window;
    globalThis.document = document;
    globalThis.localStorage = window.localStorage;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;

    // Load components
    const { default: AdjustmentTable } = await server.ssrLoadModule('/src/components/AdjustmentTable.jsx');
    const { default: AdjustmentDetailsModal } = await server.ssrLoadModule('/src/components/AdjustmentDetailsModal.jsx');
    const { default: CustomerEditorModal } = await server.ssrLoadModule('/src/components/CustomerEditorModal.jsx');

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    // 1. TEST STOCK ADJUSTMENT: DRAFT vs COMPLETED buttons in AdjustmentTable
    const draftRecord = { id: 1, recordNo: 'ADJ-001', status: 'DRAFT', type: 'Addition', totalProducts: 1, items: [] };
    const completedRecord = { id: 2, recordNo: 'ADJ-002', status: 'COMPLETED', type: 'Reduction', totalProducts: 1, items: [] };
    const cancelledRecord = { id: 3, recordNo: 'ADJ-003', status: 'CANCELLED', type: 'Addition', totalProducts: 1, items: [] };

    let editedRecord = null;
    let cancelledRecordAction = null;

    await act(async () => {
      root.render(
        React.createElement(AdjustmentTable, {
          rows: [draftRecord, completedRecord, cancelledRecord],
          canEdit: true,
          onView: () => {},
          onEdit: (r) => { editedRecord = r; },
          onCancel: (r) => { cancelledRecordAction = r; },
        })
      );
    });

    const rows = host.querySelectorAll('.adjustment-table tbody tr');
    assert.equal(rows.length, 3);

    // Row 0 (DRAFT): Must have Edit and Cancel buttons
    const draftRowEditBtn = rows[0].querySelector('button[aria-label="Edit Adjustment"]');
    const draftRowCancelBtn = rows[0].querySelector('button[aria-label="Cancel Adjustment"]');
    assert.ok(draftRowEditBtn, 'DRAFT record must have Edit button in table');
    assert.ok(draftRowCancelBtn, 'DRAFT record must have Cancel button in table');

    // Row 1 (COMPLETED): Must NOT have Edit or Cancel buttons
    const completedRowEditBtn = rows[1].querySelector('button[aria-label="Edit Adjustment"]');
    const completedRowCancelBtn = rows[1].querySelector('button[aria-label="Cancel Adjustment"]');
    assert.equal(completedRowEditBtn, null, 'COMPLETED record must NOT have Edit button in table');
    assert.equal(completedRowCancelBtn, null, 'COMPLETED record must NOT have Cancel button in table');

    // Row 2 (CANCELLED): Must NOT have Edit or Cancel buttons
    const cancelledRowEditBtn = rows[2].querySelector('button[aria-label="Edit Adjustment"]');
    const cancelledRowCancelBtn = rows[2].querySelector('button[aria-label="Cancel Adjustment"]');
    assert.equal(cancelledRowEditBtn, null, 'CANCELLED record must NOT have Edit button in table');
    assert.equal(cancelledRowCancelBtn, null, 'CANCELLED record must NOT have Cancel button in table');

    // 2. TEST STOCK ADJUSTMENT: DRAFT vs COMPLETED in AdjustmentDetailsModal
    await act(async () => {
      root.render(
        React.createElement(AdjustmentDetailsModal, {
          record: draftRecord,
          canManage: true,
          onClose: () => {},
          onEdit: () => {},
          onAdjust: () => {},
          onCancel: () => {},
        })
      );
    });

    const draftModalActions = host.querySelector('.purchase-inspection-detail-actions');
    assert.ok(draftModalActions, 'DRAFT record must have detailActions in details card');
    const draftButtons = [...draftModalActions.querySelectorAll('button')].map((b) => b.textContent.trim());
    assert.ok(draftButtons.some((b) => b.includes('Edit Adjustment')), 'DRAFT modal must have Edit Adjustment');
    assert.ok(draftButtons.some((b) => b.includes('Adjust stock')), 'DRAFT modal must have Adjust stock');
    assert.ok(draftButtons.some((b) => b.includes('Cancel adjustment')), 'DRAFT modal must have Cancel adjustment');

    // COMPLETED record in modal: detailActions must be empty / no management buttons
    await act(async () => {
      root.render(
        React.createElement(AdjustmentDetailsModal, {
          record: completedRecord,
          canManage: true,
          onClose: () => {},
          onEdit: () => {},
          onAdjust: () => {},
          onCancel: () => {},
        })
      );
    });

    const completedModalActions = host.querySelector('.purchase-inspection-detail-actions');
    assert.equal(completedModalActions, null, 'COMPLETED record modal must NOT have detail actions');

    // 3. TEST CustomerEditorModal: 2-column workspace layout matching EmployeeEditorModal
    const customerFormData = {
      name: 'Apex Supermarket',
      code: 'CUST-001',
      contactPerson: 'Jane Doe',
      phone: '+94 77 123 4567',
      email: 'jane@apex.com',
      creditLimit: '50000',
      address: '123 Market Street, Colombo',
    };

    let closed = false;
    let savedData = null;

    await act(async () => {
      root.render(
        React.createElement(CustomerEditorModal, {
          form: customerFormData,
          setForm: () => {},
          editing: null,
          saving: false,
          onClose: () => { closed = true; },
          onSubmit: (e, draft) => { savedData = { draft }; },
        })
      );
    });

    // Check workspace shell & 2-column structure
    const customerWorkspace = host.querySelector('.supplier-workspace-shell .allocation-workspace.supplier-editor');
    assert.ok(customerWorkspace, 'CustomerEditorModal must use supplier-workspace-shell and allocation-workspace layout');

    // Left side: User input fields
    const fields = customerWorkspace.querySelector('fieldset.supplier-editor-fields');
    assert.ok(fields, 'User input fields section must be present on one side');
    assert.ok(fields.querySelector('[aria-label="Customer name"]'), 'Customer name input exists');
    assert.ok(fields.querySelector('[aria-label="Customer code"]'), 'Customer code input exists');
    assert.ok(fields.querySelector('[aria-label="Contact person"]'), 'Contact person input exists');
    assert.ok(fields.querySelector('[aria-label="Contact number"]'), 'Contact number input exists');
    assert.ok(fields.querySelector('[aria-label="Email address"]'), 'Email address input exists');
    assert.ok(fields.querySelector('[aria-label="Approved credit limit"]'), 'Credit limit input exists');
    assert.ok(fields.querySelector('[aria-label="Physical address"]'), 'Address input exists');

    // Right side: Details / summary review card
    const summaryCard = customerWorkspace.querySelector('aside.allocation-receipt.allocation-inline-review');
    assert.ok(summaryCard, 'Customer summary review card must be present on the other side');
    assert.ok(summaryCard.textContent.includes('Customer summary'), 'Summary card heading exists');
    assert.ok(summaryCard.textContent.includes('Apex Supermarket'), 'Customer profile shows customer name');
    assert.ok(summaryCard.textContent.includes('CUST-001'), 'Customer profile shows customer code');
    assert.ok(summaryCard.textContent.includes('+94 77 123 4567'), 'Customer contact shows phone');
    assert.ok(summaryCard.textContent.includes('LKR 50,000.00'), 'Customer financial shows formatted credit limit');

    // Action buttons in footer
    const footer = customerWorkspace.querySelector('footer.allocation-workspace-actions');
    assert.ok(footer, 'Footer actions must exist');
    const cancelBtn = [...footer.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Cancel');
    const draftBtn = [...footer.querySelectorAll('button')].find((b) => b.textContent.toLowerCase().includes('save draft'));
    const saveBtn = footer.querySelector('button.allocation-primary');
    assert.ok(cancelBtn, 'Cancel button exists');
    assert.ok(draftBtn, 'Save draft button exists');
    assert.ok(saveBtn, 'Save Customer button exists');

    // Test close
    await act(async () => cancelBtn.click());
    assert.equal(closed, true, 'Cancel button triggers onClose');

  } finally {
    await server.close();
    if (globalThis.window?.happyDOM) {
      await globalThis.window.happyDOM.close();
    }
    for (const key of ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']) {
      delete globalThis[key];
    }
  }
});
