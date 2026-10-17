import test from 'node:test';
import assert from 'node:assert/strict';
import {createRealtimeClient, readEventStream} from '../src/api/realtimeClient.js';

const flush = async () => { for (let i=0;i<20;i++) await Promise.resolve(); };
const encoder = new TextEncoder();
function environment(t) {
  t.mock.timers.enable({apis:['setTimeout','setInterval','Date']});
  const win = new EventTarget(), doc = new EventTarget(), nav = {onLine:true};
  doc.visibilityState = 'visible';
  let sink, calls = [], invalidations = [];
  const fetch = async (url, options) => {
    calls.push({url,options});
    const body = new ReadableStream({start(controller) {
      sink = controller;
      options.signal.addEventListener('abort', () => { try { controller.error(new Error('aborted')); } catch {} },{once:true});
    }});
    return {ok:true,status:200,headers:new Headers({'content-type':'text/event-stream'}),body};
  };
  return {win,doc,nav,calls,invalidations,get sink(){return sink;},
    config:{url:'/api/v1/events',getToken:()=> 'secret',refreshSession:async()=>{},invalidate:topics=>invalidations.push(topics),fetch,window:win,document:doc,navigator:nav,random:()=>0.5}};
}

test('SSE parser handles fragmented UTF-8, CRLF, comments and multiline data', async () => {
  const bytes = encoder.encode(': heartbeat\r\nevent: invalidate\r\ndata: {"topics":\r\ndata: ["sales"],"label":"é"}\r\n\r\n');
  const events=[];
  await readEventStream(new ReadableStream({start(controller){for(const byte of bytes)controller.enqueue(new Uint8Array([byte]));controller.close();}}),
    (name,data)=>events.push([name,JSON.parse(data)]),new AbortController().signal);
  assert.deepEqual(events,[['invalidate',{topics:['sales'],label:'é'}]]);
});

test('authenticated stream reconnects once, reconciles, and cleans up on logout', async t => {
  const env=environment(t);const stop=createRealtimeClient(env.config);await flush();
  assert.equal(env.calls.length,1);
  assert.equal(env.calls[0].options.headers.Authorization,'Bearer secret');
  assert.equal(env.calls[0].url.includes('secret'),false);
  env.sink.enqueue(encoder.encode('event:ready\ndata:{}\n\n'));await flush();
  env.sink.enqueue(encoder.encode('event:invalidate\ndata:{"topics":["orders"]}\n\n'));await flush();
  assert.deepEqual(env.invalidations,[null,['orders']]);
  env.sink.close();await flush();t.mock.timers.tick(1000);await flush();
  assert.equal(env.calls.length,2);
  env.sink.enqueue(encoder.encode('event:ready\ndata:{}\n\n'));await flush();
  assert.deepEqual(env.invalidations,[null,['orders'],null]);
  stop();await flush();assert.equal(env.calls[1].options.signal.aborted,true);
  t.mock.timers.tick(600000);await flush();assert.equal(env.calls.length,2);
});

test('fallback polling is bounded, skips hidden/offline tabs and reconnects when visible', async t => {
  const env=environment(t);let attempts=0;
  const stop=createRealtimeClient({...env.config,fetch:async()=>{attempts++;throw new Error('unavailable');}});
  await flush();t.mock.timers.tick(60000);await flush();
  assert.deepEqual(env.invalidations,[null]);assert.ok(attempts<10);
  env.doc.visibilityState='hidden';env.doc.dispatchEvent(new Event('visibilitychange'));await flush();
  const before=attempts;t.mock.timers.tick(600000);await flush();assert.equal(attempts,before);assert.equal(env.invalidations.length,1);
  env.doc.visibilityState='visible';env.doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(attempts,before+1);
  env.nav.onLine=false;env.win.dispatchEvent(new Event('offline'));await flush();
  t.mock.timers.tick(600000);await flush();assert.equal(env.invalidations.length,1);stop();
});

test('401 uses the existing refresh flow and opens with the rotated token', async t => {
  const env=environment(t);let token='old',refreshes=0;
  const stop=createRealtimeClient({...env.config,getToken:()=>token,refreshSession:async()=>{token='new';refreshes++;},
    fetch:async(url,options)=> options.headers.Authorization==='Bearer old'
      ? {status:401,body:null} : env.config.fetch(url,options)});
  await flush();assert.equal(refreshes,1);assert.equal(env.calls[0].options.headers.Authorization,'Bearer new');stop();await flush();
});

test('missing heartbeat aborts a stalled stream and hidden tabs release their connection', async t => {
  const env=environment(t);const stop=createRealtimeClient(env.config);await flush();
  t.mock.timers.tick(45000);await flush();assert.equal(env.calls[0].options.signal.aborted,true);
  t.mock.timers.tick(1000);await flush();assert.equal(env.calls.length,2);
  env.doc.visibilityState='hidden';env.doc.dispatchEvent(new Event('visibilitychange'));await flush();
  assert.equal(env.calls[1].options.signal.aborted,true);stop();
});
