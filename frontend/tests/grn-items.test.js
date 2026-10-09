import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeGrnItems, calculateGrnStaging, buildGrnItemsPayload } from '../src/utils/grnItems.js';
const line = (id, qty, cost, free = 0, discount = 0) => ({ productId:id, quantityReceived:qty, freeQuantity:free, unitCost:cost, purchaseValue:qty*cost, discountAmount:discount, amount:qty*cost-discount, salePrice:20 });
test('typed quantities and prices stay numeric through calculation and saving', () => {
  let item = { quantity: 1, freeQuantity: 0, costPrice: 10, salePrice: 20, discountPercent: 0 };
  for (const [key, value] of [['quantity', '2'], ['freeQuantity', '1'], ['costPrice', '12.50'], ['salePrice', '18'], ['discountPercent', '10']]) {
    item = calculateGrnStaging(item, key, value);
  }
  assert.equal(item.freeCostPrice, 7.5);
  assert.equal(item.amount, 22.5);
  assert.equal(item.salePrice.toFixed(2), '18.00');
  const [payload] = buildGrnItemsPayload([{ ...item, productId: 1, quantityReceived: item.quantity }]);
  assert.equal(payload.quantityReceived, 3);
  assert.equal(payload.unitCost, 7.5);
});
test('free receipts serialize zero cost, while invalid quantities never reach the API', () => {
  assert.equal(buildGrnItemsPayload([line(1, 0, 0, 2)])[0].unitCost, 0);
  assert.throws(() => buildGrnItemsPayload([line(1, 0, 10)]), /Line 1/);
  assert.throws(() => buildGrnItemsPayload([{ ...line(1, 2, 10), amount: NaN }]), /Line 1/);
});
test('repeat product adds received and free quantities into one row', () => {
  const result = mergeGrnItems([line(1,2,10,1), line('1',3,10,2)]);
  assert.equal(result.length,1); assert.equal(result[0].quantityReceived,5);
  assert.equal(result[0].freeQuantity,3); assert.equal(result[0].amount,50);
});
test('different costs and discounts preserve combined value and product order', () => {
  const input=[line(1,2,10,0,2),line(2,1,5),line(1,3,20,1,6)];
  const result=mergeGrnItems(input);
  assert.deepEqual(result.map(x=>x.productId),[1,2]);
  assert.equal(result[0].unitCost,16);assert.equal(result[0].amount,72);
  assert.equal(result[0].discountAmount,8);assert.equal(result[0].freeCostPrice,12);
  assert.equal(input[0].quantityReceived,2);
});
