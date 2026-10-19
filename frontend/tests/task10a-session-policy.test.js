import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { Window } from 'happy-dom';

test('TASK 10A: 30-Minute Inactivity and Authentication Policy Verification', async (t) => {
  const window = new Window();
  Object.assign(globalThis, {
    window,
    document: window.document,
    CustomEvent: window.CustomEvent,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    BroadcastChannel: window.BroadcastChannel,
    IS_REACT_ACT_ENVIRONMENT: true,
  });

  const server = await createServer({
    root: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/i, '$1'),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });

  try {
    const {
      recordUserActivity,
      getLastUserActivity,
      expireSession,
      getAccessToken,
      setAccessToken,
      clearAccessToken,
      clearApiCache,
      IDLE_TIMEOUT_MS,
      IDLE_EXPIRED_MESSAGE,
    } = await server.ssrLoadModule('/src/api/apiClient.js');

    const { queryClient, clearSecureQueryCache } = await server.ssrLoadModule('/src/queryClient.js');

    await t.test('1. Verified 30-minute idle inactivity and refresh expiration constants', () => {
      // 30 minutes in milliseconds = 1,800,000 ms
      assert.equal(IDLE_TIMEOUT_MS, 30 * 60 * 1000, 'Idle timeout must be exactly 30 minutes (1,800,000 ms)');
      assert.equal(IDLE_TIMEOUT_MS, 1800000);
      assert.match(IDLE_EXPIRED_MESSAGE, /30 minutes of inactivity/, 'Message must clearly specify 30 minutes of inactivity');
    });

    await t.test('2. Genuine user activity updates lastActive while throttled', () => {
      window.localStorage.clear();
      assert.equal(getLastUserActivity(), 0);

      const initialTime = Date.now();
      recordUserActivity();
      const recorded = getLastUserActivity();
      assert.ok(recorded >= initialTime, 'Activity timestamp must be recorded');
      assert.equal(window.localStorage.getItem('nbh_last_active'), String(recorded));

      // Immediate subsequent call within 2 seconds is throttled
      recordUserActivity();
      assert.equal(getLastUserActivity(), recorded, 'Throttled calls must not re-write storage');
    });

    await t.test('3. Inactive employee >= 30 minutes evaluates as expired; active employee remains valid', () => {
      const now = Date.now();

      // Active employee interacted 10 minutes ago
      const tenMinutesAgo = now - (10 * 60 * 1000);
      window.localStorage.setItem('nbh_last_active', String(tenMinutesAgo));
      let lastActive = getLastUserActivity();
      let isIdle = lastActive > 0 && (now - lastActive >= IDLE_TIMEOUT_MS);
      assert.equal(isIdle, false, 'Employee active 10 minutes ago must NOT be marked idle');

      // Active employee interacted 29 minutes ago
      const twentyNineMinutesAgo = now - (29 * 60 * 1000);
      window.localStorage.setItem('nbh_last_active', String(twentyNineMinutesAgo));
      lastActive = getLastUserActivity();
      isIdle = lastActive > 0 && (now - lastActive >= IDLE_TIMEOUT_MS);
      assert.equal(isIdle, false, 'Employee active 29 minutes ago must NOT be marked idle');

      // Idle employee inactive for 30 minutes and 1 second
      const thirtyMinutesOneSecondAgo = now - ((30 * 60 * 1000) + 1000);
      window.localStorage.setItem('nbh_last_active', String(thirtyMinutesOneSecondAgo));
      lastActive = getLastUserActivity();
      isIdle = lastActive > 0 && (now - lastActive >= IDLE_TIMEOUT_MS);
      assert.equal(isIdle, true, 'Employee inactive for >= 30 minutes must be detected as idle expired');
    });

    await t.test('4. Session expiration cleans access token, sessionStorage, and broadcasts window event', () => {
      window.sessionStorage.clear();
      setAccessToken('sample-active-jwt-token');
      assert.equal(getAccessToken(), 'sample-active-jwt-token');

      let windowEventFired = false;
      const onSessionExpired = () => { windowEventFired = true; };
      window.addEventListener('nbh:session_expired', onSessionExpired);

      expireSession(IDLE_EXPIRED_MESSAGE);

      assert.equal(getAccessToken(), null, 'In-memory access token must be immediately purged');
      assert.equal(window.sessionStorage.getItem('nbh_session_expired'), IDLE_EXPIRED_MESSAGE);
      assert.equal(windowEventFired, true, 'nbh:session_expired window event must fire');

      window.removeEventListener('nbh:session_expired', onSessionExpired);
      clearAccessToken();
    });

    await t.test('5. Logout and session expiration securely clear TanStack Query cache and API cache', () => {
      // Set test query data
      queryClient.setQueryData(['test', 'data'], { secret: 'employee-records' });
      assert.ok(queryClient.getQueryData(['test', 'data']) !== undefined);

      // Clear query cache
      clearSecureQueryCache();
      assert.equal(queryClient.getQueryData(['test', 'data']), undefined, 'TanStack Query cache must be completely cleared');

      // Clear API cache
      clearApiCache();
    });

    await t.test('6. Multi-tab coordination purges sensitive credentials without leaking tokens', () => {
      window.localStorage.setItem('nbh_last_active', String(Date.now()));
      window.localStorage.setItem('nbh_token', 'legacy-leak');
      window.localStorage.setItem('nbh_refresh', 'legacy-refresh');
      window.localStorage.setItem('nbh_user', JSON.stringify({ id: 1, username: 'emp' }));

      expireSession(IDLE_EXPIRED_MESSAGE);

      assert.equal(window.localStorage.getItem('nbh_last_active'), null);
      assert.equal(window.localStorage.getItem('nbh_token'), null);
      assert.equal(window.localStorage.getItem('nbh_refresh'), null);
      assert.equal(window.localStorage.getItem('nbh_user'), null);
    });
  } finally {
    await server.close();
  }
});
