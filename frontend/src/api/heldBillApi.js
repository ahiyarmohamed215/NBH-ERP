import api from './apiClient.js';

// Keep the batch save transport independent of older, long-lived salesApi objects.
export function saveSplitHeld(request, idempotencyKey) {
  return api.post('/invoices/held/save-split', request, {
    headers: {'Idempotency-Key': idempotencyKey}
  });
}
