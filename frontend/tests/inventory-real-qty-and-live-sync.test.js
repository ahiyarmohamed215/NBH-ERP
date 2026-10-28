import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('InventoryBalanceTable renders real available quantity when onhold bills reserve stock', async () => {
  const window = new Window();
  Object.assign(globalThis, {
    window,
    document: window.document,
    CustomEvent: window.CustomEvent,
    Event: window.Event,
    IS_REACT_ACT_ENVIRONMENT: true
  });
  const { createRoot } = await import('react-dom/client');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const server = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] }
  });

  try {
    const { default: InventoryBalanceTable } = await server.ssrLoadModule('/src/components/InventoryBalanceTable.jsx');
    const { invalidateRealtime } = await server.ssrLoadModule('/src/context/RealtimeSync.jsx');
    const { queryClient } = await server.ssrLoadModule('/src/queryClient.js');
    const apiClient = await server.ssrLoadModule('/src/api/apiClient.js');

    const rows = [
      {
        id: 1,
        sku: 'PRD-001',
        productName: 'Widget A',
        brandName: 'Brand X',
        categoryName: 'Category Y',
        warehouseName: 'Main Warehouse',
        unitOfMeasure: 'PCS',
        quantity: 100, // Gross GRN quantity
        reservedQuantity: 25, // Billed on-hold quantity
        availableQuantity: 75, // Real sellable quantity
        sellingPrice: 150,
        costPrice: 100,
        minStockLevel: 10,
      },
      {
        id: 2,
        sku: 'PRD-002',
        productName: 'Widget B',
        brandName: 'Brand X',
        categoryName: 'Category Y',
        warehouseName: 'Main Warehouse',
        unitOfMeasure: 'PCS',
        quantity: 50,
        reservedQuantity: 50, // All reserved on-hold!
        availableQuantity: 0, // Real sellable is 0!
        sellingPrice: 200,
        costPrice: 120,
        minStockLevel: 5,
      },
      {
        id: 3,
        sku: 'PRD-003',
        productName: 'Widget C',
        brandName: 'Brand Z',
        categoryName: 'Category Y',
        warehouseName: 'Main Warehouse',
        unitOfMeasure: 'BOX',
        quantity: 10,
        reservedQuantity: 7, // 10 physical, 7 reserved -> 3 available (<= minStockLevel 5)
        availableQuantity: 3,
        sellingPrice: 500,
        costPrice: 350,
        minStockLevel: 5,
      }
    ];

    await act(async () => {
      root.render(
        React.createElement(InventoryBalanceTable, {
          rows,
          loading: false,
          canSeeCost: false,
          onView: () => {},
        })
      );
    });

    const tableRows = host.querySelectorAll('tbody tr');
    assert.equal(tableRows.length, 3);

    // Row 1: Must show 75 (real available), NOT 100 (gross GRN quantity)
    const row1QtyText = tableRows[0].querySelector('.inventory-stock-quantity').textContent;
    assert.ok(row1QtyText.includes('75'), `Row 1 displays real sellable quantity 75, got ${row1QtyText}`);
    assert.ok(!row1QtyText.includes('100'), 'Row 1 does NOT display raw GRN quantity 100');
    assert.ok(tableRows[0].textContent.includes('IN STOCK'), 'Row 1 with 75 available is IN STOCK');
    const row1Tooltip = tableRows[0].querySelector('.inventory-stock-quantity').getAttribute('title');
    assert.ok(row1Tooltip?.includes('Reserved in onhold: 25'), 'Row 1 tooltip includes onhold reserved count');

    // Row 2: All 50 units reserved onhold -> Available is 0 -> OUT OF STOCK
    const row2QtyText = tableRows[1].querySelector('.inventory-stock-quantity').textContent;
    assert.ok(row2QtyText.includes('0'), 'Row 2 displays 0 PCS when all units reserved onhold');
    assert.ok(tableRows[1].textContent.includes('OUT OF STOCK'), 'Row 2 with 0 available is OUT OF STOCK');
    assert.ok(tableRows[1].querySelector('.inventory-stock-empty'), 'Row 2 has empty stock styling');

    // Row 3: 3 available <= minStockLevel 5 -> LOW STOCK
    const row3QtyText = tableRows[2].querySelector('.inventory-stock-quantity').textContent;
    assert.ok(row3QtyText.includes('3'), 'Row 3 displays 3 BOX');
    assert.ok(tableRows[2].textContent.includes('LOW STOCK'), 'Row 3 with 3 available <= 5 minStockLevel is LOW STOCK');

    // RealtimeSync invalidation verification
    const receivedEvents = [];
    const onSync = e => receivedEvents.push({ type: e.type, detail: e.detail });
    window.addEventListener('erp:inventory_updated', onSync);
    window.addEventListener('erp:sales_updated', onSync);
    window.addEventListener('erp:realtime_sync', onSync);

    try {
      invalidateRealtime(['sales'], { type: 'INVOICE_UPDATED', warehouseId: 1 });

      const types = receivedEvents.map(e => e.type);
      assert.ok(types.includes('erp:inventory_updated'), 'erp:inventory_updated event is dispatched on sales change');
      assert.ok(types.includes('erp:sales_updated'), 'erp:sales_updated event is dispatched on sales change');
      assert.ok(types.includes('erp:realtime_sync'), 'erp:realtime_sync event is dispatched on sales change');
      assert.ok(receivedEvents[0].detail.topics.includes('sales'), 'Sales topic is included when sales changes');
    } finally {
      window.removeEventListener('erp:inventory_updated', onSync);
      window.removeEventListener('erp:sales_updated', onSync);
      window.removeEventListener('erp:realtime_sync', onSync);
    }

  } finally {
    await act(async () => root.unmount());
    await server.close();
    await window.happyDOM.close();
    for (const key of ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT']) {
      delete globalThis[key];
    }
  }
});
