import type { ForecastTimeRecord } from './datasetManager';

export type WeatherScenarioId = 'nominal' | 'heatwave' | 'cool' | 'custom';

export interface FutureWeatherInput {
  hour: number; // 0..23
  temperatureDegC: number;
  humidityPct: number;
  isWeekend: boolean;
  isHoliday: boolean;
}

export interface ForecastEvaluationMetrics {
  maeMW: number;
  rmseMW: number;
  smapePercent: number;
  mapePercent: number | null;
  mapeValid: boolean;
  rSquared: number | null;
}

export interface HoldoutComparisonRow {
  index: number;
  timestampLabel: string;
  hour: number;
  temperatureDegC: number;
  actualMW: number;
  fullModelMW: number;
  coreModelMW: number;
  naiveBaselineMW: number;
  lower95MW: number;
  upper95MW: number;
  residualMW: number;
}

export interface Next24HourForecastRow {
  hour: number;
  timestampLabel: string;
  temperatureDegC: number;
  humidityPct: number;
  lag24DemandMW: number;
  fullModelMW: number;
  coreModelMW: number;
  naiveBaselineMW: number;
  lower95MW: number;
  upper95MW: number;
  featureVector: number[];
}

export interface FeatureTermSubstitution {
  featureName: string;
  symbolTex: string;
  beta: number;
  stdError: number;
  featureValue: number;
  contributionMW: number;
}

export interface NumericalForecastEngineResult {
  valid: boolean;
  error?: string;
  trainCount: number;
  holdoutCount: number;
  chronologicalVerified: boolean;
  maxTrainEpochMs: number;
  minHoldoutEpochMs: number;

  // Design Matrix & Linear Algebra Diagnostics
  featureNames: string[];
  featureSymbolsTex: string[];
  designMatrixShape: [number, number];
  designMatrixPreview: number[][];
  normalMatrixXTX: number[][];
  normalVectorXTy: number[];
  coefficients: number[];
  coefficientStdErrors: number[];
  residualStdErrorMW: number;
  qrOrthogonalityError: number;

  // Core 4-feature OLS model [beta0, T, sin(2pi*h/24), cos(2pi*h/24)] for 3D surface
  coreCoefficients: number[];

  // Chronological Holdout Validation Metrics
  fullModelMetrics: ForecastEvaluationMetrics;
  coreModelMetrics: ForecastEvaluationMetrics;
  naiveBaselineMetrics: ForecastEvaluationMetrics;
  holdoutComparison: HoldoutComparisonRow[];

  // Next 24-Hour Operational Forecast
  weatherScenarioId: WeatherScenarioId;
  weatherScenarioLabel: string;
  next24h: Next24HourForecastRow[];
  predictedPeakMW: number;
  peakHour: number;
  lowestDemandMW: number;
  lowestHour: number;
  totalForecastEnergyMWh: number;

  // Worked Substitution for any selected hour in Next 24h
  workedHour: number;
  workedTerms: FeatureTermSubstitution[];
  workedPredictedMW: number;
  workedLower95MW: number;
  workedUpper95MW: number;
}

interface InternalFeatureSpec {
  name: string;
  symbolTex: string;
  extract: (r: {
    hour: number;
    temperatureDegC: number;
    humidityPct: number | null;
    isWeekend: boolean;
    isHoliday: boolean;
    lag24MW: number;
  }) => number;
}

function solveHouseholderQRFull(X: number[][], y: number[]) {
  const m = X.length;
  const p = X[0]?.length ?? 0;

  // Normal matrix X^T X and X^T y
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

  const R = X.map((row) => [...row]);
  const qty = [...y];
  const Q = Array.from({ length: m }, (_, i) =>
    Array.from({ length: m }, (_, j) => (i === j ? 1 : 0)),
  );

  for (let k = 0; k < p; k++) {
    let normSq = 0;
    for (let i = k; i < m; i++) normSq += R[i][k] * R[i][k];
    const normX = Math.sqrt(normSq);
    if (normX < 1e-11) {
      return { valid: false as const, error: `Rank-deficient design matrix at column ${k}.` };
    }

    const alpha = R[k][k] >= 0 ? -normX : normX;
    const v = Array<number>(m - k).fill(0);
    v[0] = R[k][k] - alpha;
    for (let i = k + 1; i < m; i++) v[i - k] = R[i][k];
    const vNormSq = v.reduce((acc, val) => acc + val * val, 0);
    if (vNormSq < 1e-15) continue;

    for (let j = k; j < p; j++) {
      let dot = 0;
      for (let i = k; i < m; i++) dot += v[i - k] * R[i][j];
      const scale = (2 * dot) / vNormSq;
      for (let i = k; i < m; i++) R[i][j] -= scale * v[i - k];
    }

    let dotY = 0;
    for (let i = k; i < m; i++) dotY += v[i - k] * qty[i];
    const scaleY = (2 * dotY) / vNormSq;
    for (let i = k; i < m; i++) qty[i] -= scaleY * v[i - k];

    for (let row = 0; row < m; row++) {
      let dotQ = 0;
      for (let i = k; i < m; i++) dotQ += Q[row][i] * v[i - k];
      const scaleQ = (2 * dotQ) / vNormSq;
      for (let i = k; i < m; i++) Q[row][i] -= scaleQ * v[i - k];
    }
  }

  const beta = Array<number>(p).fill(0);
  for (let i = p - 1; i >= 0; i--) {
    let rhs = qty[i];
    for (let j = i + 1; j < p; j++) rhs -= R[i][j] * beta[j];
    if (Math.abs(R[i][i]) < 1e-11) {
      return { valid: false as const, error: 'Singular R diagonal in back-substitution.' };
    }
    beta[i] = rhs / R[i][i];
  }

  // Invert R[0..p-1, 0..p-1] so (X^T X)^(-1) = R^(-1) (R^(-1))^T for prediction intervals
  const Rinv = Array.from({ length: p }, () => Array<number>(p).fill(0));
  for (let col = 0; col < p; col++) {
    for (let i = col; i >= 0; i--) {
      let sum = i === col ? 1 : 0;
      for (let j = i + 1; j <= col; j++) sum -= R[i][j] * Rinv[j][col];
      Rinv[i][col] = sum / R[i][i];
    }
  }

  const xtxInv = Array.from({ length: p }, () => Array<number>(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = Math.max(i, j); k < p; k++) sum += Rinv[i][k] * Rinv[j][k];
      xtxInv[i][j] = sum;
    }
  }

  // Orthogonality check ||Q^T Q - I||_F
  let orthSq = 0;
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let dot = 0;
      for (let r = 0; r < m; r++) dot += Q[r][i] * Q[r][j];
      orthSq += (dot - (i === j ? 1 : 0)) ** 2;
    }
  }

  return {
    valid: true as const,
    beta,
    xtx,
    xty,
    xtxInv,
    qrOrthogonalityError: Math.sqrt(orthSq),
  };
}

export function computeForecastMetrics(
  actuals: number[],
  predicted: number[],
): ForecastEvaluationMetrics {
  const n = actuals.length;
  if (n === 0) {
    return {
      maeMW: 0,
      rmseMW: 0,
      smapePercent: 0,
      mapePercent: null,
      mapeValid: false,
      rSquared: null,
    };
  }

  let absSum = 0;
  let sqSum = 0;
  let smapeSum = 0;
  let mapeSum = 0;
  let mapeValid = true;
  let actualSum = 0;

  for (let i = 0; i < n; i++) {
    const a = actuals[i];
    const f = predicted[i];
    const err = f - a;
    absSum += Math.abs(err);
    sqSum += err * err;
    actualSum += a;

    const symDenom = (Math.abs(a) + Math.abs(f)) / 2;
    if (symDenom > 1e-6) {
      smapeSum += Math.abs(err) / symDenom;
    }

    if (Math.abs(a) <= 1e-6) {
      mapeValid = false;
    } else {
      mapeSum += Math.abs(err / a);
    }
  }

  const meanA = actualSum / n;
  const ssTot = actuals.reduce((acc, a) => acc + (a - meanA) ** 2, 0);

  return {
    maeMW: Number((absSum / n).toFixed(3)),
    rmseMW: Number(Math.sqrt(sqSum / n).toFixed(3)),
    smapePercent: Number(((100 * smapeSum) / n).toFixed(3)),
    mapePercent: mapeValid ? Number(((100 * mapeSum) / n).toFixed(3)) : null,
    mapeValid,
    rSquared: ssTot > 1e-6 ? Number((1 - sqSum / ssTot).toFixed(4)) : null,
  };
}

export function buildDefaultWeatherScenario(
  records: ForecastTimeRecord[],
  scenarioId: WeatherScenarioId,
): FutureWeatherInput[] {
  // Average temperature & humidity per hour across available history (strictly from historical data)
  const tempByHour = Array.from({ length: 24 }, () => [] as number[]);
  const humByHour = Array.from({ length: 24 }, () => [] as number[]);
  for (const r of records) {
    tempByHour[r.hour].push(r.temperatureDegC);
    if (r.humidityPct !== null) humByHour[r.hour].push(r.humidityPct);
  }

  const lastRecord = records[records.length - 1];
  const nextStartDow = lastRecord ? (lastRecord.dayOfWeek + (lastRecord.hour === 23 ? 1 : 0)) % 7 : 1;
  const isWeekend = nextStartDow === 0 || nextStartDow === 6;

  const tempShift =
    scenarioId === 'heatwave' ? 4.5 : scenarioId === 'cool' ? -3.5 : 0;

  return Array.from({ length: 24 }, (_, hr) => {
    const tArr = tempByHour[hr];
    const hArr = humByHour[hr];
    const baseT =
      tArr.length > 0
        ? tArr.reduce((a, b) => a + b, 0) / tArr.length
        : 28 - 5 * Math.cos((2 * Math.PI * (hr - 2)) / 24);
    const baseH =
      hArr.length > 0 ? hArr.reduce((a, b) => a + b, 0) / hArr.length : 60;

    return {
      hour: hr,
      temperatureDegC: Number((baseT + tempShift).toFixed(1)),
      humidityPct: Number(Math.max(15, Math.min(98, baseH - tempShift * 2)).toFixed(0)),
      isWeekend,
      isHoliday: false,
    };
  });
}

function studentT975Approx(df: number): number {
  if (df >= 120) return 1.96;
  if (df >= 60) return 2.0;
  if (df >= 30) return 2.042;
  if (df >= 15) return 2.131;
  return 2.262;
}

/**
 * Trains causal multiple linear regression & 4-feature thermal+diurnal OLS
 * using strictly chronological splitting (no future information leakage),
 * evaluates holdout accuracy against seasonal-naive baseline, and produces
 * a complete 24-hour forecast with 95% statistically justified prediction intervals.
 */
export function runNumericalDemandForecast(params: {
  records: ForecastTimeRecord[];
  holdoutHours?: number;
  weatherScenarioId?: WeatherScenarioId;
  futureWeather?: FutureWeatherInput[];
  workedHour?: number;
}): NumericalForecastEngineResult {
  const {
    records,
    holdoutHours = 24,
    weatherScenarioId = 'nominal',
    futureWeather,
    workedHour = 14,
  } = params;

  const minRequired = 60; // >= 24h lag warmup + sufficient training + holdout
  if (records.length < minRequired) {
    return {
      valid: false,
      error: `At least ${minRequired} hourly records are required for causal lag-24 training and chronological holdout (received ${records.length}).`,
      trainCount: 0,
      holdoutCount: 0,
      chronologicalVerified: false,
      maxTrainEpochMs: 0,
      minHoldoutEpochMs: 0,
      featureNames: [],
      featureSymbolsTex: [],
      designMatrixShape: [0, 0],
      designMatrixPreview: [],
      normalMatrixXTX: [],
      normalVectorXTy: [],
      coefficients: [],
      coefficientStdErrors: [],
      residualStdErrorMW: 0,
      qrOrthogonalityError: 0,
      coreCoefficients: [],
      fullModelMetrics: computeForecastMetrics([], []),
      coreModelMetrics: computeForecastMetrics([], []),
      naiveBaselineMetrics: computeForecastMetrics([], []),
      holdoutComparison: [],
      weatherScenarioId,
      weatherScenarioLabel: 'Unavailable',
      next24h: [],
      predictedPeakMW: 0,
      peakHour: 0,
      lowestDemandMW: 0,
      lowestHour: 0,
      totalForecastEnergyMWh: 0,
      workedHour,
      workedTerms: [],
      workedPredictedMW: 0,
      workedLower95MW: 0,
      workedUpper95MW: 0,
    };
  }

  // Chronological order check & lag-24 construction (strictly backward-looking t - 24)
  const sorted = [...records].sort((a, b) => a.epochMs - b.epochMs);
  const safeHoldout = Math.min(Math.max(12, holdoutHours), Math.floor(sorted.length / 3));
  const splitIdx = sorted.length - safeHoldout;

  const lagStart = 24;
  const trainRows = sorted.slice(lagStart, splitIdx).map((r, offset) => ({
    ...r,
    lag24MW: sorted[lagStart + offset - 24].demandMW,
  }));

  const holdoutRows = sorted.slice(splitIdx).map((r, offset) => ({
    ...r,
    lag24MW: sorted[splitIdx + offset - 24].demandMW,
  }));

  const maxTrainEpochMs = trainRows[trainRows.length - 1].epochMs;
  const minHoldoutEpochMs = holdoutRows[0].epochMs;
  const chronologicalVerified = maxTrainEpochMs < minHoldoutEpochMs;

  // Candidate features: dynamically exclude constant/collinear binary indicators (e.g. if zero holidays)
  const hasHumidity = trainRows.every((r) => r.humidityPct !== null);
  const hasWeekendVariation = new Set(trainRows.map((r) => (r.isWeekend ? 1 : 0))).size > 1;
  const hasHolidayVariation = new Set(trainRows.map((r) => (r.isHoliday ? 1 : 0))).size > 1;
  const hasCoolingThresholdSpan =
    trainRows.some((r) => r.temperatureDegC < 24) &&
    trainRows.some((r) => r.temperatureDegC > 24);

  const featureSpecs: InternalFeatureSpec[] = [
    { name: 'Intercept', symbolTex: '1', extract: () => 1 },
    { name: 'Temperature (°C)', symbolTex: 'T(t)', extract: (r) => r.temperatureDegC },
    {
      name: 'Diurnal sin(2πh/24)',
      symbolTex: '\\sin(2\\pi h/24)',
      extract: (r) => Math.sin((2 * Math.PI * r.hour) / 24),
    },
    {
      name: 'Diurnal cos(2πh/24)',
      symbolTex: '\\cos(2\\pi h/24)',
      extract: (r) => Math.cos((2 * Math.PI * r.hour) / 24),
    },
    {
      name: 'Semi-diurnal sin(4πh/24)',
      symbolTex: '\\sin(4\\pi h/24)',
      extract: (r) => Math.sin((4 * Math.PI * r.hour) / 24),
    },
    {
      name: 'Semi-diurnal cos(4πh/24)',
      symbolTex: '\\cos(4\\pi h/24)',
      extract: (r) => Math.cos((4 * Math.PI * r.hour) / 24),
    },
    { name: 'Causal Lag Load D(t-24)', symbolTex: 'D(t-24)', extract: (r) => r.lag24MW },
  ];

  if (hasCoolingThresholdSpan) {
    featureSpecs.push({
      name: 'Cooling Degree max(0, T-24)',
      symbolTex: '\\max(0, T-24)',
      extract: (r) => Math.max(0, r.temperatureDegC - 24),
    });
  }
  if (hasWeekendVariation) {
    featureSpecs.push({
      name: 'Weekend Indicator',
      symbolTex: '\\mathbb{I}_{\\text{wknd}}',
      extract: (r) => (r.isWeekend ? 1 : 0),
    });
  }
  if (hasHolidayVariation) {
    featureSpecs.push({
      name: 'Holiday Indicator',
      symbolTex: '\\mathbb{I}_{\\text{hol}}',
      extract: (r) => (r.isHoliday ? 1 : 0),
    });
  }
  if (hasHumidity) {
    featureSpecs.push({
      name: 'Relative Humidity (%)',
      symbolTex: 'H(t)',
      extract: (r) => r.humidityPct ?? 60,
    });
  }

  const Xtrain = trainRows.map((r) => featureSpecs.map((spec) => spec.extract(r)));
  const yTrain = trainRows.map((r) => r.demandMW);

  const qrFull = solveHouseholderQRFull(Xtrain, yTrain);
  if (!qrFull.valid) {
    return {
      valid: false,
      error: qrFull.error,
      trainCount: trainRows.length,
      holdoutCount: holdoutRows.length,
      chronologicalVerified,
      maxTrainEpochMs,
      minHoldoutEpochMs,
      featureNames: [],
      featureSymbolsTex: [],
      designMatrixShape: [Xtrain.length, featureSpecs.length],
      designMatrixPreview: [],
      normalMatrixXTX: [],
      normalVectorXTy: [],
      coefficients: [],
      coefficientStdErrors: [],
      residualStdErrorMW: 0,
      qrOrthogonalityError: 0,
      coreCoefficients: [],
      fullModelMetrics: computeForecastMetrics([], []),
      coreModelMetrics: computeForecastMetrics([], []),
      naiveBaselineMetrics: computeForecastMetrics([], []),
      holdoutComparison: [],
      weatherScenarioId,
      weatherScenarioLabel: 'Error',
      next24h: [],
      predictedPeakMW: 0,
      peakHour: 0,
      lowestDemandMW: 0,
      lowestHour: 0,
      totalForecastEnergyMWh: 0,
      workedHour,
      workedTerms: [],
      workedPredictedMW: 0,
      workedLower95MW: 0,
      workedUpper95MW: 0,
    };
  }

  // Also fit the exact 4-feature Core Equation: D(t) = b0 + b1*T + b2*sin + b3*cos
  const XcoreTrain = trainRows.map((r) => [
    1,
    r.temperatureDegC,
    Math.sin((2 * Math.PI * r.hour) / 24),
    Math.cos((2 * Math.PI * r.hour) / 24),
  ]);
  const qrCore = solveHouseholderQRFull(XcoreTrain, yTrain);
  const coreCoefficients = qrCore.valid ? qrCore.beta : [0, 0, 0, 0];

  // Training residual standard error s = sqrt(SSE / (n - p))
  const nTrain = trainRows.length;
  const pCols = featureSpecs.length;
  const df = Math.max(1, nTrain - pCols);
  let sseTrain = 0;
  for (let i = 0; i < nTrain; i++) {
    const pred = Xtrain[i].reduce((acc, xij, j) => acc + xij * qrFull.beta[j], 0);
    const diff = yTrain[i] - pred;
    sseTrain += diff * diff;
  }
  const residualStdErrorMW = Math.sqrt(sseTrain / df);
  const tCrit = studentT975Approx(df);

  const coefficientStdErrors = qrFull.xtxInv.map((row, i) =>
    residualStdErrorMW * Math.sqrt(Math.max(0, row[i])),
  );

  const evalPredictionInterval = (xVec: number[], yHat: number) => {
    // Leverage h_0 = x^T (X^T X)^(-1) x
    let leverage = 0;
    for (let i = 0; i < pCols; i++) {
      let rowDot = 0;
      for (let j = 0; j < pCols; j++) {
        rowDot += qrFull.xtxInv[i][j] * xVec[j];
      }
      leverage += xVec[i] * rowDot;
    }
    const halfWidth = tCrit * residualStdErrorMW * Math.sqrt(Math.max(1, 1 + leverage));
    return {
      lower: Number(Math.max(0, yHat - halfWidth).toFixed(2)),
      upper: Number((yHat + halfWidth).toFixed(2)),
    };
  };

  // Evaluate Chronological Holdout Set
  const holdoutComparison: HoldoutComparisonRow[] = holdoutRows.map((r) => {
    const xVec = featureSpecs.map((spec) => spec.extract(r));
    const fullPred = Math.max(0, xVec.reduce((acc, xj, j) => acc + xj * qrFull.beta[j], 0));
    const corePred = Math.max(
      0,
      coreCoefficients[0] +
        coreCoefficients[1] * r.temperatureDegC +
        coreCoefficients[2] * Math.sin((2 * Math.PI * r.hour) / 24) +
        coreCoefficients[3] * Math.cos((2 * Math.PI * r.hour) / 24),
    );
    const pi = evalPredictionInterval(xVec, fullPred);
    return {
      index: r.index,
      timestampLabel: r.displayLabel,
      hour: r.hour,
      temperatureDegC: r.temperatureDegC,
      actualMW: r.demandMW,
      fullModelMW: Number(fullPred.toFixed(2)),
      coreModelMW: Number(corePred.toFixed(2)),
      naiveBaselineMW: Number(r.lag24MW.toFixed(2)),
      lower95MW: pi.lower,
      upper95MW: pi.upper,
      residualMW: Number((r.demandMW - fullPred).toFixed(2)),
    };
  });

  const holdoutActuals = holdoutComparison.map((h) => h.actualMW);
  const fullModelMetrics = computeForecastMetrics(
    holdoutActuals,
    holdoutComparison.map((h) => h.fullModelMW),
  );
  const coreModelMetrics = computeForecastMetrics(
    holdoutActuals,
    holdoutComparison.map((h) => h.coreModelMW),
  );
  const naiveBaselineMetrics = computeForecastMetrics(
    holdoutActuals,
    holdoutComparison.map((h) => h.naiveBaselineMW),
  );

  // Refit full model on ALL causal historical rows up to end of dataset for Next-24h operational forecast
  const allCausalRows = sorted.slice(lagStart).map((r, offset) => ({
    ...r,
    lag24MW: sorted[lagStart + offset - 24].demandMW,
  }));
  const Xall = allCausalRows.map((r) => featureSpecs.map((spec) => spec.extract(r)));
  const yAll = allCausalRows.map((r) => r.demandMW);
  const qrFinal = solveHouseholderQRFull(Xall, yAll);
  const finalBeta = qrFinal.valid ? qrFinal.beta : qrFull.beta;

  const weatherPlan =
    futureWeather && futureWeather.length === 24
      ? futureWeather
      : buildDefaultWeatherScenario(sorted, weatherScenarioId);

  const weatherLabels: Record<WeatherScenarioId, string> = {
    nominal: 'Scenario Weather: Historical Diurnal Mean Profile (Assumed)',
    heatwave: 'Scenario Weather: +4.5 °C Heatwave Stress (Assumed)',
    cool: 'Scenario Weather: -3.5 °C Cool / Overcast Profile (Assumed)',
    custom: 'Scenario Weather: User-Specified Hourly Temperatures',
  };

  // Next 24h uses the final 24 historical hours as causal lag-24 references
  const last24 = sorted.slice(-24);
  const next24h: Next24HourForecastRow[] = weatherPlan.map((w, idx) => {
    const lagRecord = last24[idx] ?? last24[last24.length - 1];
    const lag24MW = lagRecord.demandMW;
    const xVec = featureSpecs.map((spec) =>
      spec.extract({
        hour: w.hour,
        temperatureDegC: w.temperatureDegC,
        humidityPct: w.humidityPct,
        isWeekend: w.isWeekend,
        isHoliday: w.isHoliday,
        lag24MW,
      }),
    );

    const fullPred = Math.max(0, xVec.reduce((acc, xj, j) => acc + xj * finalBeta[j], 0));
    const corePred = Math.max(
      0,
      coreCoefficients[0] +
        coreCoefficients[1] * w.temperatureDegC +
        coreCoefficients[2] * Math.sin((2 * Math.PI * w.hour) / 24) +
        coreCoefficients[3] * Math.cos((2 * Math.PI * w.hour) / 24),
    );
    const pi = evalPredictionInterval(xVec, fullPred);

    return {
      hour: w.hour,
      timestampLabel: `${String(w.hour).padStart(2, '0')}:00`,
      temperatureDegC: w.temperatureDegC,
      humidityPct: w.humidityPct,
      lag24DemandMW: lag24MW,
      fullModelMW: Number(fullPred.toFixed(2)),
      coreModelMW: Number(corePred.toFixed(2)),
      naiveBaselineMW: Number(lag24MW.toFixed(2)),
      lower95MW: pi.lower,
      upper95MW: pi.upper,
      featureVector: xVec,
    };
  });

  let predictedPeakMW = -Infinity;
  let peakHour = 0;
  let lowestDemandMW = Infinity;
  let lowestHour = 0;
  let totalForecastEnergyMWh = 0;

  for (const row of next24h) {
    if (row.fullModelMW > predictedPeakMW) {
      predictedPeakMW = row.fullModelMW;
      peakHour = row.hour;
    }
    if (row.fullModelMW < lowestDemandMW) {
      lowestDemandMW = row.fullModelMW;
      lowestHour = row.hour;
    }
    totalForecastEnergyMWh += row.fullModelMW;
  }

  const safeWorkedHour = Math.max(0, Math.min(23, Math.round(workedHour)));
  const workedRow = next24h[safeWorkedHour] ?? next24h[0];
  const workedTerms: FeatureTermSubstitution[] = featureSpecs.map((spec, j) => ({
    featureName: spec.name,
    symbolTex: spec.symbolTex,
    beta: finalBeta[j],
    stdError: coefficientStdErrors[j] ?? 0,
    featureValue: workedRow.featureVector[j],
    contributionMW: finalBeta[j] * workedRow.featureVector[j],
  }));

  return {
    valid: true,
    trainCount: trainRows.length,
    holdoutCount: holdoutRows.length,
    chronologicalVerified,
    maxTrainEpochMs,
    minHoldoutEpochMs,
    featureNames: featureSpecs.map((s) => s.name),
    featureSymbolsTex: featureSpecs.map((s) => s.symbolTex),
    designMatrixShape: [Xall.length, featureSpecs.length],
    designMatrixPreview: Xall.slice(0, 6).map((row) => row.map((v) => Number(v.toFixed(4)))),
    normalMatrixXTX: qrFull.xtx,
    normalVectorXTy: qrFull.xty,
    coefficients: finalBeta,
    coefficientStdErrors,
    residualStdErrorMW: Number(residualStdErrorMW.toFixed(3)),
    qrOrthogonalityError: qrFull.qrOrthogonalityError,
    coreCoefficients,
    fullModelMetrics,
    coreModelMetrics,
    naiveBaselineMetrics,
    holdoutComparison,
    weatherScenarioId,
    weatherScenarioLabel: weatherLabels[weatherScenarioId],
    next24h,
    predictedPeakMW: Number(predictedPeakMW.toFixed(2)),
    peakHour,
    lowestDemandMW: Number(lowestDemandMW.toFixed(2)),
    lowestHour,
    totalForecastEnergyMWh: Number(totalForecastEnergyMWh.toFixed(1)),
    workedHour: safeWorkedHour,
    workedTerms,
    workedPredictedMW: workedRow.fullModelMW,
    workedLower95MW: workedRow.lower95MW,
    workedUpper95MW: workedRow.upper95MW,
  };
}
