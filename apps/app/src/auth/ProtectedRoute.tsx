import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { LoadingState } from '../components/LoadingState';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app">
        <LoadingState title="Getting things ready" sub="Checking your session — one moment." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}