import test from 'node:test';
import assert from 'node:assert/strict';
import {loadWorkspace} from '../src/utils/lazyWithRetry.js';

test('a stalled page import exits loading so the error boundary can offer reload', async () => {
  await assert.rejects(loadWorkspace(() => new Promise(() => {}), 15), {
    name: 'ChunkLoadError',
    message: /Reload the page/,
  });
});

test('successful imports and actual module errors are preserved', async () => {
  const module = {default: () => null};
  assert.equal(await loadWorkspace(() => Promise.resolve(module), 100), module);
  const error = new ReferenceError('Invalid page component');
  await assert.rejects(loadWorkspace(() => {throw error;}, 100), failure => failure === error);
});
