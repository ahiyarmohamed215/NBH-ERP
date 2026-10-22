import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordUserActivity,
  getLastUserActivity,
  expireSession,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  IDLE_TIMEOUT_MS,
  IDLE_EXPIRED_MESSAGE,
} from '../src/api/apiClient.js';

// Setup mock browser globals
const storage = new Map();
const sessionStore = new Map();
globalThis.localStorage = {
  getItem: k => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: k => storage.delete(k),
  clear: () => storage.clear(),
};
globalThis.sessionStorage = {
  getItem: k => sessionStore.get(k) || null,
  setItem: (k, v) => sessionStore.set(k, String(v)),
  removeItem: k => sessionStore.delete(k),
  clear: () => sessionStore.clear(),
};
globalThis.window = new EventTarget();

test('1. IDLE_TIMEOUT_MS is configured to exactly 30 minutes (1,800,000 ms)', () => {
  assert.equal(IDLE_TIMEOUT_MS, 30 * 60 * 1000, 'Idle timeout must be exactly 30 minutes');
  assert.equal(IDLE_TIMEOUT_MS, 1800000);
  assert.match(IDLE_EXPIRED_MESSAGE, /30 minutes of inactivity/);
});

test('2. recordUserActivity throttles and updates nbh_last_active in localStorage', async () => {
  storage.clear();
  assert.equal(getLastUserActivity(), 0);

  recordUserActivity();
  const first = getLastUserActivity();
  assert.ok(first > 0, 'Last active timestamp must be recorded');
  assert.equal(String(first), storage.get('nbh_last_active'));

  // Immediate subsequent call should be throttled
  recordUserActivity();
  const second = getLastUserActivity();
  assert.equal(second, first, 'Rapid calls within throttle window must not re-write storage');
});

test('3. expireSession with idle message updates sessionStorage and notifies window', () => {
  sessionStore.clear();
  setAccessToken('active-user-token');

  let expiredEventFired = false;
  const listener = () => { expiredEventFired = true; };
  window.addEventListener('nbh:session_expired', listener);

  expireSession(IDLE_EXPIRED_MESSAGE);

  assert.equal(getAccessToken(), null, 'Access token must be cleared');
  assert.equal(sessionStorage.getItem('nbh_session_expired'), IDLE_EXPIRED_MESSAGE);
  assert.equal(expiredEventFired, true, 'nbh:session_expired event must fire');

  window.removeEventListener('nbh:session_expired', listener);
  clearAccessToken();
});

test('4. Inactive time >= 30 minutes correctly evaluates as expired', () => {
  const thirtyOneMinutesAgo = Date.now() - (31 * 60 * 1000);
  storage.set('nbh_last_active', String(thirtyOneMinutesAgo));

  const lastActive = getLastUserActivity();
  const isIdleExpired = lastActive > 0 && (Date.now() - lastActive >= IDLE_TIMEOUT_MS);
  assert.equal(isIdleExpired, true, 'User inactive for 31 minutes must be detected as idle expired');

  // Active user (5 minutes ago)
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  storage.set('nbh_last_active', String(fiveMinutesAgo));
  const recentActive = getLastUserActivity();
  const isStillActive = recentActive > 0 && (Date.now() - recentActive < IDLE_TIMEOUT_MS);
  assert.equal(isStillActive, true, 'User active 5 minutes ago must not be expired');
});

test('5. Logout and expireSession clean up nbh_last_active from storage', () => {
  storage.set('nbh_last_active', String(Date.now()));
  storage.set('nbh_token', 'legacy-token');
  storage.set('nbh_user', '{"id":1}');

  expireSession();

  assert.equal(localStorage.getItem('nbh_last_active'), null, 'nbh_last_active must be purged on session expiration');
  assert.equal(localStorage.getItem('nbh_token'), null);
  assert.equal(localStorage.getItem('nbh_user'), null);
});
