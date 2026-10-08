import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, refreshSession } from '../api/apiClient';
const AuthContext = createContext(null);
const isTokenExpired = token => {
  try { const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return !payload.exp || payload.exp * 1000 < Date.now() + 30000; }
  catch { return true; }
};
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true);
  const clear = useCallback(() => { ['nbh_token','nbh_refresh','nbh_user'].forEach(k => localStorage.removeItem(k)); setUser(null); }, []);
  const logout = useCallback(async () => { try { if(localStorage.getItem('nbh_token')) await authApi.logout(); } finally { clear(); } }, [clear]);
  useEffect(() => {
    let active = true;
    const check = async () => {
      if(!localStorage.getItem('nbh_token')) return;
      try {
        if(isTokenExpired(localStorage.getItem('nbh_token'))) await refreshSession();
        const res = await authApi.getMe();
        if(active) { setUser(res.data); localStorage.setItem('nbh_user', JSON.stringify(res.data)); }
      } catch(e) { if(e.response?.status === 401 || !localStorage.getItem('nbh_token')) clear(); }
    };
    check().finally(() => { if(active) setLoading(false); });
    const timer = setInterval(check, 60000);
    window.addEventListener('nbh:session_expired', clear);
    window.addEventListener('focus', check);
    return () => { active = false; clearInterval(timer); window.removeEventListener('nbh:session_expired', clear); window.removeEventListener('focus', check); };
  }, [clear]);
  const login = async (username, password) => {
    const { data } = await authApi.login(username, password);
    localStorage.setItem('nbh_token', data.accessToken); localStorage.setItem('nbh_refresh', data.refreshToken);
    const { accessToken, refreshToken, ...profile } = data;
    localStorage.setItem('nbh_user', JSON.stringify(profile)); setUser(profile); sessionStorage.removeItem('nbh_session_expired'); return data;
  };
  const updateUser = profile => setUser(prev => { const next={ ...prev,...profile }; localStorage.setItem('nbh_user',JSON.stringify(next)); return next; });
  return <AuthContext.Provider value={{ user, loading, login, logout, updateUser, isTokenExpired }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
