const numeric=value=>value==null || value==='' || !Number.isFinite(Number(value))?null:Number(value);

export function inventorySellingPrice(balance,product={},canSeeCost=false) {
  const catalog=numeric(product.sellingPrice),stock=numeric(balance.sellingPrice);
  const automatic=product.useBrandMarkup ?? balance.useBrandMarkup;
  // An explicitly manual zero is a valid free selling price.
  if(automatic===false)return catalog ?? stock ?? 0;
  if(catalog!=null && catalog>0)return catalog;
  if(stock!=null && stock>0)return stock;
  if(canSeeCost) {
    const catalogCost=numeric(product.costPrice),stockCost=numeric(balance.costPrice);
    const cost=catalogCost>0 ? catalogCost : stockCost>0 ? stockCost : catalogCost ?? stockCost;
    const markup=numeric(product.brandMarkupPercent ?? balance.brandMarkupPercent) ?? 0;
    if(cost!=null && cost>=0 && markup>=-100)return Number((cost*(1+markup/100)).toFixed(2));
  }
  return catalog ?? stock ?? 0;
}
