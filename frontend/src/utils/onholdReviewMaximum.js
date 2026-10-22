import {warehouseSellableStock} from './posStockLimits.js';
export function onholdReviewMaximum(line,lines,review,billWarehouseId){
 const warehouseId=line.warehouseId || billWarehouseId;
 const match=review?.stock?.find(stock=>String(stock.productId)===String(line.productId) && String(stock.warehouseId)===String(warehouseId));
 if(!match)return 0;
 const siblings=lines.filter(other=>other.id!==line.id);
 const sameStock=other=>String(other.productId)===String(line.productId) && String(other.warehouseId || billWarehouseId)===String(warehouseId);
 const physical=Number(match.availableForBill);
 const used=siblings.filter(sameStock).reduce((sum,other)=>sum+(Number(other.approvedQuantity)||0),0);
 return warehouseSellableStock(line.productId,warehouseId,Math.max(0,physical-used),review.limits || [],siblings.map(other=>({productId:other.productId,warehouseId:other.warehouseId || billWarehouseId,quantity:Number(other.approvedQuantity)||0})));
}
