import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
import { Week } from './pages/Week';
import { Roadmap } from './pages/Roadmap';
import { Roadmaps } from './pages/Roadmaps';
import { Replan } from './pages/Replan';
import { Settings } from './pages/Settings';
import { Session } from './pages/Session';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useEffect } from 'react';
import { OnboardingGate } from './onboarding/OnboardingGate';
import { RequireOnboarding } from './onboarding/RequireOnboarding';
import { OnboardingProvider } from './onboarding/OnboardingProvider';
import { OnboardingLayout } from './onboarding/OnboardingLayout';
import { MetadataFetcherProvider } from './onboarding/MetadataFetcherContext';
import { SupabaseMetadataFetcher } from './onboarding/supabase-metadata-fetcher';
import { DevMetadataFetcher } from './onboarding/dev-metadata-fetcher';
import type { MetadataFetcher } from './onboarding/metadata-fetcher';
import { Step1Deadline } from './onboarding/steps/Step1Deadline';
import { Step2Hours } from './onboarding/steps/Step2Hours';
import { Step3Materials } from './onboarding/steps/Step3Materials';
import { Step3Preview } from './onboarding/steps/Step3Preview';
import { Step4Confirm } from './onboarding/steps/Step4Confirm';
import BurnUpChartTest from './components/BurnUpChartTest';
import { DevSeeder } from './dev/DevSeeder';

const metadataFetcher: MetadataFetcher = import.meta.env.DEV
  ? new DevMetadataFetcher(supabase)
  : new SupabaseMetadataFetcher(supabase);

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

function OnboardingIndexRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={{ pathname: '/onboarding/1', search: location.search }}
      state={location.state}
      replace
    />
  );
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
      <Route path="/chart-test" element={<BurnUpChartTest />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        element={
          <ProtectedRoute>
            <RequireOnboarding>
              <AppShell />
            </RequireOnboarding>
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/session" element={<Session />} />
        <Route path="/log" element={<Log />} />
        <Route path="/week" element={<Week />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/roadmaps" element={<Roadmaps />} />
        <Route path="/replan" element={<Replan />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingGate>
              <MetadataFetcherProvider fetcher={metadataFetcher}>
                <OnboardingProvider>
                  <OnboardingLayout />
                </OnboardingProvider>
              </MetadataFetcherProvider>
            </OnboardingGate>
          </ProtectedRoute>
        }
      >
        <Route index element={<OnboardingIndexRedirect />} />
        <Route path="1" element={<Step1Deadline />} />
        <Route path="2" element={<Step2Hours />} />
        <Route path="3" element={<Step3Materials />}>
          <Route path="preview" element={<Step3Preview />} />
        </Route>
        <Route path="4" element={<Step4Confirm />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter basename="/study">
      <AuthProvider>
        <EventStoreRouter>
          {import.meta.env.DEV && <DevSeeder />}
          <SyncRouter>
            <div className="app">
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </div>
          </SyncRouter>
        </EventStoreRouter>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
