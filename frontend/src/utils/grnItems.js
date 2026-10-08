// Keep one receipt line per product while preserving the value of each addition.
export function mergeGrnItems(items) {
  const lines = new Map();
  for (const item of items) {
    const key = String(item.productId);
    const previous = lines.get(key);
    if (!previous) { lines.set(key, { ...item }); continue; }
    const quantityReceived = Number(previous.quantityReceived) + Number(item.quantityReceived);
    const freeQuantity = Number(previous.freeQuantity || 0) + Number(item.freeQuantity || 0);
    const purchaseValue = Number(previous.purchaseValue ?? previous.quantityReceived * previous.unitCost)
      + Number(item.purchaseValue ?? item.quantityReceived * item.unitCost);
    const discountAmount = Number(previous.discountAmount || 0) + Number(item.discountAmount || 0);
    const amount = Number(previous.amount ?? previous.quantityReceived * previous.unitCost)
      + Number(item.amount ?? item.quantityReceived * item.unitCost);
    const unitCost = quantityReceived ? purchaseValue / quantityReceived : 0;
    const discountPercent = purchaseValue ? discountAmount / purchaseValue * 100 : 0;
    const salePrice = Number(item.salePrice || previous.salePrice || 0);
    const gpPercent = salePrice ? (salePrice - unitCost) / salePrice * 100 : 0;
    lines.set(key, { ...previous, ...item, quantityReceived, freeQuantity, purchaseValue,
      discountAmount, amount, unitCost, discountPercent, salePrice, gpPercent,
      freeCostPrice: amount / (quantityReceived + freeQuantity),
      notes: `Free: ${freeQuantity} | Disc: ${discountPercent.toFixed(2)}% | Sale: $${salePrice.toFixed(2)}` });
  }
  return [...lines.values()];
}
