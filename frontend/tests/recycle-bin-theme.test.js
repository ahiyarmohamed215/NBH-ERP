import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('RecycleBinView adopts GRN/Purchasing theme with search toolbar, table icons, and inspection popup modal', async () => {
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
        for (const key of Object.keys(api)) {
          if (typeof api[key] === 'function') api[key] = async () => ({ data: [] });
        }
      }
    }

    localStorage.setItem(
      'nbh_token',
      `test.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.sig`
    );
    apis.authApi.getMe = async () => ({
      data: { id: 100, username: 'admin', fullName: 'System Admin', roles: ['ROLE_ADMIN'], permissions: [] },
    });

    let records = [
      { id: 101, type: 'PRODUCT', code: 'PRD-001', name: 'Engine Oil Filter', deletedAt: '2026-10-18T10:30:00' },
      { id: 102, type: 'SUPPLIER', code: 'SUP-002', name: 'Apex Motors Ltd', deletedAt: '2026-10-18T14:45:00' },
      { id: 103, type: 'CUSTOMER', code: 'CUS-003', name: 'John Doe Transport', deletedAt: '2026-10-19T09:15:00' },
    ];

    let restoredItem = null;
    let purgedItem = null;

    apis.recycleBinApi.getAll = async () => ({ data: records });
    apis.recycleBinApi.restore = async (type, id) => {
      restoredItem = { type, id };
      records = records.filter((r) => !(r.type === type && r.id === id));
    };
    apis.recycleBinApi.permanentlyDelete = async (type, id) => {
      purgedItem = { type, id };
      records = records.filter((r) => !(r.type === type && r.id === id));
    };

    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const { default: RecycleBinView } = await server.ssrLoadModule('/src/views/RecycleBinView.jsx');

    const render = (component) =>
      act(async () => {
        root.render(
          React.createElement(AuthProvider, null, React.createElement(ToastProvider, null, component))
        );
      });

    await render(React.createElement(RecycleBinView));

    // 1. Verify Page Header
    const header = host.querySelector('.erp-page-header');
    assert.ok(header, 'Page header with erp-page-header must exist');
    assert.ok(header.textContent.includes('Recycle Bin'), 'Header must contain title Recycle Bin');
    assert.ok(header.textContent.includes('Total Deleted: 3'), 'Header must display total count badge');

    // 2. Verify Table structure and columns
    const table = host.querySelector('.erp-table');
    assert.ok(table, 'Table with erp-table class must exist');
    const headers = [...table.querySelectorAll('th')].map((th) => th.textContent.trim());
    assert.ok(headers.includes('RECORD TYPE'));
    assert.ok(headers.includes('CODE'));
    assert.ok(headers.includes('NAME / DESCRIPTION'));
    assert.ok(headers.includes('DELETED ON'));
    assert.ok(headers.includes('ACTIONS'));

    // Check rows count
    const rows = host.querySelectorAll('tbody tr');
    assert.equal(rows.length, 3, 'All 3 deleted records should render as table rows');

    // Check code styling has erp-table-code monospace
    const codeSpan = host.querySelector('.erp-table-code');
    assert.ok(codeSpan, 'Record code must use erp-table-code class');
    assert.equal(codeSpan.textContent.trim(), 'PRD-001');

    // 3. Search and Reset filtering
    const searchInput = host.querySelector('input[aria-label="Search recycle bin"]');
    assert.ok(searchInput, 'Search input should exist');

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(searchInput, 'Apex');
      } else {
        searchInput.value = 'Apex';
      }
      searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    });

    const filteredRows = host.querySelectorAll('tbody tr');
    assert.equal(filteredRows.length, 1, 'Only Apex Motors Ltd should match search query');
    assert.ok(host.querySelector('tbody').textContent.includes('Apex Motors Ltd'));

    // Verify clear search button (X)
    const clearSearchBtn = host.querySelector('button[aria-label="Clear search"]');
    assert.ok(clearSearchBtn, 'Clear search button must appear when search text is present');

    // Verify Reset filters button appears
    const resetBtn = host.querySelector('button[aria-label="Reset filters"]');
    assert.ok(resetBtn, 'Reset button should appear when filters or search is active');

    await act(async () => {
      resetBtn.click();
    });

    assert.equal(host.querySelectorAll('tbody tr').length, 3, 'Resetting filters should restore all rows');

    // 4. Click row to open Inspection Popup Modal
    const firstRow = host.querySelector('tbody tr');
    await act(async () => {
      firstRow.click();
    });

    const modal = document.querySelector('[role="dialog"][aria-label="Product details"]');
    assert.ok(modal, 'Clicking row must open inspection details modal');
    assert.ok(modal.classList.contains('purchase-inspection'), 'Modal must have purchase-inspection class');
    assert.ok(modal.classList.contains('master-details-modal'), 'Modal must have master-details-modal class');

    // Check popup content
    assert.ok(modal.textContent.includes('Engine Oil Filter'), 'Popup must show record name in title');
    assert.ok(modal.textContent.includes('DELETED PRODUCT'), 'Popup must show caption');
    assert.ok(modal.textContent.includes('PRD-001'), 'Popup must show record code');

    // Check StatusBadge
    const statusBadge = modal.querySelector('.erp-status-badge');
    assert.ok(statusBadge, 'Status badge must exist in popup');
    assert.equal(statusBadge.getAttribute('data-status'), 'DELETED');

    // Check action buttons in popup
    const restoreBtnInModal = modal.querySelector('button[aria-label="Restore Product PRD-001"]');
    assert.ok(restoreBtnInModal, 'Restore button must exist in popup');

    const deleteBtnInModal = modal.querySelector('button[aria-label="Permanently delete Product PRD-001"]');
    assert.ok(deleteBtnInModal, 'Delete permanently button must exist in popup');

    const printBtnInModal = modal.querySelector('button[aria-label="Print Product details"]');
    assert.ok(printBtnInModal, 'Print button must exist in popup');

    const closeBtnInModal = modal.querySelector('button[aria-label="Close product details"]');
    assert.ok(closeBtnInModal, 'Close button must exist in popup header');

    // 5. Restore from modal
    await act(async () => {
      restoreBtnInModal.click();
    });

    assert.deepEqual(restoredItem, { type: 'PRODUCT', id: 101 }, 'Restoring from modal should call API');
    assert.equal(document.querySelector('[role="dialog"][aria-label="Product details"]'), null, 'Modal should close on restore');
    assert.equal(host.querySelectorAll('tbody tr').length, 2, 'Table should have 2 rows remaining');

    // 6. View Eye icon opens modal for another record
    const viewButtons = host.querySelectorAll('button[title="View details"]');
    assert.equal(viewButtons.length, 2);

    await act(async () => {
      viewButtons[0].click();
    });

    const secondModal = document.querySelector('[role="dialog"][aria-label="Supplier details"]');
    assert.ok(secondModal, 'Eye icon click must open inspection modal');
    assert.ok(secondModal.textContent.includes('Apex Motors Ltd'));

    // 7. Delete permanently from modal opens RecordDeleteDialog
    const deleteInSecondModal = secondModal.querySelector('button[aria-label="Permanently delete Supplier SUP-002"]');
    assert.ok(deleteInSecondModal);

    await act(async () => {
      deleteInSecondModal.click();
    });

    const confirmDialog = document.querySelector('[role="dialog"][aria-label="Permanently delete supplier"]');
    assert.ok(confirmDialog, 'Confirmation dialog must open on permanent deletion request');

    const confirmButton = [...confirmDialog.querySelectorAll('button')].find(
      (b) => b.textContent === 'Delete permanently'
    );
    assert.ok(confirmButton, 'Delete permanently confirmation button must exist');

    await act(async () => {
      confirmButton.click();
    });

    assert.deepEqual(purgedItem, { type: 'SUPPLIER', id: 102 }, 'Confirming permanent deletion must purge record');
    assert.equal(records.length, 1);
  } finally {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5100)));
    await act(async () => root.unmount());
    await server.close();
    await window.happyDOM.close();
    for (const key of ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']) {
      delete globalThis[key];
    }
  }
});
