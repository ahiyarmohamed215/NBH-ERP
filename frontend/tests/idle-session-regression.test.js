import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import api, { assertSessionActive, authApi, beginUserSession, setAccessToken, getAccessToken, getLastUserActivity, refreshSession, expireSession, IDLE_TIMEOUT_MS } from '../src/api/apiClient.js';

const values = new Map();
globalThis.localStorage = {getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,String(v)), removeItem: k => values.delete(k)};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window = new EventTarget();
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {locks: {request: (_, callback) => callback()}} });
const response = config => ({data: {data: {ok: true}}, status: 200, headers: {}, config});

test('automatic GETs and POSTs cannot extend the idle deadline; cache and refresh are blocked at 30 minutes', async () => {
  beginUserSession();
  setAccessToken('test-token');
  const last = getLastUserActivity();
  const adapter = api.defaults.adapter;
  const post = axios.post;
  const now = Date.now;
  let calls = 0;
  try {
    api.defaults.adapter = async config => { calls++; return response(config); };
    Date.now = () => last + 29 * 60000;
    await api.get('/warehouses', {cacheTtl: 3600000});
    await api.post('/background/autosave', {});
    assert.equal(getLastUserActivity(), last);
    Date.now = () => last + IDLE_TIMEOUT_MS;
    await assert.rejects(api.get('/warehouses'), {code: 'SESSION_IDLE'});
    assert.equal(calls, 2, 'expired cached GET must not serve data or contact server');
    let refreshCalls = 0;
    axios.post = async () => { refreshCalls++; throw new Error('must not refresh'); };
    await assert.rejects(refreshSession(), {code: 'SESSION_ENDED'});
    assert.equal(refreshCalls, 0);
    assert.equal(getAccessToken(), null);
  } finally { api.defaults.adapter = adapter; axios.post = post; Date.now = now; }
});

test('late refresh response after logout cannot restore credentials', async () => {
  beginUserSession();
  setAccessToken('before-logout');
  const originalPost = axios.post;
  let release, started;
  const ready = new Promise(resolve => { started = resolve; });
  try {
    axios.post = () => { started(); return new Promise(resolve => { release = resolve; }); };
    const pending = refreshSession();
    await ready;
    expireSession();
    release({data: {data: {accessToken: 'late-token'}}});
    await assert.rejects(pending, {code: 'SESSION_CHANGED'});
    assert.equal(getAccessToken(), null);
    await assert.rejects(refreshSession(), {code: 'SESSION_ENDED'});
  } finally { axios.post = originalPost; }
});

test('a stale refresh cannot clear a newly signed-in user', async () => {
  beginUserSession(); setAccessToken('old-user');
  const originalPost = axios.post;
  let release, started;
  const ready = new Promise(resolve => { started = resolve; });
  try {
    axios.post = () => { started(); return new Promise(resolve => { release = resolve; }); };
    const pending = refreshSession();
    await ready;
    setAccessToken('new-user'); beginUserSession();
    release({data: {data: {accessToken: 'old-user-refreshed'}}});
    await assert.rejects(pending, {code: 'SESSION_CHANGED'});
    assert.equal(getAccessToken(), 'new-user');
  } finally { axios.post = originalPost; }
});

test('activity heartbeat does not broadcast a business-data change', async () => {
  beginUserSession(); setAccessToken('active');
  const adapter = api.defaults.adapter;
  let changes = 0;
  const listener = () => {changes++;};
  window.addEventListener('erp:data_changed', listener);
  try {
    api.defaults.adapter = async config => response(config);
    await authApi.activity();
    assert.equal(changes, 0);
  } finally {api.defaults.adapter = adapter; window.removeEventListener('erp:data_changed', listener);}
});

test('idle enforcement still works when browser storage is blocked', () => {
  const storage = globalThis.localStorage;
  const now = Date.now;
  globalThis.localStorage = {getItem() {throw new Error('blocked');}, setItem() {throw new Error('blocked');}, removeItem() {throw new Error('blocked');}};
  try {
    beginUserSession(); setAccessToken('active');
    const last = getLastUserActivity();
    assert.ok(last > 0);
    Date.now = () => last + IDLE_TIMEOUT_MS;
    assert.throws(assertSessionActive, {code: 'SESSION_IDLE'});
    assert.equal(getAccessToken(), null);
    assert.throws(assertSessionActive, {code: 'SESSION_ENDED'});
  } finally {globalThis.localStorage = storage; Date.now = now;}
});
