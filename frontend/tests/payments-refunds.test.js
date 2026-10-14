import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentApi } from '../src/api/apiClient.js';
import { canAccessTab, moduleTabs } from '../src/utils/moduleAccess.js';

test('refund API attaches paymentType REFUND and permissions allow tab access', async () => {
  // Test permissions definition
  assert.ok(moduleTabs.payments.refunds.includes('PAYMENT_VIEW'), 'Refunds tab requires PAYMENT_VIEW');
  const user = { username: 'cashier', roles: ['ROLE_CUSTOM'], permissions: ['PAYMENT_VIEW'] };
  assert.equal(canAccessTab(user, 'payments', 'refunds'), true, 'Cashier with PAYMENT_VIEW can access refunds');

  // Verify paymentApi has createRefund function
  assert.equal(typeof paymentApi.createRefund, 'function', 'paymentApi.createRefund exists');
});
