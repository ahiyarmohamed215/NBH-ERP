import test from 'node:test';
import assert from 'node:assert/strict';
import {newestFirst} from '../src/utils/recordOrder.js';

test('newest creation is first regardless of document dates or recent edits',()=>{
  const records=[{id:3,createdAt:'2026-10-10T09:00:00',updatedAt:'2026-10-12T15:00:00',receivedDate:'2026-10-12'},
    {id:4,createdAt:'2026-10-12T10:00:00',receivedDate:'2026-10-01'},
    {id:5,createdAt:'2026-10-12T10:00:00',receivedDate:'2026-10-01'}];
  assert.deepEqual(newestFirst(records).map(record=>record.id),[5,4,3]);
  assert.deepEqual(records.map(record=>record.id),[3,4,5],'Sorting does not mutate the fetched list');
});
test('legacy records without creation times use newest ID first',()=>{
  assert.deepEqual(newestFirst([{id:1},{id:7},{id:3,createdAt:'invalid'}]).map(record=>record.id),[7,3,1]);
});
