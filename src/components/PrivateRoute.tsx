// src/components/PrivateRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { JSX } from 'react';

export default function PrivateRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Checking authentication...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}