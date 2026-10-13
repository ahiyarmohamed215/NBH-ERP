// Keep sales display prices separate from the purchase costs used for stock accounting.
export function purchaseSellingPrice(item, products = []) {
  const product = products.find(product => String(product.id) === String(item.productId ?? item.id));
  return Number(item.sellingPrice ?? product?.sellingPrice ?? 0);
}
