import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  computeDiurnalLighting,
  computeGridVisualTelemetry,
} from '../components/three/powerFlowMath';
import {
  buildForkedBolt,
  computeBoltEnvelope,
} from '../components/three/ThunderstormSystem';
import { StormAudioEngine } from '../components/three/stormAudio';
import { createSkyboxEnvironmentTexture } from '../components/three/webglUtils';
import { validateBattery, validateScenario } from '../data/ingestion';
import { SYNTHETIC_SCENARIOS } from '../data/syntheticMicrogrid';
import {
  DEFAULT_EXPERIMENT_PARAMETERS,
  runScientificExperiment,
  serializeExperimentCsv,
  SOFTWARE_VERSION,
} from '../experiments/scientificExperiments';
import {
  buildSampleForecastCsv,
  generateSyntheticHistoryDataset,
  parseForecastCsv,
} from '../forecasting/datasetManager';
import {
  computeForecastMetrics,
  runNumericalDemandForecast,
} from '../forecasting/numericalForecaster';
import { computeNumericalDifferentiation } from '../math/differentiation';
import { solveGaussianElimination } from '../math/gaussianElimination';
import { computeNumericalIntegration } from '../math/integration';
import { computeNewtonDividedDifference } from '../math/interpolation';
import { solveLinearProgram } from '../math/linearProgramming';
import {
  finiteDifferenceDerivative,
  solveLinearSystem,
} from '../math/numericalCore';
import { solveLeastSquaresRegression } from '../math/regression';
import { solveBoundedLP } from '../optimization/boundedSimplex';
import {
  createDefaultDispatchConfig,
  runOptimalEnergyDispatch,
} from '../optimization/optimalDispatchEngine';
import { useSimulationStore } from '../store/useSimulationStore';

describe('PHASE 8 — Numerical Edge Cases & Analytical Verification', () => {
  it('handles divided difference interpolation sorting, duplicates, insufficient points, and large scales', () => {
    // Unsorted points for exact quadratic f(x) = 1e5 * x^2 + 5e4 * x + 1e6
    const fn = (x: number) => 1e5 * x * x + 5e4 * x + 1e6;
    const unsorted = [
      { x: 4, y: fn(4) },
      { x: 0, y: fn(0) },
      { x: 2, y: fn(2) },
      { x: 1, y: fn(1) },
    ];
    const largeRes = computeNewtonDividedDifference(unsorted, 3, fn);
    expect(largeRes.valid).toBe(true);
    expect(largeRes.sortedPoints.map((p) => p.x)).toEqual([0, 1, 2, 4]);
    expect(largeRes.interpolatedY).toBeCloseTo(fn(3), 4);
    expect(largeRes.benchmarkError!).toBeLessThan(1e-6);

    // Duplicate x-coordinate rejection
    const dupRes = computeNewtonDividedDifference(
      [
        { x: 1, y: 10 },
        { x: 1, y: 12 },
        { x: 2, y: 20 },
      ],
      1.5,
    );
    expect(dupRes.valid).toBe(false);
    expect(dupRes.error).toContain('Duplicate');

    // Insufficient points (< 2)
    const singleRes = computeNewtonDividedDifference([{ x: 0, y: 5 }], 1);
    expect(singleRes.valid).toBe(false);
  });

  it('verifies Gaussian elimination on singular, ill-conditioned Hilbert, mismatched, and large systems', () => {
    // 1. Dimension mismatch
    const mismatch = solveGaussianElimination([[1, 2], [3, 4]], [1]);
    expect(mismatch.valid).toBe(false);

    // 2. mathjs solveLinearSystem throws on singular matrix
    expect(() =>
      solveLinearSystem(
        [
          [1, 2],
          [2, 4],
        ],
        [3, 6],
      ),
    ).toThrow();

    // 3. Ill-conditioned 5x5 Hilbert matrix H_ij = 1 / (i + j + 1) with known exact x = [1,1,1,1,1]
    const n = 5;
    const H = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => 1 / (i + j + 1)),
    );
    const exactX = Array(n).fill(1);
    const rhs = H.map((row) => row.reduce((acc, aij, j) => acc + aij * exactX[j], 0));
    const hilbertRes = solveGaussianElimination(H, rhs);
    expect(hilbertRes.valid).toBe(true);
    expect(hilbertRes.residualL2Norm).toBeLessThan(1e-10);
    for (let i = 0; i < n; i++) {
      expect(hilbertRes.solution[i]).toBeCloseTo(1, 5);
    }

    // 4. Large numerical scale (1e8)
    const bigRes = solveGaussianElimination(
      [
        [2e8, 1e8],
        [1e8, 3e8],
      ],
      [4e8, 7e8],
    );
    expect(bigRes.valid).toBe(true);
    expect(bigRes.solution[0]).toBeCloseTo(1, 8);
    expect(bigRes.solution[1]).toBeCloseTo(2, 8);
  });

  it('rejects collinear/insufficient least-squares matrices and scales accurately to large targets', () => {
    // Insufficient rows for 2 predictors (needs >= 3)
    const tooFew = solveLeastSquaresRegression(
      [
        { id: '1', label: 'A', x1: 1, x2: 2, y: 10 },
        { id: '2', label: 'B', x1: 2, x2: 3, y: 15 },
      ],
      2,
    );
    expect(tooFew.valid).toBe(false);

    // Collinear predictors: x2 = 2 * x1
    const collinear = solveLeastSquaresRegression(
      [
        { id: '1', label: 'A', x1: 1, x2: 2, y: 10 },
        { id: '2', label: 'B', x1: 2, x2: 4, y: 20 },
        { id: '3', label: 'C', x1: 3, x2: 6, y: 30 },
        { id: '4', label: 'D', x1: 4, x2: 8, y: 40 },
      ],
      2,
    );
    expect(collinear.valid).toBe(false);
    expect(collinear.error?.toLowerCase()).toMatch(/collinear|dependent/);

    // Large target scale: y = 1e5 + 2500 * x1
    const bigObs = [1, 2, 3, 4, 5].map((x1, idx) => ({
      id: String(idx),
      label: `P${idx}`,
      x1,
      y: 1e5 + 2500 * x1,
    }));
    const bigFit = solveLeastSquaresRegression(bigObs, 1);
    expect(bigFit.valid).toBe(true);
    expect(bigFit.coefficients[0]).toBeCloseTo(1e5, 4);
    expect(bigFit.coefficients[1]).toBeCloseTo(2500, 4);
    expect(bigFit.qrOrthogonalityError).toBeLessThan(1e-10);
  });

  it('guards finite differences against zero/negative step sizes and verifies analytical derivatives', () => {
    expect(() => finiteDifferenceDerivative([10, 20, 30], 0)).toThrow();
    expect(() => finiteDifferenceDerivative([10, 20, 30], -1)).toThrow();
    expect(() => finiteDifferenceDerivative([10, 20, 30], Number.NaN)).toThrow();

    // Exact analytical derivative for f(t) = 4t^2 - 12t + 50 => f'(t) = 8t - 12 (central diff exact for quadratics)
    const diffRes = computeNumericalDifferentiation({
      fn: (t) => 4 * t * t - 12 * t + 50,
      exactDfn: (t) => 8 * t - 12,
      x0: 5,
      h: 0.5,
      method: 'central',
    });
    expect(diffRes.centralDiff).toBeCloseTo(28, 8);
    expect(diffRes.demandTrend).toBe('rising');

    // Negative h input clamps cleanly to safe positive step >= 0.05 without NaN
    const clamped = computeNumericalDifferentiation({
      fn: (t) => 2 * t,
      x0: 3,
      h: -2,
      method: 'forward',
    });
    expect(clamped.h).toBe(0.05);
    expect(clamped.forwardDiff).toBeCloseTo(2, 6);
  });

  it('rejects invalid integration bounds and validates large-magnitude quadratures', () => {
    const inverted = computeNumericalIntegration({
      fn: (t) => t + 10,
      a: 10,
      b: 5,
      subdivisions: 4,
      method: 'trapezoidal',
    });
    expect(inverted.valid).toBe(false);

    const equalBounds = computeNumericalIntegration({
      fn: (t) => t + 10,
      a: 4,
      b: 4,
      subdivisions: 4,
      method: 'simpson',
    });
    expect(equalBounds.valid).toBe(false);

    // Large power curve P(t) = 1e5 + 5000*t over [0, 10] -> integral = 1e5*10 + 2500*100 = 1,250,000 MWh
    const largeInt = computeNumericalIntegration({
      fn: (t) => 1e5 + 5000 * t,
      exactIntegral: (a, b) => 1e5 * (b - a) + 2500 * (b * b - a * a),
      a: 0,
      b: 10,
      subdivisions: 10,
      method: 'simpson',
    });
    expect(largeInt.valid).toBe(true);
    expect(largeInt.simpsonEnergyMWh).toBeCloseTo(1_250_000, 4);
    expect(largeInt.simpsonAbsErrorMWh!).toBeLessThan(1e-6);
  });

  it('detects unbounded and infeasible linear programs and handles large LP coefficients', () => {
    // Unbounded maximization: max x1 + x2 s.t. x1 - x2 <= 10, x1,x2 >= 0
    const unbounded = solveLinearProgram({
      sense: 'max',
      variableNames: ['x1', 'x2'],
      objectiveCoeffs: [1, 1],
      constraints: [{ id: 'c1', label: 'Open', coeffs: [1, -1], op: '<=', rhs: 10 }],
    });
    expect(unbounded.status).toBe('unbounded');
    expect(unbounded.bounded).toBe(false);

    // Large-scale bounded LP: min 1e4*x1 + 2e4*x2 s.t. x1 + x2 = 1e4, 0<=x1<=6000, 0<=x2<=8000 => (6000, 4000)
    const largeLp = solveBoundedLP({
      sense: 'min',
      numVars: 2,
      varNames: ['x1', 'x2'],
      objective: [1e4, 2e4],
      lowerBounds: [0, 0],
      upperBounds: [6000, 8000],
      rows: [{ name: 'bal', terms: [{ col: 0, coeff: 1 }, { col: 1, coeff: 1 }], op: '=', rhs: 1e4 }],
    });
    expect(largeLp.feasible).toBe(true);
    expect(largeLp.primal[0]).toBeCloseTo(6000, 2);
    expect(largeLp.primal[1]).toBeCloseTo(4000, 2);
    expect(largeLp.objectiveValue).toBeCloseTo(1.4e8, -1);
  });

  it('validates battery edge cases (zero efficiency, negative capacity, depleted SoC) and invalid scenario fields', () => {
    const baseBattery = structuredClone(SYNTHETIC_SCENARIOS[0].battery);
    expect(validateBattery({ ...baseBattery, roundTripEfficiency: 0 }).length).toBeGreaterThan(0);
    expect(validateBattery({ ...baseBattery, roundTripEfficiency: 1.2 }).length).toBeGreaterThan(0);
    expect(validateBattery({ ...baseBattery, capacityMWh: -50 }).length).toBeGreaterThan(0);
    expect(validateBattery({ ...baseBattery, initialSocMWh: 5 }).length).toBeGreaterThan(0);

    // Negative demand / NaN irradiance rejected by validateScenario
    const broken = structuredClone(SYNTHETIC_SCENARIOS[0]);
    broken.hourlyDemand[2].residentialMW = -10;
    broken.hourlyDemand[2].totalMW -= 10;
    broken.hourlyDemand[4].solarIrradianceWm2 = Number.NaN;
    const report = validateScenario(broken);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('non-negative'))).toBe(true);
    expect(report.errors.some((e) => e.includes('solarIrradianceWm2'))).toBe(true);
  });

  it('rejects invalid units, empty files, and corrupt cells during CSV dataset ingestion', () => {
    const sample = buildSampleForecastCsv(generateSyntheticHistoryDataset('Asia/Kolkata', 4));

    // Invalid units (kW instead of MW, Fahrenheit instead of Celsius)
    const invalidUnitCsv = sample
      .replace('demand_mw', 'demand_kw')
      .replace('temperature_c', 'temperature_f');
    const unitBundle = parseForecastCsv(invalidUnitCsv, 'bad-units.csv', 'Asia/Kolkata');
    expect(unitBundle.records).toHaveLength(0);
    expect(unitBundle.qualityReport.validRows).toBe(0);
    expect(unitBundle.qualityReport.issues[0]).toContain('Invalid unit detected');

    // Empty / header-only CSV
    const emptyBundle = parseForecastCsv('timestamp,demand_mw,temperature_c\n', 'empty.csv', 'UTC');
    expect(emptyBundle.records).toHaveLength(0);
    expect(emptyBundle.qualityReport.issues.length).toBeGreaterThan(0);

    // Zero actuals yield valid sMAPE but invalid MAPE
    const zeroActuals = computeForecastMetrics([0, 0, 150], [10, 0, 150]);
    expect(zeroActuals.mapeValid).toBe(false);
    expect(zeroActuals.mapePercent).toBeNull();
    expect(Number.isFinite(zeroActuals.smapePercent)).toBe(true);
  });
});

describe('PHASE 8 — End-to-End Integration & Synchronization', () => {
  it('propagates forecast-to-dispatch pipeline updates consistently through store and 3D city telemetry', () => {
    const store = useSimulationStore.getState();
    store.resetSimulation();

    const qrRun = runNumericalDemandForecast({
      records: store.forecastDataset.records,
      holdoutHours: 24,
      weatherScenarioId: 'heatwave',
      workedHour: 14,
    });
    const customForecast = qrRun.next24h.map((pt) => ({
      hour: pt.hour,
      demandMW: pt.fullModelMW,
      temperatureDegC: pt.temperatureDegC,
    }));

    store.applyForecastToDispatch(customForecast, 'Integration Test QR Forecast');
    const state = useSimulationStore.getState();

    expect(state.useForecastDrivenDemand).toBe(true);
    expect(state.appliedForecastLabel).toBe('Integration Test QR Forecast');
    expect(state.dispatchBundle.feasible).toBe(true);
    expect(state.activeScenario.hourlyDemand[14].totalMW).toBeCloseTo(
      customForecast[14].demandMW,
      1,
    );
    expect(state.daySummary.hourlyDispatches[14].totalDemandMW).toBeCloseTo(
      customForecast[14].demandMW,
      1,
    );

    // Verify 3D city telemetry mirrors activeDispatch and activeHourlyDemand
    const telemetry = computeGridVisualTelemetry(state.activeDispatch, state.activeHourlyDemand);
    expect(telemetry.corridors).toHaveLength(7);
    expect(telemetry.lighting.hour).toBe(state.activeHour);
    const commercialCorridor = telemetry.corridors.find((c) => c.id === 'substation-commercial')!;
    expect(commercialCorridor.flowMW).toBeCloseTo(state.activeHourlyDemand.commercialMW, 1);

    // Verify BESS charge vs discharge reverses corridor endpoints
    const chargingDispatch = structuredClone(state.activeDispatch);
    chargingDispatch.batteryNetPowerMW = -20;
    const chargingTelemetry = computeGridVisualTelemetry(chargingDispatch, state.activeHourlyDemand);
    const bessLink = chargingTelemetry.corridors.find((c) => c.id === 'bess-substation')!;
    expect(bessLink.fromZone).toBe('substation');
    expect(bessLink.toZone).toBe('bess');

    store.clearAppliedForecast();
    expect(useSimulationStore.getState().useForecastDrivenDemand).toBe(false);
    store.resetSimulation();
  });

  it('verifies numerical stepper progression across Gaussian elimination and Simplex LP', () => {
    const gauss = solveGaussianElimination(
      [
        [0, 3, -1],
        [2, -1, 1],
        [4, 2, 3],
      ],
      [5, 3, 19],
    );
    expect(gauss.valid).toBe(true);
    expect(gauss.steps[0].kind).toBe('initial');
    expect(gauss.steps.some((s) => s.kind === 'pivot-swap')).toBe(true);
    expect(gauss.steps.some((s) => s.kind === 'eliminate')).toBe(true);
    expect(gauss.steps.some((s) => s.kind === 'back-substitute')).toBe(true);
    expect(gauss.steps[gauss.steps.length - 1].kind).toBe('complete');

    const lp = solveLinearProgram({
      sense: 'max',
      variableNames: ['x1', 'x2'],
      objectiveCoeffs: [10, 20],
      constraints: [
        { id: 'c1', label: 'SumCap', coeffs: [1, 1], op: '<=', rhs: 40 },
        { id: 'c2', label: 'MaxX1', coeffs: [1, 0], op: '<=', rhs: 25 },
        { id: 'c3', label: 'MaxX2', coeffs: [0, 1], op: '<=', rhs: 30 },
      ],
    });
    expect(lp.steps.length).toBeGreaterThanOrEqual(2);
    expect(lp.steps[0].vertex).toEqual([0, 0]);
    expect(lp.steps[lp.steps.length - 1].vertex[0]).toBeCloseTo(10, 4);
    expect(lp.steps[lp.steps.length - 1].vertex[1]).toBeCloseTo(30, 4);
    expect(lp.optimalValue).toBeCloseTo(700, 4);
  });

  it('maintains coherent state across all 8 scenarios, quality presets, and CSV dataset uploads', () => {
    const store = useSimulationStore.getState();

    // Render quality transitions
    store.setRenderQuality('high');
    expect(useSimulationStore.getState().renderQuality).toBe('high');
    store.setRenderQuality('low');
    expect(useSimulationStore.getState().renderQuality).toBe('low');
    store.setRenderQuality('balanced');

    // Scenario switching across all 8 scenarios
    for (const sc of SYNTHETIC_SCENARIOS) {
      store.setScenario(sc.id);
      const next = useSimulationStore.getState();
      expect(next.activeScenarioId).toBe(sc.id);
      expect(next.validationReport.valid).toBe(true);
      expect(next.dispatchBundle.feasible).toBe(true);
      expect(next.daySummary.hourlyDispatches).toHaveLength(24);
    }

    // Dirty CSV upload into store forecast pipeline
    const cleanCsv = buildSampleForecastCsv(generateSyntheticHistoryDataset('Asia/Kolkata', 5));
    const lines = cleanCsv.split('\n');
    const dirtyUpload = [
      lines[0],
      lines[1],
      '2026-10-01T00:00:00+05:30,250,25.0,60,Clear,0', // duplicate timestamp
      ...lines.slice(2),
    ].join('\n');
    const uploadedBundle = parseForecastCsv(dirtyUpload, 'station-upload.csv', 'Asia/Kolkata');
    store.setForecastSettings({ forecastDataset: uploadedBundle, holdoutHours: 24 });

    const afterUpload = useSimulationStore.getState();
    expect(afterUpload.forecastDataset.isSynthetic).toBe(false);
    expect(afterUpload.forecastDataset.qualityReport.duplicateTimestampCount).toBe(1);
    expect(afterUpload.numericalForecast.valid).toBe(true);
    expect(afterUpload.numericalForecast.next24h).toHaveLength(24);

    // Experiment CSV & Dispatch audit serialization consistency
    const expRes = runScientificExperiment({
      experimentId: 'outage-stress',
      scenario: afterUpload.activeScenario,
      dispatchConfig: afterUpload.dispatchConfig,
      forecastDataset: afterUpload.forecastDataset,
      expParams: DEFAULT_EXPERIMENT_PARAMETERS,
    });
    const expCsv = serializeExperimentCsv(expRes);
    expect(expCsv).toContain(SOFTWARE_VERSION);
    expect(expCsv).toContain('EXP-08');

    // Restore default synthetic dataset & nominal scenario cleanly
    store.setForecastSettings({
      forecastDataset: generateSyntheticHistoryDataset('Asia/Kolkata', 14),
      holdoutHours: 24,
    });
    store.setScenario('urban-nominal');
    store.resetSimulation();
  });

  it('verifies optimal dispatch solver consistency under insufficient generation stress', () => {
    const stressed = structuredClone(SYNTHETIC_SCENARIOS[0]);
    for (const gen of stressed.generators) {
      if (gen.technology === 'coal' || gen.technology === 'gas') {
        gen.available = false;
      }
    }
    const cfg = createDefaultDispatchConfig(stressed);
    const bundle = runOptimalEnergyDispatch(stressed, cfg);

    expect(bundle.feasible).toBe(true);
    expect(bundle.vollPenaltyCostInr).toBeGreaterThan(0);
    expect(bundle.residualSummary.maxPowerBalanceResidualMW).toBeLessThan(1e-2);
    expect(bundle.summary.hourlyDispatches.some((h) => h.balanceStatus === 'Deficit')).toBe(true);
  });

  it('synchronizes Weather & Time-of-Day environment modes with renewable dispatch and 3D telemetry', () => {
    const store = useSimulationStore.getState();
    store.resetSimulation();

    store.setEnvironmentMode('day');
    const dayState = useSimulationStore.getState();
    const dayTelemetry = computeGridVisualTelemetry(
      dayState.activeDispatch,
      dayState.activeHourlyDemand,
      dayState.environmentMode,
    );
    expect(dayState.environmentMode).toBe('day');
    expect(dayState.activeHour).toBe(14);
    expect(dayTelemetry.solarMW).toBeGreaterThan(40);
    expect(dayTelemetry.lighting.isNight).toBe(false);
    expect(dayTelemetry.lighting.surfaceWetness).toBe(0);

    store.setEnvironmentMode('night');
    const nightState = useSimulationStore.getState();
    const nightTelemetry = computeGridVisualTelemetry(
      nightState.activeDispatch,
      nightState.activeHourlyDemand,
      nightState.environmentMode,
    );
    expect(nightState.environmentMode).toBe('night');
    expect(nightState.activeHour).toBe(21);
    expect(nightState.dispatchBundle.feasible).toBe(true);
    expect(nightTelemetry.solarMW).toBeCloseTo(0, 2);
    expect(nightTelemetry.lighting.isNight).toBe(true);
    expect(nightTelemetry.lighting.nightIlluminationFactor).toBe(1.0);
    expect(nightTelemetry.lighting.powerLineGlowIntensity).toBeGreaterThan(
      dayTelemetry.lighting.powerLineGlowIntensity,
    );

    store.setEnvironmentMode('cloudy');
    const cloudyState = useSimulationStore.getState();
    const cloudyTelemetry = computeGridVisualTelemetry(
      cloudyState.activeDispatch,
      cloudyState.activeHourlyDemand,
      cloudyState.environmentMode,
    );
    expect(cloudyState.environmentMode).toBe('cloudy');
    expect(cloudyState.weatherControls.solarIrradianceScale).toBeLessThan(1);
    expect(cloudyTelemetry.lighting.isCloudy).toBe(true);
    expect(cloudyTelemetry.solarMW).toBeLessThan(dayTelemetry.solarMW);

    store.setEnvironmentMode('rainy');
    const rainyState = useSimulationStore.getState();
    const rainyTelemetry = computeGridVisualTelemetry(
      rainyState.activeDispatch,
      rainyState.activeHourlyDemand,
      rainyState.environmentMode,
    );
    expect(rainyState.environmentMode).toBe('rainy');
    expect(rainyState.dispatchBundle.feasible).toBe(true);
    expect(rainyState.weatherControls.windResourceScale).toBeGreaterThan(1);
    expect(rainyTelemetry.lighting.isRainy).toBe(true);
    expect(rainyTelemetry.lighting.surfaceWetness).toBeGreaterThan(0.8);
    expect(rainyTelemetry.solarMW).toBeLessThan(cloudyTelemetry.solarMW);

    store.setEnvironmentMode('sunset');
    const sunsetState = useSimulationStore.getState();
    const sunsetTelemetry = computeGridVisualTelemetry(
      sunsetState.activeDispatch,
      sunsetState.activeHourlyDemand,
      sunsetState.environmentMode,
    );
    expect(sunsetState.environmentMode).toBe('sunset');
    expect(sunsetState.activeHour).toBe(18);
    expect(sunsetTelemetry.lighting.isSunset).toBe(true);
    expect(sunsetTelemetry.lighting.sunPosition[0]).toBeLessThan(-70);
    expect(sunsetTelemetry.lighting.waterSheenIntensity).toBeGreaterThan(0.8);
    expect(sunsetTelemetry.lighting.vegetationTintHex).not.toBe(
      dayTelemetry.lighting.vegetationTintHex,
    );

    // Scrubbing timeline hour while in Rainy preserves storm mood into Night hours
    store.setEnvironmentMode('rainy');
    store.setActiveHour(21);
    const rainyNightState = useSimulationStore.getState();
    const rainyNightTelemetry = computeGridVisualTelemetry(
      rainyNightState.activeDispatch,
      rainyNightState.activeHourlyDemand,
      rainyNightState.environmentMode,
    );
    expect(rainyNightState.environmentMode).toBe('rainy');
    expect(rainyNightTelemetry.lighting.isRainy).toBe(true);
    expect(rainyNightTelemetry.lighting.isNight).toBe(true);
    expect(rainyNightTelemetry.lighting.surfaceWetness).toBeGreaterThan(0.85);
    expect(rainyNightTelemetry.lighting.cloudCoverage).toBeGreaterThan(0.9);

    // Clear timeline scrubbing shifts solar arc azimuth smoothly between morning and dusk
    store.setEnvironmentMode('day');
    store.setActiveHour(9);
    const morningLighting = computeGridVisualTelemetry(
      useSimulationStore.getState().activeDispatch,
      useSimulationStore.getState().activeHourlyDemand,
      useSimulationStore.getState().environmentMode,
    ).lighting;
    expect(morningLighting.sunPosition[0]).toBeGreaterThan(40);

    store.resetSimulation();
    expect(useSimulationStore.getState().environmentMode).toBe('day');
  });

  it('generates distinct sRGB equirectangular skybox environment textures for Day, Sunset, and Night', () => {
    const dayLighting = computeDiurnalLighting(14, 'day');
    const sunsetLighting = computeDiurnalLighting(18, 'sunset');
    const nightLighting = computeDiurnalLighting(21, 'night');

    const mkTex = (l: typeof dayLighting) =>
      createSkyboxEnvironmentTexture({
        skyTopHex: l.skyTopHex,
        skyHorizonHex: l.skyHorizonHex,
        sunGlowHex: l.sunGlowHex,
        groundHex: l.groundTintColor,
        sunPosition: l.sunPosition,
        sunIntensity: l.isSunset ? 1.15 : l.isNight ? 0.28 : 0.85,
      });

    const dayTex = mkTex(dayLighting);
    const sunsetTex = mkTex(sunsetLighting);
    const nightTex = mkTex(nightLighting);

    expect(dayTex.mapping).toBe(THREE.EquirectangularReflectionMapping);
    expect(dayTex.colorSpace).toBe(THREE.SRGBColorSpace);

    const dayData = dayTex.image.data as Uint8Array;
    const sunsetData = sunsetTex.image.data as Uint8Array;
    const nightData = nightTex.image.data as Uint8Array;

    // Zenith row (top sky) in Day should be brighter than Night zenith
    const zenithOffset = (31 * 64 + 32) * 4;
    const dayZenithLum = dayData[zenithOffset] + dayData[zenithOffset + 1] + dayData[zenithOffset + 2];
    const nightZenithLum = nightData[zenithOffset] + nightData[zenithOffset + 1] + nightData[zenithOffset + 2];
    expect(dayZenithLum).toBeGreaterThan(nightZenithLum * 2);

    // Horizon row in Sunset should carry warmer red bias than blue channel
    const horizonOffset = (16 * 64 + 32) * 4;
    expect(sunsetData[horizonOffset]).toBeGreaterThan(sunsetData[horizonOffset + 2]);

    dayTex.dispose();
    sunsetTex.dispose();
    nightTex.dispose();

    // Three.js Sky Preetham solar vector & scattering transitions across Day / Sunset / Night
    expect(dayLighting.skySunPosition[1]).toBeGreaterThan(0.5);
    expect(sunsetLighting.skySunPosition[1]).toBeGreaterThan(0);
    expect(sunsetLighting.skySunPosition[1]).toBeLessThan(0.2);
    expect(sunsetLighting.skyTurbidity).toBeGreaterThan(dayLighting.skyTurbidity);
    expect(sunsetLighting.skyRayleigh).toBeGreaterThan(dayLighting.skyRayleigh);
    expect(nightLighting.skySunPosition[1]).toBeLessThan(0);
  });

  it('generates forked 3D lightning bolts, double-flicker flash envelopes, and safe StormAudioEngine lifecycle', () => {
    const segs = Array.from({ length: 30 }, () => ({
      ax: 0,
      ay: 0,
      az: 0,
      bx: 0,
      by: 0,
      bz: 0,
      radius: 0,
    }));

    const count = buildForkedBolt(-20, 34, -50, -18, 6, -60, 3, segs);
    expect(count).toBe(14 + 3 * 3);
    expect(segs[0].ay).toBe(34);
    expect(segs[13].by).toBe(6);
    expect(segs[0].radius).toBeGreaterThan(segs[14].radius);

    // Double-return-stroke envelope hits primary peak, dips, and decays cleanly
    expect(computeBoltEnvelope(0.036, 0.45, false)).toBeGreaterThan(0.8);
    expect(computeBoltEnvelope(0.095, 0.45, false)).toBeLessThan(0.3);
    expect(computeBoltEnvelope(0.15, 0.45, false)).toBeGreaterThan(0.75);
    expect(computeBoltEnvelope(0.5, 0.45, false)).toBe(0);

    // Reduced-motion mode suppresses rapid strobing and caps gentle flash intensity
    expect(computeBoltEnvelope(0.225, 0.45, true)).toBeLessThanOrEqual(0.33);

    // StormAudioEngine stays safe when constructed/toggled/disposed outside active browser gestures
    const audio = new StormAudioEngine();
    audio.setRainActive(true);
    audio.setEnabled(false);
    audio.triggerThunder({ distanceNorm: 0.4, pan: -0.5 });
    audio.dispose();

    const stormLighting = computeDiurnalLighting(15, 'rainy');
    expect(stormLighting.isRainy).toBe(true);
    expect(stormLighting.skyCloudDensity).toBeGreaterThan(0.9);
    expect(stormLighting.cloudCoverage).toBeGreaterThan(0.95);
  });
});
