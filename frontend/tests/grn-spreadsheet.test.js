import test from 'node:test';
import assert from 'node:assert/strict';
import {GRN_SHEET_HEADERS,parseCsvRows,importGrnRows,createGrnTemplate,readGrnWorkbook} from '../src/utils/grnSpreadsheet.js';
import {buildGrnItemsPayload} from '../src/utils/grnItems.js';

const products=[{id:1,name:'Rice, premium',sku:'001',costPrice:100,brandMarkupPercent:20},{id:2,name:'Flour',sku:'P-2',costPrice:40,brandMarkupPercent:25}];
const suppliers=[{id:3,name:'Supplier, Ltd',supplierCode:'SUP-3'},{id:4,name:'Other supplier'}];
const PREVIOUS_HEADERS=['Product name','Product code','Received qty','Unit cost','MP%','Selling price','Supplier','Remarks'];
const row=(overrides=[])=>['Rice, premium','001','1.50','100','20','120','Supplier, Ltd','Delivery checked'].map((value,index)=>overrides[index]??value);
test('CSV quoted commas and spreadsheet columns populate all GRN values',()=>{
  const csv=PREVIOUS_HEADERS.join(',')+'\n"Rice, premium",001,1.50,100,20,120,"Supplier, Ltd","Delivery checked"';
  const imported=importGrnRows(parseCsvRows(csv),products,suppliers);
  assert.equal(imported.supplierId,3);assert.equal(imported.grnNumber,undefined);assert.equal(imported.remarks,'Delivery checked');
  assert.equal(imported.items[0].tradeName,'Rice, premium');
  assert.deepEqual(buildGrnItemsPayload(imported.items)[0],{productId:1,quantityReceived:1.5,unitCost:100,sellingPrice:120,markupPercent:20,useBrandMarkup:false,notes:''});
  const legacy=importGrnRows([[...PREVIOUS_HEADERS,'GRN number'],[...row(),'MANUAL-OLD']],products,suppliers);
  assert.equal(legacy.grnNumber,undefined,'An old template cannot supply a manual GRN number');
});
test('imports every filled row, skips unused catalogue rows and calculates missing prices',()=>{
  const result=importGrnRows([PREVIOUS_HEADERS,row(['Rice, premium','001','2','100','30','']),['Flour','P-2','3','40','','','SUP-3',''],['Flour','P-2','','40','25','','SUP-3','']],products,suppliers);
  assert.equal(result.items.length,2);assert.equal(result.items[0].salePrice,130);assert.equal(result.items[0].markupPercent,30);assert.equal(result.items[1].salePrice,50);
  assert.equal(result.items[0].useBrandMarkup,false,'Explicit spreadsheet MP% must not be replaced by brand MP% on save');
  assert.equal(result.items[1].useBrandMarkup,true,'Blank MP% uses the current brand default');
  const manual=importGrnRows([PREVIOUS_HEADERS,row(['Rice, premium','001','2','100','','140'])],products,suppliers);
  assert.equal(manual.items[0].markupPercent,40);
});
test('invalid or mixed rows reject the complete import with row-specific errors',()=>{
  for(const invalid of [row(['Rice, premium','MISSING']),row(['Rice, premium','001','0']),row(['Rice, premium','001','1.001']),row(['Rice, premium','001','1','-1']),row(['Rice, premium','001','1','100','20','150'])])assert.throws(()=>importGrnRows([PREVIOUS_HEADERS,invalid],products,suppliers),/Row 2:/);
  assert.throws(()=>importGrnRows([PREVIOUS_HEADERS,row(),['Flour','P-2','1','40','25','50','Other supplier','Delivery checked']],products,suppliers),/same supplier/);
  assert.throws(()=>importGrnRows([['Product code'],['001']],products,suppliers),/Missing columns/);
});
test('Excel template round-trips all catalogue products and preserves text product codes',async()=>{
  const buffer=await createGrnTemplate(products,{supplier:'Supplier, Ltd',remarks:'Delivery checked'});
  const rows=await readGrnWorkbook(buffer);
  assert.deepEqual(rows[0],GRN_SHEET_HEADERS);assert.equal(rows.length,3);assert.equal(rows[0][0],'Supplier');assert.equal(rows[1][0],'Supplier, Ltd');assert.equal(rows[1][2],'001');assert.equal(rows[2][1],'Flour');
  assert.equal(rows[0].length,8);assert.ok(!rows[0].includes('GRN number'));
  rows[1][3]='1.5';rows[2][3]='2';
  const result=importGrnRows(rows,products,suppliers);
  assert.equal(result.items.length,2);assert.equal(result.items[0].salePrice,120);
});
