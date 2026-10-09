// Number inputs emit strings. Normalize before adding quantities or formatting prices.
export function calculateGrnStaging(previous, field, value) {
  const updated = { ...previous, [field]: value };
  for (const key of ['quantity', 'freeQuantity', 'costPrice', 'salePrice', 'packQty', 'packSize']) {
    updated[key] = Math.max(key === 'packQty' || key === 'packSize' ? 1 : 0, Number(updated[key]) || 0);
  }
  if (field === 'packQty' || field === 'packSize') updated.quantity = updated.packQty * updated.packSize;
  updated.purchaseValue = updated.quantity * updated.costPrice;
  if (field === 'discountAmount') {
    updated.discountAmount = Math.min(updated.purchaseValue, Math.max(0, Number(value) || 0));
    updated.discountPercent = updated.purchaseValue ? updated.discountAmount / updated.purchaseValue * 100 : 0;
  } else {
    updated.discountPercent = Math.min(100, Math.max(0, Number(updated.discountPercent) || 0));
    updated.discountAmount = updated.purchaseValue * updated.discountPercent / 100;
  }
  updated.amount = updated.purchaseValue - updated.discountAmount;
  updated.markupPrice = Math.max(0, updated.salePrice - updated.costPrice);
  updated.gpPercent = updated.salePrice ? (updated.salePrice - updated.costPrice) / updated.salePrice * 100 : 0;
  const units = updated.quantity + updated.freeQuantity;
  updated.freeCostPrice = units ? updated.amount / units : updated.costPrice;
  return updated;
}

export function buildGrnItemsPayload(items) {
  return items.map((item, index) => {
    const quantityReceived = Number(item.quantityReceived) + Number(item.freeQuantity || 0);
    const amount = Number(item.amount);
    if (!Number.isFinite(quantityReceived) || quantityReceived <= 0 || !Number.isFinite(amount) || amount < 0) {
      throw new Error(`Line ${index + 1}: enter a positive received quantity and a valid non-negative cost.`);
    }
    return {
      productId: Number(item.productId),
      quantityReceived,
      unitCost: Number((amount / quantityReceived).toFixed(8)),
      notes: item.notes,
    };
  });
}

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
