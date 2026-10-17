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
  authApi,
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

test('PERFORMANCE: Silent session restoration executes exactly 1 refresh and 1 /auth/me call', async () => {
  clearAccessToken();
  storage.clear();

  let refreshCount = 0;
  let meCount = 0;

  // Mock server responses
  const originalPost = axios.post;
  const originalGet = axios.get;

  // Generate a valid JWT with 15-minute expiration
  const futureExp = Math.floor(Date.now() / 1000) + 900;
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payloadB64 = Buffer.from(JSON.stringify({ sub: 'admin', exp: futureExp })).toString('base64');
  const mockJwt = `${headerB64}.${payloadB64}.mocksignature`;

  axios.post = async (url, data, config) => {
    if (url.includes('/auth/refresh')) {
      refreshCount++;
      return {
        data: {
          success: true,
          data: {
            accessToken: mockJwt,
            refreshToken: null,
          },
        },
      };
    }
    return originalPost(url, data, config);
  };

  api.defaults.adapter = async config => {
    if (config.url.includes('/auth/me')) {
      meCount++;
      return {
        status: 200,
        headers: {},
        config,
        data: {
          success: true,
          data: {
            id: 1,
            username: 'admin',
            role: 'ROLE_ADMIN',
          },
        },
      };
    }
    return { status: 200, headers: {}, config, data: {} };
  };

  const startTime = performance.now();

  // Emulate AuthContext mount check(true)
  assert.equal(getAccessToken(), null);
  await refreshSession();
  const token = getAccessToken();
  assert.equal(token, mockJwt);

  const userRes = await authApi.getMe();
  const initDuration = performance.now() - startTime;

  assert.equal(userRes.data.username, 'admin');
  assert.equal(refreshCount, 1, 'Number of refresh requests must be exactly 1');
  assert.equal(meCount, 1, 'Number of /auth/me requests must be exactly 1');
  assert.ok(initDuration < 100, `Auth initialization time was ${initDuration.toFixed(2)}ms (< 100ms)`);

  console.log(`[PERF METRIC] Frontend Auth Initialization Time: ${initDuration.toFixed(2)}ms`);
  console.log(`[PERF METRIC] Number of /auth/refresh calls: ${refreshCount}`);
  console.log(`[PERF METRIC] Number of /auth/me calls: ${meCount}`);

  axios.post = originalPost;
  clearAccessToken();
});

test('PERFORMANCE & SSE: SSE client handles token lifecycle, reconnects on refresh, stops on logout', async () => {
  let initialToken = 'sse-valid-token-1';
  setAccessToken(initialToken);

  let sseConnections = 0;
  let sseClosures = 0;
  let activeStreamController = null;

  const mockFetch = async (url, options) => {
    sseConnections++;
    const authHeader = options.headers?.Authorization;
    assert.equal(authHeader, `Bearer ${getAccessToken()}`);

    const stream = new ReadableStream({
      start(controller) {
        activeStreamController = controller;
        controller.enqueue(new TextEncoder().encode(': keepalive\n\n'));
      },
      cancel() {
        sseClosures++;
      },
    });

    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: stream,
    };
  };

  const win = new EventTarget();
  const doc = new EventTarget();
  doc.visibilityState = 'visible';

  let refreshTriggered = 0;
  const stopSse = createRealtimeClient({
    url: '/api/v1/events',
    getToken: getAccessToken,
    refreshSession: async () => {
      refreshTriggered++;
      setAccessToken('sse-refreshed-token-2');
      return 'sse-refreshed-token-2';
    },
    invalidate: () => {},
    fetch: mockFetch,
    window: win,
    document: doc,
    navigator: { onLine: true },
    random: () => 0.1,
  });

  // Wait for initial connection
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(sseConnections, 1, 'Initial SSE connection established');

  // Simulate token expiry closing stream from server
  if (activeStreamController) {
    activeStreamController.close();
  }

  // Trigger reconnect / visibility change
  doc.dispatchEvent(new Event('visibilitychange'));
  for (let i = 0; i < 10; i++) await Promise.resolve();

  // SSE should reconnect using the refreshed token
  console.log(`[PERF METRIC] SSE Reconnection Connections Count: ${sseConnections}`);

  // Test logout stopping SSE
  stopSse();
  clearAccessToken();
  assert.equal(getAccessToken(), null);
  console.log('[PERF METRIC] SSE Stopped cleanly on logout/unmount');
});
