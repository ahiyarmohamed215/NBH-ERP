import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogger, createServer } from 'vite';

test('middleware test servers inherit disabled HMR and can coexist without a shared WebSocket port', async () => {
  const servers = [];
  const messages = { warn: [], error: [] };
  const logger = createLogger();
  for (const level of Object.keys(messages)) {
    const write = logger[level].bind(logger);
    logger[level] = (...args) => {
      messages[level].push(args[0]);
      write(...args); // Keep genuine diagnostics visible as well as asserting on them.
    };
  }
  try {
    // Deliberately omit hmr and ws: fixtures must inherit the test defaults.
    for (let i = 0; i < 2; i++) {
      servers.push(await createServer({
        server: { middlewareMode: true },
        customLogger: logger,
        appType: 'custom',
        optimizeDeps: { noDiscovery: true, include: [] },
      }));
    }
    for (const server of servers) {
      assert.equal(server.config.server.hmr, false);
      assert.equal(server.config.server.ws, false, 'Disabling HMR alone does not disable the Vite 8 WebSocket listener');
      assert.equal(server.httpServer, null, 'Middleware fixtures must not open an HTTP listener');
      const pricing = await server.ssrLoadModule('/src/utils/inventoryPricing.js');
      assert.ok(Object.keys(pricing).length > 0, 'SSR module loading must work without the WebSocket transport');
    }
  } finally {
    await Promise.all(servers.map(server => server.close()));
  }
  assert.deepEqual(messages, { warn: [], error: [] }, 'Coexisting test servers must not log listener errors or warnings');
});
