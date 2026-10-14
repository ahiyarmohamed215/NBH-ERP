import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authApi, refreshSession, clearApiCache } from '../api/apiClient';
const AuthContext = createContext(null);
const isTokenExpired = token => {
  try { const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return !payload.exp || payload.exp * 1000 < Date.now() + 30000; }
  catch { return true; }
};
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true);
  const sessionGeneration=useRef(0);
  const clear = useCallback(() => { sessionGeneration.current++; clearApiCache(); ['nbh_token','nbh_refresh','nbh_user'].forEach(k => localStorage.removeItem(k)); setUser(null); }, []);
  const logout = useCallback(async () => { try { if(localStorage.getItem('nbh_token')) await authApi.logout(); } finally { clear(); } }, [clear]);
  useEffect(() => {
    let active = true;
    const check = async () => {
      if(!localStorage.getItem('nbh_token')) return;
      const generation=++sessionGeneration.current;
      let sessionToken=localStorage.getItem('nbh_token');
      try {
        if(isTokenExpired(localStorage.getItem('nbh_token'))) await refreshSession();
        if(!active || generation!==sessionGeneration.current)return;
        sessionToken=localStorage.getItem('nbh_token');
        const res = await authApi.getMe();
        if(active && generation===sessionGeneration.current && sessionToken===localStorage.getItem('nbh_token')) { clearApiCache(); setUser(res.data); localStorage.setItem('nbh_user', JSON.stringify(res.data)); }
      } catch(e) { if(active && generation===sessionGeneration.current && sessionToken===localStorage.getItem('nbh_token') && (e.response?.status === 401 || !localStorage.getItem('nbh_token'))) clear(); }
    };
    check().finally(() => { if(active) setLoading(false); });
    const timer = setInterval(check, 60000);
    window.addEventListener('nbh:session_expired', clear);
    window.addEventListener('focus', check);
    window.addEventListener('erp:roles_updated', check);
    window.addEventListener('erp:users_updated', check);
    return () => { active = false; clearInterval(timer); window.removeEventListener('nbh:session_expired', clear); window.removeEventListener('focus', check); window.removeEventListener('erp:roles_updated', check); window.removeEventListener('erp:users_updated', check); };
  }, [clear]);
  const login = async (username, password) => {
    sessionGeneration.current++;
    const { data } = await authApi.login(username, password);
    sessionGeneration.current++; clearApiCache();
    localStorage.setItem('nbh_token', data.accessToken); localStorage.setItem('nbh_refresh', data.refreshToken);
    const { accessToken, refreshToken, ...profile } = data;
    localStorage.setItem('nbh_user', JSON.stringify(profile)); setUser(profile); sessionStorage.removeItem('nbh_session_expired'); return data;
  };
  const updateUser = profile => setUser(prev => { const next={ ...prev,...profile }; localStorage.setItem('nbh_user',JSON.stringify(next)); return next; });
  return <AuthContext.Provider value={{ user, loading, login, logout, updateUser, isTokenExpired }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
