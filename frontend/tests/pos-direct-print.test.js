import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {printHeldWarehouseSheetsInline} from '../src/utils/heldWarehousePrint.js';

test('POS opens native printing once with every saved warehouse and cleans up after closing',async()=>{
  const window=new Window();Object.assign(globalThis,{window,document:window.document});
  try{
    window.open=()=>{throw new Error('Direct printing must not open another tab');};
    const request=printHeldWarehouseSheetsInline({heldNumber:'HLD-1',customerName:'A & B',items:[
      {warehouseId:1,warehouseName:'Main',productName:'First',quantity:2},
      {warehouseId:2,warehouseName:'Second',productName:'Other',quantity:3},
    ]});
    const frame=document.querySelector('iframe');assert.ok(frame);
    assert.equal((frame.srcdoc.match(/<section>/g)||[]).length,2);
    assert.match(frame.srcdoc,/A &amp; B/);
    const previousTitle = document.title;
    assert.match(frame.srcdoc, /<title>Onhold Bill WH Review Copy-\d{4}-\d{2}-\d{2}-HLD-1<\/title>/);
    let calls=0;frame.contentWindow.focus=()=>{};frame.contentWindow.print=()=>{
      calls++;
      assert.match(document.title, /^Onhold Bill WH Review Copy-\d{4}-\d{2}-\d{2}-HLD-1$/);
    };
    frame.onload();assert.equal(calls,1);
    frame.contentWindow.dispatchEvent(new window.Event('afterprint'));
    await request;
    assert.equal(document.querySelector('iframe'),null);
    assert.equal(document.title,previousTitle);

    const failed=printHeldWarehouseSheetsInline({items:[]});
    const broken=document.querySelector('iframe');broken.contentWindow.print=()=>{throw new Error('Unavailable');};
    broken.onload();await assert.rejects(failed,/Unable to open/);
    assert.equal(document.querySelector('iframe'),null);
    assert.equal(document.title,previousTitle);
  }finally{await window.happyDOM.close();delete globalThis.window;delete globalThis.document;}
});

test('three saved onhold bills share one print dialog with all warehouse pages in order',async()=>{
  const window=new Window();Object.assign(globalThis,{window,document:window.document});
  try{
    window.open=()=>{throw new Error('Batch printing must not open another tab');};
    document.title='POS';
    const bills=[1,2,3].map(id=>({heldNumber:`HLD-${id}`,customerName:`Customer ${id}`,items:
      Array.from({length:id===2?19:1},(_,index)=>({warehouseId:id,warehouseName:`Warehouse ${id}`,productName:`Product ${id}-${index+1}`,quantity:1}))}));
    const request=printHeldWarehouseSheetsInline(bills);
    assert.equal(document.querySelectorAll('iframe').length,1);
    const frame=document.querySelector('iframe');
    const preview=new Window();
    preview.document.write(frame.srcdoc);
    const sheets=[...preview.document.querySelectorAll('section')];
    assert.equal(preview.document.querySelectorAll('style').length,1);
    assert.deepEqual(sheets.map(sheet=>sheet.querySelector('.document-number').textContent),['HLD-1','HLD-2','HLD-2','HLD-3']);
    assert.match(sheets[2].textContent,/Product 2-19/);
    assert.match(sheets[3].textContent,/Customer 3/);
    assert.match(frame.srcdoc,/section\+section\{break-before:page/);
    let calls=0;frame.contentWindow.focus=()=>{};frame.contentWindow.print=()=>{calls++;};
    frame.onload();assert.equal(calls,1);
    frame.contentWindow.dispatchEvent(new window.Event('afterprint'));
    await request;
    assert.equal(document.querySelector('iframe'),null);
    assert.equal(document.title,'POS');
    await preview.happyDOM.close();
  }finally{await window.happyDOM.close();delete globalThis.window;delete globalThis.document;}
});
