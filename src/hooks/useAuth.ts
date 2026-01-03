import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { authStore } from '../stores/authStore';

type User = { id: string; email: string; name?: string; picture?: string } | null;

export function useAuth() {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    if (!authStore.hasToken()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const API_BASE = (import.meta.env.VITE_API_URL as string) || '';
      const url = API_BASE ? `${API_BASE}/auth/me` : '/auth/me';
      const res = await apiFetch(url);

      if (!res.ok) {
        // Token is invalid, clear it
        authStore.clearToken();
        setUser(null);
        return;
      }

      const data = await res.json();
      setUser(data as User);
    } catch (err) {
      console.error('useAuth fetch error:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Token extraction is handled in main.tsx before React renders
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(() => {
    authStore.clearToken();
    setUser(null);
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchUser();
  }, [fetchUser]);

  return { user, loading, logout, refetch } as const;
}

export default useAuth;