import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('cc_token');
    const storedUser  = localStorage.getItem('cc_user');
    if (storedToken && storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsed);
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      } catch {
        localStorage.removeItem('cc_token');
        localStorage.removeItem('cc_user');
      }
    }
    setLoading(false);

    // Global 401 interceptor — auto logout on token expiry
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('cc_token');
          localStorage.removeItem('cc_user');
          delete axios.defaults.headers.common['Authorization'];
          setToken(null);
          setUser(null);
          // Redirect to login
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await axios.post(`${API}/login`, { email, password });
    const { token: tok, user: usr } = res.data;
    localStorage.setItem('cc_token', tok);
    localStorage.setItem('cc_user', JSON.stringify(usr));
    axios.defaults.headers.common['Authorization'] = `Bearer ${tok}`;
    setToken(tok);
    setUser(usr);
    return usr;
  }, []);

  const register = useCallback(async (formData) => {
    const res = await axios.post(`${API}/register`, formData);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('cc_token');
    localStorage.removeItem('cc_user');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('cc_user', JSON.stringify(updated));
  }, [user]);

  const isAdmin    = user?.role === 'admin';
  const isOfficer  = user?.role === 'department_officer';
  const isCitizen  = user?.role === 'citizen';

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, register, logout, updateUser,
      isAdmin, isOfficer, isCitizen,
      isAuthenticated: !!user,
      API,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default AuthContext;
