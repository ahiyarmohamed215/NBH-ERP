import React from 'react';

/**
 * Enhanced React.lazy that automatically retries once upon chunk loading failures.
 * This prevents blank screens when a network glitch occurs or when a production deployment
 * invalidates old asset hashes while an active user is browsing.
 */
export function lazyWithRetry(componentImport) {
  return React.lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      const isChunkError =
        error.name === 'ChunkLoadError' ||
        /Failed to fetch dynamically imported module/i.test(error?.message || '') ||
        /Loading chunk [\d]+ failed/i.test(error?.message || '') ||
        /error loading dynamically imported module/i.test(error?.message || '');

      if (isChunkError) {
        // Wait 1 second before retrying dynamic import
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          return await componentImport();
        } catch (retryError) {
          console.error('Failed to load module chunk after retry:', retryError);
          throw retryError;
        }
      }
      throw error;
    }
  });
}

export default lazyWithRetry;
