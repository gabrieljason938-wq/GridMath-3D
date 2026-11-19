import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Box,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FileText,
  FlaskConical,
  LogOut,
  Menu,
  Pause,
  Play,
  RefreshCw,
  Sigma,
  TrendingUp,
  X,
} from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';
import { ThemeSelector } from './ThemeSelector';

interface NavRouteItem {
  to: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ROUTES: NavRouteItem[] = [
  { to: '/dashboard', label: 'Command Center', shortLabel: 'Command', icon: Activity },
  { to: '/smart-city', label: '3D Digital Twin', shortLabel: '3D Twin', icon: Box },
  { to: '/mathematics', label: 'Mathematics Lab', shortLabel: 'Math Lab', icon: Sigma },
  { to: '/forecasting', label: 'Demand Forecasting', shortLabel: 'Forecast', icon: TrendingUp },
  { to: '/dispatch', label: 'Optimal Dispatch', shortLabel: 'Dispatch', icon: Cpu },
  { to: '/experiments', label: 'Experiments & Twin', shortLabel: 'Experiments', icon: FlaskConical },
  { to: '/reports', label: 'Scientific Reports', shortLabel: 'Reports', icon: FileText },
];

const ROUTE_TITLES: Record<string, { title: string; section: string }> = {
  '/dashboard': { title: 'Engineering Command Center', section: 'Grid Overview' },
  '/smart-city': { title: 'Interactive 3D Digital Twin', section: 'Spatial Telemetry' },
  '/mathematics': { title: 'Numerical Mathematics Laboratory', section: 'Solver Core' },
  '/forecasting': { title: 'Electricity Demand Forecasting', section: 'Time-Series Lab' },
  '/dispatch': { title: 'Optimal Energy Dispatch', section: 'Economic Optimization' },
  '/experiments': { title: 'Scientific Experimentation & Twin', section: 'Research Bench' },
  '/reports': { title: 'Academic Capstone Reports', section: 'Documentation' },
};

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const sidebarCollapsed = useSimulationStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useSimulationStore((s) => s.toggleSidebar);
  const scenarios = useSimulationStore((s) => s.scenarios);
  const activeScenarioId = useSimulationStore((s) => s.activeScenarioId);
  const activeHour = useSimulationStore((s) => s.activeHour);
  const isPlaying = useSimulationStore((s) => s.isPlaying);
  const playbackSpeed = useSimulationStore((s) => s.playbackSpeed);
  const setScenario = useSimulationStore((s) => s.setScenario);
  const stepHour = useSimulationStore((s) => s.stepHour);
  const playSimulation = useSimulationStore((s) => s.playSimulation);
  const pauseSimulation = useSimulationStore((s) => s.pauseSimulation);
  const recomputeSimulation = useSimulationStore((s) => s.recomputeSimulation);
  const exitSessionToLanding = useSimulationStore((s) => s.exitSessionToLanding);
  const isComputing = useSimulationStore((s) => s.isComputing);

  // Single global deterministic simulation clock independent of R3F render frame rate
  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = Math.max(250, Math.round(1200 / playbackSpeed));
    const timer = window.setInterval(() => {
      stepHour(1);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, stepHour]);

  // Close logout modal with Escape key
  useEffect(() => {
    if (!logoutDialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLogoutDialogOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [logoutDialogOpen]);

  const routeMeta = ROUTE_TITLES[location.pathname] ?? ROUTE_TITLES['/dashboard'];

  const handleOpenLogoutDialog = () => {
    setMobileMenuOpen(false);
    setLogoutDialogOpen(true);
  };

  const handleConfirmLogout = () => {
    setLogoutDialogOpen(false);
    exitSessionToLanding();
    navigate('/');
  };

  const renderBrand = (collapsed: boolean) => (
    <div className="flex h-16 items-center justify-between border-b border-[#E2E8F0] px-4 dark:border-[#334155]">
      <Link
        to="/"
        aria-label="Return to GRIDMATH 3D landing page"
        className="flex items-center gap-2.5 overflow-hidden transition-opacity hover:opacity-80"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#2563EB]/20 bg-[#2563EB]/8 text-[#2563EB] dark:border-[#60A5FA]/30 dark:bg-[#60A5FA]/10 dark:text-[#60A5FA]">
          <BarChart3 className="h-4 w-4" />
        </div>
        {!collapsed ? (
          <span className="truncate text-sm font-bold tracking-tight text-[#0F172A] whitespace-nowrap dark:text-[#F8FAFC]">
            GRIDMATH 3D
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] lg:inline-flex dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-[#F8FAFC]"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
    </div>
  );

  const renderNavLinks = (collapsed: boolean, onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary Workspace Navigation">
      {NAV_ROUTES.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap ${
                isActive
                  ? 'bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#60A5FA]/15 dark:text-[#60A5FA]'
                  : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-[#F8FAFC]'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0B1220] dark:text-[#F8FAFC]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[#2563EB] focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-[#E2E8F0] bg-[#FFFFFF] transition-all duration-200 lg:flex print:hidden dark:border-[#334155] dark:bg-[#172033] ${
          sidebarCollapsed ? 'w-[68px]' : 'w-[248px]'
        }`}
      >
        {renderBrand(sidebarCollapsed)}
        {renderNavLinks(sidebarCollapsed)}
        {!sidebarCollapsed ? (
          <div className="border-t border-[#E2E8F0] p-4 text-xs text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">
            <p className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
              Unified Twin State Active
            </p>
            <p className="mt-1 leading-relaxed">
              Units standardized: MW · MWh · INR/MWh · tCO₂e
            </p>
          </div>
        ) : null}
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex w-72 flex-col border-r border-[#E2E8F0] bg-[#FFFFFF] dark:border-[#334155] dark:bg-[#172033]">
            <div className="flex h-16 items-center justify-between border-b border-[#E2E8F0] px-4 dark:border-[#334155]">
              <span className="text-sm font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                GRIDMATH 3D
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-md p-1.5 text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderNavLinks(false, () => setMobileMenuOpen(false))}
            <div className="space-y-3 border-t border-[#E2E8F0] p-4 dark:border-[#334155]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                  Theme
                </span>
                <ThemeSelector />
              </div>
              <button
                type="button"
                onClick={handleOpenLogoutDialog}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#0F172A] transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:hover:border-red-500/40 dark:hover:bg-red-950/40 dark:hover:text-red-300"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out to Landing</span>
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Toolbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#E2E8F0] bg-[#FFFFFF] px-4 sm:px-6 print:hidden dark:border-[#334155] dark:bg-[#172033]">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A] lg:hidden dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC]"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-[#64748B] sm:inline whitespace-nowrap dark:text-[#94A3B8]">
                {routeMeta.section}
              </span>
              <span
                className="hidden text-[#CBD5E1] sm:inline dark:text-[#475569]"
                aria-hidden="true"
              >
                /
              </span>
              <h1 className="truncate font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                {routeMeta.title}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor="global-scenario-select" className="sr-only">
              Active Synthetic Scenario
            </label>
            <select
              id="global-scenario-select"
              value={activeScenarioId}
              onChange={(e) => setScenario(e.target.value)}
              className="h-9 max-w-[190px] truncate rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:outline-none xl:max-w-[220px] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:focus:border-[#60A5FA]"
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <span className="hidden font-mono-tabular text-xs text-[#64748B] xl:inline whitespace-nowrap dark:text-[#94A3B8]">
              t = {activeHour.toString().padStart(2, '0')}:00
            </span>

            <button
              type="button"
              onClick={() => (isPlaying ? pauseSimulation() : playSimulation())}
              aria-label={isPlaying ? 'Pause digital twin clock' : 'Play digital twin clock'}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isPlaying
                  ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] dark:border-[#60A5FA] dark:bg-[#60A5FA]/15 dark:text-[#60A5FA]'
                  : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]'
              }`}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">
                {isPlaying ? `Pause (${playbackSpeed}×)` : 'Play'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => recomputeSimulation('Topbar Recalculate')}
              disabled={isComputing}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Recalculate</span>
              <span className="md:hidden">Sync</span>
            </button>

            <ThemeSelector compact className="hidden sm:inline-flex" />

            <button
              type="button"
              onClick={handleOpenLogoutDialog}
              aria-label="Log out and return to landing page"
              title="Log Out"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 text-xs font-medium text-[#64748B] transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 whitespace-nowrap shrink-0 dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#94A3B8] dark:hover:border-red-500/40 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Log Out</span>
            </button>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8 print:p-0">
          {children}
        </main>
      </div>

      {/* Logout Confirmation Dialog */}
      {logoutDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
          aria-describedby="logout-dialog-description"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setLogoutDialogOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-xl dark:border-[#334155] dark:bg-[#172033]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-400">
                  <LogOut className="h-4 w-4" />
                </span>
                <h2
                  id="logout-dialog-title"
                  className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  Log Out to Landing Page?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setLogoutDialogOpen(false)}
                aria-label="Close confirmation dialog"
                className="rounded-md p-1 text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p
              id="logout-dialog-description"
              className="mt-3 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]"
            >
              Active scenario overrides (weather perturbations, fleet overrides, forecast coupling, and playback state) will be reset to defaults before returning to the landing page. Your pinned scientific experiments will remain preserved.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setLogoutDialogOpen(false)}
                className="inline-flex h-9 items-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 text-xs font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Confirm Log Out</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
