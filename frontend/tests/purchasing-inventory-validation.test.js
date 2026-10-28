import test from 'node:test';
import assert from 'node:assert/strict';
import {masterErrors,numberError,documentErrors} from '../src/utils/purchasingValidation.js';

test('numeric values reject letters, exponent syntax, negatives and excess precision',()=>{
 for(const value of ['abc','2abc','1e3','Infinity','NaN','-1',''])assert.ok(numberError(value,'Quantity',{positive:true,decimals:2}));
 assert.ok(numberError('1.234','Quantity',{positive:true,decimals:2}));
 assert.ok(numberError('2.5','Minimum stock level',{decimals:0}));
 assert.equal(numberError('2.50','Quantity',{positive:true,decimals:2}),'');
});
test('master records validate text, phone and numeric boundaries without blocking mixed names or codes',()=>{
 for(const type of ['products','brands','categories','warehouses']){
  const form={code:'BR-123',sku:'P-123',name:'3M Product 123',brandId:1,categoryId:1,warehouseId:1,minStockLevel:'5',markupPercent:'12.3456',description:'Details',phone:'0771234567'};
  assert.deepEqual(masterErrors(type,form),{});
  const invalid={...form,name:'x'.repeat(201),description:'x'.repeat(5001),remarks:'x'.repeat(5001),phone:'not-a-phone',minStockLevel:'5abc',markupPercent:'12.34567'};
  const errors=masterErrors(type,invalid);assert.ok(errors.name);assert.ok(errors[type==='warehouses'?'remarks':'description']);
  if(type==='products')assert.ok(errors.minStockLevel);
  if(type==='products')assert.ok(errors.markupPercent);
  if(type==='warehouses')assert.ok(errors.contactNumber);
 }
 assert.deepEqual(masterErrors('warehouses',{remarks:'Complete tomorrow'},{draft:true}),{});
});
test('purchasing documents reject bad line quantities and invalid selected identifiers before submission',()=>{
 for(const type of ['GRN','GTN','PRN','PO']){
  const form={supplierId:1,grnDate:'2026-10-15',items:[{productId:1,quantity:'1abc',unitCost:5,sourceWarehouseId:1,destinationWarehouseId:2,warehouseId:1,supplierId:1,sourceGrnId:1,reason:'Damaged',sellingPrice:6}]};
  assert.ok(documentErrors(type,form).some(error=>error.includes('quantity')));
  form.items[0].quantity=1;form.items[0].productId='not-an-id';
  assert.ok(documentErrors(type,form).some(error=>error.includes('valid record')));
 }
});
