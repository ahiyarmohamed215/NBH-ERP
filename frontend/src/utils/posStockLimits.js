// Apply warehouse allocations first, then the single shared product allocation.
export function allocationBudget(productId,limits,cart=[]){
 const rows=limits.filter(row=>String(row.productId)===String(productId));
 if(!rows.length)return null;
 const specific=new Map();let shared=0;
 for(const row of rows){const amount=Math.max(0,Number(row.remainingQuantity)||0);if(row.warehouseId==null)shared+=amount;else specific.set(String(row.warehouseId),(specific.get(String(row.warehouseId)) || 0)+amount);}
 const quantities=new Map();for(const line of cart)if(String(line.productId)===String(productId))quantities.set(String(line.warehouseId),(quantities.get(String(line.warehouseId)) || 0)+Number(line.quantity));
 for(const [warehouse,quantity] of quantities){const available=specific.get(warehouse) || 0;specific.set(warehouse,Math.max(0,available-quantity));shared=Math.max(0,shared-Math.max(0,quantity-available));}
 return {specific,shared};
}
export function warehouseSellableStock(productId,warehouseId,physical,limits,cart){const budget=allocationBudget(productId,limits,cart);return Math.max(0,budget?Math.min(physical,(budget.specific.get(String(warehouseId)) || 0)+budget.shared):physical);}
export function totalSellableStock(productId,stocks,limits,cart){const budget=allocationBudget(productId,limits,cart);if(!budget)return stocks.reduce((sum,row)=>sum+row.quantity,0);let scoped=0,extra=0;for(const row of stocks){const local=Math.min(row.quantity,budget.specific.get(String(row.warehouseId)) || 0);scoped+=local;extra+=row.quantity-local;}return scoped+Math.min(extra,budget.shared);}
