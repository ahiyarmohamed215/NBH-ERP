export const itemSourceId = (item, document = {}) => item.sourceWarehouseId || item.warehouseId || document.sourceWarehouseId;
export const itemDestinationId = (item, document = {}) => item.destinationWarehouseId || document.destinationWarehouseId;

export function gtnWarehouseSummary(document) {
  const sources = new Map(), destinations = new Map();
  for (const item of document.items || []) {
    const source = itemSourceId(item, document), destination = itemDestinationId(item, document);
    if (source || item.sourceWarehouseName || document.sourceWarehouseName) sources.set(source || item.sourceWarehouseName || document.sourceWarehouseName, item.sourceWarehouseName || document.sourceWarehouseName || '—');
    if (destination || item.destinationWarehouseName || document.destinationWarehouseName) destinations.set(destination || item.destinationWarehouseName || document.destinationWarehouseName, item.destinationWarehouseName || document.destinationWarehouseName || '—');
  }
  if (!sources.size && document.sourceWarehouseName) sources.set(document.sourceWarehouseId || document.sourceWarehouseName, document.sourceWarehouseName);
  if (!destinations.size && document.destinationWarehouseName) destinations.set(document.destinationWarehouseId || document.destinationWarehouseName, document.destinationWarehouseName);
  return { sources: [...sources.values()], destinations: [...destinations.values()], text: `${sources.size} source${sources.size === 1 ? '' : 's'} · ${destinations.size} destination${destinations.size === 1 ? '' : 's'}` };
}
