import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudRain,
  Layers,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Sunset,
} from 'lucide-react';
import { HourlyProfileChart } from '../components/HourlyProfileChart';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { SelectedZoneInspector } from '../components/three/SelectedZoneInspector';
import { SmartCityViewport } from '../components/three/SmartCityViewport';
import { CITY_NODE_CATALOG } from '../data/syntheticMicrogrid';
import { useSimulationStore } from '../store/useSimulationStore';
import type { EnvironmentMode, PlaybackSpeed, RenderQuality } from '../types/grid';

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 2, 4];
const QUALITY_OPTIONS: { id: RenderQuality; label: string }[] = [
  { id: 'high', label: 'High' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'low', label: 'Low' },
];
const ENVIRONMENT_OPTIONS: { id: EnvironmentMode; label: string; Icon: typeof Sun }[] = [
  { id: 'day', label: 'Day', Icon: Sun },
  { id: 'sunset', label: 'Sunset', Icon: Sunset },
  { id: 'night', label: 'Night', Icon: Moon },
  { id: 'cloudy', label: 'Cloudy', Icon: Cloud },
  { id: 'rainy', label: 'Rainy', Icon: CloudRain },
];

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
}

export function DashboardPage() {
  const activeScenario = useSimulationStore((s) => s.activeScenario);
  const activeHour = useSimulationStore((s) => s.activeHour);
  const activeDispatch = useSimulationStore((s) => s.activeDispatch);
  const activeHourlyDemand = useSimulationStore((s) => s.activeHourlyDemand);
  const daySummary = useSimulationStore((s) => s.daySummary);
  const forecastResult = useSimulationStore((s) => s.forecastResult);
  const dispatchBundle = useSimulationStore((s) => s.dispatchBundle);
  const validationReport = useSimulationStore((s) => s.validationReport);
  const selectedNodeId = useSimulationStore((s) => s.selectedNodeId);
  const isComputing = useSimulationStore((s) => s.isComputing);
  const isPlaying = useSimulationStore((s) => s.isPlaying);
  const playbackSpeed = useSimulationStore((s) => s.playbackSpeed);
  const renderQuality = useSimulationStore((s) => s.renderQuality);
  const environmentMode = useSimulationStore((s) => s.environmentMode);
  const lastComputeMs = useSimulationStore((s) => s.lastComputeMs);
  const setActiveHour = useSimulationStore((s) => s.setActiveHour);
  const stepHour = useSimulationStore((s) => s.stepHour);
  const playSimulation = useSimulationStore((s) => s.playSimulation);
  const pauseSimulation = useSimulationStore((s) => s.pauseSimulation);
  const resetSimulation = useSimulationStore((s) => s.resetSimulation);
  const setPlaybackSpeed = useSimulationStore((s) => s.setPlaybackSpeed);
  const setRenderQuality = useSimulationStore((s) => s.setRenderQuality);
  const setEnvironmentMode = useSimulationStore((s) => s.setEnvironmentMode);
  const setSelectedNode = useSimulationStore((s) => s.setSelectedNode);

  const selectedNode = CITY_NODE_CATALOG.find((n) => n.id === selectedNodeId) ?? null;

  const balanceTone =
    activeDispatch.balanceStatus === 'Deficit'
      ? 'deficit'
      : activeDispatch.balanceStatus === 'Surplus'
        ? 'info'
        : 'nominal';

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* Dataset Provenance & Time-Step Control Header */}
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 lg:flex-row lg:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <span className="font-medium text-[#2563EB] dark:text-[#60A5FA]">Synthetic Baseline Dataset</span>
            <span aria-hidden="true">·</span>
            <span>{activeScenario.regionLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{validationReport.valid ? 'Schema Validated' : 'Validation Warning'}</span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
            {activeScenario.name}
          </h2>
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">{activeScenario.subtitle}</p>
        </div>

        {/* Interactive 24-Hour Time Scrubber & Deterministic Playback Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] px-2.5 py-1.5">
            <button
              type="button"
              onClick={() => (isPlaying ? pauseSimulation() : playSimulation())}
              aria-label={isPlaying ? 'Pause simulation playback' : 'Play simulation playback'}
              className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isPlaying
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#FFFFFF] dark:bg-[#172033] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#1E293B]'
              }`}
            >
              {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <div className="flex items-center rounded-md border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-0.5 text-[11px]">
              {SPEED_OPTIONS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`rounded px-1.5 py-0.5 font-mono-tabular transition-colors ${
                    playbackSpeed === spd
                      ? 'bg-[#EFF6FF] dark:bg-[#60A5FA]/15 font-semibold text-[#2563EB] dark:text-[#60A5FA]'
                      : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                  }`}
                >
                  {spd}×
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={resetSimulation}
              aria-label="Reset digital twin state"
              className="rounded p-1 text-[#64748B] dark:text-[#94A3B8] transition-colors hover:bg-[#FFFFFF] dark:hover:bg-[#172033] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
              title="Reset scenario simulation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] px-3 py-2">
            <button
              type="button"
              onClick={() => {
                pauseSimulation();
                stepHour(-1);
              }}
              aria-label="Previous hour"
              className="rounded p-1 text-[#64748B] dark:text-[#94A3B8] transition-colors hover:bg-[#FFFFFF] dark:hover:bg-[#172033] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3">
              <span className="font-mono-tabular text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap">
                {activeDispatch.timestampLabel} IST
              </span>
              <input
                type="range"
                min={0}
                max={23}
                value={activeHour}
                onChange={(e) => {
                  pauseSimulation();
                  setActiveHour(Number(e.target.value));
                }}
                aria-label="Simulation hour slider"
                className="h-1.5 w-24 cursor-pointer accent-[#2563EB] sm:w-36"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                pauseSimulation();
                stepHour(1);
              }}
              aria-label="Next hour"
              className="rounded p-1 text-[#64748B] dark:text-[#94A3B8] transition-colors hover:bg-[#FFFFFF] dark:hover:bg-[#172033] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Link
            to="/smart-city"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-3.5 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] transition-colors hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] whitespace-nowrap shrink-0"
          >
            <Layers className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
            Full 3D Twin
            <ArrowUpRight className="h-3.5 w-3.5 text-[#64748B] dark:text-[#94A3B8]" />
          </Link>
        </div>
      </section>

      {/* Primary Telemetry KPI Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Predicted Peak Demand"
          value={daySummary.predictedPeakDemandMW.toFixed(1)}
          unit="MW"
          accentColor="primary"
          loading={isComputing}
          detail={`Daily peak at ${daySummary.peakDemandHour.toString().padStart(2, '0')}:00`}
        />
        <MetricCard
          label="Simulated Demand"
          value={activeDispatch.totalDemandMW.toFixed(1)}
          unit="MW"
          loading={isComputing}
          detail={`Tariff ₹${formatInr(activeHourlyDemand.tariffInrPerMWh)}/MWh`}
        />
        <MetricCard
          label="Available Generation"
          value={activeDispatch.totalAvailableGenerationMW.toFixed(1)}
          unit="MW"
          accentColor="secondary"
          loading={isComputing}
          detail={`Reserve margin ${activeDispatch.reserveMarginMW.toFixed(1)} MW`}
        />
        <MetricCard
          label="Renewable Contribution"
          value={activeDispatch.renewableContributionPercent.toFixed(1)}
          unit="%"
          accentColor="renewable"
          loading={isComputing}
          detail={`${activeDispatch.renewableGenerationMW.toFixed(1)} MW clean output`}
        />
        <MetricCard
          label="Hourly Dispatch Cost"
          value={`₹${formatInr(activeDispatch.dispatchCostInr)}`}
          unit="INR"
          loading={isComputing}
          detail={`24h total ₹${formatInr(daySummary.totalDailyCostInr)}`}
        />
        <MetricCard
          label="Carbon Emissions"
          value={activeDispatch.emissionsTonnesCO2e.toFixed(2)}
          unit="tCO₂e/h"
          loading={isComputing}
          detail={`${formatInr(activeDispatch.emissionsKgCO2e)} kgCO₂e this hour`}
        />
      </section>

      {/* Hero Stage: Interactive 3D Smart City Preview + Subsystem Status Column */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Large Interactive 3D Smart City Preview */}
        <div className="flex flex-col rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 xl:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Smart City Architectural Twin Preview
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Drag to orbit · Scroll to zoom · Click substations or districts to inspect live load &amp; generation
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                Renewable Feed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#06B6D4]" />
                Grid Flow
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                Peak &amp; Thermal
              </span>
              <div
                role="group"
                aria-label="Preview Weather and Time Mode"
                className="flex items-center rounded-md border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] p-0.5 text-[11px]"
              >
                {ENVIRONMENT_OPTIONS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={environmentMode === id}
                    onClick={() => setEnvironmentMode(id)}
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-colors whitespace-nowrap shrink-0 ${
                      environmentMode === id
                        ? 'bg-[#FFFFFF] dark:bg-[#172033] font-semibold text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                        : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
              <div
                role="group"
                aria-label="3D Viewport Quality"
                className="flex items-center rounded-md border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] p-0.5 text-[11px]"
              >
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    aria-pressed={renderQuality === q.id}
                    onClick={() => setRenderQuality(q.id)}
                    className={`rounded px-1.5 py-0.5 font-medium transition-colors whitespace-nowrap shrink-0 ${
                      renderQuality === q.id
                        ? 'bg-[#FFFFFF] dark:bg-[#172033] font-semibold text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                        : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <SmartCityViewport
            dispatch={activeDispatch}
            hourlyDemand={activeHourlyDemand}
            environmentMode={environmentMode}
            selectedZone={selectedNodeId}
            onSelectZone={setSelectedNode}
            showFlowVectors={true}
            showLabels={true}
            className="h-[440px] w-full lg:h-[500px]"
          />

          {/* Selected 3D Zone Inspection Bar */}
          <div className="mt-4 border-t border-[#E2E8F0] dark:border-[#334155] pt-3.5">
            {selectedNode ? (
              <SelectedZoneInspector
                zoneId={selectedNode.id}
                dispatch={activeDispatch}
                hourlyDemand={activeHourlyDemand}
                onClose={() => setSelectedNode(null)}
                variant="inline"
              />
            ) : (
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                No 3D zone selected — click any building cluster, hospital, turbine, solar array, BESS bank, or substation in the orthographic isometric viewport.
              </span>
            )}
          </div>
        </div>

        {/* Subsystem Status & Live Fleet Summary */}
        <div className="flex flex-col gap-4 xl:col-span-4">
          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Grid Balance Status</span>
              <StatusBadge tone={balanceTone} label={activeDispatch.balanceStatus} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 border-t border-[#E2E8F0] dark:border-[#334155] pt-3 text-xs">
              <div>
                <p className="text-[#64748B] dark:text-[#94A3B8]">Dispatched Supply</p>
                <p className="mt-0.5 font-mono-tabular text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {activeDispatch.totalDispatchedGenerationMW.toFixed(1)} MW
                </p>
              </div>
              <div>
                <p className="text-[#64748B] dark:text-[#94A3B8]">BESS Net Power</p>
                <p className="mt-0.5 font-mono-tabular text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {activeDispatch.batteryNetPowerMW >= 0 ? '+' : ''}
                  {activeDispatch.batteryNetPowerMW.toFixed(1)} MW
                </p>
              </div>
              <div>
                <p className="text-[#64748B] dark:text-[#94A3B8]">BESS Energy SoC</p>
                <p className="mt-0.5 font-mono-tabular text-sm font-semibold text-[#06B6D4] dark:text-[#22D3EE]">
                  {activeDispatch.batterySocMWh.toFixed(1)} MWh ({activeDispatch.batterySocPercent.toFixed(0)}%)
                </p>
              </div>
              <div>
                <p className="text-[#64748B] dark:text-[#94A3B8]">Unserved Load</p>
                <p className="mt-0.5 font-mono-tabular text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {activeDispatch.unservedEnergyMW.toFixed(2)} MW
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Forecasting Model Status</span>
              <StatusBadge tone="info" label={forecastResult.modelStatus} />
            </div>
            <p className="mt-2 text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{forecastResult.modelName}</p>
            <div className="mt-3 grid grid-cols-3 gap-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-3 text-xs">
              <div>
                <p className="text-[#64748B] dark:text-[#94A3B8]">MAPE</p>
                <p className="mt-0.5 font-mono-tabular font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {forecastResult.mapePercent.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-[#64748B] dark:text-[#94A3B8]">RMSE</p>
                <p className="mt-0.5 font-mono-tabular font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {forecastResult.rmseMW.toFixed(1)} MW
                </p>
              </div>
              <div>
                <p className="text-[#64748B] dark:text-[#94A3B8]">R² Fit</p>
                <p className="mt-0.5 font-mono-tabular font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {forecastResult.rSquared.toFixed(3)}
                </p>
              </div>
            </div>
            <Link
              to="/forecasting"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] dark:text-[#60A5FA] hover:underline"
            >
              Inspect Forecasting Lab
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Numerical Solver Status</span>
              <StatusBadge
                tone={
                  activeDispatch.solverStatus === 'Constraint Infeasible'
                    ? 'deficit'
                    : activeDispatch.solverStatus === 'Heuristic Active'
                      ? 'info'
                      : 'nominal'
                }
                label={activeDispatch.solverStatus}
              />
            </div>
            <p className="mt-2 text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{activeDispatch.solverName}</p>
            <p className="mt-1 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
              Multi-period 24h Two-Phase Bounded Simplex LP ({dispatchBundle.numVariables} vars ×{' '}
              {dispatchBundle.numConstraints} eqs) converged in {lastComputeMs} ms · Max balance residual{' '}
              {dispatchBundle.residualSummary.maxPowerBalanceResidualMW.toExponential(1)} MW.
            </p>
            <div className="mt-3 flex items-center gap-4 border-t border-[#E2E8F0] dark:border-[#334155] pt-3 text-xs">
              <Link
                to="/dispatch"
                className="inline-flex items-center gap-1 font-medium text-[#2563EB] dark:text-[#60A5FA] hover:underline"
              >
                Dispatch Matrix
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/experiments"
                className="inline-flex items-center gap-1 font-medium text-[#2563EB] dark:text-[#60A5FA] hover:underline"
              >
                Scenario Controls
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 24-Hour Load & Generation Profile */}
      <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              24-Hour Demand &amp; Generation Trajectory
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Click any hourly column to synchronize KPIs and the 3D digital twin to that time step
            </p>
          </div>
          <span className="font-mono-tabular text-xs text-[#64748B] dark:text-[#94A3B8]">
            Daily Energy: {daySummary.totalDailyEnergyMWh.toFixed(1)} MWh · Avg RE:{' '}
            {daySummary.averageRenewableSharePercent.toFixed(1)}%
          </span>
        </div>

        <HourlyProfileChart
          dispatches={daySummary.hourlyDispatches}
          activeHour={activeHour}
          onSelectHour={setActiveHour}
        />
      </section>
    </div>
  );
}
