import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { ScientificExperimentWorkspace } from '../components/experiments/ScientificExperimentWorkspace';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { evaluateScenarioComparisonMatrix } from '../simulation/digitalTwinPipeline';
import { useSimulationStore } from '../store/useSimulationStore';
import type { PlaybackSpeed, WeatherControls } from '../types/grid';

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
}

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 2, 4];

export function ExperimentsPage() {
  const [workspaceTab, setWorkspaceTab] = useState<'scientific' | 'scenarios'>('scientific');
  const scenarios = useSimulationStore((s) => s.scenarios);
  const activeScenarioId = useSimulationStore((s) => s.activeScenarioId);
  const activeScenario = useSimulationStore((s) => s.activeScenario);
  const activeHour = useSimulationStore((s) => s.activeHour);
  const simulationTimestampIso = useSimulationStore((s) => s.simulationTimestampIso);
  const isPlaying = useSimulationStore((s) => s.isPlaying);
  const playbackSpeed = useSimulationStore((s) => s.playbackSpeed);
  const weatherControls = useSimulationStore((s) => s.weatherControls);
  const generatorOverrides = useSimulationStore((s) => s.generatorOverrides);
  const batteryInitialSocOverrideMWh = useSimulationStore((s) => s.batteryInitialSocOverrideMWh);
  const useForecastDrivenDemand = useSimulationStore((s) => s.useForecastDrivenDemand);
  const dispatchConfig = useSimulationStore((s) => s.dispatchConfig);
  const dispatchBundle = useSimulationStore((s) => s.dispatchBundle);
  const daySummary = useSimulationStore((s) => s.daySummary);
  const lastComputeMs = useSimulationStore((s) => s.lastComputeMs);
  const calculationHistory = useSimulationStore((s) => s.calculationHistory);

  const setScenario = useSimulationStore((s) => s.setScenario);
  const playSimulation = useSimulationStore((s) => s.playSimulation);
  const pauseSimulation = useSimulationStore((s) => s.pauseSimulation);
  const resetSimulation = useSimulationStore((s) => s.resetSimulation);
  const setPlaybackSpeed = useSimulationStore((s) => s.setPlaybackSpeed);
  const updateWeatherControls = useSimulationStore((s) => s.updateWeatherControls);
  const resetWeatherControls = useSimulationStore((s) => s.resetWeatherControls);
  const updateGeneratorOverride = useSimulationStore((s) => s.updateGeneratorOverride);
  const resetGeneratorOverrides = useSimulationStore((s) => s.resetGeneratorOverrides);
  const setBatteryInitialSocOverride = useSimulationStore((s) => s.setBatteryInitialSocOverride);
  const setUseForecastDrivenDemand = useSimulationStore((s) => s.setUseForecastDrivenDemand);

  // Local draft weather state + 90ms debounce to avoid redundant LP solves while dragging sliders
  const [draftWeather, setDraftWeather] = useState<WeatherControls>(weatherControls);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setDraftWeather(weatherControls);
  }, [weatherControls]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const scheduleWeatherCommit = (next: WeatherControls, label: string) => {
    setDraftWeather(next);
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      updateWeatherControls(next, label);
    }, 90);
  };

  // Memoized 8-scenario LP comparison matrix (updates only when scenarios or dispatch objective rules change)
  const benchmarkRows = useMemo(() => {
    return evaluateScenarioComparisonMatrix(scenarios, dispatchConfig);
  }, [scenarios, dispatchConfig]);

  const activeBatteryInit =
    batteryInitialSocOverrideMWh ?? activeScenario.battery.initialSocMWh;
  const minSocMWh = activeScenario.battery.capacityMWh * activeScenario.battery.minSocRatio;
  const maxSocMWh = activeScenario.battery.capacityMWh * activeScenario.battery.maxSocRatio;

  const totalUnservedMWh = daySummary.hourlyDispatches.reduce(
    (a, h) => a + h.unservedEnergyMW,
    0,
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* Workspace Mode Segmented Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-5 py-3.5">
        <div className="flex items-center gap-1 rounded-lg bg-[#F8FAFC] dark:bg-[#0B1220] p-1">
          <button
            type="button"
            onClick={() => setWorkspaceTab('scientific')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              workspaceTab === 'scientific'
                ? 'bg-[#FFFFFF] dark:bg-[#172033] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            Scientific Experiment Suite (8)
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceTab('scenarios')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              workspaceTab === 'scenarios'
                ? 'bg-[#FFFFFF] dark:bg-[#172033] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            Unified Twin Scenarios &amp; History
          </button>
        </div>

        <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          Active Twin: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{activeScenario.name}</strong> ·{' '}
          <span className="font-mono-tabular">t = {activeHour.toString().padStart(2, '0')}:00</span>
        </div>
      </div>

      {workspaceTab === 'scientific' ? (
        <ScientificExperimentWorkspace />
      ) : (
        <>
          {/* Unified Twin Control & Deterministic Playback Header */}
          <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  <span className="font-medium text-[#2563EB] dark:text-[#60A5FA]">Single Authoritative Twin State</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{simulationTimestampIso}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">Recalculated in {lastComputeMs} ms</span>
                </div>
                <h2 className="text-lg font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  Scenario Simulation, Weather Perturbations &amp; Calculation History
                </h2>
                <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
              Every scenario override, weather shift, and generator capacity adjustment propagates deterministically through Householder QR forecasting, Two-Phase Bounded Simplex LP optimization, and the 3D Smart City Digital Twin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => (isPlaying ? pauseSimulation() : playSimulation())}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isPlaying
                  ? 'border-[#2563EB] dark:border-[#60A5FA] bg-[#EFF6FF] dark:bg-[#60A5FA]/15 text-[#2563EB] dark:text-[#60A5FA]'
                  : 'border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
              }`}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? 'Pause' : 'Play Cycle'}
            </button>

            <div className="flex items-center rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] p-0.5 text-xs">
              {SPEED_OPTIONS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`rounded-md px-2 py-1 font-mono-tabular transition-colors ${
                    playbackSpeed === spd
                      ? 'bg-[#FFFFFF] dark:bg-[#172033] font-semibold text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
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
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-3 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#64748B] dark:text-[#94A3B8]" />
              Reset Twin
            </button>

            <Link
              to="/smart-city"
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#2563EB] px-3.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              View 3D City
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Active KPI Telemetry Strip */}
        <div className="grid grid-cols-2 gap-4 border-t border-[#E2E8F0] dark:border-[#334155] pt-4 sm:grid-cols-4">
          <MetricCard
            label="Active Peak Demand"
            value={daySummary.predictedPeakDemandMW.toFixed(1)}
            unit="MW"
            accentColor="primary"
            detail={`Hour ${activeHour.toString().padStart(2, '0')}:00 active`}
          />
          <MetricCard
            label="Optimal 24h Cost"
            value={`₹${formatInr(daySummary.totalDailyCostInr)}`}
            unit="INR"
            detail={`Solver: ${dispatchBundle.solverStatus.toUpperCase()}`}
          />
          <MetricCard
            label="Daily Emissions"
            value={daySummary.totalDailyEmissionsTonnesCO2e.toFixed(2)}
            unit="tCO₂e"
            accentColor="renewable"
            detail={`${daySummary.averageRenewableSharePercent.toFixed(1)}% avg RE`}
          />
          <MetricCard
            label="Unserved Energy"
            value={totalUnservedMWh.toFixed(2)}
            unit="MWh"
            detail={`Max residual ${dispatchBundle.residualSummary.maxPowerBalanceResidualMW.toExponential(1)} MW`}
          />
        </div>
      </section>

      {/* Interactive Weather Controls & Generator Capacity Overrides */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Weather & Forecast Coupling Controls */}
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6 space-y-4 xl:col-span-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Weather &amp; Forecast Coupling Controls
            </h3>
            <button
              type="button"
              onClick={resetWeatherControls}
              className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] dark:border-[#334155] px-2.5 py-1 text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Weather
            </button>
          </div>

          <div className="space-y-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-3 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between">
                <label htmlFor="weather-temp-offset" className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                  Temperature Perturbation
                </label>
                <span className="font-mono-tabular font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                  {draftWeather.temperatureDeltaDegC >= 0 ? '+' : ''}
                  {draftWeather.temperatureDeltaDegC.toFixed(1)} °C
                </span>
              </div>
              <input
                id="weather-temp-offset"
                type="range"
                min={-8}
                max={10}
                step={0.5}
                value={draftWeather.temperatureDeltaDegC}
                onChange={(e) =>
                  scheduleWeatherCommit(
                    { ...draftWeather, temperatureDeltaDegC: Number(e.target.value) },
                    `Temp Delta ${e.target.value}°C`,
                  )
                }
                className="h-1.5 w-full cursor-pointer accent-[#2563EB]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <label htmlFor="weather-solar-scale" className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                  Solar Irradiance Availability
                </label>
                <span className="font-mono-tabular font-semibold text-[#10B981] dark:text-[#34D399]">
                  {Math.round(draftWeather.solarIrradianceScale * 100)}%
                </span>
              </div>
              <input
                id="weather-solar-scale"
                type="range"
                min={0.1}
                max={1.3}
                step={0.05}
                value={draftWeather.solarIrradianceScale}
                onChange={(e) =>
                  scheduleWeatherCommit(
                    { ...draftWeather, solarIrradianceScale: Number(e.target.value) },
                    `Solar Scale ${Math.round(Number(e.target.value) * 100)}%`,
                  )
                }
                className="h-1.5 w-full cursor-pointer accent-[#10B981]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <label htmlFor="weather-wind-scale" className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                  Wind Corridor Resource
                </label>
                <span className="font-mono-tabular font-semibold text-[#06B6D4] dark:text-[#22D3EE]">
                  {Math.round(draftWeather.windResourceScale * 100)}%
                </span>
              </div>
              <input
                id="weather-wind-scale"
                type="range"
                min={0.2}
                max={1.6}
                step={0.05}
                value={draftWeather.windResourceScale}
                onChange={(e) =>
                  scheduleWeatherCommit(
                    { ...draftWeather, windResourceScale: Number(e.target.value) },
                    `Wind Scale ${Math.round(Number(e.target.value) * 100)}%`,
                  )
                }
                className="h-1.5 w-full cursor-pointer accent-[#06B6D4]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <label htmlFor="demand-scale-factor" className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                  Demand Scaling Factor
                </label>
                <span className="font-mono-tabular font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {Math.round(draftWeather.demandScaleFactor * 100)}%
                </span>
              </div>
              <input
                id="demand-scale-factor"
                type="range"
                min={0.75}
                max={1.35}
                step={0.05}
                value={draftWeather.demandScaleFactor}
                onChange={(e) =>
                  scheduleWeatherCommit(
                    { ...draftWeather, demandScaleFactor: Number(e.target.value) },
                    `Demand Scale ${Math.round(Number(e.target.value) * 100)}%`,
                  )
                }
                className="h-1.5 w-full cursor-pointer accent-[#2563EB]"
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
              <div>
                <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                  Couple QR Demand Forecast to Dispatch
                </span>
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Feeds Householder QR prediction D(t) directly into LP dispatch
                </span>
              </div>
              <input
                type="checkbox"
                checked={useForecastDrivenDemand}
                onChange={(e) => setUseForecastDrivenDemand(e.target.checked)}
                className="h-4 w-4 accent-[#2563EB]"
              />
            </label>
          </div>
        </div>

        {/* Generator Capacity & Battery Initial SoC Controls */}
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6 space-y-4 xl:col-span-7">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Generator Capacity, Outages &amp; BESS Initial SoC Controls
            </h3>
            <button
              type="button"
              onClick={resetGeneratorOverrides}
              className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] dark:border-[#334155] px-2.5 py-1 text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Fleet
            </button>
          </div>

          <div className="space-y-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-3 text-xs">
            {activeScenario.generators.map((gen) => {
              const ov = generatorOverrides[gen.id];
              const isAvail = ov?.available ?? gen.available;
              const curMax = ov?.maxMW ?? gen.maxMW;
              const upperSlider = gen.technology === 'solar' || gen.technology === 'wind' ? 240 : 220;
              return (
                <div
                  key={gen.id}
                  className="grid grid-cols-1 items-center gap-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] px-3.5 py-2.5 sm:grid-cols-12"
                >
                  <div className="sm:col-span-4">
                    <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{gen.name}</div>
                    <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      P_min {gen.minMW} MW · Ramp {gen.rampRateMWPerHour} MW/h
                    </div>
                  </div>
                  <div className="sm:col-span-5 flex items-center gap-2.5">
                    <input
                      type="range"
                      min={Math.max(10, gen.minMW)}
                      max={upperSlider}
                      step={5}
                      value={curMax}
                      onChange={(e) =>
                        updateGeneratorOverride(
                          gen.id,
                          { maxMW: Number(e.target.value) },
                          `${gen.name} Max ${e.target.value} MW`,
                        )
                      }
                      aria-label={`${gen.name} max capacity`}
                      className="h-1.5 w-full cursor-pointer accent-[#2563EB]"
                    />
                    <span className="font-mono-tabular w-16 text-right font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      {curMax.toFixed(0)} MW
                    </span>
                  </div>
                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        updateGeneratorOverride(
                          gen.id,
                          { available: !isAvail },
                          `${gen.name} ${!isAvail ? 'Online' : 'Outage'}`,
                        )
                      }
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                        isAvail
                          ? 'border-[#10B981]/40 bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#34D399]'
                          : 'border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {isAvail ? 'Online' : 'Outage (0 MW)'}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* BESS Initial SoC Control */}
            <div className="grid grid-cols-1 items-center gap-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] px-3.5 py-2.5 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Central LFP BESS Initial SoC</div>
                <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Window [{minSocMWh.toFixed(0)}, {maxSocMWh.toFixed(0)}] MWh
                </div>
              </div>
              <div className="sm:col-span-5 flex items-center gap-2.5">
                <input
                  type="range"
                  min={Math.round(minSocMWh)}
                  max={Math.round(maxSocMWh)}
                  step={2}
                  value={activeBatteryInit}
                  onChange={(e) => setBatteryInitialSocOverride(Number(e.target.value))}
                  aria-label="Battery initial state of charge"
                  className="h-1.5 w-full cursor-pointer accent-[#06B6D4]"
                />
                <span className="font-mono-tabular w-20 text-right font-semibold text-[#06B6D4] dark:text-[#22D3EE]">
                  {activeBatteryInit.toFixed(0)} MWh
                </span>
              </div>
              <div className="sm:col-span-3 flex justify-end">
                <span className="font-mono-tabular text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  {((activeBatteryInit / activeScenario.battery.capacityMWh) * 100).toFixed(1)}% SoC
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8-Scenario Benchmark Comparison Matrix */}
      <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              8-Scenario Digital Twin Comparison Matrix
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Each scenario modifies only its target operational parameters while preserving all unrelated microgrid settings, evaluated via the Two-Phase Bounded Simplex LP solver.
            </p>
          </div>
          <StatusBadge tone="info" label={`${scenarios.length} Scenarios Evaluated`} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]">
                <th className="py-2.5 pr-4 font-medium">Scenario &amp; Delta Overrides</th>
                <th className="py-2.5 pr-4 text-right font-medium">Peak (MW)</th>
                <th className="py-2.5 pr-4 text-right font-medium">Energy (MWh)</th>
                <th className="py-2.5 pr-4 text-right font-medium">Avg RE</th>
                <th className="py-2.5 pr-4 text-right font-medium">24h LP Cost</th>
                <th className="py-2.5 pr-4 text-right font-medium">vs Normal</th>
                <th className="py-2.5 pr-4 text-right font-medium">Emissions (tCO₂e)</th>
                <th className="py-2.5 pr-4 text-right font-medium">Unserved (MWh)</th>
                <th className="py-2.5 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
              {benchmarkRows.map((row) => {
                const isActive = row.scenario.id === activeScenarioId;
                return (
                  <tr
                    key={row.scenario.id}
                    className={isActive ? 'bg-[#EFF6FF]/65 dark:bg-[#60A5FA]/15' : 'hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'}
                  >
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{row.scenario.name}</div>
                      <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        {(row.scenario.changedProperties ?? [row.scenario.seasonTag]).join(' · ')}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                      {row.peakDemandMW.toFixed(1)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                      {row.dailyEnergyMWh.toFixed(1)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-tabular text-[#10B981] dark:text-[#34D399]">
                      {row.averageRenewableSharePercent.toFixed(1)}%
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-tabular font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      ₹{formatInr(row.totalDailyCostInr)}
                    </td>
                    <td
                      className={`py-3 pr-4 text-right font-mono-tabular ${
                        row.costDeltaVsNormalPercent > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-[#10B981] dark:text-[#34D399]'
                      }`}
                    >
                      {row.costDeltaVsNormalPercent > 0 ? '+' : ''}
                      {row.costDeltaVsNormalPercent.toFixed(2)}%
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-tabular text-[#64748B] dark:text-[#94A3B8]">
                      {row.totalEmissionsTonnesCO2e.toFixed(2)}
                    </td>
                    <td
                      className={`py-3 pr-4 text-right font-mono-tabular ${
                        row.unservedEnergyMWh > 0.1 ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    >
                      {row.unservedEnergyMWh.toFixed(2)}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => setScenario(row.scenario.id)}
                        disabled={isActive}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          isActive
                            ? 'bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA]'
                            : 'border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                        }`}
                      >
                        {isActive ? 'Active' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Calculation History Audit Log */}
      <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Deterministic Calculation History
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Chronological record of synchronized Digital Twin recalculations across scenario, weather, forecast, and dispatch updates.
            </p>
          </div>
          <span className="font-mono-tabular text-xs text-[#64748B] dark:text-[#94A3B8]">
            {calculationHistory.length} recent evaluations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]">
                <th className="py-2 pr-4 font-medium">Trigger Event</th>
                <th className="py-2 pr-4 font-medium">Scenario</th>
                <th className="py-2 pr-4 text-right font-medium">Peak (MW)</th>
                <th className="py-2 pr-4 text-right font-medium">24h Cost (INR)</th>
                <th className="py-2 pr-4 text-right font-medium">Emissions (tCO₂e)</th>
                <th className="py-2 pr-4 text-right font-medium">Unserved (MWh)</th>
                <th className="py-2 pr-4 text-right font-medium">Balance Residual</th>
                <th className="py-2 pr-4 text-right font-medium">Latency</th>
                <th className="py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
              {calculationHistory.map((item) => (
                <tr key={item.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]">
                  <td className="py-2 pr-4 font-medium text-[#0F172A] dark:text-[#F8FAFC]">{item.trigger}</td>
                  <td className="py-2 pr-4 text-[#64748B] dark:text-[#94A3B8]">{item.scenarioName}</td>
                  <td className="py-2 pr-4 text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                    {item.peakDemandMW.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                    ₹{formatInr(item.totalDailyCostInr)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono-tabular text-[#64748B] dark:text-[#94A3B8]">
                    {item.totalEmissionsTonnesCO2e.toFixed(2)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                    {item.unservedEnergyMWh.toFixed(2)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono-tabular text-[#64748B] dark:text-[#94A3B8]">
                    {item.maxBalanceResidualMW.toExponential(1)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono-tabular text-[#64748B] dark:text-[#94A3B8]">
                    {item.computeMs} ms
                  </td>
                  <td className="py-2 text-right font-medium text-[#2563EB] dark:text-[#60A5FA]">{item.solverStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
        </>
      )}
    </div>
  );
}
