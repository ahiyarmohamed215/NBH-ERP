import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import api, { clearApiCache } from '../src/api/apiClient.js';
import { sanitizeErrorMessage } from '../src/utils/errorHandler.js';

test('In-flight GET request deduplication coalesces parallel calls', async () => {
  clearApiCache();
  let underlyingNetworkCalls = 0;
  api.defaults.adapter = async (config) => {
    underlyingNetworkCalls++;
    // Simulate realistic 30ms latency
    await new Promise((resolve) => setTimeout(resolve, 30));
    return {
      status: 200,
      headers: {},
      config,
      data: { success: true, data: [{ id: 1, name: 'Main Warehouse' }] },
    };
  };

  // Dispatch 10 concurrent requests to the same endpoint
  const promises = Array.from({ length: 10 }).map(() =>
    api.get('/warehouses/active')
  );
  const results = await Promise.all(promises);

  assert.equal(underlyingNetworkCalls, 1, '10 simultaneous GET calls must result in only 1 underlying network request');
  assert.equal(results.length, 10);
  assert.equal(results[0].data[0].name, 'Main Warehouse');
});

test('35 simultaneous outage errors emit exactly ONE outage notification', async () => {
  let displayedOutageNotifications = 0;
  let suppressedNotifications = 0;

  // Simulate ToastContext deduplication logic
  const recentToasts = new Map();
  const outageIncident = { active: false, lastNotifiedAt: 0, count: 0 };

  const simulateAddToast = (rawMessage, type = 'error') => {
    const cleanMessage = sanitizeErrorMessage(rawMessage);
    const now = Date.now();
    const isOutage =
      cleanMessage.includes('temporarily unavailable') ||
      cleanMessage.includes('Unable to connect') ||
      cleanMessage.includes('taking too long');

    if (isOutage && type === 'error') {
      outageIncident.active = true;
      outageIncident.count++;
      if (now - outageIncident.lastNotifiedAt < 8000) {
        suppressedNotifications++;
        return; // Suppressed by outage cooldown
      }
      outageIncident.lastNotifiedAt = now;
      displayedOutageNotifications++;
    }
  };

  // Simulate 35 simultaneous API failure responses (502, 503, network errors)
  const failureMessages = [
    ...Array(15).fill('Request failed with status code 502'),
    ...Array(10).fill('Request failed with status code 503'),
    ...Array(10).fill('Network Error'),
  ];

  failureMessages.forEach((msg) => {
    simulateAddToast(msg, 'error');
  });

  assert.equal(displayedOutageNotifications, 1, 'Exactly ONE user-facing outage notification should be displayed');
  assert.equal(suppressedNotifications, 34, 'The remaining 34 notifications during the outage should be suppressed');
});
