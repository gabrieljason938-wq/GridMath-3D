export type EliminationStepKind =
  | 'initial'
  | 'pivot-swap'
  | 'eliminate'
  | 'singular'
  | 'back-substitute'
  | 'complete';

export interface EliminationStep {
  stepIndex: number;
  kind: EliminationStepKind;
  pivotRow: number;
  pivotCol: number;
  targetRow?: number;
  multiplier?: number;
  matrixSnapshot: number[][];
  partialSolution?: (number | null)[];
  description: string;
}

export interface GaussianEliminationResult {
  valid: boolean;
  singular: boolean;
  error?: string;
  size: number;
  steps: EliminationStep[];
  solution: number[];
  residualVector: number[];
  residualL2Norm: number;
  residualInfNorm: number;
  swapCount: number;
}

function cloneAug(aug: number[][]): number[][] {
  return aug.map((row) => [...row]);
}

/**
 * Solves A * x = b using Gaussian Elimination with Scaled/Partial Pivoting
 * and records every matrix snapshot for deterministic 3D step animation.
 */
export function solveGaussianElimination(A: number[][], b: number[]): GaussianEliminationResult {
  const n = A.length;
  if (n === 0 || A.some((r) => r.length !== n) || b.length !== n) {
    return {
      valid: false,
      singular: false,
      error: 'Matrix A must be non-empty square (n x n) matching vector b.',
      size: n,
      steps: [],
      solution: [],
      residualVector: [],
      residualL2Norm: 0,
      residualInfNorm: 0,
      swapCount: 0,
    };
  }

  const aug = A.map((row, i) => [...row, b[i]]);
  const steps: EliminationStep[] = [];
  let swapCount = 0;

  steps.push({
    stepIndex: 0,
    kind: 'initial',
    pivotRow: 0,
    pivotCol: 0,
    matrixSnapshot: cloneAug(aug),
    description: `Initial ${n}x${n} augmented matrix [A | b].`,
  });

  for (let col = 0; col < n; col++) {
    // Partial pivoting: select row >= col with largest |aug[r][col]|
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let r = col + 1; r < n; r++) {
      const candidate = Math.abs(aug[r][col]);
      if (candidate > maxVal) {
        maxVal = candidate;
        maxRow = r;
      }
    }

    if (maxVal < 1e-12) {
      steps.push({
        stepIndex: steps.length,
        kind: 'singular',
        pivotRow: col,
        pivotCol: col,
        matrixSnapshot: cloneAug(aug),
        description: `Zero/near-zero pivot at column ${col + 1} (|pivot| = ${maxVal.toExponential(2)}). Matrix is singular.`,
      });
      return {
        valid: false,
        singular: true,
        error: `Matrix is singular or numerically rank-deficient at column ${col + 1}.`,
        size: n,
        steps,
        solution: [],
        residualVector: [],
        residualL2Norm: Infinity,
        residualInfNorm: Infinity,
        swapCount,
      };
    }

    if (maxRow !== col) {
      const tmp = aug[col];
      aug[col] = aug[maxRow];
      aug[maxRow] = tmp;
      swapCount++;
      steps.push({
        stepIndex: steps.length,
        kind: 'pivot-swap',
        pivotRow: col,
        pivotCol: col,
        targetRow: maxRow,
        matrixSnapshot: cloneAug(aug),
        description: `Partial pivot swap: R${col + 1} <-> R${maxRow + 1} (largest |a_${maxRow + 1},${col + 1}| = ${maxVal.toFixed(4)}).`,
      });
    }

    // Forward elimination below pivot
    for (let r = col + 1; r < n; r++) {
      const factor = aug[r][col] / aug[col][col];
      if (Math.abs(factor) < 1e-14) {
        aug[r][col] = 0;
        continue;
      }
      for (let c = col; c <= n; c++) {
        aug[r][c] = aug[r][c] - factor * aug[col][c];
      }
      aug[r][col] = 0;
      steps.push({
        stepIndex: steps.length,
        kind: 'eliminate',
        pivotRow: col,
        pivotCol: col,
        targetRow: r,
        multiplier: factor,
        matrixSnapshot: cloneAug(aug),
        description: `Eliminate entry (${r + 1}, ${col + 1}): R${r + 1} <- R${r + 1} - (${factor.toFixed(4)}) * R${col + 1}.`,
      });
    }
  }

  // Back substitution
  const x = Array<number>(n).fill(0);
  const partial: (number | null)[] = Array(n).fill(null);

  for (let i = n - 1; i >= 0; i--) {
    let rhs = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      rhs -= aug[i][j] * x[j];
    }
    if (Math.abs(aug[i][i]) < 1e-12) {
      return {
        valid: false,
        singular: true,
        error: `Zero diagonal during back substitution at row ${i + 1}.`,
        size: n,
        steps,
        solution: [],
        residualVector: [],
        residualL2Norm: Infinity,
        residualInfNorm: Infinity,
        swapCount,
      };
    }
    x[i] = rhs / aug[i][i];
    partial[i] = x[i];
    steps.push({
      stepIndex: steps.length,
      kind: 'back-substitute',
      pivotRow: i,
      pivotCol: i,
      matrixSnapshot: cloneAug(aug),
      partialSolution: [...partial],
      description: `Back substitution: x_${i + 1} = ${x[i].toFixed(6)}.`,
    });
  }

  // Residual verification r = A*x - b
  const residualVector = A.map((row, i) => {
    const ax = row.reduce((acc, aij, j) => acc + aij * x[j], 0);
    return ax - b[i];
  });
  const residualL2Norm = Math.sqrt(residualVector.reduce((acc, r) => acc + r * r, 0));
  const residualInfNorm = Math.max(...residualVector.map((r) => Math.abs(r)));

  steps.push({
    stepIndex: steps.length,
    kind: 'complete',
    pivotRow: 0,
    pivotCol: 0,
    matrixSnapshot: cloneAug(aug),
    partialSolution: [...x],
    description: `Solution complete. Residual ||Ax - b||_2 = ${residualL2Norm.toExponential(3)}.`,
  });

  return {
    valid: true,
    singular: false,
    size: n,
    steps,
    solution: x,
    residualVector,
    residualL2Norm,
    residualInfNorm,
    swapCount,
  };
}
