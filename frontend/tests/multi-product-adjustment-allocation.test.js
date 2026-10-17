import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('multi-product stock adjustment and inventory allocation in GRN style with brand/category filters and allocation code column', async () => {
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
      data: { username: 'admin', roles: ['ROLE_ADMIN'], permissions: ['INVENTORY_VIEW', 'INVENTORY_EDIT'] },
    });

    // Mock products
    const sampleProducts = [
      { id: 1, name: 'Product Alpha', sku: 'SKU-001', unitOfMeasure: 'PCS', brandId: 101, brandName: 'Brand Active', categoryName: 'Cat Active', costPrice: 10, isActive: true },
      { id: 2, name: 'Product Beta', sku: 'SKU-002', unitOfMeasure: 'BOX', brandId: 101, brandName: 'Brand Active', categoryName: 'Cat Active', costPrice: 20, isActive: true },
      { id: 3, name: 'Product Inactive Brand', sku: 'SKU-003', unitOfMeasure: 'PCS', brandId: 102, brandName: 'Brand Inactive', categoryName: 'Cat Inactive', costPrice: 15, isActive: true },
    ];
    apis.productApi.getProducts = async () => ({ data: { content: sampleProducts } });

    // Mock warehouses
    apis.warehouseApi.getAll = async () => ({ data: [{ id: 10, name: 'Main Warehouse', code: 'WH-MAIN', isActive: true }] });

    // Mock brands (one active, one inactive)
    apis.brandApi.getActive = async () => ({ data: [{ id: 101, name: 'Brand Active', isActive: true }] });
    apis.brandApi.getAll = async () => ({
      data: [
        { id: 101, name: 'Brand Active', isActive: true },
        { id: 102, name: 'Brand Inactive', isActive: false },
      ],
    });

    // Mock categories (one active, one inactive)
    apis.categoryApi.getActive = async () => ({ data: [{ id: 201, name: 'Cat Active', isActive: true }] });
    apis.categoryApi.getAll = async () => ({
      data: [
        { id: 201, name: 'Cat Active', isActive: true },
        { id: 202, name: 'Cat Inactive', isActive: false },
      ],
    });

    // Mock balances
    apis.inventoryApi.getBalances = async () => ({
      data: {
        content: [
          { id: 1, productId: 1, productSku: 'SKU-001', productName: 'Product Alpha', brandName: 'Brand Active', categoryName: 'Cat Active', warehouseId: 10, warehouseName: 'Main Warehouse', quantity: 50, reservedQuantity: 0, availableQuantity: 50, costPrice: 10 },
          { id: 2, productId: 2, productSku: 'SKU-002', productName: 'Product Beta', brandName: 'Brand Active', categoryName: 'Cat Active', warehouseId: 10, warehouseName: 'Main Warehouse', quantity: 30, reservedQuantity: 0, availableQuantity: 30, costPrice: 20 },
        ],
      },
    });

    // Mock POS staff
    apis.salesmanApi.getPosStaff = async () => ({
      data: {
        data: [{ id: 7, username: 'cashier1', fullName: 'Cashier One', employeeCode: 'EMP-007', isActive: true }],
      },
    });

    // Mock search products for adjustment
    const adjustmentChoices = [
      { productId: 1, productName: 'Product Alpha', productCode: 'SKU-001', warehouseId: 10, warehouseName: 'Main Warehouse', availableStock: 50, sourceGrnId: 1, sourceGrnNumber: 'GRN-001', unitCost: 10 },
      { productId: 2, productName: 'Product Beta', productCode: 'SKU-002', warehouseId: 10, warehouseName: 'Main Warehouse', availableStock: 30, sourceGrnId: 2, sourceGrnNumber: 'GRN-002', unitCost: 20 },
    ];
    apis.adjustmentApi.searchProducts = async () => ({ data: adjustmentChoices });

    const createdAdjustments = [];
    apis.adjustmentApi.create = async (payload, process) => {
      createdAdjustments.push({ payload, process });
      return { data: { id: 100 } };
    };

    const createdQuotas = [];
    apis.staffQuotaApi.search = async () => ({
      data: {
        content: [
          { id: 42, productId: 1, productSku: 'SKU-001', productName: 'Product Alpha', productUnit: 'PCS', userId: 7, userFullName: 'Cashier One', username: 'cashier1', userEmployeeCode: 'EMP-007', totalStockAvailable: 50, allocatedQuantity: 5, createdAt: '2026-10-16T10:00:00Z', isActive: true },
        ],
      },
    });
    apis.staffQuotaApi.create = async (payload) => {
      createdQuotas.push(payload);
      return { data: { id: 43, ...payload } };
    };
    apis.staffQuotaApi.getProductStock = async () => ({ data: { data: { availableStock: 50, productName: 'Product Alpha' } } });

    const { AuthProvider } = await server.ssrLoadModule('/src/context/AuthContext.jsx');
    const { ToastProvider } = await server.ssrLoadModule('/src/context/ToastContext.jsx');
    const { default: Inventory } = await server.ssrLoadModule('/src/views/InventoryHub.jsx');

    // 1. TEST INVENTORY LIST TAB: Brand and Category filter dropdowns show ONLY active items, NO warehouse filter
    await act(async () => {
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(ToastProvider, null, React.createElement(Inventory, { activeSubTab: 'inventory-list' }))
        )
      );
    });
    await act(async () => new Promise((res) => setTimeout(res, 300)));

    const click = async (el) => {
      assert.ok(el);
      await act(async () => el.click());
    };
    const enter = async (el, val) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(
          el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
          'value'
        ).set.call(el, val);
        el.dispatchEvent(new window.Event('input', { bubbles: true }));
      });

    // Check inventory list filters
    const brandFilter = host.querySelector('[title="Filter by brand"]');
    assert.ok(brandFilter, 'Brand filter dropdown must be present');
    await click(brandFilter);
    const brandOptions = [...document.querySelectorAll('.modern-filter-options [role="option"]')].map((opt) => opt.textContent.trim());
    assert.ok(brandOptions.includes('Brand Active'), 'Active brand must be in dropdown');
    assert.ok(!brandOptions.includes('Brand Inactive'), 'Inactive brand must NOT be in dropdown');
    await click(document.querySelector('.modern-filter-options [role="option"][data-value="ALL"]'));

    const catFilter = host.querySelector('[title="Filter by category"]');
    assert.ok(catFilter, 'Category filter dropdown must be present');
    await click(catFilter);
    const catOptions = [...document.querySelectorAll('.modern-filter-options [role="option"]')].map((opt) => opt.textContent.trim());
    assert.ok(catOptions.includes('Cat Active'), 'Active category must be in dropdown');
    assert.ok(!catOptions.includes('Cat Inactive'), 'Inactive category must NOT be in dropdown');
    await click(document.querySelector('.modern-filter-options [role="option"][data-value="ALL"]'));

    // Check Warehouse filter is removed from Inventory List toolbar
    const whFilter = host.querySelector('[title="Filter by warehouse"]');
    assert.equal(whFilter, null, 'Warehouse filter must be removed from inventory list');

    // 2. TEST ALLOCATION TABLE: Allocation code is first column
    await act(async () => {
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(ToastProvider, null, React.createElement(Inventory, { activeSubTab: 'pos-quotas' }))
        )
      );
    });

    const ths = [...host.querySelectorAll('.allocation-list-table th')];
    assert.ok(ths.length > 0);
    assert.equal(ths[0].textContent.trim(), 'Allocation code', 'First column in allocation table must be Allocation code');

    const firstRowFirstTd = host.querySelector('.allocation-list-table tbody tr td');
    assert.ok(firstRowFirstTd);
    assert.equal(firstRowFirstTd.textContent.trim(), 'ALC-0042', 'First cell must show ALC-0042 code');

    // 3. TEST MULTI-PRODUCT INVENTORY ALLOCATION (GRN Style)
    const newAllocBtn = [...host.querySelectorAll('button')].find((b) => b.textContent.includes('New Allocation'));
    await click(newAllocBtn);

    const allocWorkspace = host.querySelector('.allocation-workspace');
    assert.ok(allocWorkspace, 'Allocation workspace must be opened');

    // Assign staff
    await act(async () => allocWorkspace.querySelector('[aria-label="Search allocation staff"]').focus());
    const assignStaffBtn = allocWorkspace.querySelector('[aria-label="Assign Cashier One"]');
    await click(assignStaffBtn);

    // Stage first product
    await act(async () => allocWorkspace.querySelector('[aria-label="Search allocation products"]').focus());
    await click(allocWorkspace.querySelector('[aria-label="Select product SKU-001"]'));
    await enter(allocWorkspace.querySelector('[aria-label="Allocated quantity"]'), '5');

    // Click "Add to allocation" button
    const addAllocItemBtn = [...allocWorkspace.querySelectorAll('button')].find((b) => b.textContent.includes('Add to allocation'));
    assert.ok(addAllocItemBtn, 'Add to allocation button must exist in GRN style');
    await click(addAllocItemBtn);

    // Verify first item is in the allocated items table on the right
    let allocatedRows = [...allocWorkspace.querySelectorAll('.grn-items tbody tr')];
    assert.equal(allocatedRows.length, 1);
    assert.ok(allocatedRows[0].textContent.includes('SKU-001'));

    // Stage second product
    await click(host.querySelector('[aria-label="Search allocation products"]'));
    await click(host.querySelector('[aria-label="Select product SKU-002"]'));
    await enter(host.querySelector('[aria-label="Allocated quantity"]'), '10');

    // Click "Add to allocation" button again
    await click([...allocWorkspace.querySelectorAll('button')].find((b) => b.textContent.includes('Add to allocation')));

    // Verify both items are in the allocated items table
    allocatedRows = [...allocWorkspace.querySelectorAll('.grn-items tbody tr')];
    assert.equal(allocatedRows.length, 2, 'Allocated items table should have 2 products');
    assert.ok(allocatedRows[0].textContent.includes('SKU-001'));
    assert.ok(allocatedRows[1].textContent.includes('SKU-002'));

    // Total units badge
    const allocTotalUnits = allocWorkspace.querySelector('.grn-items strong');
    assert.equal(allocTotalUnits.textContent.trim(), '15', 'Total units should sum 5 + 10 = 15');

    // Submit allocation
    const submitAllocBtn = allocWorkspace.querySelector('[type="submit"]');
    assert.equal(submitAllocBtn.disabled, false);
    await act(async () => allocWorkspace.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));

    // Verify both quotas were saved
    assert.equal(createdQuotas.length, 2, 'Both allocations should be created');
    assert.equal(createdQuotas[0].productId, 1);
    assert.equal(createdQuotas[0].allocatedQuantity, 5);
    assert.equal(createdQuotas[1].productId, 2);
    assert.equal(createdQuotas[1].allocatedQuantity, 10);
    assert.equal(host.querySelector('.allocation-workspace'), null, 'Workspace closes on save');

    // 4. TEST MULTI-PRODUCT STOCK ADJUSTMENT (GRN Style)
    await act(async () => {
      root.render(
        React.createElement(
          AuthProvider,
          null,
          React.createElement(ToastProvider, null, React.createElement(Inventory, { activeSubTab: 'adjustments' }))
        )
      );
    });

    const newAdjBtn = [...host.querySelectorAll('button')].find((b) => b.textContent.includes('New Adjustment'));
    await click(newAdjBtn);

    // Pick Addition
    await click([...host.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.startsWith('Addition')));

    const adjWorkspace = host.querySelector('.adjustment-workspace');
    assert.ok(adjWorkspace, 'Adjustment workspace should open');
    await act(async () => new Promise((res) => setTimeout(res, 250)));

    // Select first product
    const prodOption1 = [...adjWorkspace.querySelectorAll('[role="option"]')].find((o) => o.textContent.includes('Product Alpha'));
    await click(prodOption1);
    await enter(adjWorkspace.querySelector('[aria-label="Adjustment quantity"]'), '7');

    // Click "Add to adjustment"
    const addAdjItemBtn = [...adjWorkspace.querySelectorAll('button')].find((b) => b.textContent.includes('Add to adjustment'));
    assert.ok(addAdjItemBtn, 'Add to adjustment button must exist in GRN style');
    await click(addAdjItemBtn);

    // Verify item 1 in items table on the right
    let adjRows = [...adjWorkspace.querySelectorAll('.grn-items tbody tr')];
    assert.equal(adjRows.length, 1);
    assert.ok(adjRows[0].textContent.includes('SKU-001'));

    // Select second product
    await click(adjWorkspace.querySelector('[aria-label="Search adjustment products"]'));
    await act(async () => new Promise((res) => setTimeout(res, 250)));
    const prodOption2 = [...adjWorkspace.querySelectorAll('[role="option"]')].find((o) => o.textContent.includes('Product Beta'));
    await click(prodOption2);
    await enter(adjWorkspace.querySelector('[aria-label="Adjustment quantity"]'), '12');

    // Click "Add to adjustment"
    await click([...adjWorkspace.querySelectorAll('button')].find((b) => b.textContent.includes('Add to adjustment')));

    // Verify both items in items table
    adjRows = [...adjWorkspace.querySelectorAll('.grn-items tbody tr')];
    assert.equal(adjRows.length, 2, 'Adjusted items table should have 2 products');
    assert.ok(adjRows[0].textContent.includes('SKU-001'));
    assert.ok(adjRows[1].textContent.includes('SKU-002'));

    // Submit adjustment
    const submitAdjBtn = adjWorkspace.querySelector('[type="submit"]');
    assert.equal(submitAdjBtn.disabled, false);
    await act(async () => adjWorkspace.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));

    // Verify saved adjustment
    assert.equal(createdAdjustments.length, 1, 'One adjustment document should be saved');
    assert.equal(createdAdjustments[0].payload.items.length, 2, 'Adjustment payload contains 2 items');
    assert.equal(createdAdjustments[0].payload.items[0].productId, 1);
    assert.equal(createdAdjustments[0].payload.items[0].quantity, 7);
    assert.equal(createdAdjustments[0].payload.items[1].productId, 2);
    assert.equal(createdAdjustments[0].payload.items[1].quantity, 12);
    assert.equal(host.querySelector('.adjustment-workspace'), null, 'Workspace closes on save');
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
