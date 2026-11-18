export interface InterpolationPoint {
  x: number;
  y: number;
  label?: string;
}

export interface DividedDiffStep {
  order: number;
  startIndex: number;
  endIndex: number;
  numerator: number;
  denominator: number;
  value: number;
  formulaLabel: string;
}

export interface NewtonInterpolationResult {
  valid: boolean;
  error?: string;
  sortedPoints: InterpolationPoint[];
  table: number[][];
  coefficients: number[];
  steps: DividedDiffStep[];
  queryX: number;
  interpolatedY: number;
  curvePoints: { x: number; y: number }[];
  maxNodeResidual: number;
  benchmarkError: number | null;
  exactBenchmarkY: number | null;
}

/**
 * Computes Newton's Divided Difference Interpolation Table, step-by-step coefficients,
 * Horner evaluation at queryX, and dense plotting curve.
 */
export function computeNewtonDividedDifference(
  rawPoints: InterpolationPoint[],
  queryX: number,
  exactFn?: (x: number) => number,
): NewtonInterpolationResult {
  if (rawPoints.length < 2) {
    return {
      valid: false,
      error: 'At least 2 distinct data points are required for interpolation.',
      sortedPoints: rawPoints,
      table: [],
      coefficients: [],
      steps: [],
      queryX,
      interpolatedY: 0,
      curvePoints: [],
      maxNodeResidual: 0,
      benchmarkError: null,
      exactBenchmarkY: null,
    };
  }

  const sortedPoints = [...rawPoints].sort((a, b) => a.x - b.x);
  for (let i = 1; i < sortedPoints.length; i++) {
    if (Math.abs(sortedPoints[i].x - sortedPoints[i - 1].x) < 1e-9) {
      return {
        valid: false,
        error: `Duplicate x-coordinate detected at x = ${sortedPoints[i].x}. Nodes must be strictly distinct.`,
        sortedPoints,
        table: [],
        coefficients: [],
        steps: [],
        queryX,
        interpolatedY: 0,
        curvePoints: [],
        maxNodeResidual: 0,
        benchmarkError: null,
        exactBenchmarkY: null,
      };
    }
  }

  const n = sortedPoints.length;
  const table: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    table[i][0] = sortedPoints[i].y;
  }

  const steps: DividedDiffStep[] = [];
  for (let j = 1; j < n; j++) {
    for (let i = 0; i < n - j; i++) {
      const numerator = table[i + 1][j - 1] - table[i][j - 1];
      const denominator = sortedPoints[i + j].x - sortedPoints[i].x;
      const value = numerator / denominator;
      table[i][j] = value;

      steps.push({
        order: j,
        startIndex: i,
        endIndex: i + j,
        numerator,
        denominator,
        value,
        formulaLabel: `f[x_${i},...,x_${i + j}]`,
      });
    }
  }

  const coefficients = Array.from({ length: n }, (_, k) => table[0][k]);

  const evaluateAt = (x: number): number => {
    let acc = coefficients[n - 1];
    for (let k = n - 2; k >= 0; k--) {
      acc = acc * (x - sortedPoints[k].x) + coefficients[k];
    }
    return acc;
  };

  const interpolatedY = evaluateAt(queryX);
  const xMin = sortedPoints[0].x;
  const xMax = sortedPoints[n - 1].x;
  const sampleCount = 80;
  const curvePoints: { x: number; y: number }[] = [];
  for (let s = 0; s <= sampleCount; s++) {
    const x = xMin + (s / sampleCount) * (xMax - xMin);
    curvePoints.push({ x, y: evaluateAt(x) });
  }

  let maxNodeResidual = 0;
  for (const pt of sortedPoints) {
    maxNodeResidual = Math.max(maxNodeResidual, Math.abs(evaluateAt(pt.x) - pt.y));
  }

  const exactBenchmarkY = exactFn ? exactFn(queryX) : null;
  const benchmarkError =
    exactBenchmarkY !== null ? Math.abs(interpolatedY - exactBenchmarkY) : null;

  return {
    valid: true,
    sortedPoints,
    table,
    coefficients,
    steps,
    queryX,
    interpolatedY,
    curvePoints,
    maxNodeResidual,
    benchmarkError,
    exactBenchmarkY,
  };
}
