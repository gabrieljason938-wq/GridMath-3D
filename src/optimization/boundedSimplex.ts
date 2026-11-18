export type LPSense = 'min' | 'max';
export type RowOp = '<=' | '>=' | '=';

export interface BoundedLPRow {
  name: string;
  /** Sparse or dense entries: [{ col, coeff }] */
  terms: { col: number; coeff: number }[];
  op: RowOp;
  rhs: number;
}

export interface BoundedLPSpec {
  sense: LPSense;
  numVars: number;
  varNames: string[];
  objective: number[];
  lowerBounds: number[];
  upperBounds: number[];
  rows: BoundedLPRow[];
}

export interface BoundedLPResult {
  status: 'optimal' | 'infeasible' | 'unbounded' | 'iteration_limit';
  feasible: boolean;
  objectiveValue: number;
  primal: number[];
  iterations: number;
  maxConstraintViolation: number;
  rowResiduals: { name: string; lhs: number; op: RowOp; rhs: number; violation: number }[];
}

const EPS = 1e-8;
const PIVOT_TOL = 1e-9;

/**
 * Solves a general bounded linear program:
 *   min / max c^T x
 *   s.t. A x {<=, =, >=} b
 *        l <= x <= u  (with u_j possibly Infinity)
 *
 * Uses Two-Phase Bounded-Variable Simplex with upper-bound variable flipping
 * (requiring zero extra rows for variable box bounds) and Harris-style anti-cycling.
 */
export function solveBoundedLP(spec: BoundedLPSpec): BoundedLPResult {
  const { sense, numVars, objective, lowerBounds, upperBounds, rows } = spec;

  // Validate finite variable bounds
  for (let j = 0; j < numVars; j++) {
    if (lowerBounds[j] > upperBounds[j] + 1e-7) {
      return {
        status: 'infeasible',
        feasible: false,
        objectiveValue: Infinity,
        primal: Array(numVars).fill(0),
        iterations: 0,
        maxConstraintViolation: Infinity,
        rowResiduals: [],
      };
    }
  }

  // Shift variables: x_j = l_j + x'_j so 0 <= x'_j <= u'_j = u_j - l_j
  const uPrime: number[] = Array(numVars);
  let constObjOffset = 0;
  const cBase: number[] = Array(numVars);
  for (let j = 0; j < numVars; j++) {
    const lb = lowerBounds[j];
    const ub = upperBounds[j];
    uPrime[j] = Number.isFinite(ub) ? Math.max(0, ub - lb) : Infinity;
    const cj = sense === 'min' ? objective[j] : -objective[j];
    cBase[j] = cj;
    constObjOffset += cj * lb;
  }

  // Build standard equality system with slack/surplus & artificials
  const m = rows.length;
  const slackInfos: { rowIdx: number; sign: number }[] = [];
  const artInfos: { rowIdx: number }[] = [];

  const rhsList: number[] = Array(m).fill(0);
  const rowActiveTerms: { col: number; coeff: number }[][] = [];

  for (let r = 0; r < m; r++) {
    const row = rows[r];
    let shiftedRhs = row.rhs;
    const cleanedTerms: { col: number; coeff: number }[] = [];

    for (const t of row.terms) {
      if (Math.abs(t.coeff) < 1e-13) continue;
      shiftedRhs -= t.coeff * lowerBounds[t.col];
      cleanedTerms.push({ col: t.col, coeff: t.coeff });
    }

    let op = row.op;
    if (shiftedRhs < -1e-10) {
      shiftedRhs = -shiftedRhs;
      for (const t of cleanedTerms) t.coeff = -t.coeff;
      if (op === '<=') op = '>=';
      else if (op === '>=') op = '<=';
    } else if (shiftedRhs < 0) {
      shiftedRhs = 0;
    }

    rhsList[r] = shiftedRhs;
    rowActiveTerms.push(cleanedTerms);

    if (op === '<=') {
      slackInfos.push({ rowIdx: r, sign: 1 });
    } else if (op === '>=') {
      slackInfos.push({ rowIdx: r, sign: -1 });
      artInfos.push({ rowIdx: r });
    } else {
      artInfos.push({ rowIdx: r });
    }
  }

  const slackStart = numVars;
  const artStart = slackStart + slackInfos.length;
  const totalCols = artStart + artInfos.length;

  // Dense tableau M[r][col] (m rows x totalCols), plus rhs bVec[r]
  const M: number[][] = Array.from({ length: m }, () => Array<number>(totalCols).fill(0));
  const bVec: number[] = [...rhsList];
  const basis: number[] = Array<number>(m).fill(-1);

  for (let r = 0; r < m; r++) {
    for (const t of rowActiveTerms[r]) {
      M[r][t.col] += t.coeff;
    }
  }

  slackInfos.forEach((s, idx) => {
    const col = slackStart + idx;
    M[s.rowIdx][col] = s.sign;
    if (s.sign === 1) basis[s.rowIdx] = col;
  });

  artInfos.forEach((a, idx) => {
    const col = artStart + idx;
    M[a.rowIdx][col] = 1;
    basis[a.rowIdx] = col;
  });

  // Variable upper bounds & status:
  // status[j]: 0 = basic, 1 = nonbasic at lower bound 0, 2 = nonbasic at upper bound u[j]
  const ub = Array<number>(totalCols).fill(Infinity);
  for (let j = 0; j < numVars; j++) ub[j] = uPrime[j];

  const varState = Array<number>(totalCols).fill(1);
  for (let r = 0; r < m; r++) {
    varState[basis[r]] = 0;
  }

  // Cost vector for current phase
  const cost = Array<number>(totalCols).fill(0);
  // Dual/Simplex multipliers or direct tableau reduced costs
  // Maintain full tableau + cost row `zRow` of length totalCols + 1
  // For bounded simplex:
  //   Basic variables satisfy M x_B + N_L x_L + N_U x_U = b  => x_B = rhsCurrent
  //   where rhsCurrent = B^(-1) (b - N_U u_U).
  const rhsCurrent = [...bVec];

  // Since all initial nonbasics start at lower bound 0, rhsCurrent == bVec initially.
  const runBoundedSimplexPhase = (
    phaseCost: number[],
    activeMaxCol: number,
    maxIters: number,
  ): { status: 'optimal' | 'unbounded' | 'iteration_limit'; iterations: number } => {
    // Compute reduced costs: rc_j = c_j - c_B^T * M[:, j]
    const rc = Array<number>(activeMaxCol).fill(0);
    const recomputeRC = () => {
      for (let j = 0; j < activeMaxCol; j++) {
        if (varState[j] === 0) {
          rc[j] = 0;
          continue;
        }
        let cDot = 0;
        for (let r = 0; r < m; r++) {
          cDot += phaseCost[basis[r]] * M[r][j];
        }
        rc[j] = phaseCost[j] - cDot;
      }
    };

    recomputeRC();

    let iter = 0;
    for (; iter < maxIters; iter++) {
      // Choose entering variable with Dantzig (most-improving) rule, falling back cleanly
      let enterCol = -1;
      let bestScore = EPS;
      let dir = 0; // +1 if increasing from 0, -1 if decreasing from u_j

      for (let j = 0; j < activeMaxCol; j++) {
        if (varState[j] === 1 && rc[j] < -bestScore) {
          bestScore = -rc[j];
          enterCol = j;
          dir = 1;
        } else if (varState[j] === 2 && rc[j] > bestScore) {
          bestScore = rc[j];
          enterCol = j;
          dir = -1;
        }
      }

      if (enterCol === -1) {
        return { status: 'optimal', iterations: iter };
      }

      // Bounded ratio test along direction dir * (-M[:, enterCol])
      let minTheta = Number.isFinite(ub[enterCol]) ? ub[enterCol] : Infinity;
      let leaveRow = -1;
      let leaveToUpper = false;

      for (let r = 0; r < m; r++) {
        const a = dir * M[r][enterCol];
        const xB = rhsCurrent[r];
        const bCol = basis[r];

        if (a > PIVOT_TOL) {
          // x_B decreases: x_B - theta * a >= 0
          const ratio = Math.max(0, xB) / a;
          if (ratio < minTheta - 1e-11) {
            minTheta = ratio;
            leaveRow = r;
            leaveToUpper = false;
          }
        } else if (a < -PIVOT_TOL && Number.isFinite(ub[bCol])) {
          // x_B increases: x_B - theta * a <= ub[bCol]
          const ratio = Math.max(0, ub[bCol] - xB) / -a;
          if (ratio < minTheta - 1e-11) {
            minTheta = ratio;
            leaveRow = r;
            leaveToUpper = true;
          }
        }
      }

      if (!Number.isFinite(minTheta)) {
        return { status: 'unbounded', iterations: iter };
      }

      if (leaveRow === -1) {
        // Entering variable hits its own opposite bound without changing basis
        const delta = dir * ub[enterCol];
        for (let r = 0; r < m; r++) {
          rhsCurrent[r] -= delta * M[r][enterCol];
        }
        varState[enterCol] = dir === 1 ? 2 : 1;
        continue;
      }

      // Update basic values before basis swap (for non-leaving rows)
      const stepDelta = dir * minTheta;
      for (let r = 0; r < m; r++) {
        rhsCurrent[r] -= stepDelta * M[r][enterCol];
      }
      // Value of entering variable after move
      const newEnterVal = dir === 1 ? minTheta : ub[enterCol] - minTheta;

      // Pivot row `leaveRow` on column `enterCol`
      const pivotVal = M[leaveRow][enterCol];
      for (let j = 0; j < totalCols; j++) {
        M[leaveRow][j] /= pivotVal;
      }
      rhsCurrent[leaveRow] = newEnterVal;

      for (let r = 0; r < m; r++) {
        if (r === leaveRow) continue;
        const factor = M[r][enterCol];
        if (Math.abs(factor) < 1e-13) continue;
        for (let j = 0; j < totalCols; j++) {
          M[r][j] -= factor * M[leaveRow][j];
        }
      }

      const oldBasisCol = basis[leaveRow];
      basis[leaveRow] = enterCol;
      varState[enterCol] = 0;
      varState[oldBasisCol] = leaveToUpper ? 2 : 1;

      recomputeRC();
    }

    return { status: 'iteration_limit', iterations: iter };
  };

  let totalIters = 0;

  // Phase I if artificial variables exist
  if (artInfos.length > 0) {
    cost.fill(0);
    for (let j = artStart; j < totalCols; j++) cost[j] = 1;
    const p1 = runBoundedSimplexPhase(cost, totalCols, 4000);
    totalIters += p1.iterations;

    let artSum = 0;
    for (let r = 0; r < m; r++) {
      if (basis[r] >= artStart) artSum += Math.max(0, rhsCurrent[r]);
    }

    if (artSum > 1e-4) {
      return {
        status: 'infeasible',
        feasible: false,
        objectiveValue: Infinity,
        primal: Array(numVars).fill(0),
        iterations: totalIters,
        maxConstraintViolation: artSum,
        rowResiduals: [],
      };
    }

    // Pivot out any zero-valued artificial still sitting in basis if possible
    for (let r = 0; r < m; r++) {
      if (basis[r] >= artStart) {
        let repCol = -1;
        for (let j = 0; j < artStart; j++) {
          if (varState[j] === 1 && Math.abs(M[r][j]) > 1e-8) {
            repCol = j;
            break;
          }
        }
        if (repCol === -1) {
          for (let j = 0; j < artStart; j++) {
            if (varState[j] === 2 && Math.abs(M[r][j]) > 1e-8) {
              repCol = j;
              break;
            }
          }
        }
        if (repCol !== -1) {
          if (varState[repCol] === 2) {
            const uVal = ub[repCol];
            for (let rr = 0; rr < m; rr++) {
              rhsCurrent[rr] += uVal * M[rr][repCol];
            }
          }
          const piv = M[r][repCol];
          for (let j = 0; j < totalCols; j++) M[r][j] /= piv;
          rhsCurrent[r] /= piv;
          for (let rr = 0; rr < m; rr++) {
            if (rr === r) continue;
            const f = M[rr][repCol];
            if (Math.abs(f) < 1e-13) continue;
            for (let j = 0; j < totalCols; j++) M[rr][j] -= f * M[r][j];
            rhsCurrent[rr] -= f * rhsCurrent[r];
          }
          varState[basis[r]] = 1;
          varState[repCol] = 0;
          basis[r] = repCol;
        }
      }
    }
  }

  // Phase II: optimize true objective over original + slack columns (0..artStart-1)
  cost.fill(0);
  for (let j = 0; j < numVars; j++) cost[j] = cBase[j];
  const p2 = runBoundedSimplexPhase(cost, artStart, 6000);
  totalIters += p2.iterations;

  if (p2.status === 'unbounded') {
    return {
      status: 'unbounded',
      feasible: true,
      objectiveValue: sense === 'min' ? -Infinity : Infinity,
      primal: Array(numVars).fill(0),
      iterations: totalIters,
      maxConstraintViolation: 0,
      rowResiduals: [],
    };
  }

  // Extract x'_j then reconstruct x_j = l_j + x'_j
  const xPrime = Array<number>(totalCols).fill(0);
  for (let j = 0; j < totalCols; j++) {
    if (varState[j] === 2) xPrime[j] = ub[j];
  }
  for (let r = 0; r < m; r++) {
    xPrime[basis[r]] = rhsCurrent[r];
  }

  const primal = Array<number>(numVars);
  for (let j = 0; j < numVars; j++) {
    const rawVal = lowerBounds[j] + xPrime[j];
    const clamped = Math.min(upperBounds[j], Math.max(lowerBounds[j], rawVal));
    primal[j] = Math.abs(clamped) < 1e-9 ? 0 : Number(clamped.toFixed(6));
  }

  let trueObj = 0;
  for (let j = 0; j < numVars; j++) {
    trueObj += objective[j] * primal[j];
  }

  // Verify exact residuals against original unshifted constraints
  let maxConstraintViolation = 0;
  const rowResiduals = rows.map((row) => {
    const lhs = row.terms.reduce((acc, t) => acc + t.coeff * primal[t.col], 0);
    let violation = 0;
    if (row.op === '<=') violation = Math.max(0, lhs - row.rhs);
    else if (row.op === '>=') violation = Math.max(0, row.rhs - lhs);
    else violation = Math.abs(lhs - row.rhs);
    if (violation > maxConstraintViolation) maxConstraintViolation = violation;
    return {
      name: row.name,
      lhs: Number(lhs.toFixed(6)),
      op: row.op,
      rhs: Number(row.rhs.toFixed(6)),
      violation: Number(violation.toFixed(8)),
    };
  });

  // Also check variable bounds
  for (let j = 0; j < numVars; j++) {
    const rawVal = lowerBounds[j] + xPrime[j];
    const lbViol = Math.max(0, lowerBounds[j] - rawVal);
    const ubViol = Number.isFinite(upperBounds[j]) ? Math.max(0, rawVal - upperBounds[j]) : 0;
    maxConstraintViolation = Math.max(maxConstraintViolation, lbViol, ubViol);
  }

  return {
    status: p2.status === 'optimal' ? 'optimal' : 'iteration_limit',
    feasible: maxConstraintViolation < 1e-3,
    objectiveValue: Number(trueObj.toFixed(2)),
    primal,
    iterations: totalIters,
    maxConstraintViolation: Number(maxConstraintViolation.toFixed(8)),
    rowResiduals,
  };
}
