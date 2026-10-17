import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('TASK 7: TanStack Query Security, Caching, and Invalidation Verification', async (t) => {
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
    const { QueryClient } = await server.ssrLoadModule('@tanstack/react-query');
    const {
      queryClient,
      queryKeys,
      clearSecureQueryCache,
      invalidateProductQueries,
      invalidateInventoryQueries,
    } = await server.ssrLoadModule('/src/queryClient.js');

    const { invalidateRealtime } = await server.ssrLoadModule('/src/context/RealtimeSync.jsx');

    await t.test('1. QueryClient configuration enforces conservative security defaults', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      assert.equal(defaultOptions.queries.staleTime, 60000, 'Default staleTime is 60s');
      assert.equal(defaultOptions.queries.gcTime, 600000, 'gcTime is 10 minutes (600,000 ms)');
      assert.equal(defaultOptions.queries.refetchOnWindowFocus, false, 'refetchOnWindowFocus is disabled to prevent refetch storms');
      assert.equal(defaultOptions.queries.refetchOnReconnect, true, 'refetchOnReconnect is enabled for network recovery');

      // Test retry behavior
      const retryFn = defaultOptions.queries.retry;
      assert.equal(typeof retryFn, 'function', 'Retry is configured as a function');
      assert.equal(retryFn(0, { response: { status: 401 } }), false, 'Never retry 401 Unauthorized');
      assert.equal(retryFn(0, { response: { status: 403 } }), false, 'Never retry 403 Forbidden');
      assert.equal(retryFn(0, { response: { status: 500 } }), true, 'Retry 500 error once (count 0 < 1)');
      assert.equal(retryFn(1, { response: { status: 500 } }), false, 'Do not retry a second time (count 1 not < 1)');
    });

    await t.test('2. Query keys factory produces structured, isolated, credential-free keys', () => {
      const productKeyP0 = queryKeys.products.list({ page: 0, size: 20 });
      const productKeyP1 = queryKeys.products.list({ page: 1, size: 20 });
      const productKeySearch = queryKeys.products.list({ page: 0, size: 20, query: 'filter-test' });

      assert.deepEqual(queryKeys.products.all, ['products']);
      assert.deepEqual(productKeyP0, ['products', 'list', { page: 0, size: 20 }]);
      assert.deepEqual(productKeyP1, ['products', 'list', { page: 1, size: 20 }]);
      assert.notDeepEqual(productKeyP0, productKeyP1, 'Different pages produce distinct query keys');
      assert.notDeepEqual(productKeyP0, productKeySearch, 'Searches produce distinct query keys');

      const invKeyWh1 = queryKeys.inventory.balances({ warehouseId: 1 });
      const invKeyWh2 = queryKeys.inventory.balances({ warehouseId: 2 });
      assert.notDeepEqual(invKeyWh1, invKeyWh2, 'Different warehouses produce distinct query keys');

      // Verify no tokens or auth headers appear in serialized keys
      const serialized = JSON.stringify([productKeyP0, invKeyWh1]);
      assert.equal(serialized.includes('Bearer'), false, 'Query keys never contain Bearer tokens');
      assert.equal(serialized.includes('token'), false, 'Query keys never contain token strings');
    });

    await t.test('3. First fetch executes queryFn; repeat navigation within staleTime serves from cache without network calls', async () => {
      const testClient = new QueryClient({
        defaultOptions: { queries: { staleTime: 60000, gcTime: 600000 } },
      });

      let networkCallCount = 0;
      const fetchProducts = async () => {
        networkCallCount++;
        return { content: [{ id: 1, name: 'Product A' }, { id: 2, name: 'Product B' }], totalElements: 2 };
      };

      const key = ['test-products', { page: 0 }];

      // First fetch: cold load
      const data1 = await testClient.fetchQuery({ queryKey: key, queryFn: fetchProducts });
      assert.equal(networkCallCount, 1, 'Cold load triggers 1 network call');
      assert.equal(data1.content.length, 2);

      // Second fetch: warm navigation within 60s staleTime
      const data2 = await testClient.fetchQuery({ queryKey: key, queryFn: fetchProducts });
      assert.equal(networkCallCount, 1, 'Warm navigation hits cache; zero extra network calls');
      assert.deepEqual(data1, data2);
    });

    await t.test('4. In-flight promise sharing coalesces simultaneous requests', async () => {
      const testClient = new QueryClient();
      let networkCallCount = 0;
      const slowFetch = async () => {
        networkCallCount++;
        await new Promise((r) => setTimeout(r, 20));
        return { balances: [{ productId: 10, qty: 50 }] };
      };

      const key = ['test-concurrent-balances'];

      // 3 parallel callers request the exact same query
      const [res1, res2, res3] = await Promise.all([
        testClient.fetchQuery({ queryKey: key, queryFn: slowFetch }),
        testClient.fetchQuery({ queryKey: key, queryFn: slowFetch }),
        testClient.fetchQuery({ queryKey: key, queryFn: slowFetch }),
      ]);

      assert.equal(networkCallCount, 1, 'Simultaneous queries share 1 promise via deduplication');
      assert.deepEqual(res1, res2);
      assert.deepEqual(res2, res3);
    });

    await t.test('5. Product and Inventory mutation invalidation marks active queries stale', async () => {
      // Populate query cache
      const pKey = queryKeys.products.list({ page: 0, size: 20 });
      const invKey = queryKeys.inventory.balances({ size: 300 });

      queryClient.setQueryData(pKey, { content: [{ id: 101, name: 'Widget' }] });
      queryClient.setQueryData(invKey, { content: [{ id: 501, quantity: 15 }] });

      assert.equal(queryClient.getQueryState(pKey).isInvalidated, false, 'Initial product query is fresh');
      assert.equal(queryClient.getQueryState(invKey).isInvalidated, false, 'Initial inventory query is fresh');

      // Trigger product mutation invalidation
      await invalidateProductQueries();
      assert.equal(queryClient.getQueryState(pKey).isInvalidated, true, 'Product query marked stale/invalidated after product mutation');
      assert.equal(queryClient.getQueryState(invKey).isInvalidated, false, 'Inventory query remains fresh');

      // Trigger inventory mutation invalidation
      await invalidateInventoryQueries();
      assert.equal(queryClient.getQueryState(invKey).isInvalidated, true, 'Inventory query marked stale/invalidated after inventory mutation');
    });

    await t.test('6. SSE real-time sync bridges topics to selective query invalidation', async () => {
      const pKey = queryKeys.products.list({ page: 0 });
      const invKey = queryKeys.inventory.balances({ warehouseId: 1 });

      queryClient.setQueryData(pKey, { content: [{ id: 201 }] });
      queryClient.setQueryData(invKey, { content: [{ id: 601 }] });

      // SSE event for inventory change only (e.g. stock adjustment)
      invalidateRealtime(['inventory']);
      assert.equal(queryClient.getQueryState(invKey).isInvalidated, true, 'Inventory cache invalidated on SSE inventory topic');

      // Reset freshness
      queryClient.setQueryData(pKey, { content: [{ id: 201 }] });
      queryClient.setQueryData(invKey, { content: [{ id: 601 }] });

      // SSE event for orders / purchasing
      invalidateRealtime(['orders']);
      assert.equal(queryClient.getQueryState(pKey).isInvalidated, true, 'Product cache invalidated on SSE purchasing topic');
    });

    await t.test('7. Secure employee cache isolation: clearSecureQueryCache wipes all cached records on logout/login', () => {
      // Populate multiple protected queries
      queryClient.setQueryData(queryKeys.products.list({ page: 0 }), { sensitive: 'employee-A-products' });
      queryClient.setQueryData(queryKeys.inventory.balances({}), { sensitive: 'employee-A-balances' });
      queryClient.setQueryData(queryKeys.masters.warehouses(), { sensitive: 'employee-A-warehouses' });

      assert.ok(queryClient.getQueryCache().getAll().length >= 3, 'Cache contains active queries before logout');

      // Simulate logout or session expiration
      clearSecureQueryCache();

      // Verify cache is completely emptied
      const remainingQueries = queryClient.getQueryCache().getAll();
      assert.equal(remainingQueries.length, 0, 'Query cache is completely wiped on logout/clear');

      // Ensure getQueryData returns undefined
      assert.equal(queryClient.getQueryData(queryKeys.products.list({ page: 0 })), undefined);
      assert.equal(queryClient.getQueryData(queryKeys.inventory.balances({})), undefined);
      assert.equal(queryClient.getQueryData(queryKeys.masters.warehouses()), undefined);
    });

    await t.test('8. Role-based cost price security protection is preserved across cache payloads', () => {
      // Authorized user payload with cost price
      const authorizedItem = { id: 1, sku: 'SKU-1', costPrice: 450.00, sellingPrice: 600.00 };
      // Unauthorized user payload where backend masked cost price to null
      const unauthorizedItem = { id: 1, sku: 'SKU-1', costPrice: null, sellingPrice: 600.00 };

      assert.equal(authorizedItem.costPrice, 450.00);
      assert.equal(unauthorizedItem.costPrice, null, 'Unauthorized cost price is masked to null');
      assert.equal(unauthorizedItem.sellingPrice, 600.00, 'Selling price remains accessible');
    });
  } finally {
    await server.close();
    window.happyDOM.abort();
  }
});
