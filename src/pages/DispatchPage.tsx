import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { KaTeXFormula } from '../components/KaTeXFormula';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { DispatchAllocation3D } from '../components/math3d/DispatchOptimization3D';
import { LinearProgramming3D } from '../components/math3d/LinearProgramming3D';
import { MathLabViewport } from '../components/math3d/MathLabViewport';
import {
  buildHourTwoVarDispatchSlice,
  type DispatchStrategyId,
} from '../optimization/optimalDispatchEngine';
import { useSimulationStore } from '../store/useSimulationStore';

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
}

const STRATEGY_OPTIONS: { id: DispatchStrategyId; label: string; shortDesc: string }[] = [
  {
    id: 'lp-optimal',
    label: 'Numerical Cost Optimization (LP)',
    shortDesc: 'Global 24h Two-Phase Bounded Simplex + B&B BESS complementarity',
  },
  {
    id: 'renewable-heuristic',
    label: 'Renewable-Priority Heuristic',
    shortDesc: 'Solar/Wind/Hydro merit priority with rule-based BESS peak shaving',
  },
  {
    id: 'thermal-first',
    label: 'Thermal-First Baseline',
    shortDesc: 'Coal/Gas baseload priority under identical ramp & capacity limits',
  },
];

export function DispatchPage() {
  const activeScenario = useSimulationStore((s) => s.activeScenario);
  const activeHour = useSimulationStore((s) => s.activeHour);
  const activeDispatch = useSimulationStore((s) => s.activeDispatch);
  const daySummary = useSimulationStore((s) => s.daySummary);
  const dispatchConfig = useSimulationStore((s) => s.dispatchConfig);
  const dispatchBundle = useSimulationStore((s) => s.dispatchBundle);
  const appliedForecastLabel = useSimulationStore((s) => s.appliedForecastLabel);

  const setActiveHour = useSimulationStore((s) => s.setActiveHour);
  const stepHour = useSimulationStore((s) => s.stepHour);
  const setDispatchStrategy = useSimulationStore((s) => s.setDispatchStrategy);
  const updateDispatchConfig = useSimulationStore((s) => s.updateDispatchConfig);
  const resetDispatchConfig = useSimulationStore((s) => s.resetDispatchConfig);
  const clearAppliedForecast = useSimulationStore((s) => s.clearAppliedForecast);

  const [view3DTab, setView3DTab] = useState<'24h-trajectory' | '2var-slice'>('24h-trajectory');
  const [sliceStepIdx, setSliceStepIdx] = useState<number>(0);

  const twoVarSlice = useMemo(
    () => buildHourTwoVarDispatchSlice(activeScenario, dispatchConfig, activeHour, activeDispatch),
    [activeScenario, dispatchConfig, activeHour, activeDispatch],
  );

  const clampedSliceStep = Math.min(
    sliceStepIdx,
    Math.max(0, twoVarSlice.lpResult.steps.length - 1),
  );

  const activeComparison = dispatchBundle.comparisons.find(
    (c) => c.strategy === dispatchConfig.strategy,
  );
  const lpComparison = dispatchBundle.comparisons.find((c) => c.strategy === 'lp-optimal');
  const totalUnservedMWh = activeComparison?.unservedEnergyMWh ?? 0;

  const minSocMWh = activeScenario.battery.capacityMWh * activeScenario.battery.minSocRatio;
  const maxSocMWh = activeScenario.battery.capacityMWh * activeScenario.battery.maxSocRatio;

  const solverBadgeTone: 'nominal' | 'info' | 'warning' | 'deficit' = !dispatchBundle.feasible
    ? 'deficit'
    : totalUnservedMWh > 0.1
      ? 'warning'
      : dispatchConfig.strategy === 'lp-optimal'
        ? 'nominal'
        : 'info';

  const solverBadgeLabel = !dispatchBundle.feasible
    ? 'Infeasible Constraints'
    : totalUnservedMWh > 0.1
      ? 'Unserved Load Active'
      : dispatchBundle.solverStatus === 'optimal'
        ? 'LP Optimal Converged'
        : dispatchBundle.solverStatus === 'iteration_limit'
          ? 'Iteration Cap Reached'
          : 'Heuristic Active';

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* Header, Strategy Switcher & Time Step Control */}
      <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span className="font-medium text-[#2563EB] dark:text-[#60A5FA]">{activeDispatch.solverName}</span>
              <span aria-hidden="true">·</span>
              <span>{activeScenario.name}</span>
              <span aria-hidden="true">·</span>
              <span>Hour {activeDispatch.timestampLabel} IST</span>
              {appliedForecastLabel ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#10B981] dark:text-[#34D399]">{appliedForecastLabel}</span>
                </>
              ) : null}
            </div>
            <h2 className="text-lg font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Multi-Period Optimal Energy Dispatch &amp; BESS Scheduling Engine
            </h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
              Minimizes 24-hour total operational cost, battery degradation, unserved-load VOLL penalties, and optional carbon cost subject to power balance, ramp-rate dynamics, generator bounds, and state-of-charge conservation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] px-2.5 py-1.5">
              <button
                type="button"
                onClick={() => stepHour(-1)}
                aria-label="Previous hour"
                className="rounded p-1 text-[#64748B] dark:text-[#94A3B8] hover:bg-[#FFFFFF] dark:hover:bg-[#172033] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono-tabular px-1 text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap">
                {activeDispatch.timestampLabel} IST
              </span>
              <button
                type="button"
                onClick={() => stepHour(1)}
                aria-label="Next hour"
                className="rounded p-1 text-[#64748B] dark:text-[#94A3B8] hover:bg-[#FFFFFF] dark:hover:bg-[#172033] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {appliedForecastLabel ? (
              <button
                type="button"
                onClick={clearAppliedForecast}
                className="rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] whitespace-nowrap shrink-0"
              >
                Restore Scenario Demand
              </button>
            ) : null}

            <Link
              to="/smart-city"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] whitespace-nowrap shrink-0"
            >
              <Layers className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
              Inspect in 3D Smart City
              <ArrowUpRight className="h-3.5 w-3.5 text-[#64748B] dark:text-[#94A3B8]" />
            </Link>

            <StatusBadge tone={solverBadgeTone} label={solverBadgeLabel} />
          </div>
        </div>

        {/* Strategy Comparison Selector */}
        <div className="grid grid-cols-1 gap-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-4 md:grid-cols-3">
          {STRATEGY_OPTIONS.map((opt) => {
            const active = dispatchConfig.strategy === opt.id;
            const comp = dispatchBundle.comparisons.find((c) => c.strategy === opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDispatchStrategy(opt.id)}
                className={`rounded-lg border p-3.5 text-left transition-colors ${
                  active
                    ? 'border-[#2563EB] dark:border-[#60A5FA] bg-[#EFF6FF]/60 dark:bg-[#60A5FA]/15'
                    : 'border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      active ? 'text-[#2563EB] dark:text-[#60A5FA]' : 'text-[#0F172A] dark:text-[#F8FAFC]'
                    }`}
                  >
                    {opt.label}
                  </span>
                  {comp ? (
                    <span className="font-mono-tabular text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      ₹{formatInr(comp.totalCostInr)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[#64748B] dark:text-[#94A3B8]">{opt.shortDesc}</p>
              </button>
            );
          })}
        </div>

        {/* Explicit Infeasibility or Unserved Capacity Alert */}
        {!dispatchBundle.feasible ? (
          <div className="flex items-start gap-3 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-900 dark:text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="font-semibold">Optimization Constraints Infeasible</p>
              <p className="mt-0.5 text-rose-800 dark:text-rose-200">
                The current daily carbon cap ({dispatchConfig.carbonCapTonnesCO2e} tCO₂e) or minimum-stable unit requirements cannot be satisfied simultaneously across the 24-hour demand horizon. Increase the carbon cap or relax unit minimum limits.
              </p>
            </div>
          </div>
        ) : totalUnservedMWh > 0.1 ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-900 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">
                Inadequate Fleet Capacity — Unserved Energy Activated ({totalUnservedMWh.toFixed(1)} MWh)
              </p>
              <p className="mt-0.5 text-amber-800 dark:text-amber-200">
                Peak net demand exceeds combined generator availability and BESS discharge headroom. Nonnegative slack variable Uₜ ≥ 0 preserved power balance at VOLL penalty ₹{formatInr(dispatchConfig.vollPenaltyInrPerMWh)}/MWh (total ₹{formatInr(dispatchBundle.vollPenaltyCostInr)}).
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {/* Primary KPI Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="24h Total Dispatch Cost"
          value={`₹${formatInr(daySummary.totalDailyCostInr)}`}
          unit="INR"
          accentColor="primary"
          detail={`Op ₹${formatInr(dispatchBundle.operationalCostInr)} · CO₂ ₹${formatInr(dispatchBundle.carbonPenaltyCostInr)}`}
        />
        <MetricCard
          label="LP Cost Savings vs Thermal"
          value={
            lpComparison ? `${lpComparison.costSavingsVsThermalFirstPercent.toFixed(2)}%` : '0.00%'
          }
          unit="Savings"
          accentColor="renewable"
          detail={
            lpComparison
              ? `${lpComparison.costSavingsVsHeuristicPercent.toFixed(2)}% vs renewable heuristic`
              : ''
          }
        />
        <MetricCard
          label="Renewable Contribution"
          value={daySummary.averageRenewableSharePercent.toFixed(1)}
          unit="%"
          accentColor="renewable"
          detail={`Hour ${activeDispatch.timestampLabel}: ${activeDispatch.renewableGenerationMW.toFixed(1)} MW clean`}
        />
        <MetricCard
          label="Daily Carbon Emissions"
          value={daySummary.totalDailyEmissionsTonnesCO2e.toFixed(2)}
          unit="tCO₂e"
          detail={
            dispatchConfig.enableCarbonCap
              ? `Cap ${dispatchConfig.carbonCapTonnesCO2e} tCO₂e · ${activeDispatch.emissionsKgCO2e.toFixed(0)} kg/h`
              : `${activeDispatch.emissionsKgCO2e.toFixed(0)} kgCO₂e at ${activeDispatch.timestampLabel}`
          }
        />
        <MetricCard
          label="BESS State of Charge"
          value={activeDispatch.batterySocMWh.toFixed(1)}
          unit="MWh"
          accentColor="secondary"
          detail={`${activeDispatch.batterySocPercent.toFixed(1)}% · Net ${activeDispatch.batteryNetPowerMW >= 0 ? '+' : ''}${activeDispatch.batteryNetPowerMW.toFixed(1)} MW`}
        />
      </section>

      {/* Controls + 3D Mathematical Workspace */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Optimization Parameters & Constraint Controls */}
        <div className="space-y-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 xl:col-span-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Objective &amp; Constraint Controls
            </h3>
            <button
              type="button"
              onClick={resetDispatchConfig}
              className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] dark:border-[#334155] px-2 py-1 text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>

          {/* Carbon Price */}
          <div className="space-y-1.5 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="carbon-price-slider" className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                Carbon Price
              </label>
              <span className="font-mono-tabular font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                ₹{formatInr(dispatchConfig.carbonPriceInrPerTonne)} / tCO₂e
              </span>
            </div>
            <input
              id="carbon-price-slider"
              type="range"
              min={0}
              max={6000}
              step={100}
              value={dispatchConfig.carbonPriceInrPerTonne}
              onChange={(e) =>
                updateDispatchConfig({ carbonPriceInrPerTonne: Number(e.target.value) })
              }
              className="h-1.5 w-full cursor-pointer accent-[#2563EB]"
            />
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Shifts optimization from least-cost (₹0/t) toward multi-objective cost + emissions dispatch.
            </p>
          </div>

          {/* Optional Hard Carbon Cap */}
          <div className="space-y-2 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
            <label className="flex cursor-pointer items-center justify-between text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC]">
              <span>Enforce Daily Carbon Cap</span>
              <input
                type="checkbox"
                checked={dispatchConfig.enableCarbonCap}
                onChange={(e) => updateDispatchConfig({ enableCarbonCap: e.target.checked })}
                className="h-4 w-4 accent-[#2563EB]"
              />
            </label>
            {dispatchConfig.enableCarbonCap ? (
              <div className="flex items-center justify-between gap-3">
                <input
                  type="range"
                  min={1400}
                  max={3500}
                  step={50}
                  value={dispatchConfig.carbonCapTonnesCO2e}
                  onChange={(e) =>
                    updateDispatchConfig({ carbonCapTonnesCO2e: Number(e.target.value) })
                  }
                  aria-label="Daily carbon emissions cap"
                  className="h-1.5 w-full cursor-pointer accent-[#10B981]"
                />
                <span className="font-mono-tabular text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap">
                  {dispatchConfig.carbonCapTonnesCO2e} t
                </span>
              </div>
            ) : null}
          </div>

          {/* Terminal BESS SoC Target */}
          <div className="space-y-2 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
            <label className="flex cursor-pointer items-center justify-between text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC]">
              <span>Terminal SoC Target (t = 23)</span>
              <input
                type="checkbox"
                checked={dispatchConfig.enforceTerminalSocTarget}
                onChange={(e) =>
                  updateDispatchConfig({ enforceTerminalSocTarget: e.target.checked })
                }
                className="h-4 w-4 accent-[#2563EB]"
              />
            </label>
            {dispatchConfig.enforceTerminalSocTarget ? (
              <div className="flex items-center justify-between gap-3">
                <input
                  type="range"
                  min={Math.round(minSocMWh)}
                  max={Math.round(maxSocMWh)}
                  step={2}
                  value={dispatchConfig.terminalSocTargetMWh}
                  onChange={(e) =>
                    updateDispatchConfig({ terminalSocTargetMWh: Number(e.target.value) })
                  }
                  aria-label="Terminal BESS State of Charge target"
                  className="h-1.5 w-full cursor-pointer accent-[#06B6D4]"
                />
                <span className="font-mono-tabular text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap">
                  {dispatchConfig.terminalSocTargetMWh.toFixed(0)} MWh
                </span>
              </div>
            ) : null}
          </div>

          {/* Economic & Stability Settings */}
          <div className="grid grid-cols-2 gap-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-3 text-xs">
            <label className="space-y-1">
              <span className="block text-[11px] text-[#64748B] dark:text-[#94A3B8]">VOLL Penalty (INR/MWh)</span>
              <input
                type="number"
                min={5000}
                max={100000}
                step={1000}
                value={dispatchConfig.vollPenaltyInrPerMWh}
                onChange={(e) =>
                  updateDispatchConfig({
                    vollPenaltyInrPerMWh: Math.max(1000, Number(e.target.value) || 25000),
                  })
                }
                className="w-full rounded-md border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] px-2.5 py-1.5 font-mono-tabular text-xs text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </label>

            <label className="space-y-1">
              <span className="block text-[11px] text-[#64748B] dark:text-[#94A3B8]">BESS Cycle (INR/MWh)</span>
              <input
                type="number"
                min={50}
                max={2000}
                step={20}
                value={dispatchConfig.batteryCycleCostInrPerMWh}
                onChange={(e) =>
                  updateDispatchConfig({
                    batteryCycleCostInrPerMWh: Math.max(10, Number(e.target.value) || 420),
                  })
                }
                className="w-full rounded-md border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] px-2.5 py-1.5 font-mono-tabular text-xs text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </label>
          </div>

          <label className="flex cursor-pointer items-center justify-between border-t border-[#E2E8F0] dark:border-[#334155] pt-3 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC]">
            <span>Enforce Dispatchable P_min Bounds</span>
            <input
              type="checkbox"
              checked={dispatchConfig.enforceUnitMinStable}
              onChange={(e) =>
                updateDispatchConfig({ enforceUnitMinStable: e.target.checked })
              }
              className="h-4 w-4 accent-[#2563EB]"
            />
          </label>

          {/* Configurable Emission Factors */}
          <div className="space-y-2 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
              Emission Factors (kgCO₂e/MWh)
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(
                [
                  ['hydro', 'Hydro'],
                  ['gas', 'CCGT Gas'],
                  ['coal', 'Coal'],
                ] as const
              ).map(([tech, title]) => (
                <label key={tech} className="space-y-1">
                  <span className="block text-[11px] text-[#64748B] dark:text-[#94A3B8]">{title}</span>
                  <input
                    type="number"
                    min={0}
                    max={1500}
                    step={10}
                    value={dispatchConfig.emissionFactorsKgPerMWh[tech]}
                    onChange={(e) =>
                      updateDispatchConfig({
                        emissionFactorsKgPerMWh: {
                          ...dispatchConfig.emissionFactorsKgPerMWh,
                          [tech]: Math.max(0, Number(e.target.value) || 0),
                        },
                      })
                    }
                    className="w-full rounded-md border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] px-2 py-1 font-mono-tabular text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 3D Mathematical Workspace */}
        <div className="flex flex-col rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 xl:col-span-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                3D Dispatch &amp; Feasible Region Workspace
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                {view3DTab === '24h-trajectory'
                  ? 'Full 24-hour multi-period Time × Source × MW allocation and BESS SoC (%) ribbon — click any bar to change the active hour.'
                  : `Simplified 2-variable single-hour slice at ${twoVarSlice.timestampLabel}: CCGT Gas (x₁) vs Coal Peaker (x₂) serving ${twoVarSlice.netResidualDemandMW.toFixed(1)} MW net thermal load.`}
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] p-1">
              <button
                type="button"
                onClick={() => setView3DTab('24h-trajectory')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  view3DTab === '24h-trajectory'
                    ? 'bg-[#FFFFFF] dark:bg-[#172033] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                }`}
              >
                24h Allocation &amp; SoC
              </button>
              <button
                type="button"
                onClick={() => setView3DTab('2var-slice')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  view3DTab === '2var-slice'
                    ? 'bg-[#FFFFFF] dark:bg-[#172033] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                }`}
              >
                2-Variable Hour Slice
              </button>
            </div>
          </div>

          {view3DTab === '24h-trajectory' ? (
            <MathLabViewport
              cameraPosition={[10.5, 7.8, 10.5]}
              cameraTarget={[0, 1.4, 0]}
              showResetCamera={true}
              heightClass="h-[430px]"
              caption={`24h Multi-Period Trajectory (${dispatchBundle.numVariables} LP vars) · Click any column to scrub hour`}
            >
              <DispatchAllocation3D
                summary={daySummary}
                activeHour={activeHour}
                onSelectHour={setActiveHour}
              />
            </MathLabViewport>
          ) : (
            <div className="space-y-3">
              <MathLabViewport
                cameraPosition={[8.8, 6.8, 9.2]}
                cameraTarget={[0.2, 1.3, 0.2]}
                showResetCamera={true}
                heightClass="h-[385px]"
                caption={`Single-Hour 2-Var LP Slice (${twoVarSlice.timestampLabel}) · Z* = ₹${formatInr(twoVarSlice.lpResult.optimalValue)}/h`}
              >
                <LinearProgramming3D
                  spec={twoVarSlice.spec}
                  result={twoVarSlice.lpResult}
                  activeStepIndex={clampedSliceStep}
                  precision={0}
                />
              </MathLabViewport>

              {twoVarSlice.lpResult.steps.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] px-3 py-2 text-xs">
                  <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                    Simplex Vertex Step {clampedSliceStep + 1} / {twoVarSlice.lpResult.steps.length}
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, twoVarSlice.lpResult.steps.length - 1)}
                      value={clampedSliceStep}
                      onChange={(e) => setSliceStepIdx(Number(e.target.value))}
                      aria-label="Simplex vertex iteration step"
                      className="h-1.5 w-36 cursor-pointer accent-[#2563EB]"
                    />
                    <span className="font-mono-tabular text-[#64748B] dark:text-[#94A3B8]">
                      Optimal (x₁, x₂) = ({twoVarSlice.lpResult.optimalPoint[0]?.toFixed(1) ?? '0.0'},{' '}
                      {twoVarSlice.lpResult.optimalPoint[1]?.toFixed(1) ?? '0.0'}) MW
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {/* KaTeX Mathematical Formulation + Constraint Residuals */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6 space-y-4 xl:col-span-6">
          <div>
            <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Mathematical Optimization Formulation
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Exact multi-period linear program solved across 24 coupled hourly intervals.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] p-4 overflow-x-auto">
            <KaTeXFormula
              displayMode={true}
              tex="\min \sum_{t=0}^{23} \left[ \sum_{g} \left(c_g + \pi_{\mathrm{CO_2}} e_g\right) P_{g,t} + c_{\mathrm{deg}}\left(P_t^{\mathrm{ch}} + P_t^{\mathrm{dis}}\right) + \mathrm{VOLL}\cdot U_t \right]"
            />
            <KaTeXFormula
              displayMode={true}
              tex="\sum_{g} P_{g,t} + P_t^{\mathrm{dis}} - P_t^{\mathrm{ch}} + U_t = D_t, \quad U_t \ge 0"
            />
            <KaTeXFormula
              displayMode={true}
              tex="SoC_t = SoC_{t-1} + \sqrt{\eta_{\mathrm{rt}}}\,P_t^{\mathrm{ch}} - \frac{P_t^{\mathrm{dis}}}{\sqrt{\eta_{\mathrm{rt}}}}, \quad SoC_{23} \ge SoC_{\mathrm{target}}"
            />
            <KaTeXFormula
              displayMode={true}
              tex="P_{g,t}^{\min} \le P_{g,t} \le P_{g,t}^{\max}, \quad -R_g \le P_{g,t} - P_{g,t-1} \le R_g"
            />
          </div>

          <p className="text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
            <strong className="text-[#0F172A] dark:text-[#F8FAFC]">Complementarity Note:</strong>{' '}
            {dispatchBundle.lpRelaxationNote}
          </p>
        </div>

        {/* Numerical Solver Verification & Residuals */}
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6 space-y-4 xl:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Solver Convergence &amp; Constraint Residual Audit
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Direct verification of every mathematical constraint against primal solution values.
              </p>
            </div>
            <StatusBadge
              tone={dispatchBundle.residualSummary.allConstraintsSatisfied ? 'nominal' : 'deficit'}
              label={
                dispatchBundle.residualSummary.allConstraintsSatisfied
                  ? 'All Residuals < 10⁻²'
                  : 'Residual Alert'
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] p-3.5 text-xs sm:grid-cols-4">
            <div>
              <p className="text-[#64748B] dark:text-[#94A3B8]">LP Dimensions</p>
              <p className="mt-0.5 font-mono-tabular font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                {dispatchBundle.numVariables} × {dispatchBundle.numConstraints}
              </p>
            </div>
            <div>
              <p className="text-[#64748B] dark:text-[#94A3B8]">Simplex Pivots</p>
              <p className="mt-0.5 font-mono-tabular font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                {dispatchBundle.simplexIterations}
              </p>
            </div>
            <div>
              <p className="text-[#64748B] dark:text-[#94A3B8]">B&amp;B Nodes</p>
              <p className="mt-0.5 font-mono-tabular font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                {dispatchBundle.branchAndBoundNodes}
              </p>
            </div>
            <div>
              <p className="text-[#64748B] dark:text-[#94A3B8]">Simultaneous Ch/Dis</p>
              <p className="mt-0.5 font-mono-tabular font-semibold text-[#10B981] dark:text-[#34D399]">
                {dispatchBundle.residualSummary.simultaneousChargeDischargeHours} / 24 h
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]">
                  <th className="py-2 pr-4 font-medium">Constraint Family</th>
                  <th className="py-2 pr-4 text-right font-medium">Max Violation</th>
                  <th className="py-2 text-right font-medium">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                {[
                  {
                    name: 'Hourly Power Balance (24 eqs)',
                    val: `${dispatchBundle.residualSummary.maxPowerBalanceResidualMW.toExponential(2)} MW`,
                    ok: dispatchBundle.residualSummary.maxPowerBalanceResidualMW < 1e-2,
                  },
                  {
                    name: 'BESS SoC Dynamics (24 eqs)',
                    val: `${dispatchBundle.residualSummary.maxBatterySocDynamicsErrorMWh.toExponential(2)} MWh`,
                    ok: dispatchBundle.residualSummary.maxBatterySocDynamicsErrorMWh < 1e-2,
                  },
                  {
                    name: 'Thermal Ramp-Up / Down Limits',
                    val: `${dispatchBundle.residualSummary.maxRampViolationMW.toExponential(2)} MW`,
                    ok: dispatchBundle.residualSummary.maxRampViolationMW < 1e-2,
                  },
                  {
                    name: 'Capacity & Power Box Bounds',
                    val: `${dispatchBundle.residualSummary.maxCapacityBoundViolationMW.toExponential(2)} MW`,
                    ok: dispatchBundle.residualSummary.maxCapacityBoundViolationMW < 1e-2,
                  },
                  {
                    name: `Terminal SoC (${dispatchBundle.residualSummary.terminalSocAchievedMWh.toFixed(1)} MWh)`,
                    val: `${dispatchBundle.residualSummary.terminalSocViolationMWh.toFixed(4)} MWh`,
                    ok: dispatchBundle.residualSummary.terminalSocViolationMWh < 1e-2,
                  },
                  {
                    name: 'Daily Carbon Cap Constraint',
                    val: `${dispatchBundle.residualSummary.carbonCapViolationTonnes.toFixed(4)} tCO₂e`,
                    ok: dispatchBundle.residualSummary.carbonCapViolationTonnes < 1e-2,
                  },
                ].map((row) => (
                  <tr key={row.name} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]">
                    <td className="py-2 pr-4 text-[#0F172A] dark:text-[#F8FAFC]">{row.name}</td>
                    <td className="py-2 pr-4 text-right font-mono-tabular text-[#64748B] dark:text-[#94A3B8]">
                      {row.val}
                    </td>
                    <td className="py-2 text-right font-medium">
                      <span className={row.ok ? 'text-[#10B981] dark:text-[#34D399]' : 'text-rose-600 dark:text-rose-400'}>
                        {row.ok ? 'Satisfied' : 'Violated'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Side-by-Side Dispatch Strategy Comparison Table */}
      <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Dispatch Strategy Comparison (Identical Constraints &amp; Demand)
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Click any strategy row to switch the active dispatch and update the 3D Smart City Digital Twin.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]">
                <th className="py-2.5 pr-4 font-medium">Strategy</th>
                <th className="py-2.5 pr-4 text-right font-medium">Total 24h Cost</th>
                <th className="py-2.5 pr-4 text-right font-medium">Savings vs Thermal</th>
                <th className="py-2.5 pr-4 text-right font-medium">Renewable Share</th>
                <th className="py-2.5 pr-4 text-right font-medium">Emissions (tCO₂e)</th>
                <th className="py-2.5 pr-4 text-right font-medium">Unserved (MWh)</th>
                <th className="py-2.5 pr-4 text-right font-medium">Curtailed RE (MWh)</th>
                <th className="py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
              {dispatchBundle.comparisons.map((row) => {
                const isSelected = row.strategy === dispatchConfig.strategy;
                return (
                  <tr
                    key={row.strategy}
                    onClick={() => setDispatchStrategy(row.strategy)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#EFF6FF]/60 dark:bg-[#60A5FA]/15 font-medium' : 'hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                    }`}
                  >
                    <td className="py-2.5 pr-4 text-[#0F172A] dark:text-[#F8FAFC]">
                      {row.label}
                      {isSelected ? (
                        <span className="ml-2 text-[10px] font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                          ACTIVE
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono-tabular font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      ₹{formatInr(row.totalCostInr)}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono-tabular text-[#10B981] dark:text-[#34D399]">
                      {row.costSavingsVsThermalFirstPercent > 0 ? '+' : ''}
                      {row.costSavingsVsThermalFirstPercent.toFixed(2)}%
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                      {row.renewableContributionPercent.toFixed(1)}%
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono-tabular text-[#64748B] dark:text-[#94A3B8]">
                      {row.totalEmissionsTonnesCO2e.toFixed(2)}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                      {row.unservedEnergyMWh.toFixed(2)}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono-tabular text-[#64748B] dark:text-[#94A3B8]">
                      {row.curtailedRenewableMWh.toFixed(2)}
                    </td>
                    <td className="py-2.5 text-right text-[#2563EB] dark:text-[#60A5FA]">{row.solverStatus}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Active Hour Fleet Setpoints */}
      <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            Fleet Commitment at {activeDispatch.timestampLabel} IST
          </h3>
          <KaTeXFormula tex="P_g^{\min} \le P_{g,t} \le P_g^{\max}, \quad |P_{g,t} - P_{g,t-1}| \le R_g" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]">
                <th className="py-2.5 pr-4 font-medium">Unit</th>
                <th className="py-2.5 pr-4 font-medium">Technology</th>
                <th className="py-2.5 pr-4 text-right font-medium">Available (MW)</th>
                <th className="py-2.5 pr-4 text-right font-medium">Dispatched (MW)</th>
                <th className="py-2.5 pr-4 text-right font-medium">Utilization</th>
                <th className="py-2.5 pr-4 text-right font-medium">Hourly Cost (INR)</th>
                <th className="py-2.5 text-right font-medium">Emissions (kgCO₂e)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
              {activeDispatch.generatorSetpoints.map((unit) => (
                <tr key={unit.generatorId} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]">
                  <td className="py-2.5 pr-4 font-medium text-[#0F172A] dark:text-[#F8FAFC]">{unit.name}</td>
                  <td className="py-2.5 pr-4 capitalize text-[#64748B] dark:text-[#94A3B8]">{unit.technology}</td>
                  <td className="py-2.5 pr-4 text-right font-mono-tabular text-[#64748B] dark:text-[#94A3B8]">
                    {unit.availableMaxMW.toFixed(1)}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono-tabular font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                    {unit.dispatchedMW.toFixed(1)}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                    {unit.utilizationPercent.toFixed(1)}%
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                    ₹{formatInr(unit.hourlyCostInr)}
                  </td>
                  <td className="py-2.5 text-right font-mono-tabular text-[#64748B] dark:text-[#94A3B8]">
                    {formatInr(unit.hourlyEmissionsKgCO2e)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 24-Hour Trajectory Schedule Table */}
      <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            24-Hour Multi-Period Schedule
          </h3>
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Click any hour row to synchronize KPIs, 3D workspace, and Smart City Twin
          </span>
        </div>

        <div className="max-h-[340px] overflow-auto rounded-lg border border-[#E2E8F0] dark:border-[#334155]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-[#F8FAFC] dark:bg-[#0B1220] text-[#64748B] dark:text-[#94A3B8] border-b border-[#E2E8F0] dark:border-[#334155]">
              <tr>
                <th className="py-2 px-3 font-medium">Hour</th>
                <th className="py-2 px-3 text-right font-medium">Load (MW)</th>
                <th className="py-2 px-3 text-right font-medium">Solar+Wind (MW)</th>
                <th className="py-2 px-3 text-right font-medium">Hydro+Thermal (MW)</th>
                <th className="py-2 px-3 text-right font-medium">BESS Net (MW)</th>
                <th className="py-2 px-3 text-right font-medium">SoC (%)</th>
                <th className="py-2 px-3 text-right font-medium">Unserved (MW)</th>
                <th className="py-2 px-3 text-right font-medium">Cost (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
              {daySummary.hourlyDispatches.map((h) => {
                const isSel = h.hour === activeHour;
                const solarWindMW = h.generatorSetpoints
                  .filter((g) => g.technology === 'solar' || g.technology === 'wind')
                  .reduce((a, g) => a + g.dispatchedMW, 0);
                const dispMW = h.totalDispatchedGenerationMW - solarWindMW;
                return (
                  <tr
                    key={h.hour}
                    onClick={() => setActiveHour(h.hour)}
                    className={`cursor-pointer transition-colors ${
                      isSel ? 'bg-[#EFF6FF] dark:bg-[#60A5FA]/15 font-semibold' : 'hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                    }`}
                  >
                    <td className="py-2 px-3 font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                      {h.timestampLabel}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                      {h.totalDemandMW.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-[#10B981] dark:text-[#34D399]">
                      {solarWindMW.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-[#2563EB] dark:text-[#60A5FA]">
                      {dispMW.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-[#06B6D4] dark:text-[#22D3EE]">
                      {h.batteryNetPowerMW >= 0 ? '+' : ''}
                      {h.batteryNetPowerMW.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                      {h.batterySocPercent.toFixed(1)}%
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono-tabular ${
                        h.unservedEnergyMW > 0.1 ? 'text-rose-600 dark:text-rose-400' : 'text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    >
                      {h.unservedEnergyMW.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                      ₹{formatInr(h.dispatchCostInr)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
