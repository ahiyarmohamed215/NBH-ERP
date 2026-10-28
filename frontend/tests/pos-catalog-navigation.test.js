import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('POS inventory catalog allows smooth 1-by-1 arrow navigation and simultaneous % + Rs discounts', async () => {
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
      data: { username: 'cashier', roles: ['ROLE_CASHIER'], permissions: ['SALES_CREATE'] },
    });
    apis.warehouseApi.getActive = async () => ({
      data: [{ id: 1, code: 'WH-1', name: 'Main Warehouse' }],
    });
    apis.customerApi.getPosCustomers = async () => ({
      data: [{ id: 1, name: 'Default Customer', customerCode: 'CUST-0001', creditLimit: 0, currentBalance: 0 }],
    });
    apis.inventoryApi.getBalances = async () => ({
      data: {
        content: [
          { productId: 1, warehouseId: 1, quantity: 20, availableQuantity: 20 },
          { productId: 2, warehouseId: 1, quantity: 20, availableQuantity: 20 },
          { productId: 3, warehouseId: 1, quantity: 20, availableQuantity: 20 },
          { productId: 4, warehouseId: 1, quantity: 20, availableQuantity: 20 },
        ],
      },
    });
    apis.productApi.searchActive = async () => ({
      data: [
        { id: 1, name: 'Product Alpha', sku: 'SKU-001', sellingPrice: 10000, warehouseId: 1 },
        { id: 2, name: 'Product Beta', sku: 'SKU-002', sellingPrice: 20000, warehouseId: 1 },
        { id: 3, name: 'Product Gamma', sku: 'SKU-003', sellingPrice: 30000, warehouseId: 1 },
        { id: 4, name: 'Product Delta', sku: 'SKU-004', sellingPrice: 40000, warehouseId: 1 },
      ],
    });
    apis.salesApi.getPosStockLimits = async () => ({ data: [] });
    apis.salesApi.getHeldWorkspace = async () => ({ data: { bills: [] } });

    let savedHeldRequest = null;
    apis.default.post = async (url, data) => {
      if (url.includes('/invoices/held/save-split')) {
        savedHeldRequest = data;
        return { data: [{ id: 101, status: 'SENT_TO_WAREHOUSE', recordVersion: 1 }] };
      }
      return { data: {} };
    };

    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const { default: PosView } = await server.ssrLoadModule('/src/views/PosView.jsx');

    await act(async () => {
      root.render(
        React.createElement(AuthProvider, null,
          React.createElement(ToastProvider, null,
            React.createElement(PosView, { onExitPos: () => {} })
          )
        )
      );
    });

    // Wait for catalog products to load
    await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));

    const rows = host.querySelectorAll('.pos-inventory-row');
    assert.equal(rows.length, 4, 'Must display 4 inventory catalog rows');

    const searchInput = host.querySelector('[aria-label="Search POS products"]');
    assert.ok(searchInput, 'Search product input must exist');

    // 1. Initial position is at index 0 (Product Alpha)
    assert.ok(rows[0].style.borderLeft.includes('#0284c7'), 'Index 0 (Alpha) must be highlighted');

    // 2. Press ArrowDown from search bar: MUST go down 1 product to Beta (Index 1), NOT skipping two to Gamma (Index 2)
    await act(async () => {
      searchInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    });
    assert.ok(rows[1].style.borderLeft.includes('#0284c7'), 'ArrowDown must move to index 1 (Product Beta)');
    assert.ok(!rows[2].style.borderLeft.includes('#0284c7'), 'Must NOT jump 2 products to Product Gamma');

    // 3. Press ArrowDown again: moves to Gamma (Index 2)
    await act(async () => {
      searchInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    });
    assert.ok(rows[2].style.borderLeft.includes('#0284c7'), 'ArrowDown must move smoothly to index 2 (Product Gamma)');

    // 4. Click directly on a product row (Product Delta, index 3)
    await act(async () => {
      rows[3].click();
    });
    assert.ok(rows[3].style.borderLeft.includes('#0284c7'), 'Clicking on Delta row must highlight it');

    // 5. Press ArrowUp from keyboard: moves smoothly up to Gamma (Index 2)
    await act(async () => {
      document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    });
    assert.ok(rows[2].style.borderLeft.includes('#0284c7'), 'ArrowUp must move back up to Product Gamma');

    // 6. Test Simultaneous Discount % and Discount Rs:
    // Click on Product Alpha (unit price 10,000, 20 in stock)
    await act(async () => {
      rows[0].click();
    });

    const qtyInput = host.querySelector('input[type="number"][min="1"]');
    const discPercentInput = host.querySelector('input[placeholder="0%"]');
    const discAmountInput = host.querySelector('input[placeholder="0.00"]');
    assert.ok(qtyInput, 'Quantity input must exist');
    assert.ok(discPercentInput, 'Discount % input must exist');
    assert.ok(discAmountInput, 'Discount Rs input must exist');

    // Set Quantity = 2 (Gross = 10,000 * 2 = 20,000 Rs)
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(qtyInput, '2');
      qtyInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      qtyInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    });

    // Enter 5% in Discount %
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(discPercentInput, '5');
      discPercentInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      discPercentInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    });

    // Check discount values: 5% of 20,000 = 1,000 Rs discount.
    assert.equal(discPercentInput.value, '5', 'Discount % must be 5');

    // Enter 1000 Rs in Discount Rs
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(discAmountInput, '1000');
      discAmountInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      discAmountInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    });

    // VERIFY: BOTH inputs retain their values! Neither overwrote the other!
    assert.equal(discPercentInput.value, '5', 'Discount % must remain 5 even after entering Discount Rs');
    assert.equal(discAmountInput.value, '1000', 'Discount Rs must remain 1000');

    // Add product to cart table by pressing Enter in discAmountInput
    await act(async () => {
      discAmountInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });

    // Verify cart table row
    let cartRow = host.querySelector('.pos-cart-details-row');
    assert.ok(cartRow, 'Cart table row must exist');

    // Check cart table cells:
    // Product, Qty (2), Unit Price (Rs. 10,000.00), Discount % (5.00%), Discount (Rs. 1,000.00), Line Total (Rs. 18,000.00)
    let cells = cartRow.querySelectorAll('td');
    assert.equal(cells[1].textContent.trim(), '2', 'Quantity must be 2');
    assert.match(cells[3].textContent.trim(), /5%/, 'Discount % column must show 5.00%');
    assert.ok(cells[4].textContent.includes('2,000'), 'Total discount column must show 2,000.00 (1,000 from 5% + 1,000 Rs cash)');
    assert.ok(cells[5].textContent.includes('18,000'), 'Line total must be 18,000.00 (20,000 - 1,000 - 1,000)');

    // 7. Test Line Editor with both % and Rs discounts:
    const editBtn = cartRow.querySelector('button[title="Edit item quantity & discount"]');
    assert.ok(editBtn, 'Edit button must exist on cart row');
    await act(async () => {
      editBtn.click();
    });

    const editDialog = host.querySelector('.pos-line-dialog');
    assert.ok(editDialog, 'Edit line dialog must open');

    const editInputs = editDialog.querySelectorAll('input');
    const editRateInput = editInputs[1];
    const editAmtInput = editInputs[2];
    assert.equal(editRateInput.value, '5', 'Line editor must load existing discount rate 5%');
    assert.equal(editAmtInput.value, '1000', 'Line editor must load existing cash discount Rs. 1000');

    // Change discount rate to 10% in line editor (10% of 20,000 = 2,000 Rs, plus 1,000 cash disc = 3,000 total discount)
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(editRateInput, '10');
      editRateInput.dispatchEvent(new window.Event('input', { bubbles: true }));
      editRateInput.dispatchEvent(new window.Event('change', { bubbles: true }));
    });

    // Save line editor
    await act(async () => {
      editDialog.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    });

    // Verify updated cart row:
    cartRow = host.querySelector('.pos-cart-details-row');
    cells = cartRow.querySelectorAll('td');
    assert.match(cells[3].textContent.trim(), /10%/, 'Updated discount % must show 10.00%');
    assert.ok(cells[4].textContent.includes('3,000'), 'Total discount column must show 3,000.00 (2,000 from 10% + 1,000 Rs cash)');
    assert.ok(cells[5].textContent.includes('17,000'), 'Line total must be 17,000.00 (20,000 - 2,000 - 1,000)');

    // 8. Test Hold Bill and verify payload sends both discountRate and discountAmount:
    // Select customer
    const customerSearch = host.querySelector('[placeholder="Select Customer (F1)..."]');
    assert.ok(customerSearch, 'Customer search must exist');
    await act(async () => customerSearch.focus());
    await act(async () => customerSearch.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));

    // Click Save Onhold Bill button
    const holdBtn = [...host.querySelectorAll('button')].find(b => b.textContent.includes('Save Onhold Bill') || b.textContent.includes('Hold Bill'));
    assert.ok(holdBtn, 'Hold button must exist');
    await act(async () => holdBtn.click());

    // Remarks form rendered in document.body via Portal
    const remarksForm = document.querySelector('form.pos-bill-remarks');
    assert.ok(remarksForm, 'Remarks dialog must appear');
    await act(async () => {
      remarksForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    });

    assert.ok(savedHeldRequest, 'Must trigger saveSplitHeld');
    assert.equal(savedHeldRequest.bill.items[0].discountRate, 10, 'Payload item must have discountRate 10');
    assert.equal(savedHeldRequest.bill.items[0].discountAmount, 1000, 'Payload item must have discountAmount 1000');
    assert.equal(savedHeldRequest.bill.items[0].quantity, 2, 'Payload item must have quantity 2');

  } finally {
    await act(async () => root.unmount());
    await server.close();
    await window.happyDOM.close();
  }
});
