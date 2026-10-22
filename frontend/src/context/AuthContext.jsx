import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {CustomerRangeBadgeProvider} from '../components/CustomerRangeBadge';
import {
  authApi,
  refreshSession,
  clearApiCache,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  expireSession,
  manualLogout,
  recordUserActivity,
  beginUserSession,
  getLastUserActivity,
  IDLE_TIMEOUT_MS,
  IDLE_EXPIRED_MESSAGE,
} from '../api/apiClient';
import { queryClient, clearSecureQueryCache } from '../queryClient';

const AuthContext = createContext(null);

export { IDLE_TIMEOUT_MS, IDLE_EXPIRED_MESSAGE };

export const isTokenExpired = token => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !payload.exp || payload.exp * 1000 < Date.now() + 30000;
  } catch {
    return true;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionGeneration = useRef(0);
  const userRef = useRef(user);
  userRef.current = user;
  const signedIn = Boolean(user);

  const clear = useCallback(() => {
    sessionGeneration.current++;
    clearApiCache();
    clearSecureQueryCache();
    clearAccessToken();
    if (typeof localStorage !== 'undefined') {
      ['nbh_token', 'nbh_refresh', 'nbh_user', 'nbh_last_active'].forEach(k => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
    }
    setUser(null);
  }, []);

  const logout = useCallback(async (isIdle = false) => {
    // Start cookie revocation, but clear the local session without waiting on the network.
    const request = authApi.logout().catch(() => {});
    if (isIdle) {
      expireSession(IDLE_EXPIRED_MESSAGE);
    } else {
      manualLogout('You have successfully signed out.');
    }
    clear();
    await request;
  }, [clear]);

  useEffect(() => {
    let active = true;

    const check = async (isInitial = false, forceFetchProfile = false) => {
      // 1. Inactivity check: if idle for 30+ minutes, terminate session immediately
      const lastActive = getLastUserActivity();
      if (lastActive > 0 && Date.now() - lastActive >= IDLE_TIMEOUT_MS) {
        logout(true);
        return;
      }

      let token = getAccessToken();
      if (!token) {
        if (!isInitial) return;
        // On initial app load only, attempt silent session restoration via HttpOnly cookie
        try {
          await refreshSession();
          token = getAccessToken();
        } catch (_) {
          return;
        }
      }
      if (!token) return;

      const generation = ++sessionGeneration.current;
      let sessionToken = token;
      try {
        if (isTokenExpired(token)) {
          // If the employee is currently idle (inactivity >= 30m), do NOT refresh session!
          if (lastActive > 0 && Date.now() - lastActive >= IDLE_TIMEOUT_MS) {
            logout(true);
            return;
          }
          await refreshSession();
          token = getAccessToken();
        }
        if (!active || generation !== sessionGeneration.current) return;
        sessionToken = token;

        // Fetch user profile only on initial load, when null, or on explicit role/user update events
        if (isInitial || !userRef.current || forceFetchProfile) {
          const res = await authApi.getMe();
          if (active && generation === sessionGeneration.current && sessionToken === getAccessToken()) {
            clearApiCache();
            setUser(res.data);
            try {
              if (localStorage.getItem('nbh_user')) localStorage.setItem('nbh_user', JSON.stringify(res.data));
            } catch (_) {}
            if (getLastUserActivity() === 0) {
              recordUserActivity();
            }
          }
        }
      } catch (e) {
        if (active && generation === sessionGeneration.current && sessionToken === getAccessToken() && (e.response?.status === 401 || !getAccessToken())) {
          clear();
        }
      }
    };

    check(true).finally(() => {
      if (active) setLoading(false);
    });

    const onRolesUpdated = () => check(false, true);
    const onUsersUpdated = () => check(false, true);

    window.addEventListener('nbh:session_expired', clear);
    window.addEventListener('erp:roles_updated', onRolesUpdated);
    window.addEventListener('erp:users_updated', onUsersUpdated);

    return () => {
      active = false;
      window.removeEventListener('nbh:session_expired', clear);
      window.removeEventListener('erp:roles_updated', onRolesUpdated);
      window.removeEventListener('erp:users_updated', onUsersUpdated);
    };
  }, [clear, logout]);

  // 30-Minute Idle Inactivity Auto-Logout Effect
  useEffect(() => {
    if (!signedIn) return;
    let heartbeatAt = getLastUserActivity();
    let heartbeatPending = false;
    const heartbeat = () => {
      const last = getLastUserActivity();
      if (heartbeatPending || last <= heartbeatAt) return;
      heartbeatPending = true;
      authApi.activity().then(() => { heartbeatAt = last; }).catch(() => {}).finally(() => { heartbeatPending = false; });
    };
    const onUserInteraction = event => {
      if (!event.isTrusted) return;
      const last = getLastUserActivity();
      // A wake-up click cannot revive a session that expired while the tab slept.
      if (last > 0 && Date.now() - last >= IDLE_TIMEOUT_MS) { logout(true); return; }
      recordUserActivity();
      scheduleIdle();
      if (Date.now() - heartbeatAt >= 60000) heartbeat();
    };

    const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'click', 'wheel'];
    if (typeof window !== 'undefined') {
      ACTIVITY_EVENTS.forEach(event => {
        window.addEventListener(event, onUserInteraction, { passive: true, capture: true });
      });
    }

    const checkIdle = () => {
      const lastActive = getLastUserActivity();
      if (lastActive > 0 && Date.now() - lastActive >= IDLE_TIMEOUT_MS) {
        logout(true);
      } else {
        heartbeat();
        scheduleIdle();
      }
    };

    // Schedule the actual deadline, and re-read shared activity when it fires.
    // The interval also catches clock changes and activity from another tab.
    let idleDeadlineTimer;
    const scheduleIdle = () => {
      clearTimeout(idleDeadlineTimer);
      const last = getLastUserActivity();
      if (last > 0) idleDeadlineTimer = setTimeout(checkIdle, Math.max(1, last + IDLE_TIMEOUT_MS - Date.now()));
    };
    scheduleIdle();

    const idleInterval = setInterval(checkIdle, 10000); // Check every 10 seconds
    if (idleInterval && typeof idleInterval.unref === 'function') {
      idleInterval.unref();
    }

    const onVisibilityOrFocus = () => {
      checkIdle();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityOrFocus);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onVisibilityOrFocus);
    }

    return () => {
      if (typeof window !== 'undefined') {
        ACTIVITY_EVENTS.forEach(event => {
          window.removeEventListener(event, onUserInteraction, true);
        });
        window.removeEventListener('focus', onVisibilityOrFocus);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      }
      clearInterval(idleInterval);
      clearTimeout(idleDeadlineTimer);
    };
  }, [signedIn, logout]);

  const login = useCallback(async (username, password) => {
    sessionGeneration.current++;
    const { data } = await authApi.login(username, password);
    sessionGeneration.current++;
    clearApiCache();
    clearSecureQueryCache();

    // Store access token in JavaScript memory ONLY!
    setAccessToken(data.accessToken);
    beginUserSession();

    // Clean up any legacy localStorage tokens
    if (typeof localStorage !== 'undefined') {
      ['nbh_token', 'nbh_refresh'].forEach(k => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
    }

    const { accessToken, refreshToken, ...profile } = data;
    setUser(profile);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('nbh_session_expired');
      sessionStorage.removeItem('nbh_signed_out');
    }
    return data;
  }, []);

  const updateUser = useCallback(profile => setUser(prev => ({ ...prev, ...profile })), []);

  const authValue = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    updateUser,
    isTokenExpired,
  }), [user, loading, login, logout, updateUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <CustomerRangeBadgeProvider user={user}>{children}</CustomerRangeBadgeProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

export const useAuth = () => useContext(AuthContext);
