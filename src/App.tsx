import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/ToastContainer';

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const SmartCityPage = lazy(() =>
  import('./pages/SmartCityPage').then((m) => ({ default: m.SmartCityPage })),
);
const MathematicsPage = lazy(() =>
  import('./pages/MathematicsPage').then((m) => ({ default: m.MathematicsPage })),
);
const ForecastingPage = lazy(() =>
  import('./pages/ForecastingPage').then((m) => ({ default: m.ForecastingPage })),
);
const DispatchPage = lazy(() =>
  import('./pages/DispatchPage').then((m) => ({ default: m.DispatchPage })),
);
const ExperimentsPage = lazy(() =>
  import('./pages/ExperimentsPage').then((m) => ({ default: m.ExperimentsPage })),
);
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex min-h-[340px] max-w-[1440px] flex-col items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 text-center dark:border-[#334155] dark:bg-[#172033]"
    >
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#2563EB] dark:border-[#334155] dark:border-t-[#60A5FA]" />
      <p className="mt-3 text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC]">
        Loading Engineering Module
      </p>
      <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
        Preparing numerical solvers and architectural workspace…
      </p>
    </div>
  );
}

function WorkspaceLayout() {
  return (
    <AppShell>
      <ErrorBoundary>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary
        title="Application Shell Recovery"
        fallbackDescription="GRIDMATH 3D encountered an unexpected view error."
      >
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route element={<WorkspaceLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/smart-city" element={<SmartCityPage />} />
              <Route path="/mathematics" element={<MathematicsPage />} />
              <Route path="/forecasting" element={<ForecastingPage />} />
              <Route path="/dispatch" element={<DispatchPage />} />
              <Route path="/experiments" element={<ExperimentsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <ToastContainer />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
