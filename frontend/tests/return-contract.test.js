import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSalesReturnPayload } from '../src/utils/invoiceMapping.js';
test('return form preserves original invoice line and maps quantity/condition to API fields', () => {
 const payload=buildSalesReturnPayload({invoiceId:'7',reason:'Return',remarks:'Damaged',items:[{invoiceItemId:11,productId:3,quantityReturned:1.5,unitPrice:10,restockable:false},{quantityReturned:0}]});
 assert.equal(payload.invoiceId,7);assert.equal(payload.returnType,'CREDIT_NOTE');
 assert.deepEqual(payload.items,[{invoiceItemId:11,productId:3,quantity:1.5,unitPrice:10,conditionType:'DAMAGED'}]);
});
