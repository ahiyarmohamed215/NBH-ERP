import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('PRN printing separates supplier and warehouse pairs while keeping all original receipt lines',async()=>{
  const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
  const window=new Window();
  try {
    const {groupPrnItems,buildPrnPrintHtml}=await server.ssrLoadModule('/src/utils/prnPrint.js');
    const item=(supplierId,warehouseId,code,grn)=>({supplierId,warehouseId,supplierName:`Supplier ${supplierId}`,warehouseName:`Warehouse ${warehouseId}`,productSku:code,productName:'Product',quantityReturned:2,unitCost:4,originalGrnNumber:grn,reason:'Damaged',remarks:'Box torn'});
    const prn={prnNumber:'PRN-TEST',returnDate:'2026-10-12',status:'DRAFT',items:[item(1,1,'A','GRN-A'),item(2,1,'B','GRN-B'),item(1,2,'C','GRN-C'),item(1,1,'D','GRN-D')]};
    const groups=groupPrnItems(prn);assert.equal(groups.length,3);assert.deepEqual(groups[0].items.map(row=>row.productSku),['A','D']);
    window.document.write(buildPrnPrintHtml(prn));
    const sheets=window.document.querySelectorAll('.prn-sheet');assert.equal(sheets.length,3);
    assert.ok(sheets[0].textContent.includes('GRN-A') && sheets[0].textContent.includes('GRN-D'));assert.ok(!sheets[0].textContent.includes('GRN-B'));
    assert.ok(sheets[1].textContent.includes('GRN-B'));assert.ok(sheets[2].textContent.includes('GRN-C'));
    for(const sheet of sheets){assert.ok(sheet.textContent.includes('PRN-TEST'));assert.ok(sheet.textContent.includes('Unit cost (LKR)'));assert.ok(sheet.textContent.includes('Box torn'));}
    assert.ok(window.document.querySelector('style').textContent.includes('page-break-before:always'));
    assert.equal(groupPrnItems({...prn,supplierId:1,warehouseId:1,supplierName:'Legacy supplier',warehouseName:'Legacy warehouse',items:[{productSku:'OLD'}]}).length,1);
    const malicious={...prn,prnNumber:'<script>alert(1)</script>',items:[{...prn.items[0],remarks:'<img src=x onerror=alert(1)>'}]};
    const html=buildPrnPrintHtml(malicious);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));
  } finally {await server.close();await window.happyDOM.close();}
});
