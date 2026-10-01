import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/apiClient';

const AuthContext = createContext(null);

/**
 * Decode JWT token payload without third-party library
 */
const parseJwt = (token) => {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

/**
 * Check if JWT token is expired (with 5s buffer)
 */
const isTokenExpired = (token) => {
  const decoded = parseJwt(token);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp * 1000 <= Date.now() + 5000;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback((isExpired = false) => {
    localStorage.removeItem('nbh_token');
    localStorage.removeItem('nbh_user');
    if (isExpired) {
      sessionStorage.setItem('nbh_session_expired', 'Your session has expired. Please sign in again.');
    }
    setUser(null);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('nbh_user');
    const token = localStorage.getItem('nbh_token');

    if (token) {
      if (isTokenExpired(token)) {
        logout(true);
        setLoading(false);
        return;
      }

      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          setUser(parsed);
          // Refresh permissions and roles live from server
          authApi.getMe()
            .then((res) => {
              if (res.data) {
                setUser(res.data);
                localStorage.setItem('nbh_user', JSON.stringify(res.data));
              }
            })
            .catch((err) => {
              if (err?.message?.includes('401') || err?.response?.status === 401) {
                logout(true);
              }
            });
        } catch {
          logout(false);
        }
      }
    }
    setLoading(false);

    // 1. Periodic expiration check every 15 seconds
    const interval = setInterval(() => {
      const currentToken = localStorage.getItem('nbh_token');
      if (currentToken && isTokenExpired(currentToken)) {
        logout(true);
      }
    }, 15000);

    // 2. Tab visibility & focus change (e.g. user returns to laptop / tab after idle period)
    const handleVisibilityOrFocus = () => {
      const currentToken = localStorage.getItem('nbh_token');
      if (currentToken && isTokenExpired(currentToken)) {
        logout(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // 3. Listen for global session expiration events (dispatched by apiClient on 401)
    const handleSessionExpiredEvent = () => {
      logout(true);
    };
    window.addEventListener('nbh:session_expired', handleSessionExpiredEvent);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('nbh:session_expired', handleSessionExpiredEvent);
    };
  }, [logout]);

  const login = async (username, password) => {
    const res = await authApi.login(username, password);
    const data = res.data;
    localStorage.setItem('nbh_token', data.accessToken);
    const userData = {
      id: data.id,
      username: data.username,
      email: data.email,
      fullName: data.fullName,
      roles: data.roles,
      permissions: data.permissions,
    };
    localStorage.setItem('nbh_user', JSON.stringify(userData));
    setUser(userData);
    sessionStorage.removeItem('nbh_session_expired');
    return data;
  };

  const updateUser = (updatedProfile) => {
    setUser((prev) => {
      const merged = { ...prev, ...updatedProfile };
      localStorage.setItem('nbh_user', JSON.stringify(merged));
      return merged;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading, isTokenExpired }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
