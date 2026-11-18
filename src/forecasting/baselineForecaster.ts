import { computeErrorMetrics } from '../math/numericalCore';
import type { ForecastPoint, ForecastResult, SimulationScenario } from '../types/grid';

/**
 * Phase 1 Deterministic Synthetic Diurnal Baseline Forecaster.
 *
 * Uses a Fourier-harmonic diurnal profile + ambient temperature sensitivity
 * evaluated strictly against the synthetic dataset. Full ML/time-series
 * models (SARIMAX, Gradient Boosting, LSTM) are scoped for Phase 2.
 */
export function computeBaselineForecast(scenario: SimulationScenario): ForecastResult {
  const points: ForecastPoint[] = scenario.hourlyDemand.map((record) => {
    const t = record.hour;
    // Smooth 2-harmonic diurnal surrogate baseline calibrated around mean daily load
    const meanLoad =
      scenario.hourlyDemand.reduce((acc, item) => acc + item.totalMW, 0) /
      scenario.hourlyDemand.length;

    const diurnalWave =
      -0.21 * meanLoad * Math.cos((2 * Math.PI * (t - 2)) / 24) +
      0.08 * meanLoad * Math.sin((4 * Math.PI * (t - 6)) / 24);

    const tempAdjustment = Math.max(0, record.temperatureDegC - 28) * 3.1;
    const predictedMW = Number(Math.max(40, meanLoad + diurnalWave + tempAdjustment).toFixed(2));
    const bandHalfWidth = Number((0.045 * predictedMW).toFixed(2));

    return {
      hour: t,
      timestampLabel: record.timestampLabel,
      actualSyntheticMW: record.totalMW,
      predictedMW,
      lowerBoundMW: Number((predictedMW - bandHalfWidth).toFixed(2)),
      upperBoundMW: Number((predictedMW + bandHalfWidth).toFixed(2)),
      residualMW: Number((predictedMW - record.totalMW).toFixed(2)),
    };
  });

  const actuals = points.map((p) => p.actualSyntheticMW);
  const preds = points.map((p) => p.predictedMW);
  const metrics = computeErrorMetrics(actuals, preds);

  return {
    scenarioId: scenario.id,
    horizonHours: points.length,
    modelName: 'Diurnal Harmonic + Thermal Sensitivity Baseline',
    modelStatus: 'Phase 1 Synthetic Baseline',
    maeMW: metrics.mae,
    rmseMW: metrics.rmse,
    mapePercent: metrics.mapePercent,
    rSquared: metrics.rSquared,
    points,
    isSyntheticBaseline: true,
  };
}
