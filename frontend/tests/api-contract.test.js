import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import api, { fetchAllPages } from '../src/api/apiClient.js';
import { invoiceTotal, formatBusinessDate } from '../src/utils/invoiceMapping.js';
const values = new Map();
globalThis.localStorage = { getItem:k=>values.get(k)||null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window = new EventTarget();
test('invoice mapping uses netTotal from API including zero', () => { assert.equal(invoiceTotal({netTotal:125.5}),125.5); assert.equal(invoiceTotal({netTotal:0,totalAmount:50}),0); });
test('business date near UTC midnight is Colombo date',()=>{assert.equal(formatBusinessDate(new Date('2026-10-07T20:00:00Z')),'2026-10-08');});
test('tables fetch every page, including record 101',async()=>{
 let calls=0;
 api.defaults.adapter=async config=>{calls++;return {status:200,headers:{},config,data:{success:true,data:{content:[{id:config.params.page*100+1}],totalPages:3,totalElements:201}}};};
 const response=await fetchAllPages('/invoices');assert.equal(calls,3);assert.deepEqual(response.data.content.map(x=>x.id),[1,101,201]);
});
test('API keeps HTTP and field-validation details',async()=>{
 api.defaults.adapter=async config=>{throw new axios.AxiosError('bad','ERR_BAD_REQUEST',config,null,{status:400,data:{message:'Validation failed',errors:['amount: positive required']}});};
 await assert.rejects(api.post('/payments',{}),e=>e.status===400 && e.response.status===400 && e.fieldErrors[0]==='amount: positive required');
});
test('bearer authorization and retry key are attached',async()=>{
 values.set('nbh_token','test-token');
 api.defaults.adapter=async config=>{assert.equal(config.headers.Authorization,'Bearer test-token');assert.ok(config.headers['Idempotency-Key']);return {status:200,headers:{},config,data:{data:{id:1}}};};
 await api.post('/invoices',{});values.clear();
});
