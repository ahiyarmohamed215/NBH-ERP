// Optional real Chromium check: CHROME_BIN=/path/to/chrome node tests/csp-browser.mjs
// Serves only local test fixtures/modules; does not run the ERP or access a database.
import {createServer} from 'node:http';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn, execFile} from 'node:child_process';
import assert from 'node:assert/strict';

const policy=readFileSync(new URL('../../deploy/aws/nginx.conf',import.meta.url),'utf8')
  .match(/add_header Content-Security-Policy "([^"]+)"/)[1];
const fixture=`<!doctype html><body><pre id="result">WAIT</pre>
<script>window.inlineExecuted=true;</script><script type="module" src="/test.mjs"></script>`;
const harness=`import {printA4Report} from '/src/utils/printReport.js';
let violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.effectiveDirective));
let prints=0;let frame;
window.open=()=>{
  frame=document.createElement('iframe');document.body.append(frame);
  frame.contentWindow.focus=()=>{};frame.contentWindow.print=()=>prints++;
  return frame.contentWindow;
};
printA4Report({title:'CSP test',columns:[{header:'Item',accessor:'name'}],data:[{name:'Staging control'}]});
const blob=new Blob(['<!doctype html><p>Blob frame allowed</p>'],{type:'text/html'});
const blobFrame=document.createElement('iframe');blobFrame.src=URL.createObjectURL(blob);document.body.append(blobFrame);
setTimeout(()=>{
  const result={inlineBlocked:!window.inlineExecuted,prints,report:frame.contentDocument.body.textContent.includes('Staging control'),blob:blobFrame.contentDocument?.body.textContent.includes('Blob frame allowed'),frameBlocked:violations.includes('frame-src')};
  document.getElementById('result').textContent=JSON.stringify(result);
},1800);`;
const server=createServer((req,res)=>{
  res.setHeader('Content-Security-Policy',policy);
  if(req.url==='/') {res.setHeader('Content-Type','text/html');res.end(fixture);}
  else if(req.url==='/test.mjs') {res.setHeader('Content-Type','text/javascript');res.end(harness);}
  else if(['/src/utils/printReport.js','/src/utils/customerPrintTemplates.js'].includes(req.url)) {
    res.setHeader('Content-Type','text/javascript');res.end(readFileSync(new URL('..'+req.url,import.meta.url)));
  } else {res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const profile=mkdtempSync(join(tmpdir(),'erp-csp-chrome-'));
try {
  const browser=spawn(process.env.CHROME_BIN||'chromium',['--headless=new','--disable-gpu','--disable-extensions',
    '--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--no-default-browser-check',
    '--no-sandbox',`--user-data-dir=${profile}`,'--dump-dom','--virtual-time-budget=4000',`http://127.0.0.1:${server.address().port}/`]);
  let output='';browser.stdout.on('data',data=>output+=data);
  browser.stderr.resume();
  const timeout=setTimeout(()=>{
    if(process.platform==='win32') execFile('taskkill',['/PID',String(browser.pid),'/T','/F']);
    else browser.kill();
  },120_000);
  try {
    await new Promise((resolve,reject)=>{browser.on('error',reject);browser.on('close',code=>code===0?resolve():reject(new Error(`Chromium exit ${code}`)));});
  } finally { clearTimeout(timeout); }
  const result=JSON.parse(output.match(/<pre id="result">([^<]+)<\/pre>/)[1]);
  assert.deepEqual(result,{inlineBlocked:true,prints:1,report:true,blob:true,frameBlocked:false});
  console.log('PASS: Chromium enforces script CSP, prints generated report, and permits blob frames.');
} finally {
  server.close();
  assert.equal(profile.startsWith(join(tmpdir(),'erp-csp-chrome-')),true);
  rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
