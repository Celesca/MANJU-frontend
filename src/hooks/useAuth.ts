import { useEffect, useState } from 'react';

type User = { id: string; email: string; name?: string } | null;

export function useAuth() {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const API_BASE = (import.meta.env.VITE_API_URL as string) || '';
        const url = API_BASE ? `${API_BASE}/auth/me` : '/auth/me';
        const res = await fetch(url, { credentials: 'include' });
        if (!mounted) return;
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = await res.json();
        setUser(data as User);
      } catch (err) {
        setUser(null);
        console.error('useAuth fetch error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return { user, loading } as const;
}

export default useAuth;