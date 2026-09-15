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
import { lazy, Suspense, useEffect } from 'react';
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
import PracticeGuidePrototype from './prototype/practice-guide/PracticeGuidePrototype';
import RoadmapFeedbackPrototype from './prototype/roadmap-feedback/RoadmapFeedbackPrototype';
import AssessmentReviewPrototype from './prototype/assessment-review/AssessmentReviewPrototype';
import { MaterialsProvider } from './materials/MaterialsProvider';
import { AssessmentProvider } from './assessments/AssessmentProvider';
import { MaterialLibrary } from './pages/materials/MaterialLibrary';
import { MaterialCreate } from './pages/materials/MaterialCreate';
import { MaterialDetail } from './pages/materials/MaterialDetail';
import { PracticeThis } from './pages/materials/PracticeThis';
import { PracticeRun } from './pages/practice/PracticeRun';
import { AssessmentConfig } from './pages/assessments/AssessmentConfig';
import { AssessmentDetail } from './pages/assessments/AssessmentDetail';
import { DevSeeder } from './dev/DevSeeder';

// pdf.js is ~1 MB and only the viewer route needs it, so it stays out of the
// main bundle (and out of the jsdom unit-test graph).
const PdfViewer = lazy(() =>
  import('./materials/PdfViewer').then((module) => ({ default: module.PdfViewer })),
);

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
      {import.meta.env.DEV && (
        <Route path="/practice-prototype" element={<PracticeGuidePrototype />} />
      )}
      {import.meta.env.DEV && (
        <Route path="/roadmap-feedback-prototype" element={<RoadmapFeedbackPrototype />} />
      )}
      {import.meta.env.DEV && (
        <Route
          path="/assessment-review-prototype"
          element={<AssessmentReviewPrototype />}
        />
      )}
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
        <Route path="/materials" element={<MaterialLibrary />} />
        <Route path="/materials/new" element={<MaterialCreate />} />
        <Route path="/materials/:materialId" element={<MaterialDetail />} />
        <Route path="/materials/:materialId/practice" element={<PracticeThis />} />
        <Route path="/materials/:materialId/practice/:runId" element={<PracticeRun />} />
        <Route
          path="/materials/:materialId/view"
          element={
            <Suspense
              fallback={
                <div className="materials-page">
                  <p className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
                    Opening viewer…
                  </p>
                </div>
              }
            >
              <PdfViewer />
            </Suspense>
          }
        />
        <Route path="/materials/:materialId/assessments/new" element={<AssessmentConfig />} />
        <Route path="/assessments/:assessmentId" element={<AssessmentDetail />} />
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
          <MaterialsProvider>
            <AssessmentProvider>
              {import.meta.env.DEV && <DevSeeder />}
              <SyncRouter>
                <div className="app">
                  <ErrorBoundary>
                    <AppRoutes />
                  </ErrorBoundary>
                </div>
              </SyncRouter>
            </AssessmentProvider>
          </MaterialsProvider>
        </EventStoreRouter>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
