import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('sales invoice tab uses GRN style theme with payment methods, date range picker, and action icons', async () => {
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
      data: { username: 'admin', roles: ['ROLE_ADMIN'], permissions: ['SALES_VIEW', 'SALES_EDIT'] },
    });

    const sampleInvoices = [
      {
        id: 101,
        invoiceNumber: 'INV-2026-0001',
        customerName: 'Customer One',
        customerId: 1,
        invoiceDate: '2026-10-18T10:00:00',
        paymentMethod: 'Cash',
        paymentType: 'CASH',
        netTotal: 5000,
        paidAmount: 5000,
        balanceAmount: 0,
        status: 'PAID',
        paymentStatus: 'PAID',
        deliveryStatus: 'DELIVERED',
        items: [{ id: 1, code: 'SKU-1', name: 'Widget 1', quantity: 2, unitPrice: 2500, totalPrice: 5000 }],
      },
      {
        id: 102,
        invoiceNumber: 'INV-2026-0002',
        customerName: 'Customer Two',
        customerId: 2,
        invoiceDate: '2026-10-19T11:00:00',
        paymentMethod: 'Card',
        paymentType: 'CARD',
        netTotal: 3000,
        paidAmount: 1000,
        balanceAmount: 2000,
        status: 'PARTIAL',
        paymentStatus: 'PARTIAL',
        deliveryStatus: 'PENDING',
        items: [{ id: 2, code: 'SKU-2', name: 'Widget 2', quantity: 1, unitPrice: 3000, totalPrice: 3000 }],
      },
    ];

    apis.salesApi.search = async () => ({ data: { content: sampleInvoices } });
    apis.salesApi.getById = async (id) => ({
      data: sampleInvoices.find((inv) => inv.id === Number(id)) || sampleInvoices[0],
    });

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

    // 1. Verify Search input placeholder
    const searchInput = host.querySelector('input[placeholder="Search by invoice number, customer, payment method..."]');
    assert.ok(searchInput, 'Search input with GRN-style placeholder should be present');

    // 2. Verify Payment Types ("All Types") is removed
    const allSelects = [...host.querySelectorAll('select')];
    const hasAllTypes = allSelects.some((s) => [...s.options].some((o) => o.text === 'All Types' || o.value === 'Full Payment'));
    assert.equal(hasAllTypes, false, 'Payment Types (All Types, Full Payment) must be removed');

    // 3. Verify Payment Methods FilterSelect is present (using GRN style FilterSelect combobox)
    const paymentMethodBtn = host.querySelector('button[role="combobox"][aria-label="Payment Methods filter"]');
    assert.ok(paymentMethodBtn, 'Payment Methods filter button must be present in GRN style');
    assert.ok(paymentMethodBtn.textContent.includes('All Payment Methods'));

    // 4. Verify Preset filter ("today", "this-week", "this-month") is removed
    const hasPresets = allSelects.some((s) => [...s.options].some((o) => o.text === 'Presets' || o.value === 'today'));
    assert.equal(hasPresets, false, 'Presets date filter must be removed');

    // 5. Verify DateRangePicker is present
    const datePickerButton = host.querySelector('.date-range-trigger');
    assert.ok(datePickerButton, 'DateRangePicker popup button must be present in GRN style');
    assert.equal(datePickerButton.getAttribute('aria-label'), 'INVOICE date range');

    // 6. Verify Status filter has GRN style FilterSelect combobox
    const statusBtn = host.querySelector('button[role="combobox"][aria-label="Status filter"]');
    assert.ok(statusBtn, 'Status filter button must be present in GRN style');
    assert.ok(statusBtn.textContent.includes('All Statuses'));

    // 7. Verify Toolbar Print and Refresh icon buttons like GRN
    const printDirBtn = host.querySelector('button[aria-label="Print Sales Invoices Directory (A4)"]');
    assert.ok(printDirBtn, 'Toolbar print directory A4 button must be present');

    const refreshBtn = host.querySelector('button[aria-label="Refresh invoice records"]');
    assert.ok(refreshBtn, 'Toolbar refresh records icon button must be present');

    // 8. Verify Table headers (Payment Type removed, Payment Method kept, GRN themed)
    const tableHeadings = [...host.querySelectorAll('thead th.erp-table-heading')].map((th) => th.textContent.trim());
    assert.ok(tableHeadings.includes('INVOICE #'));
    assert.ok(tableHeadings.includes('CUSTOMER'));
    assert.ok(tableHeadings.includes('DATE'));
    assert.ok(tableHeadings.includes('PAYMENT METHOD'));
    assert.ok(!tableHeadings.includes('PAYMENT TYPE'), 'PAYMENT TYPE heading must not be in the table');
    assert.ok(tableHeadings.includes('TOTAL'));
    assert.ok(tableHeadings.includes('PAID'));
    assert.ok(tableHeadings.includes('BALANCE'));
    assert.ok(tableHeadings.includes('STATUS'));
    assert.ok(tableHeadings.includes('DELIVERY'));
    assert.ok(tableHeadings.includes('ACTIONS'));

    // 9. Verify Rows and Action icons in GRN theme
    const rows = host.querySelectorAll('tbody tr');
    assert.equal(rows.length, 2, 'Should display 2 invoice rows');

    const firstRowActions = rows[0].querySelectorAll('.erp-table-icon-action');
    assert.ok(firstRowActions.length >= 3, 'First row should have View, Edit, and Print action icons');
    assert.ok(rows[0].querySelector('button[aria-label="View Invoice"]'), 'View Invoice action button present');
    assert.ok(rows[0].querySelector('button[aria-label="Edit Invoice"]'), 'Edit Invoice action button present');
    assert.ok(rows[0].querySelector('button[aria-label="Print Invoice PDF"]'), 'Print Invoice PDF action button present');

    // 10. Test opening Payment Methods popup and choosing CARD
    await act(async () => {
      paymentMethodBtn.click();
    });

    const cardOption = [...document.querySelectorAll('.modern-filter-options button[role="option"]')].find(
      (opt) => opt.getAttribute('data-value') === 'CARD'
    );
    assert.ok(cardOption, 'Card option must be selectable in Payment Methods');
    await act(async () => {
      cardOption.click();
    });

    const filteredRows = host.querySelectorAll('tbody tr');
    assert.equal(filteredRows.length, 1, 'Only Card invoice should remain');
    assert.ok(filteredRows[0].textContent.includes('INV-2026-0002'));
    assert.ok(filteredRows[0].textContent.includes('Customer Two'));

    // 11. Verify Reset button appears and resets filters
    const resetBtn = [...host.querySelectorAll('button')].find((b) => b.textContent.includes('Reset'));
    assert.ok(resetBtn, 'Reset button should appear when filter is active');
    await act(async () => {
      resetBtn.click();
    });

    const resetRows = host.querySelectorAll('tbody tr');
    assert.equal(resetRows.length, 2, 'All 2 invoices should be shown after reset');
  } finally {
    await act(async () => root.unmount());
    await server.close();
    await window.happyDOM.close();
    for (const key of ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']) {
      delete globalThis[key];
    }
  }
});
