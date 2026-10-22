import test from 'node:test';
import assert from 'node:assert/strict';
import {customerOutstandingInvoices,outstandingPaymentStatus} from '../src/utils/customerOutstanding.js';
test('unpaid and partially paid invoices remain distinct, including incomplete payment totals',()=>{
 assert.equal(outstandingPaymentStatus({status:'COMPLETED',paidAmount:0,balanceAmount:100}),'UNPAID');
 assert.equal(outstandingPaymentStatus({status:'COMPLETED',paidAmount:20,balanceAmount:80}),'PARTIAL');
 assert.equal(outstandingPaymentStatus({status:'PARTIAL',paidAmount:0,balanceAmount:80}),'PARTIAL');
 assert.equal(outstandingPaymentStatus({status:'COMPLETED',paymentStatus:'PARTIALLY_PAID',balanceAmount:80}),'PARTIAL');
 const invoices=[{id:1,customerId:1,status:'COMPLETED',paidAmount:0,balanceAmount:100},{id:2,customerId:1,status:'PARTIAL',balanceAmount:80},{id:3,customerId:1,status:'PAID',balanceAmount:0},{id:4,customerId:2,status:'COMPLETED',balanceAmount:100}];
 const all=customerOutstandingInvoices(invoices,1);
 assert.deepEqual(all.map(invoice=>invoice.id),[1,2]);
 assert.deepEqual(all.filter(invoice=>outstandingPaymentStatus(invoice)==='UNPAID').map(invoice=>invoice.id),[1]);
 assert.deepEqual(all.filter(invoice=>outstandingPaymentStatus(invoice)==='PARTIAL').map(invoice=>invoice.id),[2]);
});
