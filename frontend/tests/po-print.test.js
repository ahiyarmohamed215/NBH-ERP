import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {Window} from 'happy-dom';

test('PO printing starts a separate supplier sheet with its own products, destinations and total',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 const window=new Window();
 try {
  const {groupPoItems,buildPoPrintHtml}=await server.ssrLoadModule('/src/utils/poPrint.js');
  const line=(supplierId,code,warehouse)=>({supplierId,supplierName:`Supplier ${supplierId}`,sku:code,productName:code,warehouseName:warehouse,quantity:2,unitCost:4,sellingPrice:125});
  const order={poNumber:'PO-TEST',status:'INFORM_TO_ORDER',orderDate:'2026-09-01',createdAt:'2026-10-12T09:00:00',notes:'Restock',items:[line(1,'A','North'),line(2,'B','South'),line(3,'C','East'),line(1,'D','South')]};
  assert.equal(groupPoItems(order).length,3);
  window.document.write(buildPoPrintHtml(order));assert.ok(window.document.body.textContent.includes('Selling price (LKR)'));assert.ok(!window.document.body.textContent.includes('Unit cost'));const sheets=window.document.querySelectorAll('.po-sheet');assert.equal(sheets.length,3);
  assert.ok(sheets[0].textContent.includes('2026-10-12'));assert.ok(!sheets[0].textContent.includes('2026-09-01'));assert.equal(sheets[0].querySelectorAll('tbody tr').length,2);assert.ok(sheets[0].textContent.includes('North') && sheets[0].textContent.includes('South'));assert.ok(sheets[0].textContent.includes('LKR 500.00'));
  assert.equal(sheets[1].querySelectorAll('tbody tr').length,1);assert.ok(sheets[1].textContent.includes('Supplier 2'));assert.ok(!sheets[1].textContent.includes('Supplier 1'));
  for(const sheet of sheets) assert.ok(sheet.textContent.includes('PO-TEST') && sheet.textContent.includes('INFORM TO ORDER'));
  assert.ok(window.document.querySelector('style').textContent.includes('page-break-before:always'));
  assert.equal(groupPoItems({...order,supplierId:4,supplierName:'Legacy',items:[{sku:'OLD'}]}).length,1);
  const html=buildPoPrintHtml({...order,notes:'<img src=x onerror=alert(1)>',items:[line(1,'<script>alert(1)</script>','North')]});assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img') && !html.includes('<script>alert'));
  assert.equal((buildPoPrintHtml([order,{...order,poNumber:'PO-SECOND'}]).match(/class="po-sheet"/g)||[]).length,6);
 } finally {await server.close();await window.happyDOM.close();}
});
