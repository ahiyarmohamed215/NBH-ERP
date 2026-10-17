import {useEffect, useRef} from 'react';
import {useWorkspaceActive} from '../components/RetainedWorkspaces';

/** Coalesces invalidations, serializes refreshes and defers hidden workspaces. */
export function useDataSync(callback, events = ['erp:data_changed'], deps = [], topics = null) {
  const active = useWorkspaceActive();
  const callbackRef = useRef(callback);
  const scheduleRef = useRef(null);
  const pending = useRef(false), running = useRef(false), lastFocus = useRef(Date.now());
  callbackRef.current = callback;
  const eventKey = JSON.stringify(Array.isArray(events) ? events : [events]);
  const topicGroups = {purchasing:['orders','suppliers','grn','gtn','prn'], inventory:['inventory','grn','gtn','prn','sales','returns'], sales:['sales','quotations','payments','returns'], customers:['customers','targets'], targets:['targets','sales'], users:['users'], roles:['roles'], delivery:['delivery','sales']};
  const inferred = JSON.parse(eventKey).flatMap(event => topicGroups[event.replace(/^erp:/,'').replace(/_updated$/,'')] || []);
  const topicKey = JSON.stringify(topics || (inferred.length ? [...new Set(inferred)] : null));
  useEffect(() => {
    let disposed = false, timer;
    const visible = () => active && document.visibilityState !== 'hidden';
    const execute = async event => {
      timer = null;
      if (disposed) return;
      if (!visible() || running.current) { pending.current = true; return; }
      pending.current = false; running.current = true;
      try { await callbackRef.current?.(event); }
      catch (_) { /* Existing page loaders retain their error behavior. */ }
      finally {
        running.current = false;
        if (pending.current) scheduleRef.current?.({type:'pending_sync'});
      }
    };
    const schedule = event => {
      if (!visible()) { pending.current = true; return; }
      clearTimeout(timer); timer = setTimeout(() => execute(event), 250);
    };
    scheduleRef.current = schedule;
    const handle = event => {
      const changed = event.detail?.topics, relevant = JSON.parse(topicKey);
      if (changed && relevant && !changed.some(topic => relevant.includes(topic))) return;
      schedule(event);
    };
    const focus = () => {
      if (!visible()) return;
      if (pending.current || Date.now() - lastFocus.current >= 30000) {
        lastFocus.current = Date.now(); schedule({type:'focus'});
      }
    };
    const names = new Set([...JSON.parse(eventKey), 'erp:realtime_sync']);
    names.forEach(name => window.addEventListener(name, handle));
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    if (pending.current && visible()) schedule({type:'workspace_activated'});
    return () => {
      disposed = true; if (timer) { clearTimeout(timer); pending.current = true; }
      scheduleRef.current = null;
      names.forEach(name => window.removeEventListener(name, handle));
      window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus);
    };
  }, [active, eventKey, topicKey, ...deps]);
}
export default useDataSync;
