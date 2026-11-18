export type FiniteDiffMethod = 'forward' | 'backward' | 'central';

export interface StepSizeComparisonRow {
  h: number;
  forwardDiff: number;
  backwardDiff: number;
  centralDiff: number;
  forwardError: number | null;
  backwardError: number | null;
  centralError: number | null;
}

export interface DifferentiationResult {
  x0: number;
  h: number;
  method: FiniteDiffMethod;
  fx0: number;
  fxPlus: number;
  fxMinus: number;
  forwardDiff: number;
  backwardDiff: number;
  centralDiff: number;
  selectedSlope: number;
  demandTrend: 'rising' | 'falling' | 'stationary';
  exactDerivative: number | null;
  selectedTruncationError: number | null;
  stepSizeComparison: StepSizeComparisonRow[];
  sampledCurve: { x: number; y: number; slope: number }[];
}

/**
 * Evaluates Forward, Backward, and Central finite differences at x0 with step h,
 * performs multi-step truncation error analysis across h, h/2, h/4, and classifies
 * demand ramp direction (rising/falling/stationary in MW/h).
 */
export function computeNumericalDifferentiation(params: {
  fn: (x: number) => number;
  exactDfn?: (x: number) => number;
  x0: number;
  h: number;
  method: FiniteDiffMethod;
  xMin?: number;
  xMax?: number;
}): DifferentiationResult {
  const { fn, exactDfn, x0, h, method, xMin = 0, xMax = 23 } = params;
  const safeH = Math.max(0.05, h);

  const evalFinite = (step: number) => {
    const f0 = fn(x0);
    const fPlus = fn(x0 + step);
    const fMinus = fn(x0 - step);
    const forward = (fPlus - f0) / step;
    const backward = (f0 - fMinus) / step;
    const central = (fPlus - fMinus) / (2 * step);
    return { f0, fPlus, fMinus, forward, backward, central };
  };

  const base = evalFinite(safeH);
  const selectedSlope =
    method === 'forward'
      ? base.forward
      : method === 'backward'
        ? base.backward
        : base.central;

  const exactDerivative = exactDfn ? exactDfn(x0) : null;
  const selectedTruncationError =
    exactDerivative !== null ? Math.abs(selectedSlope - exactDerivative) : null;

  const stepSizeComparison: StepSizeComparisonRow[] = [safeH, safeH / 2, safeH / 4].map(
    (step) => {
      const res = evalFinite(step);
      return {
        h: Number(step.toFixed(4)),
        forwardDiff: res.forward,
        backwardDiff: res.backward,
        centralDiff: res.central,
        forwardError: exactDerivative !== null ? Math.abs(res.forward - exactDerivative) : null,
        backwardError: exactDerivative !== null ? Math.abs(res.backward - exactDerivative) : null,
        centralError: exactDerivative !== null ? Math.abs(res.central - exactDerivative) : null,
      };
    },
  );

  const demandTrend =
    selectedSlope > 0.5 ? 'rising' : selectedSlope < -0.5 ? 'falling' : 'stationary';

  const sampledCurve: { x: number; y: number; slope: number }[] = [];
  const count = 46;
  const eps = 0.25;
  for (let i = 0; i <= count; i++) {
    const x = xMin + (i / count) * (xMax - xMin);
    const y = fn(x);
    const slope = (fn(x + eps) - fn(x - eps)) / (2 * eps);
    sampledCurve.push({ x, y, slope });
  }

  return {
    x0,
    h: safeH,
    method,
    fx0: base.f0,
    fxPlus: base.fPlus,
    fxMinus: base.fMinus,
    forwardDiff: base.forward,
    backwardDiff: base.backward,
    centralDiff: base.central,
    selectedSlope,
    demandTrend,
    exactDerivative,
    selectedTruncationError,
    stepSizeComparison,
    sampledCurve,
  };
}
