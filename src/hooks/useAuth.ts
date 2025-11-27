// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';

export function useAuth() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) { setUser(null); setLoading(false); return; }
        const data = await res.json();
        setUser(data);
      } catch (err) {
        setUser(null);
        console.error('Failed to fetch user:', err);
      } finally { setLoading(false); }
    })();
  }, []);

  return { user, loading };
}