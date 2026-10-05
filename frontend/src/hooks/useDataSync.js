import { useEffect, useRef } from 'react';

/**
 * useDataSync
 *
 * Automatically refreshes component data when:
 * 1. An ERP mutation event fires (e.g. erp:data_changed, erp:roles_updated, erp:customers_updated)
 * 2. Window gains focus (user returns to ERP tab or window)
 * 3. Any additional dependencies change
 *
 * Debounced to prevent unnecessary repeated network calls.
 */
export function useDataSync(callback, events = ['erp:data_changed'], deps = []) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    let timeoutId = null;

    const triggerRefresh = (e) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (savedCallback.current) {
          try {
            savedCallback.current(e);
          } catch (err) {
            console.error('DataSync auto-refresh failed:', err);
          }
        }
      }, 120);
    };

    const eventList = Array.isArray(events) ? events : [events];
    eventList.forEach((evt) => {
      window.addEventListener(evt, triggerRefresh);
    });

    const handleFocus = () => {
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
  }, deps);
}

export default useDataSync;
