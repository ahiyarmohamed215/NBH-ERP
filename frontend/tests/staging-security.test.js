import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {executeA4Print} from '../src/utils/customerPrintTemplates.js';
import {printA4Report} from '../src/utils/printReport.js';
import api, {printPdfDocument} from '../src/api/apiClient.js';

test('every NGINX CSP allows blob frames but keeps scripts restricted', () => {
  const config=readFileSync(new URL('../../deploy/aws/nginx.conf',import.meta.url),'utf8');
  const policies=[...config.matchAll(/add_header Content-Security-Policy "([^"]+)"/g)].map(m=>m[1]);
  assert.equal(policies.length,5);
  assert.equal(new Set(policies).size,1);
  for(const policy of policies) {
    assert.match(policy, /frame-src 'self' blob:;/);
    assert.match(policy, /script-src 'self';/);
    assert.match(policy, /object-src 'none';/);
    assert.doesNotMatch(policy,/script-src[^;]*(unsafe-inline|unsafe-eval|blob:|data:)/);
  }
});

test('A4 reporting prints from parent JavaScript and generates no inline executable content',async()=>{
  const window=new Window(); const popup=new Window();
  Object.assign(globalThis,{window,document:window.document});
  const originalTimer=globalThis.setTimeout;
  let printed=0;popup.print=()=>printed++;popup.focus=()=>{};window.open=()=>popup;
  const pending=[]; globalThis.setTimeout=fn=>{pending.push(fn);return 1;};
  try {
    printA4Report({title:'Staging Report',columns:[{header:'Name',accessor:'name'}],data:[{name:'Employee'}]});
    if(popup.onload) popup.onload();
    pending.splice(0).forEach(fn=>fn());
    assert.equal(printed,1);
    assert.match(popup.document.body.textContent,/Employee/);
    assert.equal(popup.document.querySelectorAll('script,[onclick],[onload]').length,0);
    executeA4Print('<button data-print-action="print">Print</button><button data-print-action="close">Close</button>');
    popup.document.querySelector('[data-print-action="print"]').click();
    assert.ok(printed>=2);
    let closed=false;popup.close=()=>{closed=true;};
    popup.document.querySelector('[data-print-action="close"]').click();assert.equal(closed,true);
    window.open=()=>null;
    executeA4Print('<p>Fallback</p>');
    const fallback=document.querySelector('iframe');
    assert.match(fallback.contentDocument.body.textContent,/Fallback/);
    let fallbackPrints=0;fallback.contentWindow.focus=()=>{};fallback.contentWindow.print=()=>fallbackPrints++;
    pending.splice(0).forEach(fn=>fn());assert.equal(fallbackPrints,1);
  } finally {
    globalThis.setTimeout=originalTimer;
    await window.happyDOM.close();await popup.happyDOM.close();
    delete globalThis.window;delete globalThis.document;
  }
});

test('PDF fallback registers its load handler before navigating to the blob',async()=>{
  const window=new Window();Object.assign(globalThis,{window,document:window.document,CustomEvent:window.CustomEvent});
  const adapter=api.defaults.adapter;
  try {
    window.open=()=>null;window.URL.createObjectURL=()=> 'blob:http://localhost/test-pdf';
    api.defaults.adapter=async config=>({status:200,statusText:'OK',headers:{},config,data:new Blob(['%PDF-1.4'],{type:'application/pdf'})});
    await printPdfDocument('/api/v1/pdf/invoices/1');
    const frame=document.getElementById('pdf-silent-printer');
    assert.equal(typeof frame.onload,'function');assert.equal(frame.src,'blob:http://localhost/test-pdf');
  } finally {
    api.defaults.adapter=adapter;await window.happyDOM.close();delete globalThis.window;delete globalThis.document;delete globalThis.CustomEvent;
  }
});

test('PDF popup keeps its blob alive through initial navigation and revokes after the loaded page leaves',async()=>{
  const window=new Window();const popup=new Window();
  Object.assign(globalThis,{window,document:window.document,CustomEvent:window.CustomEvent});
  const adapter=api.defaults.adapter;const revoked=[];let printed=0;
  try {
    window.open=()=>popup;window.URL.createObjectURL=()=> 'blob:http://localhost/popup-pdf';
    window.URL.revokeObjectURL=url=>revoked.push(url);popup.focus=()=>{};popup.print=()=>printed++;
    api.defaults.adapter=async config=>({status:200,statusText:'OK',headers:{},config,data:new Blob(['%PDF-1.4'],{type:'application/pdf'})});
    await printPdfDocument('/api/v1/pdf/invoices/2');
    popup.dispatchEvent(new popup.Event('pagehide'));
    assert.deepEqual(revoked,[]);
    popup.onload();assert.equal(printed,1);
    popup.dispatchEvent(new popup.Event('pagehide'));
    assert.deepEqual(revoked,['blob:http://localhost/popup-pdf']);
  } finally {
    api.defaults.adapter=adapter;await popup.happyDOM.close();await window.happyDOM.close();
    delete globalThis.window;delete globalThis.document;delete globalThis.CustomEvent;
  }
});

test('all affected generated print templates avoid inline scripts and event attributes',()=>{
  for(const path of ['../src/utils/printReport.js','../src/utils/customerPrintTemplates.js','../src/views/InvoicingHub.jsx']) {
    const source=readFileSync(new URL(path,import.meta.url),'utf8');
    assert.doesNotMatch(source,/<script\b|\son(?:click|load)\s*=\s*["\']/i);
  }
  const login=readFileSync(new URL('../src/views/LoginView.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(login,/Username is incorrect|Password is incorrect/);
  assert.match(login,/Invalid username or password/);
});
