export interface RegressionObservation {
  id: string;
  label: string;
  x1: number;
  x2?: number;
  y: number;
}

export interface RegressionResult {
  valid: boolean;
  error?: string;
  predictorCount: 1 | 2;
  /** [beta0, beta1] for 1 predictor or [beta0, beta1, beta2] for 2 predictors */
  coefficients: number[];
  predictions: number[];
  residuals: number[];
  mae: number;
  rmse: number;
  rSquared: number;
  /** Educational Normal Equations matrix X^T X and vector X^T y */
  normalMatrixXTX: number[][];
  normalVectorXTy: number[];
  /** Frobenius norm ||Q^T Q - I||_F verifying numerical QR stability */
  qrOrthogonalityError: number;
}

/**
 * Solves linear least squares min ||X * beta - y||_2 via Householder QR factorization.
 * Also computes educational normal-equation matrices (X^T X, X^T y) and regression diagnostics.
 */
export function solveLeastSquaresRegression(
  observations: RegressionObservation[],
  predictorCount: 1 | 2,
): RegressionResult {
  const p = predictorCount + 1; // including intercept
  const m = observations.length;

  if (m < p) {
    return {
      valid: false,
      error: `At least ${p} observations are required to fit ${predictorCount} predictor(s) + intercept.`,
      predictorCount,
      coefficients: [],
      predictions: [],
      residuals: [],
      mae: 0,
      rmse: 0,
      rSquared: 0,
      normalMatrixXTX: [],
      normalVectorXTy: [],
      qrOrthogonalityError: 0,
    };
  }

  // Design matrix X (m x p) and target y (m)
  const X: number[][] = observations.map((obs) =>
    predictorCount === 1 ? [1, obs.x1] : [1, obs.x1, obs.x2 ?? 0],
  );
  const y: number[] = observations.map((obs) => obs.y);

  // Educational Normal Equations X^T X and X^T y
  const normalMatrixXTX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  const normalVectorXTy: number[] = Array(p).fill(0);

  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let r = 0; r < m; r++) sum += X[r][i] * X[r][j];
      normalMatrixXTX[i][j] = sum;
    }
    let rhs = 0;
    for (let r = 0; r < m; r++) rhs += X[r][i] * y[r];
    normalVectorXTy[i] = rhs;
  }

  // Householder QR decomposition on X (m x p) -> R (m x p), Q^T y (m)
  const R = X.map((row) => [...row]);
  const qty = [...y];
  const Q = Array.from({ length: m }, (_, i) =>
    Array.from({ length: m }, (_, j) => (i === j ? 1 : 0)),
  );

  for (let k = 0; k < p; k++) {
    let normSq = 0;
    for (let i = k; i < m; i++) normSq += R[i][k] * R[i][k];
    const normX = Math.sqrt(normSq);
    if (normX < 1e-12) {
      return {
        valid: false,
        error: 'Predictors are collinear (rank-deficient design matrix X).',
        predictorCount,
        coefficients: [],
        predictions: [],
        residuals: [],
        mae: 0,
        rmse: 0,
        rSquared: 0,
        normalMatrixXTX,
        normalVectorXTy,
        qrOrthogonalityError: 0,
      };
    }

    const alpha = R[k][k] >= 0 ? -normX : normX;
    const v = Array<number>(m - k).fill(0);
    v[0] = R[k][k] - alpha;
    for (let i = k + 1; i < m; i++) v[i - k] = R[i][k];

    const vNormSq = v.reduce((acc, val) => acc + val * val, 0);
    if (vNormSq < 1e-15) continue;

    // Apply Householder reflection to R[:, k:]
    for (let j = k; j < p; j++) {
      let dot = 0;
      for (let i = k; i < m; i++) dot += v[i - k] * R[i][j];
      const scale = (2 * dot) / vNormSq;
      for (let i = k; i < m; i++) R[i][j] -= scale * v[i - k];
    }

    // Apply Householder reflection to Q^T y
    let dotY = 0;
    for (let i = k; i < m; i++) dotY += v[i - k] * qty[i];
    const scaleY = (2 * dotY) / vNormSq;
    for (let i = k; i < m; i++) qty[i] -= scaleY * v[i - k];

    // Accumulate Q for orthogonality verification
    for (let row = 0; row < m; row++) {
      let dotQ = 0;
      for (let i = k; i < m; i++) dotQ += Q[row][i] * v[i - k];
      const scaleQ = (2 * dotQ) / vNormSq;
      for (let i = k; i < m; i++) Q[row][i] -= scaleQ * v[i - k];
    }
  }

  // Back-substitute R[0..p-1][0..p-1] * beta = qty[0..p-1]
  const coefficients = Array<number>(p).fill(0);
  for (let i = p - 1; i >= 0; i--) {
    let rhs = qty[i];
    for (let j = i + 1; j < p; j++) rhs -= R[i][j] * coefficients[j];
    if (Math.abs(R[i][i]) < 1e-12) {
      return {
        valid: false,
        error: 'Singular upper-triangular R factor; predictors are linearly dependent.',
        predictorCount,
        coefficients: [],
        predictions: [],
        residuals: [],
        mae: 0,
        rmse: 0,
        rSquared: 0,
        normalMatrixXTX,
        normalVectorXTy,
        qrOrthogonalityError: 0,
      };
    }
    coefficients[i] = rhs / R[i][i];
  }

  // Compute predictions, residuals, MAE, RMSE, R^2
  const predictions = X.map((row) => row.reduce((acc, xij, j) => acc + xij * coefficients[j], 0));
  const residuals = y.map((yi, i) => yi - predictions[i]);

  const absSum = residuals.reduce((acc, r) => acc + Math.abs(r), 0);
  const sqSum = residuals.reduce((acc, r) => acc + r * r, 0);
  const meanY = y.reduce((acc, val) => acc + val, 0) / m;
  const ssTot = y.reduce((acc, val) => acc + (val - meanY) ** 2, 0);

  const mae = absSum / m;
  const rmse = Math.sqrt(sqSum / m);
  const rSquared = ssTot > 1e-12 ? 1 - sqSum / ssTot : 1;

  // Verify ||Q^T Q - I||_F on leading p columns
  let orthErrSq = 0;
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let dot = 0;
      for (let r = 0; r < m; r++) dot += Q[r][i] * Q[r][j];
      const expected = i === j ? 1 : 0;
      orthErrSq += (dot - expected) ** 2;
    }
  }

  return {
    valid: true,
    predictorCount,
    coefficients,
    predictions,
    residuals,
    mae,
    rmse,
    rSquared,
    normalMatrixXTX,
    normalVectorXTy,
    qrOrthogonalityError: Math.sqrt(orthErrSq),
  };
}
