import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authApi, refreshSession, clearApiCache, getAccessToken, setAccessToken, clearAccessToken, expireSession } from '../api/apiClient';

const AuthContext = createContext(null);

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
    clearAccessToken();
    if (typeof localStorage !== 'undefined') {
      ['nbh_token', 'nbh_refresh', 'nbh_user'].forEach(k => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
    }
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getAccessToken()) await authApi.logout();
    } catch (_) {
      // Ignore network errors during logout
    } finally {
      expireSession();
      clear();
    }
  }, [clear]);

  useEffect(() => {
    let active = true;

    const check = async (isInitial = false) => {
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
  }, [clear]);

  const login = async (username, password) => {
    sessionGeneration.current++;
    const { data } = await authApi.login(username, password);
    sessionGeneration.current++;
    clearApiCache();

    // Store access token in JavaScript memory ONLY!
    setAccessToken(data.accessToken);

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
  };

  const updateUser = profile => setUser(prev => ({ ...prev, ...profile }));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, isTokenExpired }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
