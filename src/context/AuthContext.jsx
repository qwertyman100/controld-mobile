import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/controld';
import { validateToken } from '../lib/inputPolicy';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('cd_token'));
  const [user, setUser] = useState(null);
  // true while auto-validating a stored token on startup
  const [loading, setLoading] = useState(() => !!localStorage.getItem('cd_token'));
  const [authError, setAuthError] = useState(null);

  const logout = useCallback(() => {
    localStorage.removeItem('cd_token');
    setToken(null);
    setUser(null);
    setAuthError(null);
  }, []);

  const login = useCallback(async (apiToken) => {
    setAuthError(null);
    // Validate against the allowlist policy BEFORE the token touches the network:
    // reject malformed / injection-shaped input loudly, then use the trimmed,
    // validated value everywhere after.
    const check = validateToken(apiToken);
    if (!check.ok) {
      setAuthError(check.error);
      return false;
    }
    try {
      const body = await api.getUser(check.value);
      const userData = body?.user ?? body;
      localStorage.setItem('cd_token', check.value);
      setToken(check.value);
      setUser(userData);
      return true;
    } catch (err) {
      setAuthError(err.message);
      return false;
    }
  }, []);

  // Auto-validate stored token on first mount
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    // Defense-in-depth: re-validate the token restored from localStorage against the
    // allowlist policy before use — a poisoned/malformed stored value is logged out
    // rather than sent to the network.
    const check = validateToken(token);
    if (!check.ok) {
      logout();
      setLoading(false);
      return;
    }
    api.getUser(check.value)
      .then((body) => setUser(body?.user ?? body))
      .catch((err) => {
        // Only force re-login on definitive auth failures, not network errors
        const msg = err.message ?? '';
        const isAuthError =
          msg.includes('401') ||
          msg.includes('403') ||
          msg.toLowerCase().includes('unauthorized') ||
          msg.toLowerCase().includes('invalid token') ||
          msg.toLowerCase().includes('invalid api key');
        if (isAuthError) logout();
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ token, user, loading, authError, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
