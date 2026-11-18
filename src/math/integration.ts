export type IntegrationMethod = 'trapezoidal' | 'simpson';

export interface IntegrationSlice {
  index: number;
  xStart: number;
  xEnd: number;
  yStartMW: number;
  yEndMW: number;
  yMidMW: number;
  sliceEnergyMWh: number;
  cumulativeEnergyMWh: number;
  weightLabel: string;
}

export interface NumericalIntegrationResult {
  valid: boolean;
  error?: string;
  method: IntegrationMethod;
  a: number;
  b: number;
  subdivisions: number;
  stepSizeH: number;
  /** Integrated energy strictly in MWh = integral(P(t) dt) */
  trapezoidalEnergyMWh: number;
  simpsonEnergyMWh: number | null;
  selectedEnergyMWh: number;
  exactEnergyMWh: number | null;
  trapezoidalAbsErrorMWh: number | null;
  simpsonAbsErrorMWh: number | null;
  slices: IntegrationSlice[];
  curvePoints: { t: number; powerMW: number }[];
}

/**
 * Computes Composite Trapezoidal and Composite Simpson's 1/3 integration
 * over power P(t) [MW] on [a, b] [hours], producing energy in MWh.
 */
export function computeNumericalIntegration(params: {
  fn: (t: number) => number;
  exactIntegral?: (a: number, b: number) => number;
  a: number;
  b: number;
  subdivisions: number;
  method: IntegrationMethod;
}): NumericalIntegrationResult {
  const { fn, exactIntegral, a, b, subdivisions, method } = params;

  if (b <= a) {
    return {
      valid: false,
      error: 'Upper bound b must be strictly greater than lower bound a.',
      method,
      a,
      b,
      subdivisions,
      stepSizeH: 0,
      trapezoidalEnergyMWh: 0,
      simpsonEnergyMWh: null,
      selectedEnergyMWh: 0,
      exactEnergyMWh: null,
      trapezoidalAbsErrorMWh: null,
      simpsonAbsErrorMWh: null,
      slices: [],
      curvePoints: [],
    };
  }

  const n = Math.max(2, Math.round(subdivisions));
  if (method === 'simpson' && n % 2 !== 0) {
    return {
      valid: false,
      error: `Composite Simpson's 1/3 rule requires an even number of subintervals (received n = ${n}).`,
      method,
      a,
      b,
      subdivisions: n,
      stepSizeH: (b - a) / n,
      trapezoidalEnergyMWh: 0,
      simpsonEnergyMWh: null,
      selectedEnergyMWh: 0,
      exactEnergyMWh: exactIntegral ? exactIntegral(a, b) : null,
      trapezoidalAbsErrorMWh: null,
      simpsonAbsErrorMWh: null,
      slices: [],
      curvePoints: [],
    };
  }

  const h = (b - a) / n;
  const xs = Array.from({ length: n + 1 }, (_, i) => a + i * h);
  const ys = xs.map((x) => fn(x));

  // Composite Trapezoidal Rule
  let trapSum = 0.5 * (ys[0] + ys[n]);
  for (let i = 1; i < n; i++) trapSum += ys[i];
  const trapezoidalEnergyMWh = h * trapSum;

  // Composite Simpson's 1/3 Rule (valid whenever n is even)
  let simpsonEnergyMWh: number | null = null;
  if (n % 2 === 0) {
    let simpSum = ys[0] + ys[n];
    for (let i = 1; i < n; i++) {
      simpSum += (i % 2 === 1 ? 4 : 2) * ys[i];
    }
    simpsonEnergyMWh = (h / 3) * simpSum;
  }

  const selectedEnergyMWh =
    method === 'simpson' && simpsonEnergyMWh !== null
      ? simpsonEnergyMWh
      : trapezoidalEnergyMWh;

  // Build step-by-step slices for progressive 3D visualization & cumulative MWh trace
  const slices: IntegrationSlice[] = [];
  let cumulative = 0;

  if (method === 'simpson' && n % 2 === 0) {
    // Pair subdivisions [x_{2k}, x_{2k+2}] for Simpson's 1/3 parabolic panels
    for (let k = 0; k < n; k += 2) {
      const panelEnergy = (h / 3) * (ys[k] + 4 * ys[k + 1] + ys[k + 2]);
      cumulative += panelEnergy;
      slices.push({
        index: k / 2,
        xStart: xs[k],
        xEnd: xs[k + 2],
        yStartMW: ys[k],
        yEndMW: ys[k + 2],
        yMidMW: ys[k + 1],
        sliceEnergyMWh: panelEnergy,
        cumulativeEnergyMWh: cumulative,
        weightLabel: '(h/3)·(y₀ + 4y₁ + y₂)',
      });
    }
  } else {
    for (let i = 0; i < n; i++) {
      const trapEnergy = 0.5 * h * (ys[i] + ys[i + 1]);
      cumulative += trapEnergy;
      slices.push({
        index: i,
        xStart: xs[i],
        xEnd: xs[i + 1],
        yStartMW: ys[i],
        yEndMW: ys[i + 1],
        yMidMW: 0.5 * (ys[i] + ys[i + 1]),
        sliceEnergyMWh: trapEnergy,
        cumulativeEnergyMWh: cumulative,
        weightLabel: '(h/2)·(yᵢ + yᵢ₊₁)',
      });
    }
  }

  const exactEnergyMWh = exactIntegral ? exactIntegral(a, b) : null;
  const trapezoidalAbsErrorMWh =
    exactEnergyMWh !== null ? Math.abs(trapezoidalEnergyMWh - exactEnergyMWh) : null;
  const simpsonAbsErrorMWh =
    exactEnergyMWh !== null && simpsonEnergyMWh !== null
      ? Math.abs(simpsonEnergyMWh - exactEnergyMWh)
      : null;

  const curvePoints: { t: number; powerMW: number }[] = [];
  const curveSteps = 72;
  for (let s = 0; s <= curveSteps; s++) {
    const t = a + (s / curveSteps) * (b - a);
    curvePoints.push({ t, powerMW: fn(t) });
  }

  return {
    valid: true,
    method,
    a,
    b,
    subdivisions: n,
    stepSizeH: h,
    trapezoidalEnergyMWh,
    simpsonEnergyMWh,
    selectedEnergyMWh,
    exactEnergyMWh,
    trapezoidalAbsErrorMWh,
    simpsonAbsErrorMWh,
    slices,
    curvePoints,
  };
}
