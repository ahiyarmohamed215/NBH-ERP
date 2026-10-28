import {useEffect} from 'react';
import {useAuth} from './AuthContext';
import {clearApiCache, refreshSession, getAccessToken} from '../api/apiClient';
import {createRealtimeClient} from '../api/realtimeClient';
import {queryClient, queryKeys} from '../queryClient';

const topicEvents = {
  orders:['purchasing'], suppliers:['purchasing'], grn:['purchasing','inventory'],
  gtn:['purchasing','inventory'], prn:['purchasing','inventory'], inventory:['inventory'],
  sales:['sales','inventory','targets'], quotations:['sales'], payments:['sales','customers'],
  returns:['sales','inventory','customers'],
  customers:['customers'], targets:['targets','customers'], delivery:['delivery'], users:['users'], roles:['roles'],
  dashboard:[], reports:[], audit:[],
};
export function invalidateRealtime(topics, eventData = {}) {
  const accepted = topics?.filter(topic => Object.hasOwn(topicEvents, topic)) ?? null;
  if (accepted && !accepted.length) return;

  const { type, productId, warehouseId } = eventData || {};

  // Targeted legacy API cache clearing (instead of clearing the entire cache)
  if (!accepted) {
    clearApiCache();
  } else {
    if (accepted.includes('inventory') || accepted.includes('sales')) {
      clearApiCache('/inventory');
      clearApiCache('/products');
    }
    if (accepted.includes('orders')) clearApiCache('/purchase-orders');
    if (accepted.includes('suppliers')) clearApiCache('/suppliers');
    if (accepted.includes('grn')) clearApiCache('/grn');
    if (accepted.includes('gtn')) clearApiCache('/gtn');
    if (accepted.includes('prn')) clearApiCache('/purchase-returns');
    if (accepted.includes('sales')) clearApiCache('/invoices');
    if (accepted.includes('customers')) clearApiCache('/customers');
    if (accepted.includes('targets')) clearApiCache('/customer-targets');
    if (accepted.includes('roles')) clearApiCache('/roles');
    if (accepted.includes('users')) clearApiCache('/users');
  }

  // Targeted TanStack Query invalidation
  if (!accepted) {
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
  } else {
    // Inventory balances invalidation with warehouse targeting
    if (accepted.some(t => ['inventory', 'grn', 'gtn', 'prn', 'sales', 'returns'].includes(t))) {
      if (warehouseId) {
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            if (!Array.isArray(key) || key[0] !== 'inventory') return false;
            const params = key[2];
            if (!params) return true;
            return !params.warehouseId || params.warehouseId === 'ALL' || String(params.warehouseId) === String(warehouseId);
          }
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.warehouseStock(warehouseId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lowStock(warehouseId) });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      }
    }

    // Product master catalog invalidation
    if (accepted.some(t => ['orders', 'suppliers', 'inventory', 'grn'].includes(t))) {
      if (type === 'STOCK_UPDATED' && productId) {
        // Stock quantity updates do not change product master fields; only invalidate detail if active
        queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(productId) });
      } else if (productId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(productId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      }
    }

    if (accepted.includes('suppliers')) {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.suppliers() });
    }
    if (accepted.includes('customers')) {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.customers() });
    }
    if (accepted.includes('inventory') && type === 'WAREHOUSE_UPDATED') {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.warehouses() });
    }
  }

  window.dispatchEvent(new CustomEvent('erp:realtime_sync', {
    detail: { topics: accepted, remote: true, ...eventData }
  }));
  const names = new Set((accepted || []).flatMap(topic => topicEvents[topic]));
  for (const name of names) {
    window.dispatchEvent(new CustomEvent(`erp:${name}_updated`, {
      detail: { topics: accepted, remote: true, ...eventData }
    }));
  }
}
export default function RealtimeSync() {
  const {user} = useAuth();
  useEffect(() => {
    if (!user?.id) return;
    return createRealtimeClient({
      url:`${(import.meta.env?.VITE_API_URL || '').replace(/\/$/, '')}/api/v1/events`,
      getToken: getAccessToken, refreshSession, invalidate:invalidateRealtime,
    });
  }, [user?.id]);
  return null;
}
