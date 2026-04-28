import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuthContext } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { EventStoreProvider, useEventStoreContext } from './events/EventStoreProvider';
import { SyncProvider } from './sync/SyncProvider';
import type { SupabaseClientLike } from './sync/types';
import { supabase, supabaseUrl } from './lib/supabase';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { Home } from './pages/Home';
import { AuthConfirmed } from './pages/AuthConfirmed';
import { ResetPassword } from './pages/ResetPassword';
import { Log } from './pages/Log';
import { useEffect } from 'react';

function EventStoreRouter({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  return (
    <EventStoreProvider userId={user?.id ?? null}>
      {children}
    </EventStoreProvider>
  );
}

function SyncRouter({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const { eventStore, ready } = useEventStoreContext();

  if (!user || !ready || !eventStore) {
    return <>{children}</>;
  }

  return (
    <SyncProvider supabase={supabase as unknown as SupabaseClientLike} supabaseUrl={supabaseUrl} userId={user.id} eventStore={eventStore}>
      {children}
    </SyncProvider>
  );
}

function RootRedirect() {
  const { user, loading } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (user) {
        navigate('/home', { replace: true });
      } else {
        navigate('/sign-in', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="app">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <p className="t-body">Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}

function PublicRouteWithAuthCheck({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/home', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="app">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <p className="t-body">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route
        path="/sign-in"
        element={
          <PublicRouteWithAuthCheck>
            <SignIn />
          </PublicRouteWithAuthCheck>
        }
      />
      <Route
        path="/sign-up"
        element={
          <PublicRouteWithAuthCheck>
            <SignUp />
          </PublicRouteWithAuthCheck>
        }
      />
      <Route path="/auth-confirmed" element={<AuthConfirmed />} />
      <Route
        path="/reset-password"
        element={
          <PublicRouteWithAuthCheck>
            <ResetPassword />
          </PublicRouteWithAuthCheck>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/log"
        element={
          <ProtectedRoute>
            <Log />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter basename="/study">
      <AuthProvider>
        <EventStoreRouter>
          <SyncRouter>
            <div className="app">
              <AppRoutes />
            </div>
          </SyncRouter>
        </EventStoreRouter>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;