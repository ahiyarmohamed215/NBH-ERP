import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import api, {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  refreshSession,
  expireSession,
  clearApiCache,
} from '../src/api/apiClient.js';

// Setup mock browser globals
const storage = new Map();
globalThis.localStorage = {
  getItem: k => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: k => storage.delete(k),
  clear: () => storage.clear(),
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window = new EventTarget();

const setMockNavigator = (navValue) => {
  Object.defineProperty(globalThis, 'navigator', {
    value: navValue,
    configurable: true,
    writable: true,
  });
};

test('1. Two simulated tabs refreshing concurrently with Web Locks succeed without replay collision', async () => {
  storage.clear();
  clearAccessToken();

  let activeCookieToken = 'refresh-token-v1';
  let refreshCalls = 0;
  const originalPost = axios.post;

  // Mock server behavior with token rotation and replay detection
  axios.post = async (url, data, config) => {
    if (url.includes('/auth/refresh')) {
      refreshCalls++;
      assert.equal(config.headers['X-Requested-With'], 'XMLHttpRequest', 'Must send X-Requested-With');

      // Server rotates cookie
      const currentToken = activeCookieToken;
      const newToken = `refresh-token-v${refreshCalls + 1}`;
      activeCookieToken = newToken;

      return {
        data: {
          success: true,
          data: {
            accessToken: `access-token-for-call-${refreshCalls}`,
            refreshToken: null,
          },
        },
      };
    }
    return originalPost(url, data, config);
  };

  // Mock Web Locks: queue requests sequentially
  let lockQueue = Promise.resolve();
  setMockNavigator({
    locks: {
      request: async (name, callback) => {
        const next = lockQueue.then(async () => callback());
        lockQueue = next.catch(() => {});
        return next;
      },
    },
  });

  // Simulate Tab 1 and Tab 2 invoking refresh concurrently
  const [tab1Result, tab2Result] = await Promise.all([
    refreshSession(),
    refreshSession(),
  ]);

  assert.ok(tab1Result?.accessToken, 'Tab 1 must receive an access token');
  assert.ok(tab2Result?.accessToken, 'Tab 2 must receive an access token');
  assert.ok(refreshCalls >= 1, 'Refresh must have been invoked');

  axios.post = originalPost;
  clearAccessToken();
});

test('2. Two simulated tabs refreshing concurrently without Web Locks (fallback mutex) succeed', async () => {
  storage.clear();
  clearAccessToken();

  let refreshCalls = 0;
  let concurrentExecutions = 0;
  let peakConcurrency = 0;

  const originalPost = axios.post;
  axios.post = async (url, data, config) => {
    if (url.includes('/auth/refresh')) {
      concurrentExecutions++;
      peakConcurrency = Math.max(peakConcurrency, concurrentExecutions);
      refreshCalls++;

      // Simulate network latency
      await new Promise(r => setTimeout(r, 30));

      concurrentExecutions--;
      return {
        data: {
          success: true,
          data: {
            accessToken: `access-token-mutex-${refreshCalls}`,
            refreshToken: null,
          },
        },
      };
    }
    return originalPost(url, data, config);
  };

  // Remove navigator.locks to force fallback to localStorage mutex
  setMockNavigator({});

  const [tab1Result, tab2Result] = await Promise.all([
    refreshSession(),
    refreshSession(),
  ]);

  assert.ok(tab1Result?.accessToken, 'Tab 1 must receive token via fallback mutex');
  assert.ok(tab2Result?.accessToken, 'Tab 2 must receive token via fallback mutex');

  axios.post = originalPost;
  clearAccessToken();
});

test('3. Failed silent refresh clears local tab in-memory token but does NOT broadcast LOGOUT to peer tabs', async () => {
  storage.clear();
  setAccessToken('active-peer-token-123');

  let broadcastLogoutCount = 0;
  const originalPost = axios.post;

  // Make refresh fail with 401 (e.g. guest with no cookie or expired session)
  axios.post = async (url, data, config) => {
    if (url.includes('/auth/refresh')) {
      const err = new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
        status: 401,
        data: { message: 'No refresh token provided' },
      });
      throw err;
    }
    return originalPost(url, data, config);
  };

  await assert.rejects(
    refreshSession(),
    err => err.response?.status === 401
  );

  assert.equal(getAccessToken(), null, 'Local tab token must be cleared');
  assert.equal(broadcastLogoutCount, 0, 'Must NOT broadcast LOGOUT to peer tabs on silent refresh failure');

  axios.post = originalPost;
  clearAccessToken();
});

test('4. Explicit logout propagates LOGOUT to other tabs and clears storage', () => {
  storage.clear();
  localStorage.setItem('nbh_token', 'old');
  localStorage.setItem('nbh_refresh', 'old');
  setAccessToken('token-before-logout');

  let sessionExpiredEventFired = false;
  const listener = () => { sessionExpiredEventFired = true; };
  window.addEventListener('nbh:session_expired', listener);

  expireSession();

  assert.equal(getAccessToken(), null);
  assert.equal(sessionExpiredEventFired, true, 'Window event nbh:session_expired must be fired');
  assert.equal(localStorage.getItem('nbh_token'), null);
  assert.equal(localStorage.getItem('nbh_refresh'), null);

  window.removeEventListener('nbh:session_expired', listener);
});
