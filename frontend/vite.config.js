import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Test middleware servers must not replace the running app's optimized dependencies.
  cacheDir: process.env.NODE_TEST_CONTEXT
    ? `node_modules/.vite-tests/${process.pid}`
    : 'node_modules/.vite-dev',
  server: {
    // Middleware-only test servers need no live reload. Without this default,
    // fixtures that omit hmr start competing WebSocket listeners on port 24678.
    // Leave normal development's HMR behavior unchanged.
    hmr: process.env.NODE_TEST_CONTEXT ? false : undefined,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('axios')) {
              return 'vendor-axios';
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  }
});
