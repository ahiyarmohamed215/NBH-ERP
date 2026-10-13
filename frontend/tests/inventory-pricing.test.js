import test from 'node:test';
import assert from 'node:assert/strict';
import {inventorySellingPrice} from '../src/utils/inventoryPricing.js';

test('zero stock prices do not override the catalog selling price',()=>{
  assert.equal(inventorySellingPrice({sellingPrice:0},{sellingPrice:125}),125);
  assert.equal(inventorySellingPrice({sellingPrice:110},{sellingPrice:125}),125);
});
test('legacy automatic prices calculate from cost and brand MP%',()=>{
  assert.equal(inventorySellingPrice({sellingPrice:0,costPrice:100},{sellingPrice:0,brandMarkupPercent:25},true),125);
  assert.equal(inventorySellingPrice({sellingPrice:0,costPrice:0},{sellingPrice:0,costPrice:100,brandMarkupPercent:25},true),125);
  assert.equal(inventorySellingPrice({sellingPrice:0,costPrice:120},{sellingPrice:0,useBrandMarkup:true,brandMarkupPercent:25},true),150);
  assert.equal(inventorySellingPrice({costPrice:'12.3456'},{brandMarkupPercent:'12.5'},true),13.89);
});
test('manual zero prices and hidden costs are respected',()=>{
  assert.equal(inventorySellingPrice({sellingPrice:100,costPrice:80},{sellingPrice:0,useBrandMarkup:false},true),0);
  assert.equal(inventorySellingPrice({sellingPrice:0,costPrice:100},{sellingPrice:0,brandMarkupPercent:25},false),0);
});
