import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';
import path from 'node:path';

async function fixture(run) {
  const window = new Window();
  if (!window.HTMLDialogElement.prototype.showModal) {
    window.HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
  }
  if (!window.HTMLDialogElement.prototype.close) {
    window.HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
  }

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
    root: path.resolve('frontend'),
    cacheDir: '.build/outstanding-test-cache',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });

  try {
    await run({ window, host, root, server });
  } finally {
    await act(async () => root.unmount());
    await server.close();
    await window.happyDOM.close();
    for (const name of ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT']) {
      delete globalThis[name];
    }
  }
}

test('PosCustomerOutstandingModal shows the account summary, filters invoice statuses, and expands products', () =>
  fixture(async ({ window, host, root, server }) => {
    const { default: PosCustomerOutstandingModal } = await server.ssrLoadModule(
      '/src/components/PosCustomerOutstandingModal.jsx'
    );
    const { salesApi } = await server.ssrLoadModule('/src/api/apiClient.js');

    const mockCustomer = {
      id: 101,
      name: 'Supermart Retailers',
      customerCode: 'CUST-101',
      contactPerson: 'Kamal Perera',
      phone: '0771234567',
      address: '123 Galle Road, Colombo',
      creditLimit: 250000,
      currentBalance: 75000,
    };

    const mockInvoices = [
      {
        id: 501,
        invoiceNumber: 'INV-2026-000501',
        invoiceDate: '2026-10-15',
        warehouseName: 'Main Depot',
        paymentType: 'CREDIT',
        paymentMethod: '30_DAYS',
        netTotal: 50000,
        paidAmount: 20000,
        balanceAmount: 30000,
        status: 'PARTIAL',
        createdBy: 'cashier1',
        items: [
          {
            id: 1,
            productName: 'Premium Biscuit 200g',
            productSku: 'BIS-001',
            unitPrice: 250,
            quantity: 100,
            discountAmount: 0,
            totalPrice: 25000,
          },
          {
            id: 2,
            productName: 'Ceylon Tea 400g',
            productSku: 'TEA-002',
            unitPrice: 500,
            quantity: 50,
            discountAmount: 0,
            totalPrice: 25000,
          },
        ],
      },
      {
        id: 502,
        invoiceNumber: 'INV-2026-000502',
        invoiceDate: '2026-10-18',
        warehouseName: 'Main Depot',
        paymentType: 'CREDIT',
        paymentMethod: 'CHEQUE',
        netTotal: 45000,
        paidAmount: 0,
        balanceAmount: 45000,
        status: 'UNPAID',
        createdBy: 'cashier2',
        items: [
          {
            id: 3,
            productName: 'Dairy Milk Powder 1kg',
            productSku: 'MLK-003',
            unitPrice: 1500,
            quantity: 30,
            discountAmount: 0,
            totalPrice: 45000,
          },
        ],
      },
    ];

    mockInvoices.push({id:503,invoiceNumber:'INV-PAID',invoiceDate:'2026-10-19',netTotal:1000,paidAmount:1000,balanceAmount:0,status:'PAID'}, {id:504,invoiceNumber:'INV-CANCELLED',netTotal:2000,paidAmount:0,balanceAmount:2000,status:'CANCELLED'});
    salesApi.getCustomerOutstanding = async (id, onlyUnpaid) => {
      assert.equal(id,101); assert.equal(onlyUnpaid,true);
      return {data:mockInvoices};
    };

    mockInvoices.push({id:600,customerId:202,invoiceNumber:'OTHER-CUSTOMER',netTotal:500,balanceAmount:500,status:'COMPLETED'});
    let closed = false;
    await act(async () => {
      root.render(
        React.createElement(PosCustomerOutstandingModal, {
          isOpen: true,
          customer: mockCustomer,
          rangeInfo: {
            currentRangeName: 'Gold',
            remainingAmount: 15000,
            nextRangeName: 'Platinum',
            isHighestRange: false,
          },
          onClose: () => {
            closed = true;
          },
        })
      );
    });

    // 1. Verify dialog attributes
    const dialog = document.querySelector('dialog.pos-outstanding-dialog');
    assert.equal(dialog.parentElement, document.body, 'Popup escapes POS layout and transforms');
    assert.ok(dialog.classList.contains('purchase-inspection'), 'Uses the GRN popup shell');
    assert.ok(dialog, 'Dialog element exists');
    assert.equal(dialog.getAttribute('closedby'), 'any');

    // 2. Verify Customer Profile Summary banner
    assert.match(document.body.textContent, /Supermart Retailers/);
    assert.match(document.body.textContent, /CUST-101/);
    assert.match(document.body.textContent, /0771234567/);
    assert.match(document.body.textContent, /Gold/);
    assert.doesNotMatch(document.body.textContent, /to Platinum/);
    assert.doesNotMatch(document.body.textContent, /INV-PAID|INV-CANCELLED/);

    // 3. Verify Table content
    assert.match(document.body.textContent, /INV-2026-000501/);
    assert.match(document.body.textContent, /INV-2026-000502/);
    assert.match(document.body.textContent, /30000.00/);
    assert.match(document.body.textContent, /45000.00/);

    assert.doesNotMatch(document.body.textContent,/OTHER-CUSTOMER/);
    assert.ok(document.body.querySelector('.customer-outstanding-table'));
    assert.match(document.body.textContent,/Payment type/);
    assert.equal(document.body.querySelector('[aria-label="Print outstanding invoice"]'),null,'POS popup has no per-invoice actions');
    assert.equal(document.body.querySelectorAll('.customer-outstanding-table thead th').length,7);
    // 4. Drilldown: Expand line items for invoice by clicking the table row button
    const viewItemsBtn = Array.from(document.body.querySelectorAll('.customer-outstanding-row')).find((b) =>
      b.getAttribute('aria-label')?.includes('View outstanding invoice INV-2026-000501')
    );
    assert.ok(viewItemsBtn, 'Found View Items button');
    await act(async () => {
      viewItemsBtn.click();
    });

    assert.match(document.body.textContent, /Premium Biscuit 200g/);
    assert.match(document.body.textContent, /Ceylon Tea 400g/);
    assert.match(document.body.textContent, /cashier1/);

    assert.equal(document.body.querySelector('[aria-label="Invoice status"]').textContent.trim(),'All Outstanding Invoices','All outstanding invoices is the default');
    const statusFilter = document.body.querySelector('[aria-label="Invoice status"]');
    await act(async () => statusFilter.click());
    assert.ok(dialog.querySelector('[role="listbox"]'), 'Filter opens inside the native modal top layer');
    assert.equal(host.querySelector('[data-value="PAID"]'),null);
    assert.equal(host.querySelector('[data-value="CANCELLED"]'),null);
    await act(async () => document.body.querySelector('[role="option"][data-value="UNPAID"]').click());
    assert.match(document.body.textContent,/INV-2026-000502/);
    assert.doesNotMatch(document.body.textContent,/INV-2026-000501/);
    await act(async () => statusFilter.click());
    await act(async () => document.body.querySelector('[role="option"][data-value="PARTIAL"]').click());
    assert.match(document.body.textContent, /INV-2026-000501/);
    assert.doesNotMatch(document.body.textContent, /INV-2026-000502|INV-PAID|INV-CANCELLED/);
    await act(async () => statusFilter.click());
    await act(async () => document.body.querySelector('[role="option"][data-value="ALL"]').click());
    assert.equal(document.body.querySelectorAll('.customer-outstanding-row').length, 2);

    const search = document.body.querySelector('[aria-label="Search customer invoices"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(search, 'NOT-A-BILL');
      search.dispatchEvent(new window.Event('input', {bubbles:true}));
    });
    assert.match(document.body.textContent, /No matching invoices/);
    assert.equal(document.body.querySelectorAll('.customer-outstanding-table thead th').length,7,'Headers remain visible with no matching invoices');
    assert.equal([...document.body.querySelectorAll('button')].find(button => button.textContent.includes('Print Statement')).disabled, true);
    await act(async () => document.body.querySelector('[aria-label="Clear search text"]').click());
    assert.equal(document.body.querySelectorAll('.customer-outstanding-row').length, 2);

    // 5. Test Close Button
    const closeBtn = document.body.querySelector('header button');
    await act(async () => {
      closeBtn.click();
    });
    assert.equal(closed, true, 'Modal triggered onClose');
  }));

