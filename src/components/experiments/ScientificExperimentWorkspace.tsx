import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookmarkCheck, Download, Play, RotateCcw } from 'lucide-react';
import { KaTeXFormula } from '../KaTeXFormula';
import { MetricCard } from '../MetricCard';
import { StatusBadge } from '../StatusBadge';
import { ExperimentVisualization3D } from '../math3d/ExperimentVisualization3D';
import { MathLabViewport } from '../math3d/MathLabViewport';
import {
  DEFAULT_EXPERIMENT_PARAMETERS,
  EXPERIMENT_CATALOG,
  runScientificExperiment,
  serializeExperimentCsv,
} from '../../experiments/scientificExperiments';
import type { WeatherScenarioId } from '../../forecasting/numericalForecaster';
import { useSimulationStore } from '../../store/useSimulationStore';

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ScientificExperimentWorkspace() {
  const activeScenario = useSimulationStore((s) => s.activeScenario);
  const dispatchConfig = useSimulationStore((s) => s.dispatchConfig);
  const forecastDataset = useSimulationStore((s) => s.forecastDataset);
  const activeExperimentId = useSimulationStore((s) => s.activeExperimentId);
  const experimentParams = useSimulationStore((s) => s.experimentParams);
  const pinnedExperiments = useSimulationStore((s) => s.pinnedExperiments);

  const setActiveExperimentId = useSimulationStore((s) => s.setActiveExperimentId);
  const updateExperimentParams = useSimulationStore((s) => s.updateExperimentParams);
  const pinExperimentResult = useSimulationStore((s) => s.pinExperimentResult);
  const runAndPinAllExperiments = useSimulationStore((s) => s.runAndPinAllExperiments);
  const addNotification = useSimulationStore((s) => s.addNotification);

  // Deterministically execute the active experiment with real numerical engines
  const result = useMemo(
    () =>
      runScientificExperiment({
        experimentId: activeExperimentId,
        scenario: activeScenario,
        dispatchConfig,
        forecastDataset,
        expParams: experimentParams,
      }),
    [activeExperimentId, activeScenario, dispatchConfig, forecastDataset, experimentParams],
  );

  const isPinned = Boolean(pinnedExperiments[activeExperimentId]);
  const pinnedCount = Object.keys(pinnedExperiments).length;

  const handleExportExperimentJson = () => {
    const payload = {
      reproducibilityManifest: result.manifest,
      experimentSettings: experimentParams,
      objectiveStatement: result.objectiveStatement,
      summaryMetrics: result.summaryMetrics,
      tableHeaders: result.tableHeaders,
      tableRows: result.tableRows,
      limitations: result.limitations,
      researchIntegrityNote: result.researchIntegrityNote,
    };
    triggerDownload(
      `gridmath3d-${result.manifest.experimentCode.toLowerCase()}-reproducibility.json`,
      JSON.stringify(payload, null, 2),
      'application/json',
    );
    addNotification({
      title: 'Experiment Settings & Results Exported',
      detail: `Saved reproducible JSON manifest for ${result.manifest.experimentCode}.`,
      tone: 'success',
    });
  };

  const handleExportExperimentCsv = () => {
    const csv = serializeExperimentCsv(result);
    triggerDownload(
      `gridmath3d-${result.manifest.experimentCode.toLowerCase()}-results.csv`,
      csv,
      'text/csv;charset=utf-8;',
    );
    addNotification({
      title: 'Experiment CSV Exported',
      detail: `Downloaded accuracy & benchmark table for ${result.manifest.experimentCode}.`,
      tone: 'success',
    });
  };

  const handlePinToReport = () => {
    pinExperimentResult(result);
    addNotification({
      title: 'Experiment Pinned to Report',
      detail: `${result.manifest.experimentCode} (${result.manifest.computeMs} ms) captured for Academic PDF/CSV Report.`,
      tone: 'success',
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left Column: 8-Experiment Navigator & Parameter Calibration */}
      <aside className="space-y-4 xl:col-span-4">
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Scientific Experiment Suite (8)
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Reproducible numerical, forecasting, and optimization benchmarks.
              </p>
            </div>
            <button
              type="button"
              onClick={runAndPinAllExperiments}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#2563EB] px-2.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Play className="h-3 w-3" />
              Run All 8
            </button>
          </div>

          <div className="space-y-1.5 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
            {EXPERIMENT_CATALOG.map((exp) => {
              const active = exp.id === activeExperimentId;
              const pinned = Boolean(pinnedExperiments[exp.id]);
              return (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => setActiveExperimentId(exp.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? 'border-[#2563EB] dark:border-[#60A5FA] bg-[#EFF6FF]/65 dark:bg-[#60A5FA]/15'
                      : 'border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono-tabular font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                      {exp.code} · {exp.category}
                    </span>
                    {pinned ? (
                      <span className="font-medium text-[#10B981] dark:text-[#34D399]">Pinned</span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{exp.title}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                    {exp.shortDescription}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Context-Sensitive Algorithm Parameter Calibration */}
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Algorithm Parameters</h4>
            <button
              type="button"
              onClick={() => updateExperimentParams({ ...DEFAULT_EXPERIMENT_PARAMETERS })}
              className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] dark:border-[#334155] px-2 py-1 text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
            >
              <RotateCcw className="h-3 w-3" />
              Defaults
            </button>
          </div>

          {activeExperimentId === 'forecast-accuracy' ? (
            <div className="space-y-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
              <label className="block space-y-1">
                <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Primary Holdout Window</span>
                <select
                  value={experimentParams.holdoutWindowHours}
                  onChange={(e) =>
                    updateExperimentParams({
                      holdoutWindowHours: Number(e.target.value) as 24 | 48 | 72,
                    })
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-2.5 py-1.5 font-mono-tabular text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <option value={24}>24 hours (1 day out-of-sample)</option>
                  <option value={48}>48 hours (2 days out-of-sample)</option>
                  <option value={72}>72 hours (3 days out-of-sample)</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Weather Forecast Regime</span>
                <select
                  value={experimentParams.forecastWeatherId}
                  onChange={(e) =>
                    updateExperimentParams({
                      forecastWeatherId: e.target.value as WeatherScenarioId,
                    })
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-2.5 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <option value="nominal">Historical Mean (Nominal)</option>
                  <option value="heatwave">Heatwave (+4.5 °C)</option>
                  <option value="cool">Cool Overcast (-3.5 °C)</option>
                </select>
              </label>
            </div>
          ) : null}

          {activeExperimentId === 'integration-accuracy' ? (
            <div className="space-y-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
              <label className="block space-y-1">
                <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Analytic Benchmark Function</span>
                <select
                  value={experimentParams.integrandId}
                  onChange={(e) =>
                    updateExperimentParams({
                      integrandId: e.target.value as
                        | 'diurnal-load'
                        | 'cubic-polynomial'
                        | 'sinusoidal-peak',
                    })
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-2.5 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <option value="diurnal-load">Diurnal Harmonic Load [0, 24h]</option>
                  <option value="cubic-polynomial">Exact Cubic Polynomial [0, 12h]</option>
                  <option value="sinusoidal-peak">Squared Sinusoid Peak [0, 24h]</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Maximum Subdivisions (n)</span>
                <select
                  value={experimentParams.maxSubdivisions}
                  onChange={(e) =>
                    updateExperimentParams({
                      maxSubdivisions: Number(e.target.value) as 16 | 32 | 64,
                    })
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-2.5 py-1.5 font-mono-tabular text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <option value={16}>n up to 16</option>
                  <option value={32}>n up to 32</option>
                  <option value={64}>n up to 64</option>
                </select>
              </label>
            </div>
          ) : null}

          {activeExperimentId === 'gaussian-stability' ? (
            <div className="space-y-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Max Hilbert Dimension n</span>
                  <span className="font-mono-tabular font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                    H_{experimentParams.hilbertMaxDim}
                  </span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={7}
                  step={1}
                  value={experimentParams.hilbertMaxDim}
                  onChange={(e) =>
                    updateExperimentParams({
                      hilbertMaxDim: Number(e.target.value) as 4 | 5 | 6 | 7,
                    })
                  }
                  className="h-1.5 w-full cursor-pointer accent-[#2563EB]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Small Pivot Perturbation ε</span>
                  <span className="font-mono-tabular font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                    10^(-{experimentParams.pivotEpsilonExp})
                  </span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={14}
                  step={1}
                  value={experimentParams.pivotEpsilonExp}
                  onChange={(e) =>
                    updateExperimentParams({ pivotEpsilonExp: Number(e.target.value) })
                  }
                  className="h-1.5 w-full cursor-pointer accent-[#2563EB]"
                />
              </div>
            </div>
          ) : null}

          {activeExperimentId === 'regression-comparison' ? (
            <div className="space-y-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Tightest Collinearity δ</span>
                  <span className="font-mono-tabular font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                    10^(-{experimentParams.collinearityDeltaExp})
                  </span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={8}
                  step={1}
                  value={experimentParams.collinearityDeltaExp}
                  onChange={(e) =>
                    updateExperimentParams({ collinearityDeltaExp: Number(e.target.value) })
                  }
                  className="h-1.5 w-full cursor-pointer accent-[#2563EB]"
                />
              </div>

              <label className="block space-y-1">
                <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Deterministic PRNG Seed</span>
                <input
                  type="number"
                  value={experimentParams.seed}
                  onChange={(e) =>
                    updateExperimentParams({ seed: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="w-full rounded-lg border border-[#E2E8F0] dark:border-[#334155] px-2.5 py-1.5 font-mono-tabular text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                />
              </label>
            </div>
          ) : null}

          {activeExperimentId === 'dispatch-vs-heuristic' ? (
            <div className="space-y-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Carbon Pricing Benchmark</span>
                  <span className="font-mono-tabular font-semibold text-[#10B981] dark:text-[#34D399]">
                    ₹{experimentParams.carbonPriceSweepInr} / tCO₂e
                  </span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={5000}
                  step={250}
                  value={experimentParams.carbonPriceSweepInr}
                  onChange={(e) =>
                    updateExperimentParams({ carbonPriceSweepInr: Number(e.target.value) })
                  }
                  className="h-1.5 w-full cursor-pointer accent-[#10B981]"
                />
              </div>
            </div>
          ) : null}

          {activeExperimentId === 'demand-sensitivity' ? (
            <div className="space-y-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Upper Demand Multiplier</span>
                  <span className="font-mono-tabular font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                    {Math.round(experimentParams.demandScaleMax * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={1.1}
                  max={1.45}
                  step={0.05}
                  value={experimentParams.demandScaleMax}
                  onChange={(e) =>
                    updateExperimentParams({ demandScaleMax: Number(e.target.value) })
                  }
                  className="h-1.5 w-full cursor-pointer accent-[#2563EB]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Max Temp Perturbation ΔT</span>
                  <span className="font-mono-tabular font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                    +{experimentParams.tempDeltaMaxDegC.toFixed(1)} °C
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={10}
                  step={1}
                  value={experimentParams.tempDeltaMaxDegC}
                  onChange={(e) =>
                    updateExperimentParams({ tempDeltaMaxDegC: Number(e.target.value) })
                  }
                  className="h-1.5 w-full cursor-pointer accent-[#2563EB]"
                />
              </div>
            </div>
          ) : null}

          {activeExperimentId === 'renewable-sensitivity' ? (
            <div className="space-y-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Minimum Solar Availability</span>
                  <span className="font-mono-tabular font-semibold text-[#10B981] dark:text-[#34D399]">
                    {Math.round(experimentParams.solarScaleMin * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.6}
                  step={0.05}
                  value={experimentParams.solarScaleMin}
                  onChange={(e) =>
                    updateExperimentParams({ solarScaleMin: Number(e.target.value) })
                  }
                  className="h-1.5 w-full cursor-pointer accent-[#10B981]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Maximum Wind Multiplier</span>
                  <span className="font-mono-tabular font-semibold text-[#06B6D4] dark:text-[#22D3EE]">
                    {Math.round(experimentParams.windScaleMax * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={1.1}
                  max={1.8}
                  step={0.1}
                  value={experimentParams.windScaleMax}
                  onChange={(e) =>
                    updateExperimentParams({ windScaleMax: Number(e.target.value) })
                  }
                  className="h-1.5 w-full cursor-pointer accent-[#06B6D4]"
                />
              </div>
            </div>
          ) : null}

          {activeExperimentId === 'outage-stress' ? (
            <div className="space-y-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">Initial BESS Reserve SoC</span>
                  <span className="font-mono-tabular font-semibold text-[#06B6D4] dark:text-[#22D3EE]">
                    {experimentParams.outageBatterySocMWh.toFixed(0)} MWh
                  </span>
                </div>
                <input
                  type="range"
                  min={22}
                  max={162}
                  step={5}
                  value={experimentParams.outageBatterySocMWh}
                  onChange={(e) =>
                    updateExperimentParams({ outageBatterySocMWh: Number(e.target.value) })
                  }
                  className="h-1.5 w-full cursor-pointer accent-[#06B6D4]"
                />
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Main Experimental Workspace Stage */}
      <div className="space-y-6 xl:col-span-8">
        {/* Header & Reproducibility Actions */}
        <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
                <span className="font-mono-tabular font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                  {result.manifest.experimentCode}
                </span>
                <span aria-hidden="true">·</span>
                <span>{result.manifest.dataProvenance}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">Computed in {result.manifest.computeMs} ms</span>
              </div>
              <h3 className="text-lg font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{result.manifest.title}</h3>
              <p className="text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">{result.objectiveStatement}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePinToReport}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isPinned
                    ? 'border-[#10B981]/50 bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#34D399]'
                    : 'border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                }`}
              >
                <BookmarkCheck className="h-3.5 w-3.5" />
                {isPinned ? 'Pinned to Report' : 'Pin to Report'}
              </button>
              <button
                type="button"
                onClick={handleExportExperimentCsv}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-3 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportExperimentJson}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-3 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5 text-[#06B6D4] dark:text-[#22D3EE]" />
                Settings JSON
              </button>
              <Link
                to="/reports"
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#2563EB] px-3 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
              >
                Academic Report ({pinnedCount}/8)
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-[#E2E8F0] dark:border-[#334155] pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {result.summaryMetrics.map((m) => (
              <MetricCard
                key={m.label}
                label={m.label}
                value={m.value}
                unit={m.unit}
                detail={m.detail}
                accentColor={
                  m.tone === 'renewable'
                    ? 'renewable'
                    : m.tone === 'primary'
                      ? 'primary'
                      : 'neutral'
                }
              />
            ))}
          </div>
        </section>

        {/* 3D Experimental Visualization & Mathematical Formulation */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 space-y-3 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                3D Experimental Visualization
              </h4>
              <StatusBadge tone="info" label="Real Numerical Output" />
            </div>
            <MathLabViewport
              cameraPosition={[10.5, 6.8, 10.5]}
              cameraTarget={[0, 2.0, 0]}
              heightClass="h-[390px]"
              showResetCamera
              caption={result.plotCaption}
            >
              <ExperimentVisualization3D plot={result.plot3D} />
            </MathLabViewport>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 space-y-4 lg:col-span-5">
            <h4 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Mathematical Formulation &amp; Reproducibility Manifest
            </h4>
            <div className="rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] p-3 overflow-x-auto">
              <KaTeXFormula displayMode tex={result.formulaTex} />
            </div>
            <p className="text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">{result.methodologyNote}</p>

            <dl className="divide-y divide-[#E2E8F0] dark:divide-[#334155] border-t border-[#E2E8F0] dark:border-[#334155] text-[11px]">
              <div className="flex justify-between gap-3 py-1.5">
                <dt className="text-[#64748B] dark:text-[#94A3B8]">Dataset</dt>
                <dd className="text-right font-medium text-[#0F172A] dark:text-[#F8FAFC]">{result.manifest.inputDataset}</dd>
              </div>
              <div className="flex justify-between gap-3 py-1.5">
                <dt className="text-[#64748B] dark:text-[#94A3B8]">Algorithm</dt>
                <dd className="text-right font-medium text-[#0F172A] dark:text-[#F8FAFC]">{result.manifest.algorithmName}</dd>
              </div>
              <div className="flex justify-between gap-3 py-1.5">
                <dt className="text-[#64748B] dark:text-[#94A3B8]">Tolerance</dt>
                <dd className="text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                  {result.manifest.numericalTolerance}
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-1.5">
                <dt className="text-[#64748B] dark:text-[#94A3B8]">Random Seed</dt>
                <dd className="text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                  {result.manifest.seedLabel}
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-1.5">
                <dt className="text-[#64748B] dark:text-[#94A3B8]">Software Version</dt>
                <dd className="text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                  {result.manifest.softwareVersion}
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-1.5">
                <dt className="text-[#64748B] dark:text-[#94A3B8]">Timestamp</dt>
                <dd className="text-right font-mono-tabular text-[#64748B] dark:text-[#94A3B8]">
                  {result.manifest.timestampIso}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Intermediate Calculation & Accuracy Analysis Table */}
        <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Experimental Results &amp; Accuracy Audit Table
              </h4>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{result.researchIntegrityNote}</p>
            </div>
            <span className="font-mono-tabular text-xs text-[#64748B] dark:text-[#94A3B8]">
              {result.tableRows.length} measured trials
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]">
                  {result.tableHeaders.map((h, i) => (
                    <th
                      key={h}
                      className={`py-2 pr-4 font-medium whitespace-nowrap ${
                        i >= 2 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                {result.tableRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`py-2 pr-4 ${
                          cIdx === 0
                            ? 'font-medium text-[#0F172A] dark:text-[#F8FAFC]'
                            : cIdx >= 2
                              ? 'text-right font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]'
                              : 'text-[#64748B] dark:text-[#94A3B8]'
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
            <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Model Limitations &amp; Scope</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              {result.limitations.map((lim, i) => (
                <li key={i}>{lim}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
