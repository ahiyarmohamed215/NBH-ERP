import test from 'node:test';import assert from 'node:assert/strict';
import {warehouseSellableStock,totalSellableStock} from '../src/utils/posStockLimits.js';
const limit=(warehouseId,remainingQuantity)=>({productId:1,warehouseId,remainingQuantity});
test('allocated products show remaining staff quantity and unallocated products show physical stock',()=>{
 const limits=[limit(1,3)];assert.equal(warehouseSellableStock(1,1,20,limits,[]),3);assert.equal(warehouseSellableStock(1,2,20,limits,[]),0);assert.equal(warehouseSellableStock(2,1,20,limits,[]),20);assert.equal(warehouseSellableStock(1,1,2,limits,[]),2);
});
test('shared allocations are not duplicated across warehouses and cart quantities reduce the displayed balance',()=>{
 const limits=[limit(null,5),limit(1,3)];const stocks=[{warehouseId:1,quantity:20},{warehouseId:2,quantity:20}];assert.equal(totalSellableStock(1,stocks,limits,[]),8);
 const cart=[{productId:1,warehouseId:1,quantity:4}];assert.equal(totalSellableStock(1,stocks,limits,cart),4);assert.equal(warehouseSellableStock(1,2,20,limits,cart),4);
 assert.equal(totalSellableStock(1,stocks,[limit(1,0)],[]),0);
});
