import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('quotation tab uses GRN style workstation, directory toolbar, inspection modal and cancellation reason flow', async () => {
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
      data: { username: 'admin', roles: ['ROLE_ADMIN'], permissions: ['SALES_CREATE', 'QUOTATION_MANAGE', 'SALES_VIEW'] },
    });

    const sampleCustomers = [
      { id: 1, name: 'Apex Motors Ltd', code: 'CUST-001', phone: '0771234567', email: 'info@apex.com' },
      { id: 2, name: 'Precision Engineering', code: 'CUST-002', phone: '0719876543', email: 'sales@precision.com' },
    ];

    const sampleProducts = [
      { id: 10, name: 'Brake Disc Rotor', sku: 'BDR-100', barcode: '89012345', sellingPrice: 4500, costPrice: 3200, availableQuantity: 25, unitOfMeasure: 'PCS' },
      { id: 20, name: 'Ceramic Brake Pads', sku: 'CBP-200', barcode: '89054321', sellingPrice: 2800, costPrice: 1900, availableQuantity: 40, unitOfMeasure: 'SET' },
    ];

    const sampleQuotations = [
      {
        id: 101,
        quotationNumber: 'QT-2026-0001',
        quotationNo: 'QT-2026-0001',
        customerName: 'Apex Motors Ltd',
        customerId: 1,
        customerPhone: '0771234567',
        customerEmail: 'info@apex.com',
        quotationDate: '2026-10-20',
        validUntil: '2026-11-20',
        subtotal: 9000,
        discountAmount: 500,
        taxAmount: 0,
        totalAmount: 8500,
        status: 'PENDING',
        notes: '30 days warranty included',
        items: [
          { id: 1, productId: 10, productSku: 'BDR-100', productName: 'Brake Disc Rotor', quantity: 2, unitPrice: 4500, discountRate: 5.56, discountAmount: 500, totalPrice: 8500 },
        ],
      },
      {
        id: 102,
        quotationNumber: 'QT-2026-0002',
        quotationNo: 'QT-2026-0002',
        customerName: 'Precision Engineering',
        customerId: 2,
        quotationDate: '2026-10-21',
        validUntil: '2026-11-21',
        subtotal: 5600,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 5600,
        status: 'ACCEPTED',
        notes: 'Delivery upon receipt of purchase order',
        items: [
          { id: 2, productId: 20, productSku: 'CBP-200', productName: 'Ceramic Brake Pads', quantity: 2, unitPrice: 2800, discountRate: 0, discountAmount: 0, totalPrice: 5600 },
        ],
      },
      {
        id: 103,
        quotationNumber: 'QT-2026-0003',
        quotationNo: 'QT-2026-0003',
        customerName: 'Walk-in Garage',
        customerId: null,
        quotationDate: '2026-10-15',
        validUntil: '2026-10-18',
        subtotal: 1200,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 1200,
        status: 'CANCELLED',
        cancelReason: 'Customer decided not to proceed',
        cancelledBy: 'admin',
        items: [],
      },
    ];

    apis.quotationApi.search = async () => ({ data: { content: sampleQuotations } });
    apis.quotationApi.getById = async (id) => ({
      data: sampleQuotations.find((q) => q.id === Number(id)) || sampleQuotations[0],
    });
    let cancelledId = null;
    let cancelReasonPassed = null;
    apis.quotationApi.cancel = async (id, data) => {
      cancelledId = id;
      cancelReasonPassed = data.reason;
      return { data: { ...sampleQuotations[0], status: 'CANCELLED', cancelReason: data.reason } };
    };

    apis.customerApi.getActive = async () => ({ data: sampleCustomers });
    apis.productApi.getProducts = async () => ({ data: { content: sampleProducts } });

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
            React.createElement(InvoicingHub, { activeSubTab: 'quotations' })
          )
        )
      )
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 80)));

    // 1. Verify directory toolbar: Search input, FilterSelect, Print, Refresh
    const searchInput = host.querySelector('input[placeholder="Search quotations by quotation # or customer name..."]');
    assert.ok(searchInput, 'Search input with GRN-style placeholder must be present');

    const statusFilterBtn = host.querySelector('button[role="combobox"][aria-label="Filter quotations by status"]');
    assert.ok(statusFilterBtn, 'Status FilterSelect button must be present');
    assert.ok(statusFilterBtn.textContent.includes('All Statuses'), 'Status filter default must be All Statuses');

    const printBtn = host.querySelector('button[aria-label="Print Quotations Directory (A4)"]');
    assert.ok(printBtn, 'Print directory A4 button must be present');

    const refreshBtn = host.querySelector('button[aria-label="Refresh records"]');
    assert.ok(refreshBtn, 'Refresh records button must be present');

    // 2. Verify Table Columns match GRN style
    const headings = [...host.querySelectorAll('th.erp-table-heading')].map((th) => th.textContent.trim());
    assert.ok(headings.includes('QUOTATION NUMBER'), 'Heading QUOTATION NUMBER must be present');
    assert.ok(headings.includes('CUSTOMER'), 'Heading CUSTOMER must be present');
    assert.ok(headings.includes('TOTAL PRODUCTS'), 'Heading TOTAL PRODUCTS must be present');
    assert.ok(headings.includes('DATE'), 'Heading DATE must be present');
    assert.ok(headings.includes('VALID UNTIL'), 'Heading VALID UNTIL must be present');
    assert.ok(headings.includes('TOTAL AMOUNT'), 'Heading TOTAL AMOUNT must be present');
    assert.ok(headings.includes('STATUS'), 'Heading STATUS must be present');
    assert.ok(headings.includes('ACTIONS'), 'Heading ACTIONS must be present');

    // 3. Verify quotations listed with StatusBadge
    const tableCells = [...host.querySelectorAll('td.erp-table-cell')].map((td) => td.textContent.trim());
    assert.ok(tableCells.includes('QT-2026-0001'), 'QT-2026-0001 must be listed');
    assert.ok(tableCells.includes('Apex Motors Ltd'), 'Apex Motors Ltd must be listed');
    assert.ok(tableCells.includes('QT-2026-0002'), 'QT-2026-0002 must be listed');

    // 4. Verify Inspect Modal opens on row click
    const firstRow = host.querySelector('tbody tr');
    assert.ok(firstRow, 'Table rows must be rendered');
    await act(async () => firstRow.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));

    const modal = host.querySelector('.purchase-inspection');
    assert.ok(modal, 'Purchase inspection modal must open on clicking quotation row');
    assert.ok(modal.textContent.includes('Customer quotation'), 'Document title must say Customer quotation');
    assert.ok(modal.textContent.includes('QT-2026-0001'), 'Quotation number must be displayed in inspection header');
    assert.ok(modal.textContent.includes('Brake Disc Rotor'), 'Quoted items table must show product name');
    assert.ok(modal.textContent.includes('LKR 8500.00'), 'Total amount must be displayed in inspection modal');

    // 5. Verify Cancel button in Inspection triggers status change dialog
    const cancelModalBtn = [...modal.querySelectorAll('button')].find((b) => b.textContent.includes('Cancel Quotation'));
    assert.ok(cancelModalBtn, 'Cancel Quotation button must be present in inspection modal');

    await act(async () => cancelModalBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));

    const statusDialog = host.querySelector('.supplier-status-dialog');
    assert.ok(statusDialog, 'PurchasingStatusDialog must open when cancelling quotation');
    assert.ok(statusDialog.textContent.includes('Change Quotation status') || statusDialog.textContent.includes('Quotation number'), 'Status dialog must identify Quotation');
    assert.ok(/cancelled/i.test(statusDialog.textContent), 'Status dialog must show Cancelled target status');

    // Submit cancellation with reason
    const reasonTextarea = statusDialog.querySelector('textarea');
    assert.ok(reasonTextarea, 'Reason textarea must be present');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(
        reasonTextarea,
        'Price too high for client'
      );
      reasonTextarea.dispatchEvent(new window.Event('input', { bubbles: true }));
      reasonTextarea.dispatchEvent(new window.Event('change', { bubbles: true }));
    });

    const confirmCancelBtn = statusDialog.querySelector('button.supplier-status-confirm');
    assert.ok(confirmCancelBtn, 'Confirm status change button must be present');
    await act(async () => confirmCancelBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));

    assert.equal(cancelledId, 101, 'Quotation 101 must have been cancelled via API');
    assert.equal(cancelReasonPassed, 'Price too high for client', 'Cancellation reason must be passed to API');

    // 6. Test "+ New Quotation" opens GRN-style workstation
    const newQuotationBtn = [...host.querySelectorAll('button')].find((b) => b.textContent.includes('New Quotation'));
    assert.ok(newQuotationBtn, '+ New Quotation button in header must be present');

    await act(async () => newQuotationBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));

    const workstation = host.querySelector('.quotation-page.grn-page');
    assert.ok(workstation, 'Quotation workstation (.quotation-page.grn-page) must open');
    assert.ok(workstation.textContent.includes('New Customer Quotation'), 'Workstation title must be New Customer Quotation');

    // Verify left workstation has Product search and line fields
    const productSearchInput = workstation.querySelector('.purchase-product-search input');
    assert.ok(productSearchInput, 'Product search input must be present in workstation');

    const quotedQtyInput = workstation.querySelector('input[name="quantity"]') || [...workstation.querySelectorAll('label')].find((l) => l.textContent.includes('QUOTED QTY'))?.querySelector('input');
    assert.ok(quotedQtyInput, 'QUOTED QTY input must be present');

    const unitPriceInput = workstation.querySelector('input[name="unitPrice"]') || [...workstation.querySelectorAll('label')].find((l) => l.textContent.includes('UNIT PRICE'))?.querySelector('input');
    assert.ok(unitPriceInput, 'UNIT PRICE input must be present');

    // Verify right workstation has quoted items table and financial summary
    const quotedItemsHeading = [...workstation.querySelectorAll('span')].find((s) => s.textContent.includes('Quoted items'));
    assert.ok(quotedItemsHeading, 'Quoted items heading must be present');

    const backBtn = [...workstation.querySelectorAll('button')].find((b) => b.textContent.includes('Back to Quotations'));
    assert.ok(backBtn, 'Back to Quotations button must be present in workstation footer');

    const createBtn = [...workstation.querySelectorAll('button')].find((b) => b.textContent.includes('Create Quotation'));
    assert.ok(createBtn, 'Create Quotation button must be present in workstation footer');
  } finally {
    root.unmount();
    await server.close();
  }
});
