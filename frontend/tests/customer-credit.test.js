import test from 'node:test';
import assert from 'node:assert/strict';
import {customerCreditBlock} from '../src/utils/customerCredit.js';
test('credit checks block the limit and excess, allow the exact remaining credit, and reopen after payment',()=>{
 const customer={creditLimit:1000,currentBalance:1000};
 assert.match(customerCreditBlock(customer,1),/limit reached/);
 assert.match(customerCreditBlock({...customer,currentBalance:750},250.01),/exceeds/);
 assert.equal(customerCreditBlock({...customer,currentBalance:750},250),'');
 assert.equal(customerCreditBlock({...customer,currentBalance:500},250),'');
 assert.equal(customerCreditBlock({creditLimit:0,currentBalance:0},1),'');
 assert.equal(customerCreditBlock({creditLimit:null,currentBalance:500000},1000000),'');
 assert.equal(customerCreditBlock({creditLimit:0,currentBalance:500000},1000000),'');
 assert.equal(customerCreditBlock({creditLimit:2000,currentBalance:1000},500),'');
 assert.equal(customerCreditBlock(null,100),'');
});
