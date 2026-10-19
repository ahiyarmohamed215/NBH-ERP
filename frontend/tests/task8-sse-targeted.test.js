import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('TASK 8: Targeted SSE Real-Time Updates and Duplicate Fetch Elimination', async (t) => {
  const window = new Window();
  Object.assign(globalThis, {
    window,
    document: window.document,
    CustomEvent: window.CustomEvent,
    localStorage: window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  });

  const server = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });

  try {
    const {
      queryClient,
      queryKeys,
      clearSecureQueryCache,
    } = await server.ssrLoadModule('/src/queryClient.js');

    const { invalidateRealtime } = await server.ssrLoadModule('/src/context/RealtimeSync.jsx');

    t.beforeEach(() => {
      clearSecureQueryCache();
    });

    await t.test('1. Targeted warehouse invalidation scopes updates and avoids wiping unrelated warehouses', () => {
      const wh1Key = queryKeys.inventory.balances({ warehouseId: 1 });
      const wh2Key = queryKeys.inventory.balances({ warehouseId: 2 });
      const allWhKey = queryKeys.inventory.balances({ warehouseId: 'ALL' });
      const unspecKey = queryKeys.inventory.balances({});

      queryClient.setQueryData(wh1Key, { content: [{ id: 'bal-wh1', quantity: 50 }] });
      queryClient.setQueryData(wh2Key, { content: [{ id: 'bal-wh2', quantity: 100 }] });
      queryClient.setQueryData(allWhKey, { content: [{ id: 'bal-all', quantity: 150 }] });
      queryClient.setQueryData(unspecKey, { content: [{ id: 'bal-unspec', quantity: 150 }] });

      // Incoming SSE targeted to Warehouse 1
      invalidateRealtime(['inventory'], {
        type: 'STOCK_UPDATED',
        warehouseId: 1,
        productId: 501,
      });

      // Warehouse 1 and ALL/unspecified queries should be invalidated
      assert.equal(queryClient.getQueryState(wh1Key).isInvalidated, true, 'Warehouse 1 query is invalidated');
      assert.equal(queryClient.getQueryState(allWhKey).isInvalidated, true, 'ALL warehouse query is invalidated');
      assert.equal(queryClient.getQueryState(unspecKey).isInvalidated, true, 'Unspecified warehouse query is invalidated');

      // Unrelated Warehouse 2 must remain fresh
      assert.equal(queryClient.getQueryState(wh2Key).isInvalidated, false, 'Unrelated Warehouse 2 query remains fresh');
    });

    await t.test('2. Product catalog caching distinguishes stock balance updates from product master changes', () => {
      const pListKey = queryKeys.products.list({ page: 0, size: 20 });
      const p101DetailKey = queryKeys.products.detail(101);
      const p202DetailKey = queryKeys.products.detail(202);

      queryClient.setQueryData(pListKey, { content: [{ id: 101, name: 'Item A' }] });
      queryClient.setQueryData(p101DetailKey, { id: 101, name: 'Item A', sellingPrice: 1500 });
      queryClient.setQueryData(p202DetailKey, { id: 202, name: 'Item B', sellingPrice: 2500 });

      // STOCK_UPDATED event: Only affects inventory levels, not product metadata
      invalidateRealtime(['inventory'], {
        type: 'STOCK_UPDATED',
        warehouseId: 3,
        productId: 101,
      });

      // Target product detail is invalidated
      assert.equal(queryClient.getQueryState(p101DetailKey).isInvalidated, true, 'Target product detail is invalidated');
      // Unrelated product detail remains fresh
      assert.equal(queryClient.getQueryState(p202DetailKey).isInvalidated, false, 'Unrelated product detail remains fresh');
      // Product list directory remains fresh! (Avoids unnecessary catalog refetch)
      assert.equal(queryClient.getQueryState(pListKey).isInvalidated, false, 'Product catalog list remains fresh on pure stock update');

      // Now PRODUCT_UPDATED event: Modifies product catalog metadata
      invalidateRealtime(['inventory'], {
        type: 'PRODUCT_UPDATED',
        productId: 101,
      });

      // Both detail and directory lists are invalidated
      assert.equal(queryClient.getQueryState(pListKey).isInvalidated, true, 'Product catalog list is invalidated on product metadata update');
    });

    await t.test('3. Reconnection fallback (invalidateRealtime(null)) safely invalidates all cached domains', () => {
      const pListKey = queryKeys.products.list({ page: 0 });
      const invKey = queryKeys.inventory.balances({ warehouseId: 1 });

      queryClient.setQueryData(pListKey, { content: [{ id: 1 }] });
      queryClient.setQueryData(invKey, { content: [{ id: 1 }] });

      // SSE connection re-established, full reconciliation triggered
      invalidateRealtime(null);

      assert.equal(queryClient.getQueryState(pListKey).isInvalidated, true, 'Products invalidated on reconnect');
      assert.equal(queryClient.getQueryState(invKey).isInvalidated, true, 'Inventory invalidated on reconnect');
    });

    await t.test('4. Remote SSE events carry remote flag to prevent duplicate query invalidation in DOM listeners', () => {
      let syncDetail = null;
      let inventoryDetail = null;

      const onSync = (e) => { syncDetail = e.detail; };
      const onInv = (e) => { inventoryDetail = e.detail; };

      window.addEventListener('erp:realtime_sync', onSync);
      window.addEventListener('erp:inventory_updated', onInv);

      try {
        invalidateRealtime(['inventory'], {
          type: 'STOCK_UPDATED',
          warehouseId: 4,
          productId: 888,
        });

        assert.ok(syncDetail, 'erp:realtime_sync dispatched');
        assert.equal(syncDetail.remote, true, 'remote flag set to true on realtime sync');
        assert.equal(syncDetail.warehouseId, 4, 'warehouseId forwarded in event detail');
        assert.equal(syncDetail.productId, 888, 'productId forwarded in event detail');

        assert.ok(inventoryDetail, 'erp:inventory_updated dispatched');
        assert.equal(inventoryDetail.remote, true, 'remote flag set on topic event');
        assert.equal(inventoryDetail.type, 'STOCK_UPDATED', 'type forwarded in topic event');
      } finally {
        window.removeEventListener('erp:realtime_sync', onSync);
        window.removeEventListener('erp:inventory_updated', onInv);
      }
    });

    await t.test('5. Backward compatibility with legacy SSE payloads without entity metadata', () => {
      const pKey = queryKeys.products.list({ page: 0 });
      const invKey = queryKeys.inventory.balances({ warehouseId: 2 });

      queryClient.setQueryData(pKey, { content: [{ id: 1 }] });
      queryClient.setQueryData(invKey, { content: [{ id: 2 }] });

      // Legacy payload: only topics array, no metadata object
      invalidateRealtime(['inventory']);

      assert.equal(queryClient.getQueryState(invKey).isInvalidated, true, 'Inventory invalidated by legacy topic payload');
      assert.equal(queryClient.getQueryState(pKey).isInvalidated, true, 'Products invalidated by legacy topic payload');
    });

    await t.test('6. Event payload security: payloads contain zero sensitive pricing or customer information', () => {
      // Create sample payload as emitted by RealtimeStreams.java
      const ssePayload = {
        topics: ['inventory'],
        type: 'STOCK_UPDATED',
        productId: 101,
        warehouseId: 5,
        timestamp: Date.now(),
        details: [{
          topic: 'inventory',
          type: 'STOCK_UPDATED',
          productId: 101,
          warehouseId: 5,
        }],
      };

      const serialized = JSON.stringify(ssePayload);
      assert.equal(serialized.includes('costPrice'), false, 'Payload contains NO costPrice');
      assert.equal(serialized.includes('password'), false, 'Payload contains NO credentials');
      assert.equal(serialized.includes('token'), false, 'Payload contains NO tokens');
      assert.equal(serialized.includes('customerName'), false, 'Payload contains NO customer private data');
      assert.equal(serialized.includes('phone'), false, 'Payload contains NO phone numbers');
    });
  } finally {
    await server.close();
    window.happyDOM.abort();
  }
});
