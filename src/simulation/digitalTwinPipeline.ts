import { validateScenario } from '../data/ingestion';
import type { ForecastDatasetBundle } from '../forecasting/datasetManager';
import {
  buildDefaultWeatherScenario,
  runNumericalDemandForecast,
  type FutureWeatherInput,
  type NumericalForecastEngineResult,
  type WeatherScenarioId,
} from '../forecasting/numericalForecaster';
import {
  runOptimalEnergyDispatch,
  type DispatchOptimizationConfig,
  type OptimalDispatchBundle,
} from '../optimization/optimalDispatchEngine';
import type {
  ForecastPoint,
  ForecastResult,
  GeneratorOverride,
  ScenarioValidationReport,
  SimulationScenario,
  WeatherControls,
} from '../types/grid';

export const DEFAULT_WEATHER_CONTROLS: WeatherControls = {
  temperatureDeltaDegC: 0,
  solarIrradianceScale: 1,
  windResourceScale: 1,
  demandScaleFactor: 1,
};

export interface AppliedForecastPoint {
  hour: number;
  demandMW: number;
  temperatureDegC: number;
}

export interface DigitalTwinPipelineInput {
  baseScenario: SimulationScenario;
  weatherControls: WeatherControls;
  generatorOverrides: Record<string, GeneratorOverride>;
  batteryInitialSocOverrideMWh: number | null;
  dispatchConfig: DispatchOptimizationConfig;
  forecastDataset: ForecastDatasetBundle;
  weatherScenarioId: WeatherScenarioId;
  holdoutHours: number;
  activeHour: number;
  useForecastDrivenDemand: boolean;
  customForecastSeries: AppliedForecastPoint[] | null;
}

export interface DigitalTwinPipelineOutput {
  effectiveScenario: SimulationScenario;
  validationReport: ScenarioValidationReport;
  numericalForecast: NumericalForecastEngineResult;
  forecastResult: ForecastResult;
  dispatchBundle: OptimalDispatchBundle;
  simulationTimestampIso: string;
  computeMs: number;
}

/**
 * Applies weather perturbations, generator overrides, BESS initial SoC override,
 * and optional forecast-coupled demand cleanly without mutating the source scenario.
 */
export function buildEffectiveScenario(params: {
  baseScenario: SimulationScenario;
  weatherControls: WeatherControls;
  generatorOverrides: Record<string, GeneratorOverride>;
  batteryInitialSocOverrideMWh: number | null;
  forecastSeriesOverride?: AppliedForecastPoint[] | null;
}): SimulationScenario {
  const {
    baseScenario,
    weatherControls,
    generatorOverrides,
    batteryInitialSocOverrideMWh,
    forecastSeriesOverride,
  } = params;

  const {
    temperatureDeltaDegC,
    solarIrradianceScale,
    windResourceScale,
    demandScaleFactor,
  } = weatherControls;

  const generators = baseScenario.generators.map((g) => {
    const ov = generatorOverrides[g.id];
    const maxMW = ov?.maxMW !== undefined ? Math.max(g.minMW, ov.maxMW) : g.maxMW;
    const available = ov?.available !== undefined ? ov.available : g.available;
    return {
      ...g,
      maxMW: Number(maxMW.toFixed(1)),
      available,
    };
  });

  const minSocMWh = baseScenario.battery.capacityMWh * baseScenario.battery.minSocRatio;
  const maxSocMWh = baseScenario.battery.capacityMWh * baseScenario.battery.maxSocRatio;
  const initialSocMWh =
    batteryInitialSocOverrideMWh !== null
      ? Number(Math.max(minSocMWh, Math.min(maxSocMWh, batteryInitialSocOverrideMWh)).toFixed(2))
      : baseScenario.battery.initialSocMWh;

  const battery = {
    ...baseScenario.battery,
    initialSocMWh,
    currentSocMWh: initialSocMWh,
  };

  const hourlyDemand = baseScenario.hourlyDemand.map((rec) => {
    const forecastMatch = forecastSeriesOverride?.find((f) => f.hour === rec.hour);
    const nextTemp = Number(
      Math.max(
        -15,
        Math.min(52, (forecastMatch ? forecastMatch.temperatureDegC : rec.temperatureDegC) + temperatureDeltaDegC),
      ).toFixed(1),
    );
    const nextSolar = Number(
      Math.max(0, Math.min(1350, rec.solarIrradianceWm2 * solarIrradianceScale)).toFixed(0),
    );
    const nextWind = Number(
      Math.max(0, Math.min(1, rec.windCapacityFactor * windResourceScale)).toFixed(3),
    );

    let targetRes = rec.residentialMW * demandScaleFactor;
    let targetCom = rec.commercialMW * demandScaleFactor;
    let targetInd = rec.industrialMW * demandScaleFactor;

    if (forecastMatch) {
      const targetMW = Math.max(10, forecastMatch.demandMW * demandScaleFactor);
      const baseSum = Math.max(1, rec.residentialMW + rec.commercialMW + rec.industrialMW);
      targetRes = (rec.residentialMW / baseSum) * targetMW;
      targetCom = (rec.commercialMW / baseSum) * targetMW;
      targetInd = targetMW - targetRes - targetCom;
    } else if (Math.abs(temperatureDeltaDegC) > 0.05) {
      // Cooling/heating weather sensitivity (~4.2 MW/degC when ambient temp exceeds 24C)
      const baseCD = Math.max(0, rec.temperatureDegC - 24);
      const newCD = Math.max(0, nextTemp - 24);
      const deltaCoolingMW = (newCD - baseCD) * 4.2 * demandScaleFactor;
      targetRes = Math.max(20, targetRes + deltaCoolingMW * 0.45);
      targetCom = Math.max(20, targetCom + deltaCoolingMW * 0.55);
    }

    const resRounded = Number(targetRes.toFixed(2));
    const comRounded = Number(targetCom.toFixed(2));
    const indRounded = Number(targetInd.toFixed(2));
    const totalMW = Number((resRounded + comRounded + indRounded).toFixed(2));

    return {
      ...rec,
      temperatureDegC: nextTemp,
      solarIrradianceWm2: nextSolar,
      windCapacityFactor: nextWind,
      residentialMW: resRounded,
      commercialMW: comRounded,
      industrialMW: indRounded,
      totalMW,
    };
  });

  const peakDemandMW = Number(Math.max(...hourlyDemand.map((d) => d.totalMW)).toFixed(2));
  const installedGenerationMW = generators
    .filter((g) => g.available)
    .reduce((acc, g) => acc + g.maxMW, 0);
  const renewableCapacityMW = generators
    .filter(
      (g) =>
        g.available &&
        (g.technology === 'solar' || g.technology === 'wind' || g.technology === 'hydro'),
    )
    .reduce((acc, g) => acc + g.maxMW, 0);

  return {
    ...baseScenario,
    peakDemandMW,
    installedGenerationMW,
    renewableCapacityMW,
    hourlyDemand,
    generators,
    battery,
  };
}

/**
 * Single authoritative Phase 6 Digital Twin recalculation pipeline:
 * 1. Apply weather, fleet, and battery overrides
 * 2. Validate inputs
 * 3. Recompute Householder QR forecast with live weather plan
 * 4. Couple forecast demand if enabled
 * 5. Recompute Multi-Period LP Optimal Dispatch + heuristic comparisons
 * 6. Return synchronized state for Dashboard, 3D Smart City, Forecasting, Dispatch, and Reports
 */
export function executeDigitalTwinPipeline(
  input: DigitalTwinPipelineInput,
): DigitalTwinPipelineOutput {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const preScenario = buildEffectiveScenario({
    baseScenario: input.baseScenario,
    weatherControls: input.weatherControls,
    generatorOverrides: input.generatorOverrides,
    batteryInitialSocOverrideMWh: input.batteryInitialSocOverrideMWh,
    forecastSeriesOverride: input.customForecastSeries,
  });

  // Build consistent 24h future weather plan aligned with active weather controls
  const baseFutureWeather = buildDefaultWeatherScenario(
    input.forecastDataset.records,
    input.weatherScenarioId === 'custom' ? 'nominal' : input.weatherScenarioId,
  );
  const effectiveFutureWeather: FutureWeatherInput[] = baseFutureWeather.map((w) => {
    const scenHour = preScenario.hourlyDemand[w.hour];
    return {
      ...w,
      temperatureDegC: scenHour
        ? scenHour.temperatureDegC
        : Number((w.temperatureDegC + input.weatherControls.temperatureDeltaDegC).toFixed(1)),
    };
  });

  // Step 2: Recompute numerical Householder QR forecast
  const safeHour = Math.max(0, Math.min(23, Math.round(input.activeHour)));
  const numericalForecast = runNumericalDemandForecast({
    records: input.forecastDataset.records,
    holdoutHours: input.holdoutHours,
    weatherScenarioId:
      Math.abs(input.weatherControls.temperatureDeltaDegC) > 0.05
        ? 'custom'
        : input.weatherScenarioId,
    futureWeather: effectiveFutureWeather,
    workedHour: safeHour,
  });

  // Step 3: Couple forecast demand into effective scenario if forecast-driven mode active
  const effectiveScenario =
    input.useForecastDrivenDemand &&
    !input.customForecastSeries &&
    numericalForecast.valid &&
    numericalForecast.next24h.length === 24
      ? buildEffectiveScenario({
          baseScenario: input.baseScenario,
          weatherControls: input.weatherControls,
          generatorOverrides: input.generatorOverrides,
          batteryInitialSocOverrideMWh: input.batteryInitialSocOverrideMWh,
          forecastSeriesOverride: numericalForecast.next24h.map((row) => ({
            hour: row.hour,
            demandMW: row.fullModelMW,
            temperatureDegC: row.temperatureDegC,
          })),
        })
      : preScenario;

  // Step 1/4: Validate final scenario inputs
  const validationReport = validateScenario(effectiveScenario);

  // Align Dashboard summary ForecastResult directly with Householder QR numerical forecaster
  const forecastPoints: ForecastPoint[] = effectiveScenario.hourlyDemand.map((h) => {
    const nf = numericalForecast.next24h.find((r) => r.hour === h.hour);
    const pred = nf ? nf.fullModelMW : h.totalMW;
    return {
      hour: h.hour,
      timestampLabel: h.timestampLabel,
      actualSyntheticMW: h.totalMW,
      predictedMW: Number(pred.toFixed(2)),
      lowerBoundMW: Number((nf?.lower95MW ?? pred * 0.96).toFixed(2)),
      upperBoundMW: Number((nf?.upper95MW ?? pred * 1.04).toFixed(2)),
      residualMW: Number((h.totalMW - pred).toFixed(2)),
    };
  });

  const forecastResult: ForecastResult = {
    scenarioId: effectiveScenario.id,
    horizonHours: 24,
    modelName: 'Householder QR Multiple Regression (Fourier + Lag-24 + Cooling)',
    modelStatus: 'Phase 1 Linear/Root Core',
    maeMW: numericalForecast.valid ? numericalForecast.fullModelMetrics.maeMW : 0,
    rmseMW: numericalForecast.valid ? numericalForecast.fullModelMetrics.rmseMW : 0,
    mapePercent: numericalForecast.valid ? (numericalForecast.fullModelMetrics.mapePercent ?? 0) : 0,
    rSquared: numericalForecast.valid ? (numericalForecast.fullModelMetrics.rSquared ?? 0) : 0,
    points: forecastPoints,
    isSyntheticBaseline: input.forecastDataset.isSynthetic,
  };

  // Step 5: Recompute Optimal Dispatch with clamped terminal SoC if needed
  const minSoc = effectiveScenario.battery.capacityMWh * effectiveScenario.battery.minSocRatio;
  const maxSoc = effectiveScenario.battery.capacityMWh * effectiveScenario.battery.maxSocRatio;
  const clampedConfig: DispatchOptimizationConfig = {
    ...input.dispatchConfig,
    terminalSocTargetMWh: Math.max(
      minSoc,
      Math.min(maxSoc, input.dispatchConfig.terminalSocTargetMWh),
    ),
  };

  const dispatchBundle = runOptimalEnergyDispatch(effectiveScenario, clampedConfig);

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const computeMs = Number(Math.max(0.1, t1 - t0).toFixed(1));

  // Deterministic simulated wall-clock timestamp anchored on synthetic reference date + activeHour
  const simulationTimestampIso = `2026-10-15T${safeHour.toString().padStart(2, '0')}:00:00+05:30`;

  return {
    effectiveScenario,
    validationReport,
    numericalForecast,
    forecastResult,
    dispatchBundle,
    simulationTimestampIso,
    computeMs,
  };
}

export interface ScenarioBenchmarkSummary {
  scenario: SimulationScenario;
  peakDemandMW: number;
  dailyEnergyMWh: number;
  averageRenewableSharePercent: number;
  totalDailyCostInr: number;
  costDeltaVsNormalPercent: number;
  totalEmissionsTonnesCO2e: number;
  unservedEnergyMWh: number;
  solverStatus: string;
  maxBalanceResidualMW: number;
}

/**
 * Evaluates all scenarios side-by-side under identical LP optimal dispatch rules.
 */
export function evaluateScenarioComparisonMatrix(
  scenarios: SimulationScenario[],
  baseConfig: DispatchOptimizationConfig,
  weatherControls: WeatherControls = DEFAULT_WEATHER_CONTROLS,
): ScenarioBenchmarkSummary[] {
  const raw = scenarios.map((sc) => {
    const eff = buildEffectiveScenario({
      baseScenario: sc,
      weatherControls,
      generatorOverrides: {},
      batteryInitialSocOverrideMWh: null,
    });
    const minSoc = eff.battery.capacityMWh * eff.battery.minSocRatio;
    const maxSoc = eff.battery.capacityMWh * eff.battery.maxSocRatio;
    const cfg: DispatchOptimizationConfig = {
      ...baseConfig,
      terminalSocTargetMWh: Math.max(minSoc, Math.min(maxSoc, eff.battery.initialSocMWh)),
    };
    const bundle = runOptimalEnergyDispatch(eff, cfg);
    const unservedMWh = bundle.summary.hourlyDispatches.reduce(
      (a, h) => a + h.unservedEnergyMW,
      0,
    );
    return {
      scenario: eff,
      peakDemandMW: bundle.summary.predictedPeakDemandMW,
      dailyEnergyMWh: bundle.summary.totalDailyEnergyMWh,
      averageRenewableSharePercent: bundle.summary.averageRenewableSharePercent,
      totalDailyCostInr: bundle.summary.totalDailyCostInr,
      totalEmissionsTonnesCO2e: bundle.summary.totalDailyEmissionsTonnesCO2e,
      unservedEnergyMWh: Number(unservedMWh.toFixed(2)),
      solverStatus: bundle.feasible ? 'Optimal LP' : 'Infeasible',
      maxBalanceResidualMW: bundle.residualSummary.maxPowerBalanceResidualMW,
    };
  });

  const normalCost = Math.max(1, raw[0]?.totalDailyCostInr ?? 1);
  return raw.map((row) => ({
    ...row,
    costDeltaVsNormalPercent: Number(
      (((row.totalDailyCostInr - normalCost) / normalCost) * 100).toFixed(2),
    ),
  }));
}
