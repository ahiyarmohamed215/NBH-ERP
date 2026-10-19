/** Incremental SSE parser; supports split UTF-8, CR/LF framing, comments and multiline data. */
export async function readEventStream(body, onEvent, signal, onActivity = () => {}) {
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffer = '', event = '', data = [];
  const line = value => {
    if (!value) {
      if (data.length) onEvent(event || 'message', data.join('\n'));
      event = ''; data = [];
    } else if (!value.startsWith(':')) {
      const colon = value.indexOf(':');
      const field = colon < 0 ? value : value.slice(0, colon);
      const content = colon < 0 ? '' : value.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') event = content;
      if (field === 'data') data.push(content);
    }
  };
  try {
    while (!signal.aborted) {
      const {done, value} = await reader.read();
      if (done) break;
      onActivity(); buffer += decoder.decode(value, {stream:true});
      if (buffer.length + data.join('').length > 65536) throw new Error('SSE frame exceeds limit');
      let match;
      while ((match = /\r\n|\r|\n/.exec(buffer))) {
        if (match[0] === '\r' && match.index === buffer.length - 1) break;
        line(buffer.slice(0, match.index)); buffer = buffer.slice(match.index + match[0].length);
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** One manager per authenticated root. Every reconnect reconciles through existing APIs. */
export function createRealtimeClient({url, getToken, refreshSession, invalidate,
  fetch: request = globalThis.fetch, window: win = window, document: doc = document,
  navigator: nav = navigator, random = Math.random}) {
  let stopped = false, controller, retryTimer, watchdog, failures = 0, connected = false;
  let running = false, restartRequested = false, lastSync = Date.now(), connectedAt = 0;
  const available = () => !stopped && doc.visibilityState !== 'hidden' && nav.onLine !== false && getToken();
  const sync = () => { lastSync = Date.now(); invalidate(null); };
  const activity = () => { clearTimeout(watchdog); watchdog = setTimeout(() => controller?.abort(), 45000); };
  const connect = async () => {
    if (!available() || running) return;
    running = true; controller = new AbortController();
    const signal = controller.signal;
    try {
      activity();
      const open = () => request(url, {headers:{Authorization:`Bearer ${getToken()}`, Accept:'text/event-stream'}, cache:'no-store', signal});
      let response = await open();
      if (response.status === 401) {
        await response.body?.cancel();
        if (!available() || signal.aborted) return;
        await refreshSession();
        if (!available() || signal.aborted) return;
        response = await open();
      }
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
        await response.body?.cancel(); throw new Error('Realtime stream unavailable');
      }
      await readEventStream(response.body, (event, payload) => {
        if (signal.aborted || stopped) return;
        if (event === 'ready') { connected = true; connectedAt = Date.now(); sync(); }
        if (event === 'invalidate') {
          try {
            const data = JSON.parse(payload);
            const topics = data?.topics;
            if (Array.isArray(topics) && topics.length && topics.length <= 32 && topics.every(t => typeof t === 'string')) {
              invalidate(topics, data);
            }
          } catch (_) {}
        }
      }, signal, activity);
    } catch (_) { /* Transport retries stay silent; page loaders handle data errors. */ }
    finally {
      clearTimeout(watchdog);
      if (connected && Date.now() - connectedAt > 30000) failures = 0;
      connected = false; running = false; controller.abort();
      if (available()) {
        const delay = restartRequested ? 0 : Math.min(60000, 1000 * 2 ** Math.min(failures++, 6)) * (0.8 + random() * 0.4);
        retryTimer = setTimeout(connect, delay);
      }
      restartRequested = false;
    }
  };
  const resume = () => {
    clearTimeout(retryTimer);
    if (!available()) { controller?.abort(); return; }
    if (!connected) {
      if (running) { restartRequested = true; controller?.abort(); }
      else connect();
    }
  };
  const poll = setInterval(() => {
    // Also repairs missed notifications and changes handled by another backend instance.
    if (available() && Date.now() - lastSync >= (connected ? 120000 : 60000)) sync();
  }, 15000);
  win.addEventListener('online', resume); win.addEventListener('offline', resume);
  doc.addEventListener('visibilitychange', resume); connect();
  return () => {
    stopped = true; controller?.abort(); clearTimeout(retryTimer); clearTimeout(watchdog); clearInterval(poll);
    win.removeEventListener('online', resume); win.removeEventListener('offline', resume);
    doc.removeEventListener('visibilitychange', resume);
  };
}
