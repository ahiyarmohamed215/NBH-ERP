import { useEffect, useRef } from 'react';
import { useWorkspaceActive } from '../components/RetainedWorkspaces';

/**
 * useDataSync
 *
 * Automatically refreshes component data when:
 * 1. An ERP mutation event fires (e.g. erp:data_changed, erp:roles_updated, erp:customers_updated)
 * 2. Window gains focus (throttled to avoid network flooding)
 * 3. Enclosing workspace switches from inactive to active if a sync was pending
 *
 * Prevents inactive/hidden background workspaces from triggering unnecessary network calls.
 */
export function useDataSync(callback, events = ['erp:data_changed'], deps = []) {
  const isWorkspaceActive = useWorkspaceActive();
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  const hasPendingSync = useRef(false);
  const lastFocusSync = useRef(0);

  // When workspace transitions from inactive to active, execute any pending sync
  useEffect(() => {
    if (isWorkspaceActive && hasPendingSync.current) {
      hasPendingSync.current = false;
      if (savedCallback.current) {
        try {
          Promise.resolve(savedCallback.current({ type: 'workspace_activated' })).catch(() => {});
        } catch (_) {}
      }
    }
  }, [isWorkspaceActive]);

  useEffect(() => {
    let timeoutId = null;

    const triggerRefresh = (e) => {
      // If workspace is inactive/hidden, defer until user switches back to this workspace
      if (!isWorkspaceActive) {
        hasPendingSync.current = true;
        return;
      }

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (savedCallback.current) {
          try {
            Promise.resolve(savedCallback.current(e)).catch((err) => {
              console.debug('DataSync auto-refresh skipped or failed:', err?.message || err);
            });
          } catch (err) {
            console.debug('DataSync auto-refresh skipped or failed:', err?.message || err);
          }
        }
      }, 250);
    };

    const eventList = Array.isArray(events) ? events : [events];
    eventList.forEach((evt) => {
      window.addEventListener(evt, triggerRefresh);
    });

    const handleFocus = () => {
      const now = Date.now();
      // Throttle window focus refreshes to at most once every 30 seconds
      if (now - lastFocusSync.current < 30000) {
        return;
      }
      lastFocusSync.current = now;
      triggerRefresh({ type: 'focus' });
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      eventList.forEach((evt) => {
        window.removeEventListener(evt, triggerRefresh);
      });
      window.removeEventListener('focus', handleFocus);
    };
  }, [isWorkspaceActive, ...deps]);
}

export default useDataSync;
