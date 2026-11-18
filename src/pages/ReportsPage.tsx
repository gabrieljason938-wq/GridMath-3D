import { useMemo } from 'react';
import { Download, FileSpreadsheet, Play, Printer } from 'lucide-react';
import { KaTeXFormula } from '../components/KaTeXFormula';
import { StatusBadge } from '../components/StatusBadge';
import {
  EXPERIMENT_CATALOG,
  runAllEightExperiments,
  serializeExperimentCsv,
  SOFTWARE_VERSION,
  type ExperimentId,
  type ScientificExperimentResult,
} from '../experiments/scientificExperiments';
import { useSimulationStore } from '../store/useSimulationStore';

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
}

export function ReportsPage() {
  const activeScenario = useSimulationStore((s) => s.activeScenario);
  const activeHour = useSimulationStore((s) => s.activeHour);
  const validationReport = useSimulationStore((s) => s.validationReport);
  const daySummary = useSimulationStore((s) => s.daySummary);
  const forecastResult = useSimulationStore((s) => s.forecastResult);
  const numericalForecast = useSimulationStore((s) => s.numericalForecast);
  const dispatchConfig = useSimulationStore((s) => s.dispatchConfig);
  const dispatchBundle = useSimulationStore((s) => s.dispatchBundle);
  const weatherControls = useSimulationStore((s) => s.weatherControls);
  const forecastDataset = useSimulationStore((s) => s.forecastDataset);
  const calculationHistory = useSimulationStore((s) => s.calculationHistory);
  const experimentParams = useSimulationStore((s) => s.experimentParams);
  const pinnedExperiments = useSimulationStore((s) => s.pinnedExperiments);
  const runAndPinAllExperiments = useSimulationStore((s) => s.runAndPinAllExperiments);
  const addNotification = useSimulationStore((s) => s.addNotification);

  // Ensure all 8 experiments have live real computations available in the academic report
  const experimentsMap = useMemo<Record<ExperimentId, ScientificExperimentResult>>(() => {
    const hasAll = EXPERIMENT_CATALOG.every((d) => Boolean(pinnedExperiments[d.id]));
    if (hasAll) {
      return pinnedExperiments as Record<ExperimentId, ScientificExperimentResult>;
    }
    const fresh = runAllEightExperiments({
      scenario: activeScenario,
      dispatchConfig,
      forecastDataset,
      expParams: experimentParams,
    });
    return {
      ...fresh,
      ...(pinnedExperiments as Partial<Record<ExperimentId, ScientificExperimentResult>>),
    };
  }, [activeScenario, dispatchConfig, forecastDataset, experimentParams, pinnedExperiments]);

  const orderedExperiments = useMemo(
    () => EXPERIMENT_CATALOG.map((d) => experimentsMap[d.id]),
    [experimentsMap],
  );

  const handlePrintPdf = () => {
    addNotification({
      title: 'Preparing Printable Academic Report',
      detail: 'Use "Save as PDF" in the browser print dialog for clean A4 manuscript export.',
      tone: 'info',
    });
    window.print();
  };

  const handleExportDispatchCsv = () => {
    const headers = [
      'Hour',
      'Timestamp',
      'Demand_MW',
      'Available_Gen_MW',
      'Dispatched_Gen_MW',
      'Renewable_MW',
      'RE_Share_Pct',
      'Battery_Net_MW',
      'Battery_SoC_MWh',
      'Unserved_MW',
      'Dispatch_Cost_INR',
      'Emissions_kgCO2e',
      'Balance_Status',
    ];

    const rows = daySummary.hourlyDispatches.map((h) =>
      [
        h.hour,
        h.timestampLabel,
        h.totalDemandMW,
        h.totalAvailableGenerationMW,
        h.totalDispatchedGenerationMW,
        h.renewableGenerationMW,
        h.renewableContributionPercent,
        h.batteryNetPowerMW,
        h.batterySocMWh,
        h.unservedEnergyMW,
        h.dispatchCostInr,
        h.emissionsKgCO2e,
        h.balanceStatus,
      ].join(','),
    );

    const csv = [headers.join(','), ...rows].join('\n');
    triggerDownload(
      `gridmath3d-${activeScenario.id}-dispatch.csv`,
      csv,
      'text/csv;charset=utf-8;',
    );
    addNotification({
      title: '24h Dispatch CSV Exported',
      detail: `Downloaded hourly optimal dispatch schedule for ${activeScenario.name}.`,
      tone: 'success',
    });
  };

  const handleExportExperimentsCsv = () => {
    const sections = orderedExperiments.map((exp) => serializeExperimentCsv(exp));
    triggerDownload(
      `gridmath3d-${activeScenario.id}-8-experiments.csv`,
      sections.join('\n\n'),
      'text/csv;charset=utf-8;',
    );
    addNotification({
      title: '8-Experiment Benchmark CSV Exported',
      detail: 'Exported all 8 reproducible numerical experiment tables with parameter headers.',
      tone: 'success',
    });
  };

  const handleExportReproducibilityJson = () => {
    const payload = {
      application: 'GRIDMATH 3D — Unified Mathematical Digital Twin',
      softwareVersion: SOFTWARE_VERSION,
      exportedAt: new Date().toISOString(),
      units: {
        power: 'MW',
        energy: 'MWh',
        price: 'INR/MWh',
        cost: 'INR',
        emissions: 'kgCO2e / tCO2e',
      },
      scenario: {
        id: activeScenario.id,
        name: activeScenario.name,
        isSynthetic: activeScenario.isSynthetic,
        changedProperties: activeScenario.changedProperties ?? [],
      },
      weatherControls,
      experimentSettings: experimentParams,
      validationReport,
      forecastResult,
      dispatchVerification: {
        solverStatus: dispatchBundle.solverStatus,
        feasible: dispatchBundle.feasible,
        numVariables: dispatchBundle.numVariables,
        numConstraints: dispatchBundle.numConstraints,
        simplexIterations: dispatchBundle.simplexIterations,
        residualSummary: dispatchBundle.residualSummary,
        strategyComparisons: dispatchBundle.comparisons,
      },
      experimentManifests: orderedExperiments.map((e) => ({
        manifest: e.manifest,
        summaryMetrics: e.summaryMetrics,
        tableHeaders: e.tableHeaders,
        tableRows: e.tableRows,
      })),
      daySummary,
      calculationHistory,
    };

    triggerDownload(
      `gridmath3d-${activeScenario.id}-capstone-reproducibility.json`,
      JSON.stringify(payload, null, 2),
      'application/json',
    );
    addNotification({
      title: 'Full Reproducibility JSON Exported',
      detail: `Saved scenario, solver audits, experiment parameters, and results for ${activeScenario.id}.`,
      tone: 'success',
    });
  };

  // Crisp inline SVG chart scaling for print-safe 24h Load vs Supply Visualization
  const chartGeom = useMemo(() => {
    const width = 760;
    const height = 220;
    const padL = 48;
    const padR = 18;
    const padT = 16;
    const padB = 28;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const allVals = daySummary.hourlyDispatches.flatMap((h) => [
      h.totalDemandMW,
      h.renewableGenerationMW,
      h.totalDispatchedGenerationMW,
    ]);
    const maxY = Math.max(450, Math.ceil(Math.max(...allVals, 100) / 50) * 50);

    const xOf = (hour: number) => padL + (hour / 23) * innerW;
    const yOf = (mw: number) => padT + innerH - (mw / maxY) * innerH;

    const poly = (vals: number[]) =>
      vals.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');

    const demandPoly = poly(daySummary.hourlyDispatches.map((h) => h.totalDemandMW));
    const genPoly = poly(daySummary.hourlyDispatches.map((h) => h.totalDispatchedGenerationMW));
    const rePoly = poly(daySummary.hourlyDispatches.map((h) => h.renewableGenerationMW));

    return { width, height, padL, padR, padT, padB, innerH, maxY, xOf, yOf, demandPoly, genPoly, rePoly };
  }, [daySummary.hourlyDispatches]);

  const totalUnservedMWh = daySummary.hourlyDispatches.reduce(
    (a, h) => a + h.unservedEnergyMW,
    0,
  );
  const lpComp = dispatchBundle.comparisons.find((c) => c.strategy === 'lp-optimal');
  const heurComp = dispatchBundle.comparisons.find((c) => c.strategy === 'renewable-heuristic');
  const tfComp = dispatchBundle.comparisons.find((c) => c.strategy === 'thermal-first');

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      {/* Export & Benchmark Toolbar (hidden when printing to PDF) */}
      <section className="no-print flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-6">
        <div className="max-w-2xl space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
            <span className="font-mono-tabular font-medium text-[#2563EB]">{SOFTWARE_VERSION}</span>
            <span aria-hidden="true">·</span>
            <span>Reproducible Capstone Manuscript &amp; Audits</span>
          </div>
          <h2 className="text-lg font-semibold text-[#0F172A]">
            Academic Scientific Report Generator &amp; Reproducibility Exports
          </h2>
          <p className="text-xs leading-relaxed text-[#64748B]">
            Synthesizes verified outputs from all 8 scientific experiments, dataset quality audits, KaTeX mathematical derivations, and multi-period LP dispatch runs into a browser-printable academic PDF, CSV tables, and JSON reproducibility archives.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={runAndPinAllExperiments}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5 text-[#10B981]" />
            Refresh All 8 Benchmarks
          </button>
          <button
            type="button"
            onClick={handleExportDispatchCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#2563EB]" />
            24h Dispatch CSV
          </button>
          <button
            type="button"
            onClick={handleExportExperimentsCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5 text-[#06B6D4]" />
            Experiments CSV
          </button>
          <button
            type="button"
            onClick={handleExportReproducibilityJson}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5 text-[#2563EB]" />
            Reproducibility JSON
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Export PDF
          </button>
        </div>
      </section>

      {/* Printable Academic Capstone Manuscript */}
      <article className="space-y-6 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 print:border-0 print:p-0">
        {/* 1. Title & Objective */}
        <header className="border-b border-[#E2E8F0] pb-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
            <span>Engineering Capstone Technical Report · {SOFTWARE_VERSION}</span>
            <span className="font-mono-tabular">Generated: {new Date().toISOString()}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            GRIDMATH 3D: Numerical Intelligence for Smart Grid Demand Forecasting and Optimal Energy Dispatch
          </h1>
          <p className="text-sm leading-relaxed text-[#475569]">
            <strong className="text-[#0F172A]">Objective:</strong> Formulate, verify, and benchmark an end-to-end deterministic numerical pipeline linking causal Householder QR electricity demand forecasting, high-order quadrature and conditioned linear system solvers, and Two-Phase Bounded Simplex multi-period optimal dispatch over a synchronized urban microgrid digital twin.
          </p>
        </header>

        {/* 2. Research Integrity & Data Provenance Disclosure */}
        <section className="print-avoid-break space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[#0F172A]">
              1. Research Integrity &amp; Data Provenance Classification
            </h2>
            <StatusBadge
              tone={validationReport.valid && dispatchBundle.feasible ? 'nominal' : 'warning'}
              label={
                validationReport.valid && dispatchBundle.feasible
                  ? 'All Solver Checks Verified'
                  : 'Review Warnings'
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-1.5">
              <div className="font-semibold text-[#0F172A]">Synthetic vs. Real Data Boundaries</div>
              <p className="text-[#64748B] leading-relaxed">
                <strong className="text-[#0F172A]">Active Grid Scenario:</strong>{' '}
                {activeScenario.name} ({activeScenario.isSynthetic ? 'Synthetic Urban Microgrid Baseline, INR Tariff' : 'Hybrid'}).
              </p>
              <p className="text-[#64748B] leading-relaxed">
                <strong className="text-[#0F172A]">Forecasting Time-Series:</strong>{' '}
                {forecastDataset.isSynthetic
                  ? `Documented synthetic 14-day demonstration (${forecastDataset.records.length}h, ${forecastDataset.timezone}) — explicitly NOT presented as measured utility meter telemetry.`
                  : `User-uploaded CSV "${forecastDataset.datasetName}" (${forecastDataset.qualityReport.validRows} valid rows, ${forecastDataset.timezone}).`}
              </p>
            </div>

            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-1.5">
              <div className="font-semibold text-[#0F172A]">Assumptions, Precision &amp; Verified Outcomes</div>
              <p className="text-[#64748B] leading-relaxed">
                <strong className="text-[#0F172A]">Assumptions:</strong> Single-bus copper-plate substation balance, BESS round-trip efficiency 90% (<KaTeXFormula tex="\eta=0.90" />), linear cooling slope <KaTeXFormula tex="4.2\;\text{MW}/^\circ\text{C}" /> above 24 °C, and VOLL = ₹25,000/MWh.
              </p>
              <p className="text-[#64748B] leading-relaxed">
                <strong className="text-[#0F172A]">Precision:</strong> IEEE-754 float64 arithmetic (<KaTeXFormula tex="\varepsilon_{\text{mach}} \approx 2.22 \times 10^{-16}" />); every accuracy metric and solver residual below is directly measured from live execution.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Dataset Description */}
        <section className="print-avoid-break space-y-3 border-t border-[#E2E8F0] pt-5">
          <h2 className="text-base font-semibold text-[#0F172A]">
            2. Dataset Description &amp; Ingestion Quality Audit
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="py-2 pr-4 font-medium">Audit Dimension</th>
                  <th className="py-2 pr-4 font-medium">Measured Value</th>
                  <th className="py-2 font-medium">Engineering Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                <tr>
                  <td className="py-2 pr-4 font-medium text-[#0F172A]">Forecast Dataset Window</td>
                  <td className="py-2 pr-4 font-mono-tabular">
                    {forecastDataset.qualityReport.validRows}/{forecastDataset.qualityReport.totalRawRows} rows ({forecastDataset.timezone})
                  </td>
                  <td className="py-2 text-[#64748B]">
                    Missing: {forecastDataset.qualityReport.missingValueCount}, Duplicates: {forecastDataset.qualityReport.duplicateTimestampCount}, Invalid: {forecastDataset.qualityReport.invalidValueCount}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-[#0F172A]">Chronological Train/Holdout Split</td>
                  <td className="py-2 pr-4 font-mono-tabular">
                    {numericalForecast.trainCount}h train / {numericalForecast.holdoutCount}h holdout
                  </td>
                  <td className="py-2 text-[#10B981]">
                    {numericalForecast.chronologicalVerified
                      ? 'Strict temporal separation verified (zero future leakage)'
                      : 'Check chronological ordering'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-[#0F172A]">Microgrid Peak / Energy</td>
                  <td className="py-2 pr-4 font-mono-tabular">
                    {daySummary.predictedPeakDemandMW.toFixed(2)} MW / {daySummary.totalDailyEnergyMWh.toFixed(1)} MWh
                  </td>
                  <td className="py-2 text-[#64748B]">
                    Installed available capacity: {activeScenario.installedGenerationMW.toFixed(0)} MW + {activeScenario.batteryCapacityMWh} MWh BESS
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-[#0F172A]">Standardized Units</td>
                  <td className="py-2 pr-4 font-mono-tabular">MW · MWh · INR/MWh · tCO₂e</td>
                  <td className="py-2 text-[#64748B]">
                    Weather overrides: ΔT={weatherControls.temperatureDeltaDegC >= 0 ? '+' : ''}
                    {weatherControls.temperatureDeltaDegC}°C, Solar={Math.round(weatherControls.solarIrradianceScale * 100)}%, Wind={Math.round(weatherControls.windResourceScale * 100)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Mathematical Methodology & Formula Derivation */}
        <section className="print-avoid-break space-y-3 border-t border-[#E2E8F0] pt-5">
          <h2 className="text-base font-semibold text-[#0F172A]">
            3. Mathematical Methodology &amp; Formula Derivation
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
              <div className="text-xs font-semibold text-[#0F172A]">
                A. Householder QR Load Regression
              </div>
              <KaTeXFormula
                displayMode
                tex="X = Q R \implies R\hat{\boldsymbol{\beta}} = Q^T \mathbf{y}, \quad \|Q^T Q - I\|_F = \mathcal{O}(\varepsilon_{\text{mach}})"
              />
              <p className="text-[11px] text-[#64748B]">
                Avoids <KaTeXFormula tex="\kappa(X)^2" /> conditioning loss of normal equations <KaTeXFormula tex="(X^TX)\boldsymbol{\beta}=X^T\mathbf{y}" /> using orthogonal Householder reflections over Fourier diurnal harmonics, temperature cooling degree terms, and 24-hour causal lags.
              </p>
            </div>

            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
              <div className="text-xs font-semibold text-[#0F172A]">
                B. Multi-Period Bounded Simplex Optimal Dispatch
              </div>
              <KaTeXFormula
                displayMode
                tex="\min \sum_{t=0}^{23}\!\left(\sum_i c_i P_{i,t} + c_{\text{deg}}(P_{\text{ch},t}+P_{\text{dis},t}) + c_{\text{CO}_2} E_t + \text{VOLL}\cdot u_t\right)"
              />
              <p className="text-[11px] text-[#64748B]">
                Subject to hourly power balance (<KaTeXFormula tex="\|A\mathbf{x}-\mathbf{b}\|_\infty < 10^{-2}" />), thermal ramp bounds <KaTeXFormula tex="|P_{i,t}-P_{i,t-1}|\le R_i" />, and BESS SoC dynamics <KaTeXFormula tex="E_{t+1} = E_t + \eta_c P_{\text{ch},t} - P_{\text{dis},t}/\eta_d" />.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Numerical Solution & Worked Intermediate Tables */}
        <section className="space-y-4 border-t border-[#E2E8F0] pt-5">
          <h2 className="text-base font-semibold text-[#0F172A]">
            4. Worked Numerical Solution &amp; Intermediate Calculation Tables
          </h2>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Worked QR Substitution Table at active hour */}
            <div className="space-y-2 lg:col-span-5">
              <div className="text-xs font-semibold text-[#0F172A]">
                A. Regression Term Substitution at Hour {numericalForecast.workedHour.toString().padStart(2, '0')}:00
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
                <table className="w-full border-collapse text-right text-[11px] font-mono-tabular">
                  <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] font-sans text-[#64748B]">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left font-medium">Feature</th>
                      <th className="px-2 py-1.5 font-medium">β̂ⱼ</th>
                      <th className="px-2 py-1.5 font-medium">xⱼ</th>
                      <th className="px-2.5 py-1.5 font-medium text-[#2563EB]">β̂ⱼ·xⱼ (MW)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {numericalForecast.workedTerms.slice(0, 8).map((t) => (
                      <tr key={t.featureName}>
                        <td className="px-2.5 py-1 text-left font-sans text-[#0F172A]">
                          {t.featureName}
                        </td>
                        <td className="px-2 py-1 text-[#64748B]">{t.beta.toFixed(2)}</td>
                        <td className="px-2 py-1 text-[#0F172A]">{t.featureValue.toFixed(3)}</td>
                        <td className="px-2.5 py-1 font-semibold text-[#2563EB]">
                          {t.contributionMW >= 0 ? '+' : ''}
                          {t.contributionMW.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[11px] font-mono-tabular text-[#64748B]">
                Predicted Sum D̂({numericalForecast.workedHour}) ={' '}
                <strong className="text-[#0F172A]">{numericalForecast.workedPredictedMW.toFixed(2)} MW</strong>{' '}
                · ||QᵀQ - I||_F = {numericalForecast.qrOrthogonalityError.toExponential(2)}
              </div>
            </div>

            {/* Sample 24h Optimal Dispatch Intermediate Schedule (6-hour intervals + active hour) */}
            <div className="space-y-2 lg:col-span-7">
              <div className="text-xs font-semibold text-[#0F172A]">
                B. Optimal LP Dispatch Trajectory Sample (4-Hour Steps &amp; Active Hour {activeHour}:00)
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
                <table className="w-full border-collapse text-right text-[11px] font-mono-tabular">
                  <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] font-sans text-[#64748B]">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Hour</th>
                      <th className="px-2 py-1.5 font-medium">Load (MW)</th>
                      <th className="px-2 py-1.5 font-medium">RE (MW)</th>
                      <th className="px-2 py-1.5 font-medium">Thermal (MW)</th>
                      <th className="px-2 py-1.5 font-medium">BESS Net</th>
                      <th className="px-2 py-1.5 font-medium">SoC (MWh)</th>
                      <th className="px-2 py-1.5 font-medium">Cost (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {daySummary.hourlyDispatches
                      .filter((h) => h.hour % 4 === 0 || h.hour === activeHour || h.hour === 20)
                      .map((h) => {
                        const thermalMW = h.totalDispatchedGenerationMW - h.renewableGenerationMW;
                        return (
                          <tr
                            key={h.hour}
                            className={h.hour === activeHour ? 'bg-[#EFF6FF]/65 font-semibold' : ''}
                          >
                            <td className="px-2 py-1 text-left text-[#0F172A]">{h.timestampLabel}</td>
                            <td className="px-2 py-1">{h.totalDemandMW.toFixed(1)}</td>
                            <td className="px-2 py-1 text-[#10B981]">
                              {h.renewableGenerationMW.toFixed(1)}
                            </td>
                            <td className="px-2 py-1 text-[#64748B]">{thermalMW.toFixed(1)}</td>
                            <td className="px-2 py-1 text-[#0891B2]">
                              {h.batteryNetPowerMW >= 0 ? '+' : ''}
                              {h.batteryNetPowerMW.toFixed(1)}
                            </td>
                            <td className="px-2 py-1">{h.batterySocMWh.toFixed(1)}</td>
                            <td className="px-2 py-1">₹{formatInr(h.dispatchCostInr)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <div className="text-[11px] font-mono-tabular text-[#64748B]">
                Solver: {dispatchBundle.solverStatus.toUpperCase()} ({dispatchBundle.numVariables} vars,{' '}
                {dispatchBundle.numConstraints} constraints, {dispatchBundle.simplexIterations} pivots) · Max Balance Residual:{' '}
                {dispatchBundle.residualSummary.maxPowerBalanceResidualMW.toExponential(2)} MW
              </div>
            </div>
          </div>
        </section>

        {/* 6. Graphs & Fair Optimization Strategy Comparison */}
        <section className="print-avoid-break space-y-4 border-t border-[#E2E8F0] pt-5">
          <h2 className="text-base font-semibold text-[#0F172A]">
            5. Operational Dispatch Graph &amp; Fair Optimization Comparison
          </h2>

          {/* Print-Safe Inline SVG Chart */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#0F172A]">
                24-Hour Optimal Supply, Demand &amp; Renewable Trajectory ({activeScenario.name})
              </span>
              <div className="flex items-center gap-4 text-[11px] text-[#64748B]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-4 bg-[#0F172A]" /> Demand (MW)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-4 bg-[#2563EB]" /> Total Generation (MW)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-4 bg-[#10B981]" /> Renewable (MW)
                </span>
              </div>
            </div>
            <svg
              viewBox={`0 0 ${chartGeom.width} ${chartGeom.height}`}
              className="h-auto w-full"
              role="img"
              aria-label="24-hour demand versus generation dispatch curve"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const mw = Math.round(chartGeom.maxY * frac);
                const y = chartGeom.yOf(mw);
                return (
                  <g key={frac}>
                    <line
                      x1={chartGeom.padL}
                      x2={chartGeom.width - chartGeom.padR}
                      y1={y}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                    />
                    <text
                      x={chartGeom.padL - 6}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="10"
                      fill="#64748B"
                    >
                      {mw}
                    </text>
                  </g>
                );
              })}
              {[0, 4, 8, 12, 16, 20, 23].map((h) => (
                <text
                  key={h}
                  x={chartGeom.xOf(h)}
                  y={chartGeom.height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#64748B"
                >
                  {String(h).padStart(2, '0')}:00
                </text>
              ))}
              <polyline
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
                points={chartGeom.rePoly}
              />
              <polyline
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.2"
                points={chartGeom.genPoly}
              />
              <polyline
                fill="none"
                stroke="#0F172A"
                strokeWidth="2"
                strokeDasharray="5 3"
                points={chartGeom.demandPoly}
              />
            </svg>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="py-2 pr-4 font-medium">Dispatch Strategy (Identical Constraints)</th>
                  <th className="py-2 pr-4 text-right font-medium">24h Cost (INR)</th>
                  <th className="py-2 pr-4 text-right font-medium">Savings vs Thermal-First</th>
                  <th className="py-2 pr-4 text-right font-medium">Avg RE Share</th>
                  <th className="py-2 pr-4 text-right font-medium">Emissions (tCO₂e)</th>
                  <th className="py-2 pr-4 text-right font-medium">Unserved (MWh)</th>
                  <th className="py-2 text-right font-medium">Max Residual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {dispatchBundle.comparisons.map((c) => (
                  <tr
                    key={c.strategy}
                    className={c.strategy === 'lp-optimal' ? 'bg-[#EFF6FF]/60 font-semibold' : ''}
                  >
                    <td className="py-2 pr-4 text-[#0F172A]">{c.label}</td>
                    <td className="py-2 pr-4 text-right font-mono-tabular">
                      ₹{formatInr(c.totalCostInr)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono-tabular text-[#10B981]">
                      {c.costSavingsVsThermalFirstPercent.toFixed(2)}%
                    </td>
                    <td className="py-2 pr-4 text-right font-mono-tabular">
                      {c.renewableContributionPercent.toFixed(2)}%
                    </td>
                    <td className="py-2 pr-4 text-right font-mono-tabular text-[#64748B]">
                      {c.totalEmissionsTonnesCO2e.toFixed(2)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono-tabular">
                      {c.unservedEnergyMWh.toFixed(2)}
                    </td>
                    <td className="py-2 text-right font-mono-tabular text-[#64748B]">
                      {c.maxBalanceResidualMW.toExponential(2)} MW
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 7. 8-Experiment Scientific Benchmark Summary & Reproducibility Registry */}
        <section className="space-y-4 border-t border-[#E2E8F0] pt-5">
          <h2 className="text-base font-semibold text-[#0F172A]">
            6. Accuracy Analysis &amp; 8-Experiment Reproducibility Registry
          </h2>
          <p className="text-xs text-[#64748B]">
            Every row below reflects an actual live execution of the corresponding Phase 7 experimental module with explicit algorithmic parameters, IEEE-754 tolerance, seed provenance, and measured execution time.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="py-2 pr-3 font-medium">Code</th>
                  <th className="py-2 pr-3 font-medium">Experiment &amp; Algorithm</th>
                  <th className="py-2 pr-3 font-medium">Key Measured Outcomes</th>
                  <th className="py-2 pr-3 font-medium">Tolerance / Seed</th>
                  <th className="py-2 text-right font-medium">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {orderedExperiments.map((exp) => (
                  <tr key={exp.manifest.experimentId} className="align-top">
                    <td className="py-2.5 pr-3 font-mono-tabular font-semibold text-[#2563EB] whitespace-nowrap">
                      {exp.manifest.experimentCode}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-[#0F172A]">{exp.manifest.title}</div>
                      <div className="text-[11px] text-[#64748B]">{exp.manifest.algorithmName}</div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono-tabular text-[11px] text-[#0F172A]">
                      {exp.summaryMetrics
                        .slice(0, 2)
                        .map((m) => `${m.label}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`)
                        .join(' · ')}
                    </td>
                    <td className="py-2.5 pr-3 text-[11px] text-[#64748B]">
                      <div>{exp.manifest.numericalTolerance}</div>
                      <div className="font-mono-tabular">{exp.manifest.seedLabel}</div>
                    </td>
                    <td className="py-2.5 text-right font-mono-tabular text-[#0F172A] whitespace-nowrap">
                      {exp.manifest.computeMs.toFixed(2)} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 8. Limitations & Conclusion */}
        <section className="print-avoid-break grid grid-cols-1 gap-6 border-t border-[#E2E8F0] pt-5 md:grid-cols-2">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-[#0F172A]">7. Methodological Limitations</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-[#64748B]">
              <li>
                <strong className="text-[#0F172A]">Synthetic Grid Baseline:</strong> Unless an external telemetry CSV is uploaded, microgrid loads and INR tariffs reflect calibrated synthetic profiles rather than metered utility SCADA exports.
              </li>
              <li>
                <strong className="text-[#0F172A]">Single-Bus LP Relaxation:</strong> Optimal dispatch enforces aggregate bus power balance, BESS state-of-charge dynamics, and thermal ramp bounds without AC optimal power flow (AC-OPF) reactive losses or binary startup variables.
              </li>
              <li>
                <strong className="text-[#0F172A]">IEEE-754 Condition Limits:</strong> High-order Hilbert systems (<KaTeXFormula tex="n \ge 7" />) exhibit inherent forward error amplification regardless of partial pivoting due to finite 53-bit significand precision.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-[#0F172A]">8. Capstone Conclusion</h2>
            <p className="text-xs leading-relaxed text-[#64748B]">
              Under scenario <strong className="text-[#0F172A]">{activeScenario.name}</strong>, the unified Householder QR + Bounded Simplex LP pipeline achieved a 24-hour dispatch cost of{' '}
              <strong className="font-mono-tabular text-[#0F172A]">
                ₹{formatInr(lpComp?.totalCostInr ?? daySummary.totalDailyCostInr)}
              </strong>{' '}
              (saving{' '}
              <strong className="font-mono-tabular text-[#10B981]">
                {(lpComp?.costSavingsVsThermalFirstPercent ?? 0).toFixed(2)}%
              </strong>{' '}
              vs. thermal-first baseline and{' '}
              <strong className="font-mono-tabular text-[#10B981]">
                {((heurComp?.totalCostInr ?? 0) - (lpComp?.totalCostInr ?? 0) >= 0
                  ? ((lpComp?.costSavingsVsHeuristicPercent ?? 0).toFixed(2))
                  : '0.00')}
                %
              </strong>{' '}
              vs. constrained heuristic at identical terminal SoC constraints, with{' '}
              <strong className="font-mono-tabular text-[#0F172A]">
                {totalUnservedMWh.toFixed(2)} MWh
              </strong>{' '}
              unserved load and max nodal residual{' '}
              <strong className="font-mono-tabular text-[#0F172A]">
                {dispatchBundle.residualSummary.maxPowerBalanceResidualMW.toExponential(2)} MW
              </strong>
              ). By coupling verified numerical methods with transparent provenance and reproducible experiment manifests, GRIDMATH 3D establishes an auditable engineering benchmark for smart grid planning.
            </p>
            <div className="pt-1 text-[11px] font-mono-tabular text-[#64748B]">
              Thermal-First Baseline: ₹{formatInr(tfComp?.totalCostInr ?? 0)} · Renewable Heuristic: ₹
              {formatInr(heurComp?.totalCostInr ?? 0)} · LP Optimal: ₹{formatInr(lpComp?.totalCostInr ?? 0)}
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
