import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  authApi,
  refreshSession,
  clearApiCache,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  expireSession,
  recordUserActivity,
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
    try {
      if (getAccessToken()) await authApi.logout();
    } catch (_) {
      // Ignore network errors during logout
    } finally {
      if (isIdle) {
        expireSession(IDLE_EXPIRED_MESSAGE);
      } else {
        expireSession();
      }
      clear();
    }
  }, [clear]);

  useEffect(() => {
    let active = true;

    const check = async (isInitial = false) => {
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
          await refreshSession();
          token = getAccessToken();
        }
        if (!active || generation !== sessionGeneration.current) return;
        sessionToken = token;
        const res = await authApi.getMe();
        if (active && generation === sessionGeneration.current && sessionToken === getAccessToken()) {
          clearApiCache();
          setUser(res.data);
          if (typeof localStorage !== 'undefined' && localStorage.getItem('nbh_user')) {
            localStorage.setItem('nbh_user', JSON.stringify(res.data));
          }
          if (getLastUserActivity() === 0) {
            recordUserActivity();
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

    const onCheckEvent = () => check(false);
    const timer = setInterval(() => check(false), 60000);
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
    window.addEventListener('nbh:session_expired', clear);
    window.addEventListener('focus', onCheckEvent);
    window.addEventListener('erp:roles_updated', onCheckEvent);
    window.addEventListener('erp:users_updated', onCheckEvent);

    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('nbh:session_expired', clear);
      window.removeEventListener('focus', onCheckEvent);
      window.removeEventListener('erp:roles_updated', onCheckEvent);
      window.removeEventListener('erp:users_updated', onCheckEvent);
    };
  }, [clear, logout]);

  // 30-Minute Idle Inactivity Auto-Logout Effect
  useEffect(() => {
    if (!user) return;

    recordUserActivity();

    const onUserInteraction = () => {
      recordUserActivity();
    };

    const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
    if (typeof window !== 'undefined') {
      ACTIVITY_EVENTS.forEach(event => {
        window.addEventListener(event, onUserInteraction, { passive: true });
      });
    }

    const checkIdle = () => {
      const lastActive = getLastUserActivity();
      if (lastActive > 0 && Date.now() - lastActive >= IDLE_TIMEOUT_MS) {
        logout(true);
      }
    };

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
          window.removeEventListener(event, onUserInteraction);
        });
        window.removeEventListener('focus', onVisibilityOrFocus);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      }
      clearInterval(idleInterval);
    };
  }, [user, logout]);

  const login = useCallback(async (username, password) => {
    sessionGeneration.current++;
    const { data } = await authApi.login(username, password);
    sessionGeneration.current++;
    clearApiCache();
    clearSecureQueryCache();

    // Store access token in JavaScript memory ONLY!
    setAccessToken(data.accessToken);
    recordUserActivity();

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
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

export const useAuth = () => useContext(AuthContext);
