import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('customer directory includes inactive customers and history rows open details while actions print', async () => {
  const window = new Window();
  Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import('react-dom/client');
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    const apis = await server.ssrLoadModule('/src/api/apiClient.js');
    for (const [name, api] of Object.entries(apis)) {
      if (!name.endsWith('Api') || !api || typeof api !== 'object') continue;
      for (const method of Object.keys(api)) if (typeof api[method] === 'function') api[method] = async () => ({ data: [] });
    }
    localStorage.setItem('nbh_token', `header.${Buffer.from(JSON.stringify({ exp: 2200000000 })).toString('base64url')}.signature`);
    apis.authApi.getMe = async () => ({ data: { username: 'admin', roles: ['ROLE_ADMIN'] } });
    apis.customerGroupApi.getAll = async () => ({ data: [{ id: 9, groupName: 'Test customer group', customerIds: [1], isActive: true }] });
    const directory = [
      { id: 1, name: 'Active customer', customerCode: 'C-1', isActive: true, creditLimit: 25000 },
      { id: 2, name: 'Hidden customer', customerCode: 'C-2', isActive: false },
      { id: 6, name: 'Saved draft', customerCode: 'C-6', isActive: false, draft: true },
    ];
    apis.customerApi.getAll = async config => {assert.equal(config.params.includeInactive, true); return {data: directory};};
    let savedDraft;
    apis.customerApi.update = async (id, payload) => {savedDraft = payload; Object.assign(directory.find(c => c.id === id), payload, {isActive: !payload.draft}); return {data: {}};};
    const invoice = { id: 3, customerId: 1, invoiceNumber: 'INV-3', netTotal: 150, paidAmount: 0, balanceAmount: 150, status: 'COMPLETED', invoiceDate: '2026-10-09' };
    apis.salesApi.search = async () => ({ data: { content: [invoice] } });
    apis.salesApi.getById = async () => ({ data: { ...invoice, createdAt: '2026-10-09T10:11:12', notes: 'Complete invoice details', items: [{ productName: 'Test rice', quantity: 3, unitPrice: 50 }] } });
    const payments = [
      { id: 4, customerId: 1, paymentNumber: 'ADV-4', voucherNo: 'ADV-4', paymentType: 'ADVANCE', paymentMethod: 'CASH', paymentDate: '2026-10-08', amount: 50, status: 'COMPLETED' },
      { id: 5, customerId: 1, paymentNumber: 'RCT-5', receiptNo: 'RCT-5', paymentType: 'INVOICE_PAYMENT', invoiceNumber: 'INV-3', paymentMethod: 'CHEQUE', paymentDate: '2026-10-09', referenceNumber: 'CHQ-5', amount: 25, status: 'COMPLETED' },
    ];
    apis.paymentApi.search = async () => ({ data: { content: payments } });
    apis.paymentApi.getById = async (id) => ({ data: { ...payments.find((p) => p.id === id), notes: 'Full payment details' } });
    let printed = null;
    apis.pdfApi.printInvoice = async (id) => { printed = id; };
    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const { default: CustomersHub } = await server.ssrLoadModule('/src/views/CustomersHub.jsx');
    await act(async () => root.render(React.createElement(AuthProvider, null, React.createElement(ToastProvider, null, React.createElement(CustomersHub)))));
    assert.ok(host.textContent.includes('Active customer'));
    assert.ok(host.textContent.includes('Hidden customer'));
    assert.equal(host.querySelectorAll('thead th').length, 7);
    assert.ok(host.querySelector('thead').textContent.includes('CUSTOMER NAME & CODE'));
    assert.equal(host.querySelector('[title="View customer details"]'), null);
    assert.ok(!host.querySelector('thead').textContent.includes('CREDIT LIMIT'));
    const choose = async (label, value) => {
      await act(async () => host.querySelector(`[aria-label="${label}"]`).click());
      await act(async () => document.querySelector(`[role="option"][data-value="${value}"]`).click());
    };
    await choose('Customer status filter', 'INACTIVE');
    assert.ok(host.querySelector('tbody').textContent.includes('Hidden customer'));
    assert.ok(!host.querySelector('tbody').textContent.includes('Saved draft'));
    await choose('Customer status filter', 'DRAFT');
    assert.ok(host.querySelector('tbody').textContent.includes('Saved draft'));
    assert.ok(!host.querySelector('tbody').textContent.includes('Active customer'));
    await act(async () => host.querySelector('tbody tr').click());
    await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent.includes('Continue Draft')).click());
    await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save Draft').click());
    assert.equal(savedDraft.draft, true);
    await act(async () => host.querySelector('tbody tr').click());
    await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent.includes('Continue Draft')).click());
    assert.ok([...host.querySelectorAll('button')].some(b => b.textContent === 'Activate Customer'));
    await act(async () => host.querySelector('form').dispatchEvent(new window.Event('submit', {bubbles:true,cancelable:true})));
    assert.equal(savedDraft.draft, false);
    assert.ok(!host.querySelector('tbody').textContent.includes('Saved draft'), 'activated draft leaves the draft filter');
    await act(async () => host.querySelector('[title="Reset all filters to default"]').click());
    await choose('Customer group filter', '9');
    assert.ok(!host.querySelector('tbody').textContent.includes('Hidden customer'));
    await act(async () => host.querySelector('[title="Reset all filters to default"]').click());
    const customerRow = [...host.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Active customer'));
    await act(async () => customerRow.click());
    const customerPopup = host.querySelector('.modal-backdrop');
    assert.ok(customerPopup.querySelector('.master-details-modal.master-details-uniform'));
    assert.ok(customerPopup.textContent.includes('Credit Limit'));
    assert.ok(customerPopup.textContent.includes('25,000.00'));
    assert.equal(customerPopup.querySelectorAll('[title="Print Customer Statement (A4)"]').length, 1, 'Customer popup has only its footer print');
    await act(async () => customerPopup.querySelector('[aria-label="Close customer details"]').click());
    await act(async () => host.querySelector('[title="View Customer History & Ledger"]').click());
    assert.ok(host.querySelector('[aria-label="History status filter"]').classList.contains('modern-filter-trigger'));
    const row = host.querySelector('tr[aria-label="View invoice INV-3"]');
    assert.ok(row, 'Invoice row should be available');
    assert.ok(row.textContent.includes('150.00'), 'Invoice amount uses netTotal');
    await act(async () => row.querySelector('[title="Print invoice"]').click());
    assert.equal(printed, 3);
    assert.equal(host.querySelector('[role="dialog"]'), null, 'Printing must not also open the preview');
    await act(async () => row.querySelector('td:nth-child(2)').click());
    const dialog = host.querySelector('[role="dialog"]');
    assert.ok(dialog);
    assert.ok(dialog.textContent.includes('Test rice'));
    assert.ok(dialog.textContent.includes('Complete invoice details'));
    assert.ok(dialog.textContent.includes('09 Oct 2026'));
    assert.ok(dialog.textContent.includes('10:11:12'));
    await act(async () => dialog.querySelector('[aria-label="Close details"]').click());
    await act(async () => row.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    assert.ok(host.querySelector('[role="dialog"]'), 'Keyboard opens the same full details');
    await act(async () => host.querySelector('[aria-label="Close details"]').click());
    for (const [tab, label] of [['Advance Payments', 'advance payment ADV-4'], ['Payments', 'payment receipt RCT-5'], ['Cheques', 'cheque RCT-5'], ['Outstanding', 'outstanding invoice INV-3']]) {
      const tabButton = [...host.querySelectorAll('button')].find((b) => b.querySelector('span')?.textContent === tab);
      assert.ok(tabButton, `History tab ${tab} exists`);
      await act(async () => tabButton.click());
      const historyRow = host.querySelector(`tr[aria-label="View ${label}"]`);
      assert.ok(historyRow, `${tab} row exists`);
      assert.equal(historyRow.querySelectorAll('button').length, 1, 'Actions contain only Print');
      assert.ok(historyRow.querySelector('button').title.startsWith('Print'));
      await act(async () => historyRow.click());
      assert.ok(host.querySelector('[role="dialog"]').textContent.includes(tab === 'Outstanding' ? 'Test rice' : 'Full payment details'));
      await act(async () => host.querySelector('[aria-label="Close details"]').click());
    }
    await act(async () => [...host.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Customer Groups').click());
    await act(async () => [...host.querySelectorAll('span')].find((b) => b.textContent.includes('View Group Details')).click());
    const update = [...host.querySelectorAll('button')].find((b) => b.textContent.includes('Update Customer Group'));
    assert.ok(update);
    assert.ok(update.parentElement.textContent.includes('Print'));
    assert.ok(update.parentElement.textContent.includes('Close'));
    assert.equal(host.querySelector('.modal-backdrop').querySelectorAll('[title="Print Customer Group (A4)"]').length, 1, 'Group popup has only its footer print');
  } finally {
    await act(async () => new Promise(resolve => setTimeout(resolve, 5100)));
    await act(async () => root.unmount()); await server.close(); await window.happyDOM.close();
    for (const key of ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']) delete globalThis[key];
  }
});
