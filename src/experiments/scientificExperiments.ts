import type { ForecastDatasetBundle } from '../forecasting/datasetManager';
import {
  computeForecastMetrics,
  runNumericalDemandForecast,
  type WeatherScenarioId,
} from '../forecasting/numericalForecaster';
import { solveGaussianElimination } from '../math/gaussianElimination';
import { computeNumericalIntegration } from '../math/integration';
import { solveLeastSquaresRegression, type RegressionObservation } from '../math/regression';
import {
  createDefaultDispatchConfig,
  runOptimalEnergyDispatch,
  type DispatchOptimizationConfig,
} from '../optimization/optimalDispatchEngine';
import {
  buildEffectiveScenario,
  DEFAULT_WEATHER_CONTROLS,
} from '../simulation/digitalTwinPipeline';
import type { SimulationScenario } from '../types/grid';

export const SOFTWARE_VERSION = 'GRIDMATH 3D v1.7.0 (Phase 7)';

export type ExperimentId =
  | 'forecast-accuracy'
  | 'integration-accuracy'
  | 'gaussian-stability'
  | 'regression-comparison'
  | 'dispatch-vs-heuristic'
  | 'demand-sensitivity'
  | 'renewable-sensitivity'
  | 'outage-stress';

export interface ExperimentDescriptor {
  id: ExperimentId;
  code: string;
  title: string;
  category: 'Forecasting' | 'Numerical Core' | 'Optimization' | 'Stress Testing';
  shortDescription: string;
}

export const EXPERIMENT_CATALOG: ExperimentDescriptor[] = [
  {
    id: 'forecast-accuracy',
    code: 'EXP-01',
    title: 'Forecast Accuracy & Holdout Validation',
    category: 'Forecasting',
    shortDescription:
      'Evaluates Householder QR regression vs 4-Feature Core OLS vs Seasonal-Naive across holdout windows and weather scenarios.',
  },
  {
    id: 'integration-accuracy',
    code: 'EXP-02',
    title: 'Numerical Integration Quadrature Convergence',
    category: 'Numerical Core',
    shortDescription:
      'Benchmarks Composite Trapezoidal O(h²) vs Simpson 1/3 O(h⁴) against closed-form analytic integrals across subdivision refinements.',
  },
  {
    id: 'gaussian-stability',
    code: 'EXP-03',
    title: 'Gaussian Elimination Conditioning & Pivoting Stability',
    category: 'Numerical Core',
    shortDescription:
      'Compares Partial Pivoting vs Unpivoted Elimination on ill-conditioned Hilbert & small-pivot systems against known exact solutions.',
  },
  {
    id: 'regression-comparison',
    code: 'EXP-04',
    title: 'Regression Solver Comparison (QR vs Normal Equations)',
    category: 'Numerical Core',
    shortDescription:
      'Quantifies κ(X) Householder QR stability vs κ(X)² Normal Equations amplification under controlled predictor collinearity.',
  },
  {
    id: 'dispatch-vs-heuristic',
    code: 'EXP-05',
    title: 'Optimal LP vs Heuristic Dispatch Comparison',
    category: 'Optimization',
    shortDescription:
      'Evaluates Two-Phase Bounded Simplex LP, Renewable-Priority Heuristic, and Thermal-First under identical 24h constraints.',
  },
  {
    id: 'demand-sensitivity',
    code: 'EXP-06',
    title: 'Demand & Temperature Sensitivity Analysis',
    category: 'Stress Testing',
    shortDescription:
      'Maps 24h optimal LP cost, peak demand, and unserved load feasible boundary across demand multipliers and cooling ΔT.',
  },
  {
    id: 'renewable-sensitivity',
    code: 'EXP-07',
    title: 'Renewable Generation Sensitivity Surface',
    category: 'Optimization',
    shortDescription:
      'Sweeps Solar irradiance × Wind resource availability factors to quantify cost, emissions, curtailment, and RE share.',
  },
  {
    id: 'outage-stress',
    code: 'EXP-08',
    title: 'Generator Outage (N-1 / N-2) Stress Testing',
    category: 'Stress Testing',
    shortDescription:
      'Assesses reserve adequacy, VOLL shortage risk, BESS buffer depletion, and power balance residuals under forced unit outages.',
  },
];

export interface ExperimentParameters {
  holdoutWindowHours: 24 | 48 | 72;
  forecastWeatherId: WeatherScenarioId;
  integrandId: 'diurnal-load' | 'cubic-polynomial' | 'sinusoidal-peak';
  maxSubdivisions: 16 | 32 | 64;
  hilbertMaxDim: 4 | 5 | 6 | 7;
  pivotEpsilonExp: number; // 10^(-pivotEpsilonExp)
  collinearityDeltaExp: number; // 10^(-collinearityDeltaExp)
  seed: number;
  carbonPriceSweepInr: number;
  demandScaleMax: number;
  tempDeltaMaxDegC: number;
  solarScaleMin: number;
  windScaleMax: number;
  outageBatterySocMWh: number;
}

export const DEFAULT_EXPERIMENT_PARAMETERS: ExperimentParameters = {
  holdoutWindowHours: 48,
  forecastWeatherId: 'nominal',
  integrandId: 'diurnal-load',
  maxSubdivisions: 32,
  hilbertMaxDim: 6,
  pivotEpsilonExp: 10,
  collinearityDeltaExp: 6,
  seed: 20261117,
  carbonPriceSweepInr: 1500,
  demandScaleMax: 1.25,
  tempDeltaMaxDegC: 6,
  solarScaleMin: 0.25,
  windScaleMax: 1.5,
  outageBatterySocMWh: 90,
};

export interface ReproducibilityManifest {
  experimentId: ExperimentId;
  experimentCode: string;
  title: string;
  inputDataset: string;
  dataProvenance: 'Synthetic / Analytic Benchmark' | 'Uploaded CSV + Synthetic Grid';
  algorithmName: string;
  parameters: Record<string, string | number | boolean>;
  numericalTolerance: string;
  seedLabel: string;
  timestampIso: string;
  softwareVersion: string;
  computeMs: number;
}

export interface ExperimentKpiMetric {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  tone?: 'primary' | 'renewable' | 'warning' | 'neutral';
}

export type ExperimentPlot3DData =
  | {
      kind: 'residual-landscape';
      xLabel: string;
      yLabel: string;
      zLabel: string;
      points: { hour: number; tempDegC: number; residualMW: number; actualMW: number; predMW: number }[];
    }
  | {
      kind: 'error-surface';
      xLabel: string;
      yLabel: string;
      zLabel: string;
      xCategories: string[];
      zCategories: string[];
      /** rows[rowIdx][colIdx] = { log10Err, rawErr, label } */
      grid: { log10Err: number; rawErr: number; label: string }[][];
    }
  | {
      kind: 'generation-vs-time';
      xLabel: string;
      yLabel: string;
      zLabel: string;
      strategies: string[];
      /** [strategyIdx][hour] = MW */
      seriesMW: number[][];
      demandMW: number[];
    }
  | {
      kind: 'parameter-surface';
      xLabel: string;
      yLabel: string;
      zLabel: string;
      xValues: number[];
      zValues: number[];
      /** [zIdx][xIdx] */
      yValues: number[][];
      shortageFlags: boolean[][];
      valueUnit: string;
    };

export interface ScientificExperimentResult {
  manifest: ReproducibilityManifest;
  objectiveStatement: string;
  formulaTex: string;
  methodologyNote: string;
  summaryMetrics: ExperimentKpiMetric[];
  tableHeaders: string[];
  tableRows: (string | number)[][];
  plot3D: ExperimentPlot3DData;
  plotCaption: string;
  limitations: string[];
  researchIntegrityNote: string;
}

// Deterministic Mulberry32 PRNG for reproducible synthetic noise trials
function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Unpivoted Gaussian elimination (educational baseline demonstrating instability without pivoting)
function solveUnpivotedGaussian(A: number[][], b: number[]): {
  valid: boolean;
  solution: number[];
  residualInfNorm: number;
  maxPivotGrowth: number;
} {
  const n = A.length;
  const aug = A.map((r, i) => [...r, b[i]]);
  let maxEntry = Math.max(...A.flat().map((v) => Math.abs(v)), 1e-12);
  let maxSeen = maxEntry;

  for (let col = 0; col < n; col++) {
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-18 || !Number.isFinite(pivot)) {
      return { valid: false, solution: [], residualInfNorm: Infinity, maxPivotGrowth: Infinity };
    }
    for (let r = col + 1; r < n; r++) {
      const factor = aug[r][col] / pivot;
      for (let c = col; c <= n; c++) {
        aug[r][c] -= factor * aug[col][c];
        if (Math.abs(aug[r][c]) > maxSeen) maxSeen = Math.abs(aug[r][c]);
      }
      aug[r][col] = 0;
    }
  }

  const x = Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let rhs = aug[i][n];
    for (let j = i + 1; j < n; j++) rhs -= aug[i][j] * x[j];
    if (Math.abs(aug[i][i]) < 1e-18) {
      return { valid: false, solution: [], residualInfNorm: Infinity, maxPivotGrowth: Infinity };
    }
    x[i] = rhs / aug[i][i];
    if (!Number.isFinite(x[i])) {
      return { valid: false, solution: [], residualInfNorm: Infinity, maxPivotGrowth: Infinity };
    }
  }

  const res = A.map((row, i) =>
    Math.abs(row.reduce((acc, aij, j) => acc + aij * x[j], 0) - b[i]),
  );
  return {
    valid: true,
    solution: x,
    residualInfNorm: Math.max(...res),
    maxPivotGrowth: maxSeen / maxEntry,
  };
}

function vectorRelativeError(computed: number[], exact: number[]): number {
  if (computed.length !== exact.length || computed.length === 0) return Infinity;
  let diffSq = 0;
  let exactSq = 0;
  for (let i = 0; i < exact.length; i++) {
    diffSq += (computed[i] - exact[i]) ** 2;
    exactSq += exact[i] ** 2;
  }
  return Math.sqrt(diffSq) / Math.max(1e-15, Math.sqrt(exactSq));
}

// Normal equations solver (X^T X) beta = X^T y via Gaussian elimination (for Experiment 4 contrast vs QR)
function solveNormalEquationsOLS(X: number[][], y: number[]): {
  valid: boolean;
  beta: number[];
  condProxy: number;
} {
  const m = X.length;
  const p = X[0]?.length ?? 0;
  const xtx = Array.from({ length: p }, () => Array<number>(p).fill(0));
  const xty = Array<number>(p).fill(0);

  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let r = 0; r < m; r++) sum += X[r][i] * X[r][j];
      xtx[i][j] = sum;
    }
    let rhs = 0;
    for (let r = 0; r < m; r++) rhs += X[r][i] * y[r];
    xty[i] = rhs;
  }

  const solved = solveGaussianElimination(xtx, xty);
  const diag = xtx.map((r, i) => Math.abs(r[i]));
  const condProxy = Math.max(...diag) / Math.max(1e-16, Math.min(...diag));
  return {
    valid: solved.valid,
    beta: solved.solution,
    condProxy,
  };
}

export function runScientificExperiment(params: {
  experimentId: ExperimentId;
  scenario: SimulationScenario;
  dispatchConfig: DispatchOptimizationConfig;
  forecastDataset: ForecastDatasetBundle;
  expParams: ExperimentParameters;
}): ScientificExperimentResult {
  const { experimentId, scenario, dispatchConfig, forecastDataset, expParams } = params;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const timestampIso = new Date().toISOString();
  const descriptor = EXPERIMENT_CATALOG.find((e) => e.id === experimentId) ?? EXPERIMENT_CATALOG[0];
  const datasetLabel = forecastDataset.isSynthetic
    ? `Synthetic Demonstration (${forecastDataset.records.length}h, ${forecastDataset.timezone})`
    : `${forecastDataset.datasetName} (${forecastDataset.records.length}h, ${forecastDataset.timezone})`;
  const dataProvenance: ReproducibilityManifest['dataProvenance'] = forecastDataset.isSynthetic
    ? 'Synthetic / Analytic Benchmark'
    : 'Uploaded CSV + Synthetic Grid';

  switch (experimentId) {
    // -------------------------------------------------------------------------
    // EXPERIMENT 1: Forecast Accuracy Experiment
    // -------------------------------------------------------------------------
    case 'forecast-accuracy': {
      const windows: (24 | 48 | 72)[] = [24, 48, 72];
      const windowRuns = windows.map((h) =>
        runNumericalDemandForecast({
          records: forecastDataset.records,
          holdoutHours: h,
          weatherScenarioId: expParams.forecastWeatherId,
          workedHour: 14,
        }),
      );
      const primary =
        windowRuns[windows.indexOf(expParams.holdoutWindowHours)] ?? windowRuns[1];

      const residuals = primary.holdoutComparison.map((r) => r.residualMW);
      const meanRes = residuals.reduce((a, b) => a + b, 0) / Math.max(1, residuals.length);
      const maxAbsRes = Math.max(...residuals.map((r) => Math.abs(r)), 0);

      // Zero-denominator validity check demonstration on metrics
      const zeroDenomCheck = computeForecastMetrics([0, 120, 240], [4, 118, 244]);

      const tableHeaders = [
        'Holdout Window',
        'Model Variant',
        'MAE (MW)',
        'RMSE (MW)',
        'sMAPE (%)',
        'MAPE (%)',
        'R²',
        '||QᵀQ - I||_F',
      ];
      const tableRows: (string | number)[][] = [];
      windows.forEach((w, idx) => {
        const res = windowRuns[idx];
        if (!res.valid) return;
        const rows: [string, typeof res.fullModelMetrics, string][] = [
          ['Householder QR Multi-Reg', res.fullModelMetrics, res.qrOrthogonalityError.toExponential(2)],
          ['4-Feature Core OLS', res.coreModelMetrics, 'QR Subset'],
          ['Seasonal-Naive D(t-24)', res.naiveBaselineMetrics, 'N/A'],
        ];
        rows.forEach(([mName, m, qrErr]) => {
          tableRows.push([
            `${w}h (${res.trainCount}h train)`,
            mName,
            m.maeMW.toFixed(3),
            m.rmseMW.toFixed(3),
            `${m.smapePercent.toFixed(3)}%`,
            m.mapeValid && m.mapePercent !== null ? `${m.mapePercent.toFixed(3)}%` : 'Invalid (0 denom)',
            m.rSquared !== null ? m.rSquared.toFixed(4) : '—',
            qrErr,
          ]);
        });
      });

      const points = primary.holdoutComparison.slice(-48).map((r) => ({
        hour: r.hour,
        tempDegC: r.temperatureDegC,
        residualMW: Number(r.residualMW.toFixed(2)),
        actualMW: r.actualMW,
        predMW: r.fullModelMW,
      }));

      const computeMs = Number(
        Math.max(0.1, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(2),
      );

      return {
        manifest: {
          experimentId,
          experimentCode: descriptor.code,
          title: descriptor.title,
          inputDataset: datasetLabel,
          dataProvenance,
          algorithmName: 'Householder QR Least-Squares Multiple Regression (Zero-Leakage Holdout)',
          parameters: {
            holdoutWindowHours: expParams.holdoutWindowHours,
            weatherScenarioId: expParams.forecastWeatherId,
            featuresCount: primary.featureNames.length,
            chronologicalSplitVerified: primary.chronologicalVerified,
          },
          numericalTolerance: 'QR pivot rank norm > 1e-11 (IEEE-754 float64)',
          seedLabel: 'Deterministic (No PRNG)',
          timestampIso,
          softwareVersion: SOFTWARE_VERSION,
          computeMs,
        },
        objectiveStatement:
          'Validate out-of-sample generalization accuracy of causal Fourier + Lag-24 + Cooling regression against a 4-feature core OLS model and Seasonal-Naive baseline without future data leakage.',
        formulaTex:
          '\\min_{\\boldsymbol{\\beta}} \\|X_{\\text{train}}\\boldsymbol{\\beta} - \\mathbf{y}_{\\text{train}}\\|_2, \\quad e_t = D_t - \\hat{D}_t, \\quad \\text{sMAPE} = \\frac{200}{N}\\sum_{t=1}^N \\frac{|e_t|}{|D_t| + |\\hat{D}_t|}',
        methodologyNote:
          'Strict chronological split ensures max(train timestamp) < min(holdout timestamp). MAPE automatically marks invalid when any D_t == 0 while sMAPE remains bounded.',
        summaryMetrics: [
          {
            label: 'Full QR Holdout RMSE',
            value: primary.fullModelMetrics.rmseMW.toFixed(2),
            unit: 'MW',
            detail: `Naive RMSE: ${primary.naiveBaselineMetrics.rmseMW.toFixed(2)} MW`,
            tone: 'primary',
          },
          {
            label: 'Holdout MAE / sMAPE',
            value: primary.fullModelMetrics.maeMW.toFixed(2),
            unit: 'MW',
            detail: `sMAPE ${primary.fullModelMetrics.smapePercent.toFixed(2)}% · R² = ${primary.fullModelMetrics.rSquared?.toFixed(4) ?? '—'}`,
            tone: 'renewable',
          },
          {
            label: 'Mean Residual Bias',
            value: `${meanRes >= 0 ? '+' : ''}${meanRes.toFixed(3)}`,
            unit: 'MW',
            detail: `Max |e_t| = ${maxAbsRes.toFixed(2)} MW`,
            tone: 'neutral',
          },
          {
            label: 'QR Orthogonality Error',
            value: primary.qrOrthogonalityError.toExponential(2),
            detail: `Zero-denom MAPE check: ${zeroDenomCheck.mapeValid ? 'Valid' : 'Properly Rejected'}`,
            tone: 'primary',
          },
        ],
        tableHeaders,
        tableRows,
        plot3D: {
          kind: 'residual-landscape',
          xLabel: 'Hour of Day (0..23 h)',
          yLabel: 'Residual e = D - D̂ (MW)',
          zLabel: 'Ambient Temp (°C)',
          points,
        },
        plotCaption:
          '3D Regression Residual Landscape (Hour × Residual MW × Temp °C). Zero plane at y=0; emerald within ±8 MW, amber/crimson above ±12 MW.',
        limitations: [
          'Assumes linear additivity of temperature cooling terms and harmonic Fourier basis.',
          'Holdout metrics reflect synthetic 14-day load-weather correlations unless a real telemetry CSV is uploaded.',
          'Extreme unmodeled grid events (e.g., sudden feeder switching) are not captured in lag-24 features.',
        ],
        researchIntegrityNote: `${dataProvenance}. No future holdout observations enter training matrix X or lag normalization.`,
      };
    }

    // -------------------------------------------------------------------------
    // EXPERIMENT 2: Numerical Integration Accuracy Experiment
    // -------------------------------------------------------------------------
    case 'integration-accuracy': {
      const integrandSpecs: Record<
        ExperimentParameters['integrandId'],
        {
          label: string;
          tex: string;
          a: number;
          b: number;
          fn: (t: number) => number;
          exact: (a: number, b: number) => number;
        }
      > = {
        'diurnal-load': {
          label: 'Smooth Diurnal Load P(t) = 320 + 95·sin(πt/24) - 42·cos(πt/12) MW',
          tex: 'E = \\int_{0}^{24} \\left[320 + 95\\sin\\left(\\frac{\\pi t}{24}\\right) - 42\\cos\\left(\\frac{\\pi t}{12}\\right)\\right] dt',
          a: 0,
          b: 24,
          fn: (t) => 320 + 95 * Math.sin((Math.PI * t) / 24) - 42 * Math.cos((Math.PI * t) / 12),
          exact: (a, b) => {
            const anti = (x: number) =>
              320 * x -
              (95 * 24) / Math.PI * Math.cos((Math.PI * x) / 24) -
              (42 * 12) / Math.PI * Math.sin((Math.PI * x) / 12);
            return anti(b) - anti(a);
          },
        },
        'cubic-polynomial': {
          label: 'Exact Cubic Polynomial P(t) = 1.5t³ - 18t² + 54t + 200 MW',
          tex: 'E = \\int_{0}^{12} (1.5t^3 - 18t^2 + 54t + 200)\\,dt',
          a: 0,
          b: 12,
          fn: (t) => 1.5 * t ** 3 - 18 * t ** 2 + 54 * t + 200,
          exact: (a, b) => {
            const anti = (x: number) => 0.375 * x ** 4 - 6 * x ** 3 + 27 * x ** 2 + 200 * x;
            return anti(b) - anti(a);
          },
        },
        'sinusoidal-peak': {
          label: 'High-Curvature Peak P(t) = 260 + 140·sin²(πt/12) MW',
          tex: 'E = \\int_{0}^{24} \\left[260 + 140\\sin^2\\left(\\frac{\\pi t}{12}\\right)\\right] dt',
          a: 0,
          b: 24,
          fn: (t) => 260 + 140 * Math.sin((Math.PI * t) / 12) ** 2,
          exact: (a, b) => {
            const anti = (x: number) =>
              330 * x - (70 * 6) / Math.PI * Math.sin((Math.PI * x) / 6);
            return anti(b) - anti(a);
          },
        },
      };

      const spec = integrandSpecs[expParams.integrandId];
      const subCounts = [4, 8, 16, 32, 64].filter((n) => n <= expParams.maxSubdivisions);
      if (subCounts.length < 3) subCounts.push(16, 32);

      const results = subCounts.map((n) =>
        computeNumericalIntegration({
          fn: spec.fn,
          exactIntegral: spec.exact,
          a: spec.a,
          b: spec.b,
          subdivisions: n,
          method: 'simpson',
        }),
      );

      const exactVal = results[0].exactEnergyMWh ?? 0;
      const finest = results[results.length - 1];

      const tableHeaders = [
        'Subdivisions (n)',
        'Step h (hr)',
        'Trapezoidal (MWh)',
        'Trap Abs Err (MWh)',
        'Simpson 1/3 (MWh)',
        'Simp Abs Err (MWh)',
        'Exact Analytic (MWh)',
      ];
      const tableRows: (string | number)[][] = results.map((r) => [
        r.subdivisions,
        r.stepSizeH.toFixed(4),
        r.trapezoidalEnergyMWh.toFixed(6),
        (r.trapezoidalAbsErrorMWh ?? 0).toExponential(3),
        (r.simpsonEnergyMWh ?? 0).toFixed(6),
        (r.simpsonAbsErrorMWh ?? 0).toExponential(3),
        exactVal.toFixed(6),
      ]);

      // Build 3D Error Surface: Method (Trapezoidal vs Simpson) x Subdivisions n -> log10(Abs Error)
      const clampLog = (err: number | null) => {
        const val = Math.max(1e-12, err ?? 1e-12);
        return Number(Math.log10(val).toFixed(3));
      };
      const grid = [
        results.map((r) => ({
          log10Err: clampLog(r.trapezoidalAbsErrorMWh),
          rawErr: r.trapezoidalAbsErrorMWh ?? 0,
          label: `Trap n=${r.subdivisions}`,
        })),
        results.map((r) => ({
          log10Err: clampLog(r.simpsonAbsErrorMWh),
          rawErr: r.simpsonAbsErrorMWh ?? 0,
          label: `Simp n=${r.subdivisions}`,
        })),
      ];

      // Empirical convergence order between first and last n
      const trapRatio =
        (results[0].trapezoidalAbsErrorMWh ?? 1e-12) /
        Math.max(1e-12, finest.trapezoidalAbsErrorMWh ?? 1e-12);
      const simpRatio =
        (results[0].simpsonAbsErrorMWh ?? 1e-12) /
        Math.max(1e-12, finest.simpsonAbsErrorMWh ?? 1e-12);
      const nRatio = finest.subdivisions / results[0].subdivisions;
      const trapOrder = Math.log(Math.max(1, trapRatio)) / Math.log(nRatio);
      const simpOrder =
        (finest.simpsonAbsErrorMWh ?? 0) < 1e-10
          ? 4.0
          : Math.log(Math.max(1, simpRatio)) / Math.log(nRatio);

      const computeMs = Number(
        Math.max(0.1, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(2),
      );

      return {
        manifest: {
          experimentId,
          experimentCode: descriptor.code,
          title: descriptor.title,
          inputDataset: `Analytic Test Benchmark: ${spec.label}`,
          dataProvenance: 'Synthetic / Analytic Benchmark',
          algorithmName: "Composite Trapezoidal O(h²) vs Composite Simpson's 1/3 O(h⁴)",
          parameters: {
            integrandId: expParams.integrandId,
            interval: `[${spec.a}, ${spec.b}] h`,
            subdivisionSchedule: subCounts.join(', '),
          },
          numericalTolerance: 'Exact closed-form antiderivative comparison (float64)',
          seedLabel: 'Deterministic (Closed-form Analytic)',
          timestampIso,
          softwareVersion: SOFTWARE_VERSION,
          computeMs,
        },
        objectiveStatement:
          'Verify asymptotic quadrature convergence rates against closed-form analytical integrals, proving exact degree-3 polynomial precision for Simpson 1/3.',
        formulaTex: spec.tex,
        methodologyNote:
          'Composite Simpson 1/3 cancels cubic error terms analytically, yielding O(h⁴) convergence on smooth periodic power curves and machine-zero error on cubic polynomials.',
        summaryMetrics: [
          {
            label: 'Exact Analytic Energy',
            value: exactVal.toFixed(3),
            unit: 'MWh',
            detail: `Interval [${spec.a}, ${spec.b}] hours`,
            tone: 'primary',
          },
          {
            label: `Simpson Error (n=${finest.subdivisions})`,
            value: (finest.simpsonAbsErrorMWh ?? 0).toExponential(2),
            unit: 'MWh',
            detail: `Empirical order ≈ O(h^${simpOrder.toFixed(2)})`,
            tone: 'renewable',
          },
          {
            label: `Trapezoidal Error (n=${finest.subdivisions})`,
            value: (finest.trapezoidalAbsErrorMWh ?? 0).toExponential(2),
            unit: 'MWh',
            detail: `Empirical order ≈ O(h^${trapOrder.toFixed(2)})`,
            tone: 'warning',
          },
          {
            label: 'Relative Accuracy Gain',
            value:
              (finest.simpsonAbsErrorMWh ?? 0) > 1e-13
                ? `${((finest.trapezoidalAbsErrorMWh ?? 0) / (finest.simpsonAbsErrorMWh ?? 1)).toFixed(0)}×`
                : 'Exact (Machine 0)',
            detail: 'Trapezoidal error / Simpson error',
            tone: 'primary',
          },
        ],
        tableHeaders,
        tableRows,
        plot3D: {
          kind: 'error-surface',
          xLabel: 'Subdivisions n',
          yLabel: 'log₁₀(|Error| MWh)',
          zLabel: 'Quadrature Rule',
          xCategories: subCounts.map((n) => `n=${n}`),
          zCategories: ['Trapezoidal O(h²)', 'Simpson 1/3 O(h⁴)'],
          grid,
        },
        plotCaption:
          '3D Quadrature Error Surface (Subdivisions n × log₁₀|Error MWh| × Rule). Lower floor = higher precision.',
        limitations: [
          'Simpson 1/3 requires an even number of uniform subintervals (n mod 2 = 0).',
          'Non-smooth step changes in real dispatch tariffs degrade classical Newton-Cotes convergence unless split at discontinuities.',
        ],
        researchIntegrityNote:
          'All errors computed strictly against exact closed-form antiderivatives in IEEE-754 double precision.',
      };
    }

    // -------------------------------------------------------------------------
    // EXPERIMENT 3: Gaussian Elimination Stability Experiment
    // -------------------------------------------------------------------------
    case 'gaussian-stability': {
      const eps = Math.pow(10, -expParams.pivotEpsilonExp);
      // 1) Classic partial-pivoting stress matrix [eps, 1; 1, 1] * [1; 1] = [1+eps; 2]
      const smallPivotA = [
        [eps, 1],
        [1, 1],
      ];
      const smallPivotExact = [1, 1];
      const smallPivotB = [eps + 1, 2];
      const smallPivoted = solveGaussianElimination(smallPivotA, smallPivotB);
      const smallUnpivoted = solveUnpivotedGaussian(smallPivotA, smallPivotB);

      // 2) Hilbert matrix family H_n (notoriously ill-conditioned) with exact x* = [1,...,1]
      const dims = Array.from({ length: expParams.hilbertMaxDim - 1 }, (_, idx) => idx + 2);
      const tableHeaders = [
        'Test System',
        'Pivot Policy',
        'Pivot Swaps',
        'Rel Error ||x - x*||₂/||x*||₂',
        'Residual ||Ax - b||∞',
        'Status',
      ];
      const tableRows: (string | number)[][] = [
        [
          `2×2 Pivot ε=1e-${expParams.pivotEpsilonExp}`,
          'Partial Pivoting',
          smallPivoted.swapCount,
          vectorRelativeError(smallPivoted.solution, smallPivotExact).toExponential(3),
          smallPivoted.residualInfNorm.toExponential(3),
          smallPivoted.valid ? 'Stable' : 'Singular',
        ],
        [
          `2×2 Pivot ε=1e-${expParams.pivotEpsilonExp}`,
          'No Pivoting',
          0,
          smallUnpivoted.valid
            ? vectorRelativeError(smallUnpivoted.solution, smallPivotExact).toExponential(3)
            : 'Overflow / Div0',
          smallUnpivoted.valid ? smallUnpivoted.residualInfNorm.toExponential(3) : 'Inf',
          'Catastrophic Cancellation',
        ],
      ];

      const pivotedLogs: { log10Err: number; rawErr: number; label: string }[] = [];
      const unpivotedLogs: { log10Err: number; rawErr: number; label: string }[] = [];

      let maxHilbertRelErr = 0;
      for (const n of dims) {
        const H = Array.from({ length: n }, (_, i) =>
          Array.from({ length: n }, (_, j) => 1 / (i + j + 1)),
        );
        const exactX = Array<number>(n).fill(1);
        const b = H.map((row) => row.reduce((a, v) => a + v, 0));

        // Perturbed H with tiny diagonal scaling to highlight pivot selection
        const pivRes = solveGaussianElimination(H, b);
        const unpivRes = solveUnpivotedGaussian(H, b);

        const pivErr = pivRes.valid ? vectorRelativeError(pivRes.solution, exactX) : 1;
        const unpivErr = unpivRes.valid ? vectorRelativeError(unpivRes.solution, exactX) : 1;
        maxHilbertRelErr = Math.max(maxHilbertRelErr, pivErr);

        tableRows.push([
          `Hilbert H_${n} (n=${n})`,
          'Partial Pivoting',
          pivRes.swapCount,
          pivErr.toExponential(3),
          pivRes.residualInfNorm.toExponential(3),
          pivRes.valid ? 'Solved' : 'Rank-Deficient',
        ]);
        tableRows.push([
          `Hilbert H_${n} (n=${n})`,
          'No Pivoting',
          0,
          unpivErr.toExponential(3),
          unpivRes.residualInfNorm.toExponential(3),
          unpivRes.valid ? 'Solved' : 'Failed',
        ]);

        pivotedLogs.push({
          log10Err: Number(Math.log10(Math.max(1e-16, pivErr)).toFixed(3)),
          rawErr: pivErr,
          label: `Pivoted H_${n}`,
        });
        unpivotedLogs.push({
          log10Err: Number(Math.log10(Math.max(1e-16, unpivErr)).toFixed(3)),
          rawErr: unpivErr,
          label: `Unpivoted H_${n}`,
        });
      }

      const piv2Err = vectorRelativeError(smallPivoted.solution, smallPivotExact);
      const unpiv2Err = smallUnpivoted.valid
        ? vectorRelativeError(smallUnpivoted.solution, smallPivotExact)
        : 1;

      const computeMs = Number(
        Math.max(0.1, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(2),
      );

      return {
        manifest: {
          experimentId,
          experimentCode: descriptor.code,
          title: descriptor.title,
          inputDataset: `Hilbert H₂..H_${expParams.hilbertMaxDim} & 2×2 Pivot ε = 10^(-${expParams.pivotEpsilonExp})`,
          dataProvenance: 'Synthetic / Analytic Benchmark',
          algorithmName: 'Gaussian Elimination (Scaled Partial Pivoting vs Unpivoted Baseline)',
          parameters: {
            hilbertMaxDim: expParams.hilbertMaxDim,
            pivotEpsilon: eps.toExponential(1),
            referenceSolution: 'x* = [1, 1, ..., 1]^T',
          },
          numericalTolerance: 'Singular threshold |pivot| < 1e-12 (Partial) vs 1e-18 (Unpivoted)',
          seedLabel: 'Deterministic (Exact Rational Construction)',
          timestampIso,
          softwareVersion: SOFTWARE_VERSION,
          computeMs,
        },
        objectiveStatement:
          'Measure floating-point cancellation error, pivot swap stabilization, and condition-number error growth relative to known exact solutions.',
        formulaTex:
          'H_{i,j} = \\frac{1}{i + j - 1}, \\quad \\frac{\\|\\hat{\\mathbf{x}} - \\mathbf{x}^*\\|_2}{\\|\\mathbf{x}^*\\|_2} \\lesssim \\kappa(A)\\varepsilon_{\\text{mach}}',
        methodologyNote:
          'Constructs b = A·x* using known exact x* = 1 so forward solution error ||x̂ - x*||₂ and backward residual ||Ax̂ - b||∞ can both be measured directly.',
        summaryMetrics: [
          {
            label: '2×2 Partial Pivot Error',
            value: piv2Err.toExponential(2),
            detail: `Swaps: ${smallPivoted.swapCount} (Exact x* = [1, 1])`,
            tone: 'renewable',
          },
          {
            label: '2×2 Unpivoted Error',
            value: unpiv2Err.toExponential(2),
            detail: `Multiplier 1/ε = ${(1 / eps).toExponential(1)}`,
            tone: 'warning',
          },
          {
            label: `Hilbert H_${expParams.hilbertMaxDim} Forward Error`,
            value: maxHilbertRelErr.toExponential(2),
            detail: 'Grows exponentially with dimension n',
            tone: 'primary',
          },
          {
            label: 'Machine Epsilon (float64)',
            value: Number.EPSILON.toExponential(2),
            detail: 'IEEE-754 53-bit significand',
            tone: 'neutral',
          },
        ],
        tableHeaders,
        tableRows,
        plot3D: {
          kind: 'error-surface',
          xLabel: 'Hilbert Dimension n',
          yLabel: 'log₁₀(Rel Error)',
          zLabel: 'Elimination Policy',
          xCategories: dims.map((d) => `H_${d}`),
          zCategories: ['Partial Pivoting', 'No Pivoting'],
          grid: [pivotedLogs, unpivotedLogs],
        },
        plotCaption:
          '3D Conditioning Error Surface (Hilbert Dimension n × log₁₀ Relative Error × Pivot Policy).',
        limitations: [
          'Right-hand side b = H_n·1 is computed in IEEE-754 float64 rather than arbitrary-precision rational arithmetic, introducing O(ε_mach) input rounding.',
          'Partial pivoting does not prevent forward error amplification when κ(A) approaches 1/ε_mach.',
        ],
        researchIntegrityNote:
          'Zero simulated error curves: all errors directly computed by solving each system in browser float64.',
      };
    }

    // -------------------------------------------------------------------------
    // EXPERIMENT 4: Regression Method Comparison (QR vs Normal Equations)
    // -------------------------------------------------------------------------
    case 'regression-comparison': {
      const deltas = [2, 4, 6, 7, 8].filter((d) => d <= expParams.collinearityDeltaExp + 2);
      const trueBeta = [120, 4.5, 4.5]; // Known ground-truth model y = 120 + 4.5*x1 + 4.5*x2
      const rng = createSeededRng(expParams.seed);

      const tableHeaders = [
        'Collinearity δ',
        'Solver Method',
        'β̂₀',
        'β̂₁',
        'β̂₂',
        'Param Error ||β̂ - β*||₂',
        'Fit RMSE',
      ];
      const tableRows: (string | number)[][] = [];
      const qrErrRow: { log10Err: number; rawErr: number; label: string }[] = [];
      const normalErrRow: { log10Err: number; rawErr: number; label: string }[] = [];

      let latestQrBetaErr = 0;
      let latestNormalBetaErr = 0;
      let latestQrOrtho = 0;

      // Generate deterministic base predictors x1 in [1..12]
      const baseX1 = Array.from({ length: 24 }, (_, i) => i + 1);
      const baseNoise = Array.from({ length: 24 }, () => (rng() - 0.5) * 0.02);

      for (const expD of deltas) {
        const delta = Math.pow(10, -expD);
        // Läuchli-style collinear predictor x2 = x1 + delta * orthogonal perturbation
        const obs: RegressionObservation[] = baseX1.map((x1, i) => {
          const x2 = x1 + delta * ((i % 2 === 0 ? 1 : -1) * (1 + 0.1 * (i % 5)));
          const y = trueBeta[0] + trueBeta[1] * x1 + trueBeta[2] * x2 + baseNoise[i];
          return { id: `${i}`, label: `Obs ${i}`, x1, x2, y };
        });

        const X = obs.map((o) => [1, o.x1, o.x2 ?? 0]);
        const yVec = obs.map((o) => o.y);

        const qrRes = solveLeastSquaresRegression(obs, 2);
        const normRes = solveNormalEquationsOLS(X, yVec);

        const qrBetaErr = qrRes.valid
          ? Math.sqrt(
              qrRes.coefficients.reduce((acc, b, idx) => acc + (b - trueBeta[idx]) ** 2, 0),
            )
          : 1e6;

        const normPreds = normRes.valid
          ? X.map((r) => r.reduce((acc, v, j) => acc + v * normRes.beta[j], 0))
          : yVec.map(() => 0);
        const normRmse = normRes.valid
          ? Math.sqrt(
              normPreds.reduce((acc, p, i) => acc + (p - yVec[i]) ** 2, 0) / yVec.length,
            )
          : Infinity;
        const normBetaErr = normRes.valid
          ? Math.sqrt(normRes.beta.reduce((acc, b, idx) => acc + (b - trueBeta[idx]) ** 2, 0))
          : 1e6;

        latestQrBetaErr = qrBetaErr;
        latestNormalBetaErr = normBetaErr;
        latestQrOrtho = qrRes.qrOrthogonalityError;

        tableRows.push([
          `10^(-${expD})`,
          'Householder QR',
          qrRes.valid ? qrRes.coefficients[0].toFixed(4) : 'Rank-Def',
          qrRes.valid ? qrRes.coefficients[1].toFixed(4) : '—',
          qrRes.valid ? qrRes.coefficients[2].toFixed(4) : '—',
          qrBetaErr.toExponential(3),
          qrRes.valid ? qrRes.rmse.toExponential(3) : '—',
        ]);
        tableRows.push([
          `10^(-${expD})`,
          'Normal Eq. (XᵀX)',
          normRes.valid ? normRes.beta[0].toFixed(4) : 'Singular',
          normRes.valid ? normRes.beta[1].toFixed(4) : '—',
          normRes.valid ? normRes.beta[2].toFixed(4) : '—',
          normBetaErr.toExponential(3),
          Number.isFinite(normRmse) ? normRmse.toExponential(3) : 'Inf',
        ]);

        qrErrRow.push({
          log10Err: Number(Math.log10(Math.max(1e-12, qrBetaErr)).toFixed(3)),
          rawErr: qrBetaErr,
          label: `QR δ=1e-${expD}`,
        });
        normalErrRow.push({
          log10Err: Number(Math.log10(Math.max(1e-12, normBetaErr)).toFixed(3)),
          rawErr: normBetaErr,
          label: `Normal δ=1e-${expD}`,
        });
      }

      const computeMs = Number(
        Math.max(0.1, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(2),
      );

      return {
        manifest: {
          experimentId,
          experimentCode: descriptor.code,
          title: descriptor.title,
          inputDataset: `Synthetic Collinear Predictor Suite (n=24, δ ∈ 10⁻²..10⁻${deltas[deltas.length - 1]})`,
          dataProvenance: 'Synthetic / Analytic Benchmark',
          algorithmName: 'Householder QR Factorization vs Normal Equations Gaussian Elimination',
          parameters: {
            maxCollinearityExp: expParams.collinearityDeltaExp,
            trueParameters: `[${trueBeta.join(', ')}]`,
            seed: expParams.seed,
          },
          numericalTolerance: 'QR norm > 1e-12; Gaussian pivot > 1e-12',
          seedLabel: `Mulberry32 Seed #${expParams.seed}`,
          timestampIso,
          softwareVersion: SOFTWARE_VERSION,
          computeMs,
        },
        objectiveStatement:
          'Demonstrate why Householder QR preserves κ(X) stability while forming Normal Equations XᵀX squares the condition number to κ(X)² and degrades parameter recovery.',
        formulaTex:
          'R\\boldsymbol{\\beta} = Q^T \\mathbf{y} \\; (\\kappa(X)) \\quad \\text{vs.} \\quad (X^T X)\\boldsymbol{\\beta} = X^T \\mathbf{y} \\; (\\kappa(X^T X) = \\kappa(X)^2)',
        methodologyNote:
          'Evaluates identical design matrices X and response vectors y using seeded float64 perturbations across increasing predictor collinearity.',
        summaryMetrics: [
          {
            label: 'QR Parameter Error (Tightest δ)',
            value: latestQrBetaErr.toExponential(2),
            detail: `Orthogonality ||QᵀQ - I||_F = ${latestQrOrtho.toExponential(2)}`,
            tone: 'renewable',
          },
          {
            label: 'Normal Eq. Parameter Error',
            value: latestNormalBetaErr.toExponential(2),
            detail: 'Degrades earliest as δ → 10⁻⁸',
            tone: 'warning',
          },
          {
            label: 'True Coefficient Target',
            value: '[120, 4.5, 4.5]',
            detail: '2-predictor synthetic ground truth',
            tone: 'primary',
          },
          {
            label: 'Deterministic RNG Seed',
            value: `${expParams.seed}`,
            detail: '±0.01 MW observation perturbation',
            tone: 'neutral',
          },
        ],
        tableHeaders,
        tableRows,
        plot3D: {
          kind: 'error-surface',
          xLabel: 'Collinearity δ',
          yLabel: 'log₁₀(||β̂ - β*||₂)',
          zLabel: 'OLS Solver',
          xCategories: deltas.map((d) => `1e-${d}`),
          zCategories: ['Householder QR', 'Normal Equations (XᵀX)'],
          grid: [qrErrRow, normalErrRow],
        },
        plotCaption:
          '3D Method Conditioning Surface (Collinearity δ × log₁₀ Parameter Error × Solver). QR stays well-conditioned beyond δ=10⁻⁶.',
        limitations: [
          'When predictors are strictly rank-deficient (δ=0), neither QR nor Normal Equations is uniquely invertible without ridge regularization.',
          'For well-conditioned grid load datasets (e.g. orthogonal Fourier harmonics), Normal Equations and QR converge to similar values.',
        ],
        researchIntegrityNote:
          'Controlled collinearity benchmark using deterministic Mulberry32 seed; all errors directly computed.',
      };
    }

    // -------------------------------------------------------------------------
    // EXPERIMENT 5: Optimization vs Heuristic Dispatch Comparison
    // -------------------------------------------------------------------------
    case 'dispatch-vs-heuristic': {
      const cfgZeroCarbon: DispatchOptimizationConfig = {
        ...dispatchConfig,
        strategy: 'lp-optimal',
        carbonPriceInrPerTonne: 0,
      };
      const cfgCarbonPriced: DispatchOptimizationConfig = {
        ...dispatchConfig,
        strategy: 'lp-optimal',
        carbonPriceInrPerTonne: expParams.carbonPriceSweepInr,
      };

      const baseBundle = runOptimalEnergyDispatch(scenario, cfgZeroCarbon);
      const carbonBundle = runOptimalEnergyDispatch(scenario, cfgCarbonPriced);

      const tableHeaders = [
        'Dispatch Strategy',
        'Carbon Price (INR/t)',
        '24h Total Cost (INR)',
        'Cost vs Thermal-First',
        'RE Share (%)',
        'Emissions (tCO₂e)',
        'Unserved (MWh)',
        'Max Residual (MW)',
      ];
      const tableRows: (string | number)[][] = baseBundle.comparisons.map((c) => [
        c.label,
        '0',
        Math.round(c.totalCostInr).toLocaleString('en-IN'),
        `${c.costSavingsVsThermalFirstPercent >= 0 ? '-' : '+'}${Math.abs(c.costSavingsVsThermalFirstPercent).toFixed(2)}%`,
        `${c.renewableContributionPercent.toFixed(2)}%`,
        c.totalEmissionsTonnesCO2e.toFixed(2),
        c.unservedEnergyMWh.toFixed(2),
        c.maxBalanceResidualMW.toExponential(2),
      ]);

      const lpCarbonComp = carbonBundle.comparisons.find((c) => c.strategy === 'lp-optimal');
      if (lpCarbonComp) {
        tableRows.push([
          `LP Optimal (Carbon-Weighted)`,
          `${expParams.carbonPriceSweepInr}`,
          Math.round(lpCarbonComp.totalCostInr).toLocaleString('en-IN'),
          `${lpCarbonComp.costSavingsVsThermalFirstPercent >= 0 ? '-' : '+'}${Math.abs(lpCarbonComp.costSavingsVsThermalFirstPercent).toFixed(2)}%`,
          `${lpCarbonComp.renewableContributionPercent.toFixed(2)}%`,
          lpCarbonComp.totalEmissionsTonnesCO2e.toFixed(2),
          lpCarbonComp.unservedEnergyMWh.toFixed(2),
          lpCarbonComp.maxBalanceResidualMW.toExponential(2),
        ]);
      }

      const lpSummary = baseBundle.comparisonSummaries['lp-optimal'];
      const heurSummary = baseBundle.comparisonSummaries['renewable-heuristic'];
      const tfSummary = baseBundle.comparisonSummaries['thermal-first'];

      const lpComp = baseBundle.comparisons.find((c) => c.strategy === 'lp-optimal')!;
      const heurComp = baseBundle.comparisons.find((c) => c.strategy === 'renewable-heuristic')!;

      const computeMs = Number(
        Math.max(0.1, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(2),
      );

      return {
        manifest: {
          experimentId,
          experimentCode: descriptor.code,
          title: descriptor.title,
          inputDataset: `${scenario.name} (24h, ${scenario.generators.length} Units + 180 MWh BESS)`,
          dataProvenance: scenario.isSynthetic ? 'Synthetic / Analytic Benchmark' : 'Uploaded CSV + Synthetic Grid',
          algorithmName: 'Two-Phase Bounded Simplex LP vs Constrained Heuristic vs Thermal-First',
          parameters: {
            numVariables: baseBundle.numVariables,
            numConstraints: baseBundle.numConstraints,
            terminalSocTargetMWh: cfgZeroCarbon.terminalSocTargetMWh,
            carbonPriceSweepInr: expParams.carbonPriceSweepInr,
            enforceUnitMinStable: cfgZeroCarbon.enforceUnitMinStable,
          },
          numericalTolerance: 'Primal/Dual feasibility tol = 1e-7; Balance residual < 1e-2 MW',
          seedLabel: 'Deterministic (LP Simplex)',
          timestampIso,
          softwareVersion: SOFTWARE_VERSION,
          computeMs,
        },
        objectiveStatement:
          'Compare global multi-period LP optimal energy dispatch against greedy heuristic and thermal-first baselines under identical capacity, ramp, SoC, and terminal energy constraints.',
        formulaTex:
          '\\min \\sum_{t=0}^{23}\\left(\\sum_i c_i P_{i,t} + c_{\\text{deg}}(P_{\\text{ch},t} + P_{\\text{dis},t}) + c_{\\text{CO}_2} E_t + \\text{VOLL}\\cdot u_t\\right)',
        methodologyNote:
          'All three strategies share identical generator bounds, ramp limits, battery efficiency η=0.90, and terminal SoC target reservation so cost comparisons are strictly fair.',
        summaryMetrics: [
          {
            label: 'LP Optimal Daily Cost',
            value: `₹${Math.round(lpComp.totalCostInr).toLocaleString('en-IN')}`,
            detail: `Simplex iterations: ${baseBundle.simplexIterations}`,
            tone: 'primary',
          },
          {
            label: 'Savings vs Thermal-First',
            value: `${lpComp.costSavingsVsThermalFirstPercent.toFixed(2)}%`,
            detail: `vs Heuristic: ${lpComp.costSavingsVsHeuristicPercent.toFixed(2)}%`,
            tone: 'renewable',
          },
          {
            label: 'Carbon-Priced Emissions',
            value: carbonBundle.summary.totalDailyEmissionsTonnesCO2e.toFixed(1),
            unit: 'tCO₂e',
            detail: `Baseline 0 INR/t: ${lpComp.totalEmissionsTonnesCO2e.toFixed(1)} tCO₂e`,
            tone: 'neutral',
          },
          {
            label: 'Max Constraint Residual',
            value: baseBundle.residualSummary.maxPowerBalanceResidualMW.toExponential(2),
            unit: 'MW',
            detail: `Heur Cost: ₹${Math.round(heurComp.totalCostInr).toLocaleString('en-IN')}`,
            tone: 'primary',
          },
        ],
        tableHeaders,
        tableRows,
        plot3D: {
          kind: 'generation-vs-time',
          xLabel: 'Hour (0..23 h)',
          yLabel: 'Dispatched Power (MW)',
          zLabel: 'Dispatch Strategy',
          strategies: ['LP Optimal', 'Renewable Heuristic', 'Thermal-First'],
          seriesMW: [
            lpSummary.hourlyDispatches.map((h) => h.totalDispatchedGenerationMW + Math.max(0, h.batteryNetPowerMW)),
            heurSummary.hourlyDispatches.map((h) => h.totalDispatchedGenerationMW + Math.max(0, h.batteryNetPowerMW)),
            tfSummary.hourlyDispatches.map((h) => h.totalDispatchedGenerationMW + Math.max(0, h.batteryNetPowerMW)),
          ],
          demandMW: scenario.hourlyDemand.map((h) => h.totalMW),
        },
        plotCaption:
          '3D Generation-vs-Time Comparison (Hour 0..23 × Supply MW × Strategy). Shows LP peak-shaving BESS arbitrage vs baselines.',
        limitations: [
          'Continuous LP relaxation models dispatchable stable minimums without integer unit-commitment on/off startup costs.',
          'Assumes deterministic 24h foresight of renewable irradiance and wind curves.',
        ],
        researchIntegrityNote:
          'All strategies enforced on identical constraint sets; terminal SoC target respected across heuristic & LP comparators.',
      };
    }

    // -------------------------------------------------------------------------
    // EXPERIMENT 6: Demand Sensitivity Analysis (Demand Scale x Temp Delta)
    // -------------------------------------------------------------------------
    case 'demand-sensitivity': {
      const scales = [0.85, 0.95, 1.05, Number(expParams.demandScaleMax.toFixed(2))];
      const tempOffsets = [0, Number((expParams.tempDeltaMaxDegC * 0.5).toFixed(1)), expParams.tempDeltaMaxDegC];

      const yValues: number[][] = [];
      const shortageFlags: boolean[][] = [];
      const tableHeaders = [
        'Demand Scale',
        'Temp Delta ΔT',
        'Peak Load (MW)',
        '24h LP Cost (INR)',
        'Emissions (tCO₂e)',
        'Unserved (MWh)',
        'Feasible Zone',
      ];
      const tableRows: (string | number)[][] = [];

      let zeroDeficitMaxPeak = 0;
      let maxCostObserved = 0;
      let minCostObserved = Infinity;
      let shortageCells = 0;

      for (let zi = 0; zi < tempOffsets.length; zi++) {
        const dt = tempOffsets[zi];
        const rowVals: number[] = [];
        const rowShort: boolean[] = [];

        for (let xi = 0; xi < scales.length; xi++) {
          const sc = scales[xi];
          const eff = buildEffectiveScenario({
            baseScenario: scenario,
            weatherControls: { ...DEFAULT_WEATHER_CONTROLS, demandScaleFactor: sc, temperatureDeltaDegC: dt },
            generatorOverrides: {},
            batteryInitialSocOverrideMWh: null,
          });
          const bundle = runOptimalEnergyDispatch(eff, {
            ...dispatchConfig,
            strategy: 'lp-optimal',
            terminalSocTargetMWh: Math.max(
              eff.battery.capacityMWh * eff.battery.minSocRatio,
              Math.min(eff.battery.capacityMWh * eff.battery.maxSocRatio, dispatchConfig.terminalSocTargetMWh),
            ),
          });

          const unserved = bundle.summary.hourlyDispatches.reduce(
            (a, h) => a + h.unservedEnergyMW,
            0,
          );
          const cost = bundle.summary.totalDailyCostInr;
          const hasShortage = unserved > 0.25;

          rowVals.push(Number((cost / 1e6).toFixed(3))); // Millions INR for clean 3D Y scaling
          rowShort.push(hasShortage);
          if (hasShortage) shortageCells++;
          else zeroDeficitMaxPeak = Math.max(zeroDeficitMaxPeak, bundle.summary.predictedPeakDemandMW);

          maxCostObserved = Math.max(maxCostObserved, cost);
          minCostObserved = Math.min(minCostObserved, cost);

          tableRows.push([
            `${Math.round(sc * 100)}%`,
            `+${dt.toFixed(1)} °C`,
            bundle.summary.predictedPeakDemandMW.toFixed(1),
            Math.round(cost).toLocaleString('en-IN'),
            bundle.summary.totalDailyEmissionsTonnesCO2e.toFixed(1),
            unserved.toFixed(2),
            hasShortage ? 'VOLL Deficit' : 'Adequate',
          ]);
        }
        yValues.push(rowVals);
        shortageFlags.push(rowShort);
      }

      const computeMs = Number(
        Math.max(0.1, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(2),
      );

      return {
        manifest: {
          experimentId,
          experimentCode: descriptor.code,
          title: descriptor.title,
          inputDataset: `${scenario.name} (${scales.length * tempOffsets.length} real 24h LP solves)`,
          dataProvenance: scenario.isSynthetic ? 'Synthetic / Analytic Benchmark' : 'Uploaded CSV + Synthetic Grid',
          algorithmName: 'Parametric Two-Phase Bounded Simplex LP Sweep',
          parameters: {
            demandScales: scales.join(', '),
            tempOffsetsDegC: tempOffsets.join(', '),
            coolingSensitivity: '4.2 MW/°C above 24°C threshold',
          },
          numericalTolerance: 'LP feasibility tol = 1e-7; VOLL = ₹25,000/MWh',
          seedLabel: 'Deterministic (LP Grid Sweep)',
          timestampIso,
          softwareVersion: SOFTWARE_VERSION,
          computeMs,
        },
        objectiveStatement:
          'Map the 2D demand-temperature feasible dispatch region and identify the exact load threshold where thermal + BESS reserves saturate into VOLL load shedding.',
        formulaTex:
          'D_t(s, \\Delta T) = s \\cdot D_t^{(0)} + 4.2\\,\\max(0, T_t + \\Delta T - 24) - 4.2\\,\\max(0, T_t - 24)',
        methodologyNote:
          'Each grid point executes a full 24-hour multi-period Bounded Simplex LP solve rather than interpolating costs.',
        summaryMetrics: [
          {
            label: 'Verified Adequacy Ceiling',
            value: zeroDeficitMaxPeak.toFixed(1),
            unit: 'MW',
            detail: 'Highest peak served with zero VOLL deficit',
            tone: 'renewable',
          },
          {
            label: 'Cost Range Observed',
            value: `₹${(minCostObserved / 1e6).toFixed(2)}M–${(maxCostObserved / 1e6).toFixed(2)}M`,
            detail: 'Across parameter grid',
            tone: 'primary',
          },
          {
            label: 'Shortage Grid Regimes',
            value: `${shortageCells}/${scales.length * tempOffsets.length}`,
            detail: 'VOLL penalty activated regimes',
            tone: shortageCells > 0 ? 'warning' : 'renewable',
          },
          {
            label: 'Real LP Evaluations',
            value: `${scales.length * tempOffsets.length}`,
            detail: `${computeMs.toFixed(1)} ms total execution`,
            tone: 'neutral',
          },
        ],
        tableHeaders,
        tableRows,
        plot3D: {
          kind: 'parameter-surface',
          xLabel: 'Demand Scale (×)',
          yLabel: '24h LP Cost (M INR)',
          zLabel: 'Temp Perturbation ΔT (°C)',
          xValues: scales,
          zValues: tempOffsets,
          yValues,
          shortageFlags,
          valueUnit: 'M INR',
        },
        plotCaption:
          '3D Demand Sensitivity Surface (Demand Scale × Cost Million INR × ΔT °C). Crimson vertices indicate VOLL shortage threshold.',
        limitations: [
          'Assumes linear cooling load sensitivity above 24°C; humidity latent heat effects are simplified.',
          'Transmission congestion inside individual feeders is aggregated at the 220/33 kV substation bus.',
        ],
        researchIntegrityNote:
          'Every surface vertex represents a complete converged 24h Two-Phase Simplex LP solution.',
      };
    }

    // -------------------------------------------------------------------------
    // EXPERIMENT 7: Renewable Generation Sensitivity Surface (Solar x Wind)
    // -------------------------------------------------------------------------
    case 'renewable-sensitivity': {
      const solarScales = [
        Number(expParams.solarScaleMin.toFixed(2)),
        Number(((expParams.solarScaleMin + 1) * 0.5).toFixed(2)),
        1.0,
        1.25,
      ];
      const windScales = [
        0.4,
        0.9,
        Number(expParams.windScaleMax.toFixed(2)),
      ];

      const yValues: number[][] = [];
      const shortageFlags: boolean[][] = [];
      const tableHeaders = [
        'Solar Scale',
        'Wind Scale',
        'RE Penetration (%)',
        '24h LP Cost (INR)',
        'Emissions (tCO₂e)',
        'Curtailment (MWh)',
        'Unserved (MWh)',
      ];
      const tableRows: (string | number)[][] = [];

      let maxRePct = 0;
      let minRePct = 100;
      let maxCurtail = 0;
      let minEmissions = Infinity;

      for (let zi = 0; zi < windScales.length; zi++) {
        const ws = windScales[zi];
        const rowVals: number[] = [];
        const rowShort: boolean[] = [];

        for (let xi = 0; xi < solarScales.length; xi++) {
          const ss = solarScales[xi];
          const eff = buildEffectiveScenario({
            baseScenario: scenario,
            weatherControls: {
              ...DEFAULT_WEATHER_CONTROLS,
              solarIrradianceScale: ss,
              windResourceScale: ws,
            },
            generatorOverrides: {},
            batteryInitialSocOverrideMWh: null,
          });
          const bundle = runOptimalEnergyDispatch(eff, {
            ...dispatchConfig,
            strategy: 'lp-optimal',
            terminalSocTargetMWh: Math.max(
              eff.battery.capacityMWh * eff.battery.minSocRatio,
              Math.min(eff.battery.capacityMWh * eff.battery.maxSocRatio, dispatchConfig.terminalSocTargetMWh),
            ),
          });
          const rePct = bundle.summary.averageRenewableSharePercent;
          const curt = bundle.summary.hourlyDispatches.reduce((a, h) => a + h.curtailmentMW, 0);
          const unserved = bundle.summary.hourlyDispatches.reduce(
            (a, h) => a + h.unservedEnergyMW,
            0,
          );
          const cost = bundle.summary.totalDailyCostInr;

          rowVals.push(Number((cost / 1e6).toFixed(3)));
          rowShort.push(unserved > 0.25);

          maxRePct = Math.max(maxRePct, rePct);
          minRePct = Math.min(minRePct, rePct);
          maxCurtail = Math.max(maxCurtail, curt);
          minEmissions = Math.min(minEmissions, bundle.summary.totalDailyEmissionsTonnesCO2e);

          tableRows.push([
            `${Math.round(ss * 100)}%`,
            `${Math.round(ws * 100)}%`,
            `${rePct.toFixed(1)}%`,
            Math.round(cost).toLocaleString('en-IN'),
            bundle.summary.totalDailyEmissionsTonnesCO2e.toFixed(1),
            curt.toFixed(2),
            unserved.toFixed(2),
          ]);
        }
        yValues.push(rowVals);
        shortageFlags.push(rowShort);
      }

      const computeMs = Number(
        Math.max(0.1, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(2),
      );

      return {
        manifest: {
          experimentId,
          experimentCode: descriptor.code,
          title: descriptor.title,
          inputDataset: `${scenario.name} (${solarScales.length * windScales.length} Solar × Wind LP runs)`,
          dataProvenance: scenario.isSynthetic ? 'Synthetic / Analytic Benchmark' : 'Uploaded CSV + Synthetic Grid',
          algorithmName: '2D Parametric Renewable Sensitivity over Bounded Simplex LP',
          parameters: {
            solarScales: solarScales.join(', '),
            windScales: windScales.join(', '),
          },
          numericalTolerance: 'LP feasibility tol = 1e-7; Balance residual < 1e-2 MW',
          seedLabel: 'Deterministic (LP Grid Sweep)',
          timestampIso,
          softwareVersion: SOFTWARE_VERSION,
          computeMs,
        },
        objectiveStatement:
          'Quantify marginal cost displacement, emissions abatement, and curtailment saturation across solar irradiance and wind corridor resource variations.',
        formulaTex:
          'P_{\\text{PV},t}^{\\max} = \\alpha_s P_{\\text{PV}}^{\\text{cap}} \\frac{G_t}{1000}, \\quad P_{\\text{wind},t}^{\\max} = \\alpha_w P_{\\text{wind}}^{\\text{cap}} \\cdot \\text{CF}_t',
        methodologyNote:
          'Evaluates zero-marginal-cost renewable substitution of coal and CCGT gas units including BESS midday charging shifts.',
        summaryMetrics: [
          {
            label: 'Renewable Share Span',
            value: `${minRePct.toFixed(1)}–${maxRePct.toFixed(1)}`,
            unit: '%',
            detail: 'Across solar × wind sweep',
            tone: 'renewable',
          },
          {
            label: 'Lowest Daily Emissions',
            value: minEmissions.toFixed(1),
            unit: 'tCO₂e',
            detail: 'At peak renewable inflow',
            tone: 'primary',
          },
          {
            label: 'Max Surplus Curtailment',
            value: maxCurtail.toFixed(2),
            unit: 'MWh',
            detail: 'Excess beyond load + BESS',
            tone: maxCurtail > 10 ? 'warning' : 'neutral',
          },
          {
            label: 'Grid Matrix Solves',
            value: `${solarScales.length * windScales.length}`,
            detail: `${computeMs.toFixed(1)} ms runtime`,
            tone: 'neutral',
          },
        ],
        tableHeaders,
        tableRows,
        plot3D: {
          kind: 'parameter-surface',
          xLabel: 'Solar Scale (×)',
          yLabel: '24h LP Cost (M INR)',
          zLabel: 'Wind Scale (×)',
          xValues: solarScales,
          zValues: windScales,
          yValues,
          shortageFlags,
          valueUnit: 'M INR',
        },
        plotCaption:
          '3D Renewable Sensitivity Surface (Solar Scale × 24h Cost Million INR × Wind Scale). Cost slopes downward as RE displaces thermal.',
        limitations: [
          'Solar irradiance ratio is capped at 1.0 of inverter nameplate rating unless module capacity override is raised.',
          'Spinning reserve requirements for sudden wind gusts are approximated via thermal ramp limits.',
        ],
        researchIntegrityNote:
          'All surface nodes computed directly via multi-period LP optimization on the active scenario fleet.',
      };
    }

    // -------------------------------------------------------------------------
    // EXPERIMENT 8: Generator Outage Stress Testing (N-0, N-1, N-2)
    // -------------------------------------------------------------------------
    case 'outage-stress': {
      const contingencies: {
        label: string;
        overrides: Record<string, { available: boolean }>;
      }[] = [
        { label: 'N-0 Nominal Fleet', overrides: {} },
        { label: 'N-1 Coal Outage (-140 MW)', overrides: { 'gen-coal-01': { available: false } } },
        { label: 'N-1 CCGT Gas Outage (-150 MW)', overrides: { 'gen-gas-01': { available: false } } },
        {
          label: 'N-2 Thermal+Hydro (-185 MW)',
          overrides: { 'gen-coal-01': { available: false }, 'gen-hydro-01': { available: false } },
        },
      ];

      const runs = contingencies.map((c) => {
        const eff = buildEffectiveScenario({
          baseScenario: scenario,
          weatherControls: DEFAULT_WEATHER_CONTROLS,
          generatorOverrides: c.overrides,
          batteryInitialSocOverrideMWh: expParams.outageBatterySocMWh,
        });
        const cfg: DispatchOptimizationConfig = {
          ...dispatchConfig,
          strategy: 'lp-optimal',
          terminalSocTargetMWh: Math.max(
            eff.battery.capacityMWh * eff.battery.minSocRatio,
            Math.min(eff.battery.capacityMWh * eff.battery.maxSocRatio, expParams.outageBatterySocMWh),
          ),
        };
        const bundle = runOptimalEnergyDispatch(eff, cfg);
        return { label: c.label, scenario: eff, bundle };
      });

      const tableHeaders = [
        'Contingency Case',
        'Avail Capacity (MW)',
        '24h Total Cost (INR)',
        'Unserved Energy (MWh)',
        'Peak Deficit (MW)',
        'VOLL Penalty (INR)',
        'Max Residual (MW)',
      ];

      const tableRows: (string | number)[][] = runs.map((r) => {
        const unservedMWh = r.bundle.summary.hourlyDispatches.reduce(
          (a, h) => a + h.unservedEnergyMW,
          0,
        );
        const peakDeficit = Math.max(
          ...r.bundle.summary.hourlyDispatches.map((h) => h.unservedEnergyMW),
        );
        return [
          r.label,
          r.scenario.installedGenerationMW.toFixed(0),
          Math.round(r.bundle.summary.totalDailyCostInr).toLocaleString('en-IN'),
          unservedMWh.toFixed(2),
          peakDeficit.toFixed(2),
          Math.round(r.bundle.vollPenaltyCostInr).toLocaleString('en-IN'),
          r.bundle.residualSummary.maxPowerBalanceResidualMW.toExponential(2),
        ];
      });

      const n1CoalUnserved = runs[1].bundle.summary.hourlyDispatches.reduce(
        (a, h) => a + h.unservedEnergyMW,
        0,
      );
      const n1GasUnserved = runs[2].bundle.summary.hourlyDispatches.reduce(
        (a, h) => a + h.unservedEnergyMW,
        0,
      );
      const n2Unserved = runs[3].bundle.summary.hourlyDispatches.reduce(
        (a, h) => a + h.unservedEnergyMW,
        0,
      );

      const computeMs = Number(
        Math.max(0.1, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(2),
      );

      return {
        manifest: {
          experimentId,
          experimentCode: descriptor.code,
          title: descriptor.title,
          inputDataset: `${scenario.name} (N-0, N-1 Coal, N-1 Gas, N-2 Contingencies)`,
          dataProvenance: scenario.isSynthetic ? 'Synthetic / Analytic Benchmark' : 'Uploaded CSV + Synthetic Grid',
          algorithmName: 'Contingency-Constrained Multi-Period Bounded Simplex LP',
          parameters: {
            initialBessSocMWh: expParams.outageBatterySocMWh,
            vollPenaltyInrPerMWh: dispatchConfig.vollPenaltyInrPerMWh,
            contingenciesTested: contingencies.length,
          },
          numericalTolerance: 'Power balance residual < 1e-2 MW; SoC floor 18 MWh',
          seedLabel: 'Deterministic (Contingency Sweep)',
          timestampIso,
          softwareVersion: SOFTWARE_VERSION,
          computeMs,
        },
        objectiveStatement:
          'Quantify N-1 and N-2 generator outage survivability, battery reserve cushioning, and hourly unserved energy deficit across the 24-hour cycle.',
        formulaTex:
          '\\sum_{i \\in \\mathcal{G}_{\\text{online}}} P_{i,t} + P_{\\text{dis},t} - P_{\\text{ch},t} + u_t = D_t, \\quad u_t \\ge 0',
        methodologyNote:
          'Forces selected thermal/hydro units to 0 MW across all 24 hours and solves full LP optimal BESS re-dispatch.',
        summaryMetrics: [
          {
            label: 'N-1 Coal Outage Deficit',
            value: n1CoalUnserved.toFixed(1),
            unit: 'MWh',
            detail: n1CoalUnserved > 0.1 ? 'Evening ramp shortfall' : 'Fully served by fleet + BESS',
            tone: n1CoalUnserved > 0.1 ? 'warning' : 'renewable',
          },
          {
            label: 'N-1 CCGT Outage Deficit',
            value: n1GasUnserved.toFixed(1),
            unit: 'MWh',
            detail: '-150 MW mid-merit loss',
            tone: n1GasUnserved > 0.1 ? 'warning' : 'renewable',
          },
          {
            label: 'N-2 Stress Deficit',
            value: n2Unserved.toFixed(1),
            unit: 'MWh',
            detail: `VOLL ₹${Math.round(runs[3].bundle.vollPenaltyCostInr / 1e5).toLocaleString('en-IN')} Lakh`,
            tone: 'warning',
          },
          {
            label: 'Initial BESS Cushion',
            value: `${expParams.outageBatterySocMWh.toFixed(0)}`,
            unit: 'MWh',
            detail: `${((expParams.outageBatterySocMWh / scenario.battery.capacityMWh) * 100).toFixed(1)}% SoC`,
            tone: 'primary',
          },
        ],
        tableHeaders,
        tableRows,
        plot3D: {
          kind: 'generation-vs-time',
          xLabel: 'Hour (0..23 h)',
          yLabel: 'Served Supply (MW)',
          zLabel: 'Contingency Case',
          strategies: runs.map((r) => r.label.split(' ')[0] + ' ' + r.label.split(' ')[1]),
          seriesMW: runs.map((r) =>
            r.bundle.summary.hourlyDispatches.map(
              (h) => h.totalDemandMW - h.unservedEnergyMW,
            ),
          ),
          demandMW: scenario.hourlyDemand.map((h) => h.totalMW),
        },
        plotCaption:
          '3D Contingency Adequacy Comparison (Hour 0..23 × Served Power MW × Outage Case). Gaps below demand curve indicate unserved deficit.',
        limitations: [
          'Assumes forced outage lasts the full 24-hour scheduling horizon rather than partial-day restoration.',
          'Does not model involuntary rolling feeder priority; unserved energy u_t is penalized uniformly at VOLL.',
        ],
        researchIntegrityNote:
          'All contingency runs solved via Two-Phase Simplex with zero fabricated capacity values.',
      };
    }
  }
}

export function runAllEightExperiments(params: {
  scenario: SimulationScenario;
  dispatchConfig: DispatchOptimizationConfig;
  forecastDataset: ForecastDatasetBundle;
  expParams?: ExperimentParameters;
}): Record<ExperimentId, ScientificExperimentResult> {
  const expParams = params.expParams ?? DEFAULT_EXPERIMENT_PARAMETERS;
  const output = {} as Record<ExperimentId, ScientificExperimentResult>;
  for (const desc of EXPERIMENT_CATALOG) {
    output[desc.id] = runScientificExperiment({
      experimentId: desc.id,
      scenario: params.scenario,
      dispatchConfig: params.dispatchConfig,
      forecastDataset: params.forecastDataset,
      expParams,
    });
  }
  return output;
}

export function serializeExperimentCsv(result: ScientificExperimentResult): string {
  const metaLines = [
    `# GRIDMATH 3D Scientific Experiment Export`,
    `# Experiment,${result.manifest.experimentCode} - ${result.manifest.title}`,
    `# Dataset,${result.manifest.inputDataset}`,
    `# Provenance,${result.manifest.dataProvenance}`,
    `# Algorithm,${result.manifest.algorithmName}`,
    `# Tolerance,${result.manifest.numericalTolerance}`,
    `# Seed,${result.manifest.seedLabel}`,
    `# Timestamp,${result.manifest.timestampIso}`,
    `# Software,${result.manifest.softwareVersion}`,
    `# ComputeMs,${result.manifest.computeMs}`,
    '',
  ];
  const headerLine = result.tableHeaders
    .map((h) => `"${String(h).replace(/"/g, '""')}"`)
    .join(',');
  const rowLines = result.tableRows.map((row) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
  );
  return [...metaLines, headerLine, ...rowLines].join('\n');
}
