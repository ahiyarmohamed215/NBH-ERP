import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/apiClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('nbh_user');
    const token = localStorage.getItem('nbh_token');
    if (savedUser && token) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        // Refresh permissions and roles live from server
        authApi.getMe().then((res) => {
          if (res.data) {
            setUser(res.data);
            localStorage.setItem('nbh_user', JSON.stringify(res.data));
          }
        }).catch(() => {
          // Token may be invalid or server unreachable
        });
      } catch (e) {
        localStorage.removeItem('nbh_user');
      }
    }
    setLoading(false);
  }, []);

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
    return data;
  };

  const logout = () => {
    localStorage.removeItem('nbh_token');
    localStorage.removeItem('nbh_user');
    setUser(null);
  };

  const updateUser = (updatedProfile) => {
    setUser((prev) => {
      const merged = { ...prev, ...updatedProfile };
      localStorage.setItem('nbh_user', JSON.stringify(merged));
      return merged;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
