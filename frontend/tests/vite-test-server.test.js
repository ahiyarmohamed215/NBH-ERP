import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('middleware test servers inherit disabled HMR and can coexist without a shared WebSocket port', async () => {
  const servers = [];
  try {
    // Deliberately omit hmr here: test fixtures must inherit the safe test
    // default even when they do not provide their own explicit hmr: false.
    for (let i = 0; i < 2; i++) {
      servers.push(await createServer({
        server: { middlewareMode: true },
        appType: 'custom',
        optimizeDeps: { noDiscovery: true, include: [] },
      }));
    }
    for (const server of servers) {
      assert.equal(server.config.server.hmr, false);
      assert.equal(server.httpServer, null, 'Middleware fixtures must not open an HTTP listener');
    }
  } finally {
    await Promise.all(servers.map(server => server.close()));
  }
});
