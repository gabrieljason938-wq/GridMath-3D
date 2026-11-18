import { lup, lusolve, matrix, multiply, norm } from 'mathjs';
import type { NumericalStep } from '../types/grid';

export interface LinearSystemSolution {
  solution: number[];
  residualNorm: number;
  conditionEstimate: number;
  converged: boolean;
}

export interface ErrorMetrics {
  mae: number;
  rmse: number;
  mapePercent: number;
  rSquared: number;
}

/**
 * Solves A * x = b using mathjs LU decomposition and verifies the L2 residual ||Ax - b||_2.
 */
export function solveLinearSystem(A: number[][], b: number[]): LinearSystemSolution {
  const n = A.length;
  if (n === 0 || A.some((row) => row.length !== n) || b.length !== n) {
    throw new Error('Matrix A must be non-empty square (n x n) and match vector b length.');
  }

  const matA = matrix(A);
  const { U } = lup(matA);
  const uData = (
    typeof (U as { toArray?: () => unknown }).toArray === 'function'
      ? (U as { toArray: () => number[][] }).toArray()
      : U
  ) as number[][];
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(uData[i][i]) || Math.abs(uData[i][i]) < 1e-12) {
      throw new Error(`Matrix A is singular or numerically rank-deficient at pivot ${i + 1}.`);
    }
  }

  const vecB = b.map((v) => [v]);
  const rawX = lusolve(matA, vecB);
  const xArray = (rawX.toArray() as number[][]).map((row) => Number(row[0]));
  if (xArray.some((v) => !Number.isFinite(v))) {
    throw new Error('Linear system produced non-finite solution values.');
  }

  const ax = multiply(matA, xArray).toArray() as number[];
  const residualVec = ax.map((val, idx) => val - b[idx]);
  const residualNorm = Number(norm(residualVec, 2));

  // Diagonal dominance / row-norm condition proxy for well-posedness inspection
  const rowSums = A.map((row) => row.reduce((acc, v) => acc + Math.abs(v), 0));
  const maxRow = Math.max(...rowSums);
  const minDiag = Math.min(...A.map((row, idx) => Math.max(1e-9, Math.abs(row[idx]))));
  const conditionEstimate = Number((maxRow / minDiag).toFixed(3));

  return {
    solution: xArray.map((v) => Number(v.toFixed(6))),
    residualNorm: Number(residualNorm.toExponential(4)),
    conditionEstimate,
    converged: Number.isFinite(residualNorm) && residualNorm < 1e-6,
  };
}

/**
 * Computes MAE, RMSE, MAPE (%), and R^2 between observed and predicted series.
 */
export function computeErrorMetrics(actual: number[], predicted: number[]): ErrorMetrics {
  if (actual.length === 0 || actual.length !== predicted.length) {
    throw new Error('Actual and predicted arrays must have identical non-zero length.');
  }

  const n = actual.length;
  let absErrSum = 0;
  let sqErrSum = 0;
  let apeSum = 0;
  let validMapeCount = 0;

  const meanActual = actual.reduce((acc, v) => acc + v, 0) / n;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const err = predicted[i] - actual[i];
    absErrSum += Math.abs(err);
    sqErrSum += err * err;
    ssTot += (actual[i] - meanActual) ** 2;
    if (Math.abs(actual[i]) > 1e-6) {
      apeSum += Math.abs(err / actual[i]) * 100;
      validMapeCount++;
    }
  }

  const mae = absErrSum / n;
  const rmse = Math.sqrt(sqErrSum / n);
  const mapePercent = validMapeCount > 0 ? apeSum / validMapeCount : 0;
  const rSquared = ssTot > 1e-9 ? 1 - sqErrSum / ssTot : 1;

  return {
    mae: Number(mae.toFixed(3)),
    rmse: Number(rmse.toFixed(3)),
    mapePercent: Number(mapePercent.toFixed(2)),
    rSquared: Number(rSquared.toFixed(4)),
  };
}

/**
 * Computes central finite-difference first derivatives dY/dt for uniform spacing dt.
 */
export function finiteDifferenceDerivative(series: number[], dt = 1): number[] {
  if (!Number.isFinite(dt) || dt <= 0) {
    throw new Error('Step size dt must be a finite positive number.');
  }
  const n = series.length;
  if (n < 2) {
    return series.map(() => 0);
  }
  return series.map((_, i) => {
    if (i === 0) {
      return Number(((series[1] - series[0]) / dt).toFixed(3));
    }
    if (i === n - 1) {
      return Number(((series[n - 1] - series[n - 2]) / dt).toFixed(3));
    }
    return Number(((series[i + 1] - series[i - 1]) / (2 * dt)).toFixed(3));
  });
}

/**
 * Piecewise linear interpolation on sorted x-coordinates.
 */
export function linearInterpolateSeries(xs: number[], ys: number[], targetX: number): number {
  if (xs.length === 0 || xs.length !== ys.length) {
    throw new Error('Interpolation xs and ys must be non-empty and equal length.');
  }
  if (targetX <= xs[0]) return ys[0];
  if (targetX >= xs[xs.length - 1]) return ys[ys.length - 1];

  for (let i = 0; i < xs.length - 1; i++) {
    if (targetX >= xs[i] && targetX <= xs[i + 1]) {
      const span = xs[i + 1] - xs[i];
      if (Math.abs(span) < 1e-12) return ys[i];
      const t = (targetX - xs[i]) / span;
      return Number((ys[i] + t * (ys[i + 1] - ys[i])).toFixed(4));
    }
  }
  return ys[ys.length - 1];
}

/**
 * Deterministic scalar Newton-Raphson solver returning full iteration trace.
 */
export function newtonRaphsonScalar(
  fn: (x: number) => number,
  dfn: (x: number) => number,
  initialGuess: number,
  tolerance = 1e-7,
  maxIterations = 12,
): NumericalStep[] {
  const steps: NumericalStep[] = [];
  let x = initialGuess;

  for (let iter = 0; iter < maxIterations; iter++) {
    const fx = fn(x);
    const dfx = dfn(x);
    const residualNorm = Math.abs(fx);

    if (Math.abs(dfx) < 1e-12) {
      steps.push({
        iteration: iter,
        estimate: Number(x.toFixed(6)),
        residualNorm: Number(residualNorm.toExponential(3)),
        stepSize: 0,
        objectiveValue: Number(fx.toFixed(6)),
        converged: false,
        note: 'Derivative near zero; iteration halted safely.',
      });
      break;
    }

    const delta = fx / dfx;
    const converged = residualNorm <= tolerance;

    steps.push({
      iteration: iter,
      estimate: Number(x.toFixed(6)),
      residualNorm: Number(residualNorm.toExponential(3)),
      stepSize: Number(Math.abs(delta).toExponential(3)),
      objectiveValue: Number(fx.toFixed(6)),
      converged,
      note: converged ? 'Tolerance satisfied' : 'Quadratic Newton step applied',
    });

    if (converged) break;
    x -= delta;
  }

  return steps;
}
