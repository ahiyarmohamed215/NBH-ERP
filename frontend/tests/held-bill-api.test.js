import test from 'node:test';
import assert from 'node:assert/strict';
import api, {salesApi} from '../src/api/apiClient.js';
import {saveSplitHeld} from '../src/api/heldBillApi.js';

test('split held saving works with an older sales API object and preserves request and retry key', async () => {
  const adapter=api.defaults.adapter;
  const method=salesApi.saveSplitHeld;
  delete salesApi.saveSplitHeld;
  const request={draftId:null,bill:{hold:true,warehouseId:1,items:[{productId:1,quantity:2,unitPrice:10}]}};
  const bills=[{id:5,heldNumber:'HLD-5',status:'SENT_TO_WAREHOUSE'}];
  api.defaults.adapter=async config=>{
    assert.equal(config.method,'post');
    assert.equal(config.url,'/invoices/held/save-split');
    assert.equal(config.headers.get('Idempotency-Key'),'stable-save-key');
    assert.deepEqual(JSON.parse(config.data),request);
    return {status:200,statusText:'OK',headers:{},config,data:{success:true,data:bills}};
  };
  try {
    const response=await saveSplitHeld(request,'stable-save-key');
    assert.deepEqual(response.data,bills);
  } finally {
    api.defaults.adapter=adapter;
    salesApi.saveSplitHeld=method;
  }
});
