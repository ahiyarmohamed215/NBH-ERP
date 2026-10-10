import test from 'node:test';
import assert from 'node:assert/strict';
import { historyDetailRows, historyDocumentReference } from '../src/utils/customerHistoryDetails.js';

test('history details include full dates, invoice lines, amounts, zero values and payment references', () => {
  const rows = historyDetailRows({
    invoiceDate: '2026-10-09', createdAt: '2026-10-09T14:35:12', netTotal: 120,
    paidAmount: 0, notes: 'Deliver after 5 pm', items: [{ productName: 'Rice', quantity: 2, unitPrice: 60 }],
  });
  assert.ok(rows.some((r) => r.label === 'Invoice Date' && /09 Oct 2026/.test(r.value)));
  assert.ok(rows.some((r) => r.label === 'Created At' && /14:35:12/.test(r.value)));
  assert.ok(rows.some((r) => r.label === 'Paid Amount' && r.value === 'LKR 0.00'));
  assert.ok(rows.some((r) => r.label === 'Items 1 · Product Name' && r.value === 'Rice'));
  assert.ok(rows.some((r) => r.label === 'Items 1 · Unit Price' && r.value === 'LKR 60.00'));
  assert.equal(historyDocumentReference({ id: 4, paymentNumber: 'ADV-0004' }), 'ADV-0004');
});
