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
import { createRealtimeClient } from '../src/api/realtimeClient.js';

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

test('1. Access token is stored in JS memory only and never in localStorage', () => {
  storage.clear();
  clearAccessToken();

  setAccessToken('in-memory-jwt-token-12345');
  assert.equal(getAccessToken(), 'in-memory-jwt-token-12345');
  assert.equal(localStorage.getItem('nbh_token'), null, 'Access token must NOT be in localStorage');
  assert.equal(localStorage.getItem('nbh_refresh'), null, 'Refresh token must NOT be in localStorage');

  clearAccessToken();
  assert.equal(getAccessToken(), null);
});

test('2. API client automatically attaches in-memory access token, correlation ID, and anti-CSRF header', async () => {
  setAccessToken('authenticated-jwt-abc');

  let interceptedConfig;
  api.defaults.adapter = async config => {
    interceptedConfig = config;
    return {
      status: 200,
      headers: {},
      config,
      data: { success: true, data: { status: 'OK' } },
    };
  };

  await api.get('/products');
  assert.equal(interceptedConfig.headers.Authorization, 'Bearer authenticated-jwt-abc');
  assert.equal(interceptedConfig.headers['X-Requested-With'], 'XMLHttpRequest');
  assert.ok(interceptedConfig.headers['X-Request-Id']);
  assert.equal(interceptedConfig.withCredentials, true, 'withCredentials must be true for HttpOnly cookies');

  clearAccessToken();
});

test('3. Multiple simultaneous 401s execute exactly ONE single-flight refresh and retry queued requests', async () => {
  let refreshCalls = 0;
  let apiCalls = 0;

  // Mock refresh endpoint
  const originalPost = axios.post;
  axios.post = async (url, data, config) => {
    if (url.includes('/auth/refresh')) {
      refreshCalls++;
      // Return new access token, NO refresh token in body
      return {
        data: {
          success: true,
          data: {
            accessToken: 'refreshed-jwt-new-token',
            refreshToken: null,
          },
        },
      };
    }
    return originalPost(url, data, config);
  };

  // Mock API adapter that returns 401 on old token and 200 on new token
  api.defaults.adapter = async config => {
    apiCalls++;
    const auth = config.headers?.Authorization;
    if (auth === 'Bearer initial-expired-token') {
      const error = new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
        status: 401,
        data: { message: 'Token expired' },
      });
      throw error;
    }
    return {
      status: 200,
      headers: {},
      config,
      data: { success: true, data: { item: config.url } },
    };
  };

  setAccessToken('initial-expired-token');

  // Fire 4 parallel requests simultaneously
  const [res1, res2, res3, res4] = await Promise.all([
    api.get('/products/1'),
    api.get('/products/2'),
    api.get('/warehouses'),
    api.get('/categories'),
  ]);

  // Assert single-flight refresh: only 1 refresh call was made across all 4 requests
  assert.equal(refreshCalls, 1, 'Exactly one single-flight refresh must be executed for simultaneous 401s');
  assert.equal(getAccessToken(), 'refreshed-jwt-new-token');
  assert.equal(res1.data.item, '/products/1');
  assert.equal(res2.data.item, '/products/2');
  assert.equal(res3.data.item, '/warehouses');
  assert.equal(res4.data.item, '/categories');

  // Restore
  axios.post = originalPost;
  clearAccessToken();
});

test('4. HTTP 403 Forbidden does NOT trigger refresh', async () => {
  let refreshCalls = 0;
  const originalPost = axios.post;
  axios.post = async (url, data, config) => {
    if (url.includes('/auth/refresh')) refreshCalls++;
    return originalPost(url, data, config);
  };

  api.defaults.adapter = async config => {
    throw new axios.AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, null, {
      status: 403,
      data: { message: 'Access Denied' },
    });
  };

  setAccessToken('some-valid-token');
  await assert.rejects(api.get('/admin/restricted'), e => e.status === 403);
  assert.equal(refreshCalls, 0, 'Must NOT attempt refresh on HTTP 403');

  axios.post = originalPost;
  clearAccessToken();
});

test('5. Safe legacy localStorage token migration removes legacy tokens after successful refresh', async () => {
  storage.clear();
  storage.set('nbh_token', 'legacy-access-token');
  storage.set('nbh_refresh', 'legacy-refresh-token');

  let sentPayload = null;
  const originalPost = axios.post;
  axios.post = async (url, data, config) => {
    if (url.includes('/auth/refresh')) {
      sentPayload = data;
      return {
        data: {
          success: true,
          data: {
            accessToken: 'migrated-in-memory-token',
            refreshToken: null,
          },
        },
      };
    }
    return originalPost(url, data, config);
  };

  clearAccessToken();
  const result = await refreshSession();

  assert.equal(sentPayload.refreshToken, 'legacy-refresh-token', 'Must migrate legacy refresh token in payload');
  assert.equal(getAccessToken(), 'migrated-in-memory-token', 'New token must be in memory');
  assert.equal(localStorage.getItem('nbh_token'), null, 'Legacy nbh_token must be removed from localStorage');
  assert.equal(localStorage.getItem('nbh_refresh'), null, 'Legacy nbh_refresh must be removed from localStorage');

  axios.post = originalPost;
  clearAccessToken();
});

test('6. Logout and session expiration clear in-memory token, clear cache, and notify tabs', () => {
  setAccessToken('active-token-999');
  let notified = false;
  const listener = () => { notified = true; };
  window.addEventListener('nbh:session_expired', listener);

  expireSession();

  assert.equal(getAccessToken(), null, 'In-memory token must be cleared on expireSession');
  assert.equal(localStorage.getItem('nbh_token'), null);
  assert.equal(localStorage.getItem('nbh_refresh'), null);
  assert.equal(notified, true, 'nbh:session_expired event must be dispatched to window');

  window.removeEventListener('nbh:session_expired', listener);
});

test('7. SSE client obtains in-memory access token, passes Authorization Bearer, and avoids URLs', async () => {
  setAccessToken('sse-in-memory-jwt');

  let streamHeaders = null;
  let streamUrl = null;

  const mockFetch = async (url, options) => {
    streamUrl = url;
    streamHeaders = options.headers;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(': keepalive\n\n'));
        controller.close();
      },
    });
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body,
    };
  };

  const win = new EventTarget();
  const doc = new EventTarget();
  doc.visibilityState = 'visible';

  const stop = createRealtimeClient({
    url: '/api/v1/events',
    getToken: getAccessToken,
    refreshSession: async () => {},
    invalidate: () => {},
    fetch: mockFetch,
    window: win,
    document: doc,
    navigator: { onLine: true },
    random: () => 0.5,
  });

  // Flush promises
  for (let i = 0; i < 10; i++) await Promise.resolve();

  assert.equal(streamHeaders.Authorization, 'Bearer sse-in-memory-jwt', 'SSE must use in-memory token');
  assert.equal(streamUrl.includes('token'), false, 'No token in SSE URL');
  assert.equal(streamUrl.includes('jwt'), false, 'No token in SSE URL');

  stop();
  clearAccessToken();
});
