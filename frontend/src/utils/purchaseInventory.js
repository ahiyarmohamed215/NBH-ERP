import { inventoryApi } from '../api/apiClient';

export const availableStock = stock => Math.max(0, Number(stock.availableQuantity ?? (Number(stock.quantity || 0) - Number(stock.reservedQuantity || 0))));

export async function loadPurchaseInventory(requestConfig = {}) {
  const rows = [];
  let page = 0;
  let totalPages = 1;
  do {
    const response = await inventoryApi.getBalances({ page, size: 500 }, requestConfig);
    const data = response.data || [];
    rows.push(...(Array.isArray(data) ? data : data.content || []));
    totalPages = Array.isArray(data) ? 1 : Number(data.totalPages || 1);
    page += 1;
  } while (page < totalPages);
  return rows;
}
