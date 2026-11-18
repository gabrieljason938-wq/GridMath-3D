import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/ToastContainer';

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
      className="mx-auto flex min-h-[340px] max-w-[1440px] flex-col items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 text-center"
    >
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#2563EB]" />
      <p className="mt-3 text-sm font-medium text-[#0F172A]">Loading Engineering Module</p>
      <p className="mt-1 text-xs text-[#64748B]">
        Preparing numerical solvers and architectural workspace…
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary
        title="Application Shell Recovery"
        fallbackDescription="GRIDMATH 3D encountered an unexpected view error."
      >
        <AppShell>
          <ErrorBoundary>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/smart-city" element={<SmartCityPage />} />
                <Route path="/mathematics" element={<MathematicsPage />} />
                <Route path="/forecasting" element={<ForecastingPage />} />
                <Route path="/dispatch" element={<DispatchPage />} />
                <Route path="/experiments" element={<ExperimentsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AppShell>
        <ToastContainer />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
