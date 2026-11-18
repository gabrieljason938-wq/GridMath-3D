import { describe, expect, it } from 'vitest';
import { validateScenario } from '../data/ingestion';
import { SYNTHETIC_SCENARIOS } from '../data/syntheticMicrogrid';
import { computeBaselineForecast } from '../forecasting/baselineForecaster';
import {
  computeErrorMetrics,
  finiteDifferenceDerivative,
  linearInterpolateSeries,
  newtonRaphsonScalar,
  solveLinearSystem,
} from '../math/numericalCore';
import { runMeritOrderBaselineDispatch } from '../optimization/meritOrderDispatch';
import {
  buildTransmissionCorridors,
  computeDiurnalLighting,
  computeGridVisualTelemetry,
} from '../components/three/powerFlowMath';

describe('GRIDMATH 3D — Data Ingestion & Validation', () => {
  it('validates all synthetic urban microgrid scenarios cleanly', () => {
    for (const scenario of SYNTHETIC_SCENARIOS) {
      const report = validateScenario(scenario);
      expect(report.valid).toBe(true);
      expect(report.errors).toEqual([]);
      expect(scenario.hourlyDemand).toHaveLength(24);
      expect(scenario.isSynthetic).toBe(true);
    }
  });

  it('detects sector load reconciliation mismatches', () => {
    const broken = structuredClone(SYNTHETIC_SCENARIOS[0]);
    broken.hourlyDemand[5].totalMW += 25;
    const report = validateScenario(broken);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('reconcile'))).toBe(true);
  });
});

describe('GRIDMATH 3D — Numerical Core Solvers', () => {
  it('solves a 3x3 linear nodal system with machine-precision residual', () => {
    const A = [
      [10, -2, -1],
      [-2, 12, -3],
      [-1, -3, 9],
    ];
    const b = [120, 85, 60];
    const result = solveLinearSystem(A, b);

    expect(result.converged).toBe(true);
    expect(result.residualNorm).toBeLessThan(1e-9);
    expect(result.solution).toHaveLength(3);

    // Verify A*x ~= b
    const row0 = A[0][0] * result.solution[0] + A[0][1] * result.solution[1] + A[0][2] * result.solution[2];
    expect(row0).toBeCloseTo(120, 4);
  });

  it('computes MAE, RMSE, MAPE, and R^2 accurately', () => {
    const actual = [100, 200, 300, 400];
    const predicted = [110, 190, 310, 390];
    const metrics = computeErrorMetrics(actual, predicted);

    expect(metrics.mae).toBe(10);
    expect(metrics.rmse).toBe(10);
    expect(metrics.mapePercent).toBeCloseTo(5.21, 2);
    expect(metrics.rSquared).toBeCloseTo(0.992, 3);
  });

  it('computes finite difference ramp derivatives and linear interpolation', () => {
    const deriv = finiteDifferenceDerivative([100, 120, 150, 150], 1);
    expect(deriv).toEqual([20, 25, 15, 0]);
    expect(linearInterpolateSeries([0, 2, 4], [10, 30, 50], 1)).toBe(20);
  });

  it('converges quadratically with Newton-Raphson scalar solver', () => {
    // Solve x^2 - 2 = 0 starting at x0 = 1.5
    const steps = newtonRaphsonScalar(
      (x) => x * x - 2,
      (x) => 2 * x,
      1.5,
      1e-9,
      10,
    );
    const last = steps[steps.length - 1];
    expect(last.converged).toBe(true);
    expect(last.estimate).toBeCloseTo(Math.SQRT2, 5);
  });
});

describe('GRIDMATH 3D — Forecasting & Merit-Order Dispatch Baseline', () => {
  it('generates a 24-hour synthetic baseline forecast with bounded error metrics', () => {
    const forecast = computeBaselineForecast(SYNTHETIC_SCENARIOS[0]);
    expect(forecast.points).toHaveLength(24);
    expect(forecast.isSyntheticBaseline).toBe(true);
    expect(forecast.mapePercent).toBeGreaterThan(0);
    expect(forecast.mapePercent).toBeLessThan(20);
  });

  it('maintains hourly MW power balance and battery SoC limits across 24 hours', () => {
    const scenario = SYNTHETIC_SCENARIOS[0];
    const summary = runMeritOrderBaselineDispatch(scenario);
    const minSoc = scenario.battery.capacityMWh * scenario.battery.minSocRatio;
    const maxSoc = scenario.battery.capacityMWh * scenario.battery.maxSocRatio;

    expect(summary.hourlyDispatches).toHaveLength(24);
    expect(summary.predictedPeakDemandMW).toBeCloseTo(scenario.peakDemandMW, 2);

    for (const h of summary.hourlyDispatches) {
      expect(h.batterySocMWh).toBeGreaterThanOrEqual(minSoc - 0.01);
      expect(h.batterySocMWh).toBeLessThanOrEqual(maxSoc + 0.01);
      // Power balance: generation + battery net + unserved - curtailment == demand
      const netSupply =
        h.totalDispatchedGenerationMW + h.batteryNetPowerMW + h.unservedEnergyMW - h.curtailmentMW;
      expect(netSupply).toBeCloseTo(h.totalDemandMW, 0);
      expect(h.emissionsTonnesCO2e).toBeCloseTo(h.emissionsKgCO2e / 1000, 2);
    }
  });
});

describe('GRIDMATH 3D — 3D Power Flow & Diurnal Simulation State', () => {
  it('computes deterministic diurnal lighting across noon and night hours', () => {
    const noon = computeDiurnalLighting(12);
    const midnight = computeDiurnalLighting(0);

    expect(noon.isDaytime).toBe(true);
    expect(noon.daylightFactor).toBeGreaterThan(0.9);
    expect(noon.nightIlluminationFactor).toBeLessThan(0.1);

    expect(midnight.isDaytime).toBe(false);
    expect(midnight.daylightFactor).toBe(0);
    expect(midnight.nightIlluminationFactor).toBe(1);
  });

  it('scales transmission corridor particle density and warning state from numeric MW inputs', () => {
    const nominalCorridors = buildTransmissionCorridors({
      solarMW: 140,
      windMW: 50,
      thermalMW: 180,
      bessNetMW: 25,
      residentialMW: 140,
      commercialMW: 180,
      industrialMW: 110,
      supplyShortage: false,
    });

    const solarCorridor = nominalCorridors.find((c) => c.id === 'solar-substation');
    expect(solarCorridor?.particleCount).toBeGreaterThan(5);
    expect(solarCorridor?.colorHex).toBe('#10B981');

    const shortageCorridors = buildTransmissionCorridors({
      solarMW: 0,
      windMW: 10,
      thermalMW: 290,
      bessNetMW: 0,
      residentialMW: 200,
      commercialMW: 180,
      industrialMW: 120,
      supplyShortage: true,
    });

    const zeroSolar = shortageCorridors.find((c) => c.id === 'solar-substation');
    const residentialShortage = shortageCorridors.find((c) => c.id === 'substation-residential');
    expect(zeroSolar?.particleCount).toBe(0);
    expect(residentialShortage?.isShortage).toBe(true);
    expect(residentialShortage?.colorHex).toBe('#DC2626');
  });

  it('produces consistent visual telemetry from dispatch and hourly demand', () => {
    const scenario = SYNTHETIC_SCENARIOS[0];
    const summary = runMeritOrderBaselineDispatch(scenario);
    const telemetry = computeGridVisualTelemetry(
      summary.hourlyDispatches[14],
      scenario.hourlyDemand[14],
    );

    expect(telemetry.corridors).toHaveLength(7);
    expect(telemetry.solarMW).toBeGreaterThan(100);
    expect(telemetry.lighting.hour).toBe(14);
  });
});

import { computeNewtonDividedDifference } from '../math/interpolation';
import { solveGaussianElimination } from '../math/gaussianElimination';
import { solveLeastSquaresRegression } from '../math/regression';
import { computeNumericalDifferentiation } from '../math/differentiation';
import { computeNumericalIntegration } from '../math/integration';
import { solveLinearProgram } from '../math/linearProgramming';

describe('GRIDMATH 3D — Phase 3 Numerical Mathematics Laboratory', () => {
  it('reproduces polynomials exactly with Newton Divided Difference Interpolation', () => {
    // Exact quadratic f(x) = 2x^2 - 3x + 5
    const pts = [0, 1, 2, 4].map((x) => ({ x, y: 2 * x * x - 3 * x + 5 }));
    const res = computeNewtonDividedDifference(pts, 3, (x) => 2 * x * x - 3 * x + 5);

    expect(res.valid).toBe(true);
    expect(res.maxNodeResidual).toBeLessThan(1e-10);
    expect(res.interpolatedY).toBeCloseTo(2 * 9 - 9 + 5, 8);
    expect(res.benchmarkError).toBeLessThan(1e-10);
  });

  it('performs Gaussian elimination with partial pivoting and detects singular matrices', () => {
    // Requires row swap because A[0][0] === 0
    const A = [
      [0, 2, 1],
      [4, -1, 2],
      [2, 3, -1],
    ];
    const b = [7, 11, 5];
    const res = solveGaussianElimination(A, b);

    expect(res.valid).toBe(true);
    expect(res.singular).toBe(false);
    expect(res.swapCount).toBeGreaterThanOrEqual(1);
    expect(res.residualL2Norm).toBeLessThan(1e-10);

    const singularRes = solveGaussianElimination(
      [
        [1, 2, 3],
        [2, 4, 6],
        [1, 1, 1],
      ],
      [6, 12, 3],
    );
    expect(singularRes.valid).toBe(false);
    expect(singularRes.singular).toBe(true);
  });

  it('solves 1-predictor and 2-predictor least squares via Householder QR accurately', () => {
    // Exact plane y = 5 + 2*x1 - 3*x2
    const obs = [
      { id: '1', label: 'A', x1: 1, x2: 1, y: 4 },
      { id: '2', label: 'B', x1: 2, x2: 0, y: 9 },
      { id: '3', label: 'C', x1: 0, x2: 2, y: -1 },
      { id: '4', label: 'D', x1: 3, x2: 2, y: 5 },
      { id: '5', label: 'E', x1: 4, x2: 1, y: 10 },
    ];
    const res2 = solveLeastSquaresRegression(obs, 2);
    expect(res2.valid).toBe(true);
    expect(res2.coefficients[0]).toBeCloseTo(5, 8);
    expect(res2.coefficients[1]).toBeCloseTo(2, 8);
    expect(res2.coefficients[2]).toBeCloseTo(-3, 8);
    expect(res2.rmse).toBeLessThan(1e-9);
    expect(res2.qrOrthogonalityError).toBeLessThan(1e-10);

    const obs1 = [
      { id: '1', label: 'A', x1: 0, y: 10 },
      { id: '2', label: 'B', x1: 2, y: 14 },
      { id: '3', label: 'C', x1: 4, y: 18 },
    ];
    const res1 = solveLeastSquaresRegression(obs1, 1);
    expect(res1.valid).toBe(true);
    expect(res1.coefficients[0]).toBeCloseTo(10, 8);
    expect(res1.coefficients[1]).toBeCloseTo(2, 8);
  });

  it('demonstrates O(h^2) central vs O(h) forward finite-difference accuracy', () => {
    const fn = (t: number) => Math.sin(t) * 100 + 300;
    const dfn = (t: number) => Math.cos(t) * 100;
    const res = computeNumericalDifferentiation({
      fn,
      exactDfn: dfn,
      x0: 1.0,
      h: 0.4,
      method: 'central',
    });

    expect(res.stepSizeComparison).toHaveLength(3);
    const rowH = res.stepSizeComparison[0];
    const rowH4 = res.stepSizeComparison[2];
    expect(rowH.centralError!).toBeLessThan(rowH.forwardError!);
    // Halving h twice (h/4) shrinks O(h^2) central error by ~16x
    expect(rowH4.centralError!).toBeLessThan(rowH.centralError! / 12);
  });

  it('integrates cubic polynomials exactly with Simpson 1/3 (MWh) and rejects odd intervals', () => {
    // P(t) = 3t^2 + 2t + 10 => integral from 0 to 4 = [t^3 + t^2 + 10t]_0^4 = 64 + 16 + 40 = 120 MWh
    const cubic = (t: number) => 3 * t * t + 2 * t + 10;
    const exactInt = (lo: number, hi: number) =>
      hi ** 3 + hi ** 2 + 10 * hi - (lo ** 3 + lo ** 2 + 10 * lo);

    const oddCheck = computeNumericalIntegration({
      fn: cubic,
      exactIntegral: exactInt,
      a: 0,
      b: 4,
      subdivisions: 5,
      method: 'simpson',
    });
    expect(oddCheck.valid).toBe(false);

    const simpRes = computeNumericalIntegration({
      fn: cubic,
      exactIntegral: exactInt,
      a: 0,
      b: 4,
      subdivisions: 4,
      method: 'simpson',
    });
    expect(simpRes.valid).toBe(true);
    expect(simpRes.simpsonEnergyMWh).toBeCloseTo(120, 8);
    expect(simpRes.simpsonAbsErrorMWh!).toBeLessThan(1e-10);
    expect(simpRes.trapezoidalEnergyMWh).toBeGreaterThan(120);
  });

  it('solves 2D and 3D linear programs via Two-Phase Simplex and detects infeasibility', () => {
    // Min 10*x1 + 25*x2 s.t. x1 + x2 >= 100, x1 <= 60, x2 <= 80 => x* = (60, 40), Z* = 1600
    const lp2 = solveLinearProgram({
      sense: 'min',
      variableNames: ['x1', 'x2'],
      objectiveCoeffs: [10, 25],
      constraints: [
        { id: 'c1', label: 'Demand', coeffs: [1, 1], op: '>=', rhs: 100 },
        { id: 'c2', label: 'Cap1', coeffs: [1, 0], op: '<=', rhs: 60 },
        { id: 'c3', label: 'Cap2', coeffs: [0, 1], op: '<=', rhs: 80 },
      ],
    });
    expect(lp2.feasible).toBe(true);
    expect(lp2.status).toBe('optimal');
    expect(lp2.optimalPoint[0]).toBeCloseTo(60, 5);
    expect(lp2.optimalPoint[1]).toBeCloseTo(40, 5);
    expect(lp2.optimalValue).toBeCloseTo(1600, 5);
    expect(lp2.constraintResiduals.every((r) => r.satisfied)).toBe(true);

    // 3D LP: Min 1*x1 + 2*x2 + 3*x3 s.t. x1+x2+x3 >= 50, x1<=20, x2<=20, x3<=30 => (20,20,10), Z=90
    const lp3 = solveLinearProgram({
      sense: 'min',
      variableNames: ['x1', 'x2', 'x3'],
      objectiveCoeffs: [1, 2, 3],
      constraints: [
        { id: 'd', label: 'Demand', coeffs: [1, 1, 1], op: '>=', rhs: 50 },
        { id: 'u1', label: 'U1', coeffs: [1, 0, 0], op: '<=', rhs: 20 },
        { id: 'u2', label: 'U2', coeffs: [0, 1, 0], op: '<=', rhs: 20 },
        { id: 'u3', label: 'U3', coeffs: [0, 0, 1], op: '<=', rhs: 30 },
      ],
    });
    expect(lp3.status).toBe('optimal');
    expect(lp3.optimalPoint).toEqual([20, 20, 10]);
    expect(lp3.optimalValue).toBeCloseTo(90, 5);

    // Infeasible LP: x1 + x2 >= 200 with x1 <= 60, x2 <= 80
    const infLp = solveLinearProgram({
      sense: 'min',
      variableNames: ['x1', 'x2'],
      objectiveCoeffs: [10, 25],
      constraints: [
        { id: 'c1', label: 'Demand', coeffs: [1, 1], op: '>=', rhs: 200 },
        { id: 'c2', label: 'Cap1', coeffs: [1, 0], op: '<=', rhs: 60 },
        { id: 'c3', label: 'Cap2', coeffs: [0, 1], op: '<=', rhs: 80 },
      ],
    });
    expect(infLp.feasible).toBe(false);
    expect(infLp.status).toBe('infeasible');
  });
});

import {
  buildSampleForecastCsv,
  generateSyntheticHistoryDataset,
  parseForecastCsv,
} from '../forecasting/datasetManager';
import {
  computeForecastMetrics,
  runNumericalDemandForecast,
} from '../forecasting/numericalForecaster';

describe('GRIDMATH 3D — Phase 4 Numerical Demand Forecasting', () => {
  it('parses CSV uploads with missing, duplicate, and invalid-value detection under consistent timezone', () => {
    const sample = buildSampleForecastCsv(generateSyntheticHistoryDataset('Asia/Kolkata', 4));
    const lines = sample.split('\n');
    // Inject a duplicate row, missing row, and negative MW invalid row
    const dirtyCsv = [
      lines[0],
      lines[1],
      lines[1], // duplicate timestamp
      '2026-10-01T01:00:00+05:30,,24.0,60,Clear,0', // missing demand
      '2026-10-01T02:00:00+05:30,-50,23.0,60,Clear,0', // invalid negative MW
      ...lines.slice(2),
    ].join('\n');

    const bundle = parseForecastCsv(dirtyCsv, 'dirty-test.csv', 'Asia/Kolkata');
    expect(bundle.isSynthetic).toBe(false);
    expect(bundle.qualityReport.duplicateTimestampCount).toBe(1);
    expect(bundle.qualityReport.missingValueCount).toBe(1);
    expect(bundle.qualityReport.invalidValueCount).toBe(1);
    expect(bundle.qualityReport.chronologicallySorted).toBe(true);
    expect(bundle.records.length).toBeGreaterThanOrEqual(72);
  });

  it('prevents future leakage with chronological split and outperforms seasonal-naive baseline', () => {
    const dataset = generateSyntheticHistoryDataset('Asia/Kolkata', 14);
    expect(dataset.isSynthetic).toBe(true);

    const res = runNumericalDemandForecast({
      records: dataset.records,
      holdoutHours: 72,
      weatherScenarioId: 'nominal',
      workedHour: 14,
    });

    expect(res.valid).toBe(true);
    expect(res.chronologicalVerified).toBe(true);
    expect(res.maxTrainEpochMs).toBeLessThan(res.minHoldoutEpochMs);
    expect(res.next24h).toHaveLength(24);
    expect(res.qrOrthogonalityError).toBeLessThan(1e-9);
    expect(res.fullModelMetrics.rmseMW).toBeLessThan(res.naiveBaselineMetrics.rmseMW);
    expect(res.predictedPeakMW).toBeGreaterThan(res.lowestDemandMW);

    // Worked substitution terms must sum to workedPredictedMW
    const termSum = res.workedTerms.reduce((acc, t) => acc + t.contributionMW, 0);
    expect(termSum).toBeCloseTo(res.workedPredictedMW, 1);
  });

  it('marks MAPE invalid when actual demand contains zero denominators while keeping sMAPE valid', () => {
    const metrics = computeForecastMetrics([0, 100, 200], [5, 110, 190]);
    expect(metrics.mapeValid).toBe(false);
    expect(metrics.mapePercent).toBeNull();
    expect(metrics.smapePercent).toBeGreaterThan(0);
    expect(metrics.maeMW).toBeCloseTo(25 / 3, 2);
  });
});

import { solveBoundedLP } from '../optimization/boundedSimplex';
import {
  buildHourTwoVarDispatchSlice,
  createDefaultDispatchConfig,
  runOptimalEnergyDispatch,
} from '../optimization/optimalDispatchEngine';

describe('GRIDMATH 3D — Phase 5 Multi-Period Optimal Energy Dispatch', () => {
  it('solves bounded linear programs accurately and detects infeasibility', () => {
    // Min 10*x1 + 30*x2 s.t. x1 + x2 = 50, 10 <= x1 <= 35, 5 <= x2 <= 40 => x* = (35, 15), Z* = 800
    const res = solveBoundedLP({
      sense: 'min',
      numVars: 2,
      varNames: ['x1', 'x2'],
      objective: [10, 30],
      lowerBounds: [10, 5],
      upperBounds: [35, 40],
      rows: [{ name: 'bal', terms: [{ col: 0, coeff: 1 }, { col: 1, coeff: 1 }], op: '=', rhs: 50 }],
    });
    expect(res.feasible).toBe(true);
    expect(res.status).toBe('optimal');
    expect(res.primal[0]).toBeCloseTo(35, 4);
    expect(res.primal[1]).toBeCloseTo(15, 4);
    expect(res.objectiveValue).toBeCloseTo(800, 3);
    expect(res.maxConstraintViolation).toBeLessThan(1e-6);

    // Infeasible upper-bounded LP: x1 + x2 = 100 with x1 <= 35, x2 <= 40
    const inf = solveBoundedLP({
      sense: 'min',
      numVars: 2,
      varNames: ['x1', 'x2'],
      objective: [10, 30],
      lowerBounds: [10, 5],
      upperBounds: [35, 40],
      rows: [{ name: 'bal', terms: [{ col: 0, coeff: 1 }, { col: 1, coeff: 1 }], op: '=', rhs: 100 }],
    });
    expect(inf.feasible).toBe(false);
    expect(inf.status).toBe('infeasible');
  });

  it('satisfies all 24h multi-period power balance, ramp, capacity, SoC, and complementarity constraints', () => {
    const scenario = SYNTHETIC_SCENARIOS[0];
    const config = createDefaultDispatchConfig(scenario);
    const bundle = runOptimalEnergyDispatch(scenario, config);

    expect(bundle.feasible).toBe(true);
    expect(bundle.solverStatus).toBe('optimal');
    expect(bundle.summary.hourlyDispatches).toHaveLength(24);
    expect(bundle.residualSummary.allConstraintsSatisfied).toBe(true);
    expect(bundle.residualSummary.maxPowerBalanceResidualMW).toBeLessThan(1e-2);
    expect(bundle.residualSummary.maxBatterySocDynamicsErrorMWh).toBeLessThan(1e-2);
    expect(bundle.residualSummary.maxRampViolationMW).toBeLessThan(1e-2);
    expect(bundle.residualSummary.maxCapacityBoundViolationMW).toBeLessThan(1e-2);
    expect(bundle.residualSummary.terminalSocViolationMWh).toBeLessThan(1e-2);
    expect(bundle.residualSummary.simultaneousChargeDischargeHours).toBe(0);

    // 2-variable single-hour slice must also remain feasible
    const slice = buildHourTwoVarDispatchSlice(
      scenario,
      config,
      14,
      bundle.summary.hourlyDispatches[14],
    );
    expect(slice.lpResult.feasible).toBe(true);
  });

  it('achieves lower or equal cost via LP optimization compared to Thermal-First and Renewable Heuristic', () => {
    for (const scenario of SYNTHETIC_SCENARIOS) {
      const config = createDefaultDispatchConfig(scenario);
      const bundle = runOptimalEnergyDispatch(scenario, config);
      const tf = bundle.comparisons.find((c) => c.strategy === 'thermal-first')!;
      const heur = bundle.comparisons.find((c) => c.strategy === 'renewable-heuristic')!;
      const lp = bundle.comparisons.find((c) => c.strategy === 'lp-optimal')!;

      expect(lp.totalCostInr).toBeLessThanOrEqual(tf.totalCostInr);
      expect(lp.totalCostInr).toBeLessThanOrEqual(heur.totalCostInr);
      expect(lp.costSavingsVsThermalFirstPercent).toBeGreaterThan(0);
    }
  });

  it('supports multi-objective carbon pricing, carbon cap enforcement, and infeasibility reporting', () => {
    const scenario = SYNTHETIC_SCENARIOS[0];
    const leastCost = runOptimalEnergyDispatch(scenario, createDefaultDispatchConfig(scenario));

    // Apply high carbon price (distinguishing least-cost vs carbon-weighted dispatch)
    const carbonPricedConfig = {
      ...createDefaultDispatchConfig(scenario),
      carbonPriceInrPerTonne: 4500,
    };
    const carbonPriced = runOptimalEnergyDispatch(scenario, carbonPricedConfig);
    expect(carbonPriced.feasible).toBe(true);
    expect(carbonPriced.summary.totalDailyEmissionsTonnesCO2e).toBeLessThanOrEqual(
      leastCost.summary.totalDailyEmissionsTonnesCO2e + 1e-2,
    );
    expect(carbonPriced.carbonPenaltyCostInr).toBeGreaterThan(0);

    // Impossible carbon cap triggers clean infeasible state without throwing
    const impossibleConfig = {
      ...createDefaultDispatchConfig(scenario),
      enableCarbonCap: true,
      carbonCapTonnesCO2e: 100,
    };
    const impossible = runOptimalEnergyDispatch(scenario, impossibleConfig);
    expect(impossible.feasible).toBe(false);
    expect(impossible.solverStatus).toBe('infeasible');
  });

  it('handles inadequate capacity by activating nonnegative unserved load with VOLL penalty', () => {
    const stressed = structuredClone(SYNTHETIC_SCENARIOS[0]);
    // Spike peak hours well beyond combined generator + BESS capacity (~545 MW)
    for (const h of [18, 19, 20]) {
      stressed.hourlyDemand[h].residentialMW += 220;
      stressed.hourlyDemand[h].totalMW += 220;
    }
    const config = createDefaultDispatchConfig(stressed);
    const bundle = runOptimalEnergyDispatch(stressed, config);

    expect(bundle.feasible).toBe(true);
    expect(bundle.vollPenaltyCostInr).toBeGreaterThan(0);
    const totalUnserved = bundle.summary.hourlyDispatches.reduce(
      (acc, h) => acc + h.unservedEnergyMW,
      0,
    );
    expect(totalUnserved).toBeGreaterThan(50);
    expect(bundle.residualSummary.maxPowerBalanceResidualMW).toBeLessThan(1e-2);
  });
});

import {
  DEFAULT_WEATHER_CONTROLS,
  evaluateScenarioComparisonMatrix,
  executeDigitalTwinPipeline,
} from '../simulation/digitalTwinPipeline';
import { useSimulationStore } from '../store/useSimulationStore';

describe('GRIDMATH 3D — Phase 6 Unified 3D Mathematical Digital Twin', () => {
  it('defines all 8 scenarios validly while preserving unrelated baseline settings', () => {
    expect(SYNTHETIC_SCENARIOS).toHaveLength(8);
    const nominal = SYNTHETIC_SCENARIOS.find((s) => s.id === 'urban-nominal')!;
    const outage = SYNTHETIC_SCENARIOS.find((s) => s.id === 'urban-thermal-outage')!;
    const depleted = SYNTHETIC_SCENARIOS.find((s) => s.id === 'urban-battery-depletion')!;
    const industrialSurge = SYNTHETIC_SCENARIOS.find((s) => s.id === 'urban-industrial-surge')!;

    for (const sc of SYNTHETIC_SCENARIOS) {
      const report = validateScenario(sc);
      expect(report.valid).toBe(true);
      expect(sc.changedProperties?.length).toBeGreaterThan(0);
    }

    // Thermal outage preserves nominal demand & battery, only disables gen-coal-01
    expect(outage.hourlyDemand).toEqual(nominal.hourlyDemand);
    expect(outage.battery).toEqual(nominal.battery);
    expect(outage.generators.find((g) => g.id === 'gen-coal-01')?.available).toBe(false);
    expect(outage.generators.find((g) => g.id === 'gen-gas-01')?.available).toBe(true);

    // Battery depletion preserves nominal demand & fleet, only lowers initialSocMWh
    expect(depleted.hourlyDemand).toEqual(nominal.hourlyDemand);
    expect(depleted.generators).toEqual(nominal.generators);
    expect(depleted.battery.initialSocMWh).toBe(22);

    // Industrial surge preserves residential, commercial, and weather
    for (let h = 0; h < 24; h++) {
      expect(industrialSurge.hourlyDemand[h].residentialMW).toBe(nominal.hourlyDemand[h].residentialMW);
      expect(industrialSurge.hourlyDemand[h].commercialMW).toBe(nominal.hourlyDemand[h].commercialMW);
      expect(industrialSurge.hourlyDemand[h].temperatureDegC).toBe(nominal.hourlyDemand[h].temperatureDegC);
      expect(industrialSurge.hourlyDemand[h].industrialMW).toBeGreaterThan(
        nominal.hourlyDemand[h].industrialMW,
      );
    }
  });

  it('propagates weather controls and generator outages cleanly through QR forecast and LP dispatch', () => {
    const nominal = SYNTHETIC_SCENARIOS[0];
    const dataset = generateSyntheticHistoryDataset('Asia/Kolkata', 14);
    const config = createDefaultDispatchConfig(nominal);

    const out = executeDigitalTwinPipeline({
      baseScenario: nominal,
      weatherControls: {
        temperatureDeltaDegC: 5.0,
        solarIrradianceScale: 0.4,
        windResourceScale: 1.2,
        demandScaleFactor: 1.05,
      },
      generatorOverrides: {
        'gen-coal-01': { available: false },
      },
      batteryInitialSocOverrideMWh: 75,
      dispatchConfig: config,
      forecastDataset: dataset,
      weatherScenarioId: 'nominal',
      holdoutHours: 24,
      activeHour: 14,
      useForecastDrivenDemand: false,
      customForecastSeries: null,
    });

    expect(out.validationReport.valid).toBe(true);
    expect(out.numericalForecast.valid).toBe(true);
    expect(out.dispatchBundle.feasible).toBe(true);
    expect(out.dispatchBundle.residualSummary.maxPowerBalanceResidualMW).toBeLessThan(1e-2);
    expect(out.effectiveScenario.battery.initialSocMWh).toBe(75);
    expect(out.effectiveScenario.generators.find((g) => g.id === 'gen-coal-01')?.available).toBe(false);
    expect(out.effectiveScenario.hourlyDemand[14].temperatureDegC).toBeCloseTo(
      nominal.hourlyDemand[14].temperatureDegC + 5.0,
      1,
    );
    expect(out.effectiveScenario.hourlyDemand[14].solarIrradianceWm2).toBeCloseTo(
      nominal.hourlyDemand[14].solarIrradianceWm2 * 0.4,
      0,
    );
    // Outage + heatwave cooling spike + reduced solar raises daily cost above baseline
    const baseline = executeDigitalTwinPipeline({
      baseScenario: nominal,
      weatherControls: DEFAULT_WEATHER_CONTROLS,
      generatorOverrides: {},
      batteryInitialSocOverrideMWh: null,
      dispatchConfig: config,
      forecastDataset: dataset,
      weatherScenarioId: 'nominal',
      holdoutHours: 24,
      activeHour: 14,
      useForecastDrivenDemand: false,
      customForecastSeries: null,
    });
    expect(out.dispatchBundle.summary.totalDailyCostInr).toBeGreaterThan(
      baseline.dispatchBundle.summary.totalDailyCostInr,
    );
  });

  it('couples Householder QR forecast demand directly into effectiveScenario when enabled', () => {
    const nominal = SYNTHETIC_SCENARIOS[0];
    const dataset = generateSyntheticHistoryDataset('Asia/Kolkata', 14);
    const config = createDefaultDispatchConfig(nominal);

    const coupled = executeDigitalTwinPipeline({
      baseScenario: nominal,
      weatherControls: DEFAULT_WEATHER_CONTROLS,
      generatorOverrides: {},
      batteryInitialSocOverrideMWh: null,
      dispatchConfig: config,
      forecastDataset: dataset,
      weatherScenarioId: 'nominal',
      holdoutHours: 24,
      activeHour: 14,
      useForecastDrivenDemand: true,
      customForecastSeries: null,
    });

    expect(coupled.dispatchBundle.feasible).toBe(true);
    for (let h = 0; h < 24; h++) {
      expect(coupled.effectiveScenario.hourlyDemand[h].totalMW).toBeCloseTo(
        coupled.numericalForecast.next24h[h].fullModelMW,
        1,
      );
    }
  });

  it('evaluates the 8-scenario LP benchmark matrix cleanly without solver errors', () => {
    const config = createDefaultDispatchConfig(SYNTHETIC_SCENARIOS[0]);
    const matrix = evaluateScenarioComparisonMatrix(SYNTHETIC_SCENARIOS, config);

    expect(matrix).toHaveLength(8);
    expect(matrix[0].costDeltaVsNormalPercent).toBe(0);
    for (const row of matrix) {
      expect(row.solverStatus).toBe('Optimal LP');
      expect(row.maxBalanceResidualMW).toBeLessThan(1e-2);
      expect(row.dailyEnergyMWh).toBeGreaterThan(5000);
    }
  });

  it('steps simulation time in O(1) without spurious LP recalculation history entries', () => {
    const store = useSimulationStore.getState();
    store.resetSimulation();
    const historyLenAfterReset = useSimulationStore.getState().calculationHistory.length;

    store.playSimulation();
    expect(useSimulationStore.getState().isPlaying).toBe(true);

    store.stepHour(3);
    const afterStep = useSimulationStore.getState();
    expect(afterStep.activeHour).toBe(17);
    expect(afterStep.simulationTimestampIso).toContain('T17:00:00');
    expect(afterStep.activeDispatch.hour).toBe(17);
    expect(afterStep.activeHourlyDemand.hour).toBe(17);
    expect(afterStep.calculationHistory.length).toBe(historyLenAfterReset);

    store.pauseSimulation();
    store.resetSimulation();
  });
});

import {
  DEFAULT_EXPERIMENT_PARAMETERS,
  EXPERIMENT_CATALOG,
  runAllEightExperiments,
  runScientificExperiment,
  serializeExperimentCsv,
  SOFTWARE_VERSION,
} from '../experiments/scientificExperiments';

describe('GRIDMATH 3D — Phase 7 Scientific Experimentation & Academic Reporting', () => {
  it('executes all 8 reproducible experiments with complete provenance manifests and valid tables', () => {
    const scenario = SYNTHETIC_SCENARIOS[0];
    const config = createDefaultDispatchConfig(scenario);
    const dataset = generateSyntheticHistoryDataset('Asia/Kolkata', 14);

    const results = runAllEightExperiments({
      scenario,
      dispatchConfig: config,
      forecastDataset: dataset,
      expParams: DEFAULT_EXPERIMENT_PARAMETERS,
    });

    expect(Object.keys(results)).toHaveLength(8);
    for (const desc of EXPERIMENT_CATALOG) {
      const res = results[desc.id];
      expect(res.manifest.experimentId).toBe(desc.id);
      expect(res.manifest.softwareVersion).toBe(SOFTWARE_VERSION);
      expect(res.manifest.dataProvenance).toBe('Synthetic / Analytic Benchmark');
      expect(res.manifest.algorithmName.length).toBeGreaterThan(5);
      expect(res.manifest.numericalTolerance.length).toBeGreaterThan(5);
      expect(res.manifest.computeMs).toBeGreaterThan(0);
      expect(res.tableHeaders.length).toBeGreaterThanOrEqual(5);
      expect(res.tableRows.length).toBeGreaterThanOrEqual(3);
      expect(res.summaryMetrics).toHaveLength(4);
      expect(res.limitations.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('verifies exact cubic integration precision for Simpson 1/3 vs O(h^2) Trapezoidal convergence', () => {
    const scenario = SYNTHETIC_SCENARIOS[0];
    const config = createDefaultDispatchConfig(scenario);
    const dataset = generateSyntheticHistoryDataset('Asia/Kolkata', 14);

    const res = runScientificExperiment({
      experimentId: 'integration-accuracy',
      scenario,
      dispatchConfig: config,
      forecastDataset: dataset,
      expParams: { ...DEFAULT_EXPERIMENT_PARAMETERS, integrandId: 'cubic-polynomial', maxSubdivisions: 32 },
    });

    expect(res.plot3D.kind).toBe('error-surface');
    if (res.plot3D.kind === 'error-surface') {
      const trapRow = res.plot3D.grid[0];
      const simpRow = res.plot3D.grid[1];
      // Trapezoidal error decreases as subdivisions n increase
      expect(trapRow[trapRow.length - 1].rawErr).toBeLessThan(trapRow[0].rawErr);
      // Simpson 1/3 integrates cubic polynomials to near machine precision
      expect(simpRow[simpRow.length - 1].rawErr).toBeLessThan(1e-9);
    }
  });

  it('proves Partial Pivoting numerical stability and deterministic seeded regression reproducibility', () => {
    const scenario = SYNTHETIC_SCENARIOS[0];
    const config = createDefaultDispatchConfig(scenario);
    const dataset = generateSyntheticHistoryDataset('Asia/Kolkata', 14);

    const gaussRes = runScientificExperiment({
      experimentId: 'gaussian-stability',
      scenario,
      dispatchConfig: config,
      forecastDataset: dataset,
      expParams: { ...DEFAULT_EXPERIMENT_PARAMETERS, pivotEpsilonExp: 10 },
    });
    // Row 0 = 2x2 Partial Pivoting, Row 1 = 2x2 No Pivoting
    expect(Number(gaussRes.tableRows[0][3])).toBeLessThan(1e-8);
    expect(gaussRes.tableRows[1][5]).toBe('Catastrophic Cancellation');

    const regRun1 = runScientificExperiment({
      experimentId: 'regression-comparison',
      scenario,
      dispatchConfig: config,
      forecastDataset: dataset,
      expParams: { ...DEFAULT_EXPERIMENT_PARAMETERS, seed: 98765 },
    });
    const regRun2 = runScientificExperiment({
      experimentId: 'regression-comparison',
      scenario,
      dispatchConfig: config,
      forecastDataset: dataset,
      expParams: { ...DEFAULT_EXPERIMENT_PARAMETERS, seed: 98765 },
    });
    // Deterministic PRNG seed guarantees bit-identical experimental results
    expect(regRun1.tableRows).toEqual(regRun2.tableRows);
  });

  it('serializes experiment CSV with reproducibility headers and pins all 8 benchmarks in store', () => {
    const store = useSimulationStore.getState();
    const pinned = store.runAndPinAllExperiments();
    expect(Object.keys(pinned)).toHaveLength(8);
    expect(Object.keys(useSimulationStore.getState().pinnedExperiments)).toHaveLength(8);

    const csv = serializeExperimentCsv(pinned['dispatch-vs-heuristic']);
    expect(csv).toContain('# GRIDMATH 3D Scientific Experiment Export');
    expect(csv).toContain('# Experiment,EXP-05');
    expect(csv).toContain('LP Optimal');
  });
});





