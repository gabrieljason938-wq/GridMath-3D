export type ConstraintOp = '<=' | '>=' | '=';

export interface LPConstraint {
  id: string;
  label: string;
  coeffs: number[];
  op: ConstraintOp;
  rhs: number;
}

export interface LinearProgramSpec {
  sense: 'min' | 'max';
  variableNames: string[];
  /** Objective coefficients c in c^T x */
  objectiveCoeffs: number[];
  constraints: LPConstraint[];
}

export interface SimplexStep {
  iteration: number;
  basisVars: string[];
  vertex: number[];
  objectiveValue: number;
  note: string;
}

export interface ConstraintResidual {
  id: string;
  label: string;
  lhsValue: number;
  op: ConstraintOp;
  rhs: number;
  slackOrResidual: number;
  satisfied: boolean;
  active: boolean;
}

export interface LPResult {
  feasible: boolean;
  bounded: boolean;
  status: 'optimal' | 'infeasible' | 'unbounded';
  optimalPoint: number[];
  optimalValue: number;
  steps: SimplexStep[];
  constraintResiduals: ConstraintResidual[];
  /** Feasible region vertices for 2D polygon or 3D polyhedron rendering */
  feasibleVertices: number[][];
}

const EPS = 1e-8;

function solveSmallLinear(M: number[][], rhs: number[]): number[] | null {
  const n = M.length;
  const aug = M.map((row, i) => [...row, rhs[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    let maxV = Math.abs(aug[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > maxV) {
        maxV = Math.abs(aug[r][col]);
        pivot = r;
      }
    }
    if (maxV < 1e-10) return null;
    if (pivot !== col) {
      const tmp = aug[col];
      aug[col] = aug[pivot];
      aug[pivot] = tmp;
    }
    const div = aug[col][col];
    for (let c = col; c <= n; c++) aug[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let c = col; c <= n; c++) aug[r][c] -= factor * aug[col][c];
    }
  }
  return aug.map((row) => row[n]);
}

function isPointFeasible(pt: number[], constraints: LPConstraint[]): boolean {
  if (pt.some((v) => !Number.isFinite(v) || v < -1e-6)) return false;
  for (const c of constraints) {
    const lhs = c.coeffs.reduce((acc, a, i) => acc + a * pt[i], 0);
    if (c.op === '<=' && lhs > c.rhs + 1e-6) return false;
    if (c.op === '>=' && lhs < c.rhs - 1e-6) return false;
    if (c.op === '=' && Math.abs(lhs - c.rhs) > 1e-6) return false;
  }
  return true;
}

/**
 * Enumerates extreme vertices of the convex feasible polytope in 2D or 3D
 * by intersecting all n-tuples of active hyperplanes (constraints + x_i = 0).
 */
export function computeFeasibleVertices(spec: LinearProgramSpec): number[][] {
  const dim = spec.objectiveCoeffs.length;
  const planes: { coeffs: number[]; rhs: number }[] = spec.constraints.map((c) => ({
    coeffs: c.coeffs,
    rhs: c.rhs,
  }));

  for (let d = 0; d < dim; d++) {
    const row = Array(dim).fill(0);
    row[d] = 1;
    planes.push({ coeffs: row, rhs: 0 });
  }

  const vertices: number[][] = [];
  const pushUnique = (pt: number[]) => {
    const clean = pt.map((v) => (Math.abs(v) < 1e-9 ? 0 : Number(v.toFixed(6))));
    const exists = vertices.some(
      (existing) => existing.every((v, idx) => Math.abs(v - clean[idx]) < 1e-5),
    );
    if (!exists) vertices.push(clean);
  };

  if (dim === 2) {
    for (let i = 0; i < planes.length; i++) {
      for (let j = i + 1; j < planes.length; j++) {
        const pt = solveSmallLinear(
          [planes[i].coeffs, planes[j].coeffs],
          [planes[i].rhs, planes[j].rhs],
        );
        if (pt && isPointFeasible(pt, spec.constraints)) {
          pushUnique(pt);
        }
      }
    }
    // Sort counter-clockwise around centroid for clean polygon triangulation
    if (vertices.length > 2) {
      const cx = vertices.reduce((a, p) => a + p[0], 0) / vertices.length;
      const cy = vertices.reduce((a, p) => a + p[1], 0) / vertices.length;
      vertices.sort(
        (a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx),
      );
    }
  } else if (dim === 3) {
    for (let i = 0; i < planes.length; i++) {
      for (let j = i + 1; j < planes.length; j++) {
        for (let k = j + 1; k < planes.length; k++) {
          const pt = solveSmallLinear(
            [planes[i].coeffs, planes[j].coeffs, planes[k].coeffs],
            [planes[i].rhs, planes[j].rhs, planes[k].rhs],
          );
          if (pt && isPointFeasible(pt, spec.constraints)) {
            pushUnique(pt);
          }
        }
      }
    }
  }

  return vertices;
}

/**
 * Genuine Two-Phase Simplex LP Solver for min/max c^T x subject to A x {<=, =, >=} b, x >= 0.
 * Captures tableau vertex steps, verifies feasibility, checks constraint residuals, and enumerates
 * polytope vertices for 2D/3D geometric rendering.
 */
export function solveLinearProgram(spec: LinearProgramSpec): LPResult {
  const nVars = spec.objectiveCoeffs.length;
  // Normalize constraints so rhs >= 0
  const normConstraints = spec.constraints.map((c) => {
    if (c.rhs < 0) {
      const flippedOp: ConstraintOp =
        c.op === '<=' ? '>=' : c.op === '>=' ? '<=' : '=';
      return {
        ...c,
        coeffs: c.coeffs.map((v) => -v),
        op: flippedOp,
        rhs: -c.rhs,
      };
    }
    return { ...c, coeffs: [...c.coeffs] };
  });

  // Build Phase I + Phase II variable columns:
  // Original x_0..x_{nVars-1}, slacks/surpluses, artificials
  const slackCols: number[] = [];
  const artCols: number[] = [];
  const rows: number[][] = [];
  const rhsList: number[] = [];
  const basis: number[] = [];

  let totalCols = nVars;
  normConstraints.forEach((c) => {
    if (c.op === '<=') {
      slackCols.push(totalCols++);
    } else if (c.op === '>=') {
      slackCols.push(totalCols++);
      artCols.push(totalCols++);
    } else {
      artCols.push(totalCols++);
    }
  });

  let slackCursor = nVars;
  let artCursor = nVars + slackCols.length;

  normConstraints.forEach((c) => {
    const row = Array<number>(totalCols).fill(0);
    for (let j = 0; j < nVars; j++) row[j] = c.coeffs[j];

    if (c.op === '<=') {
      row[slackCursor] = 1;
      basis.push(slackCursor);
      slackCursor++;
    } else if (c.op === '>=') {
      row[slackCursor] = -1;
      row[artCursor] = 1;
      basis.push(artCursor);
      slackCursor++;
      artCursor++;
    } else {
      row[artCursor] = 1;
      basis.push(artCursor);
      artCursor++;
    }
    rows.push(row);
    rhsList.push(c.rhs);
  });

  const m = rows.length;
  const colNames: string[] = [
    ...spec.variableNames,
    ...slackCols.map((_, idx) => `s_${idx + 1}`),
    ...artCols.map((_, idx) => `a_${idx + 1}`),
  ];

  // Construct tableau with m constraint rows + 1 objective row
  const tableau: number[][] = rows.map((r, i) => [...r, rhsList[i]]);
  const objRow = Array<number>(totalCols + 1).fill(0);
  tableau.push(objRow);

  const steps: SimplexStep[] = [];

  const extractDecisionPoint = (tab: number[][], bList: number[]): number[] => {
    const pt = Array<number>(nVars).fill(0);
    for (let r = 0; r < m; r++) {
      const col = bList[r];
      if (col < nVars) pt[col] = tab[r][totalCols];
    }
    return pt.map((v) => (Math.abs(v) < 1e-9 ? 0 : Number(v.toFixed(6))));
  };

  const evalTrueObjective = (pt: number[]): number =>
    spec.objectiveCoeffs.reduce((acc, c, i) => acc + c * pt[i], 0);

  const runSimplex = (
    tab: number[][],
    bList: number[],
    activeColCount: number,
    phaseLabel: string,
    recordSteps: boolean,
  ): 'optimal' | 'unbounded' => {
    const maxIters = 80;
    for (let iter = 0; iter < maxIters; iter++) {
      // Bland's rule / most-negative reduced cost for minimization
      let enterCol = -1;
      let minRC = -EPS;
      for (let c = 0; c < activeColCount; c++) {
        if (tab[m][c] < minRC) {
          minRC = tab[m][c];
          enterCol = c;
          break; // Bland's rule prevents cycling
        }
      }
      if (enterCol === -1) return 'optimal';

      let leaveRow = -1;
      let minRatio = Infinity;
      for (let r = 0; r < m; r++) {
        const a = tab[r][enterCol];
        if (a > EPS) {
          const ratio = tab[r][totalCols] / a;
          if (ratio < minRatio - EPS) {
            minRatio = ratio;
            leaveRow = r;
          }
        }
      }
      if (leaveRow === -1) return 'unbounded';

      // Pivot at (leaveRow, enterCol)
      const pivotVal = tab[leaveRow][enterCol];
      for (let c = 0; c <= totalCols; c++) tab[leaveRow][c] /= pivotVal;
      for (let r = 0; r <= m; r++) {
        if (r === leaveRow) continue;
        const factor = tab[r][enterCol];
        if (Math.abs(factor) < 1e-12) continue;
        for (let c = 0; c <= totalCols; c++) tab[r][c] -= factor * tab[leaveRow][c];
      }
      bList[leaveRow] = enterCol;

      if (recordSteps) {
        const pt = extractDecisionPoint(tab, bList);
        steps.push({
          iteration: steps.length,
          basisVars: bList.map((b) => colNames[b]),
          vertex: pt,
          objectiveValue: evalTrueObjective(pt),
          note: `${phaseLabel}: pivot ${colNames[enterCol]} into basis.`,
        });
      }
    }
    return 'optimal';
  };

  // Phase I if artificial variables exist
  const artStartCol = nVars + slackCols.length;
  if (artCols.length > 0) {
    for (let c = artStartCol; c < totalCols; c++) tableau[m][c] = 1;
    // Eliminate artificials from Phase I objective row
    for (let r = 0; r < m; r++) {
      if (basis[r] >= artStartCol) {
        for (let c = 0; c <= totalCols; c++) tableau[m][c] -= tableau[r][c];
      }
    }

    const p1Status = runSimplex(tableau, basis, totalCols, 'Phase I', false);
    const phase1Obj = -tableau[m][totalCols];
    if (p1Status !== 'optimal' || phase1Obj > 1e-5) {
      return {
        feasible: false,
        bounded: true,
        status: 'infeasible',
        optimalPoint: Array(nVars).fill(0),
        optimalValue: 0,
        steps: [
          {
            iteration: 0,
            basisVars: basis.map((b) => colNames[b]),
            vertex: Array(nVars).fill(0),
            objectiveValue: 0,
            note: `Infeasible constraint set (Phase I artificial residual = ${phase1Obj.toExponential(2)}).`,
          },
        ],
        constraintResiduals: [],
        feasibleVertices: [],
      };
    }
  }

  // Record initial feasible vertex before Phase II pivots
  const initialPt = extractDecisionPoint(tableau, basis);
  steps.push({
    iteration: 0,
    basisVars: basis.map((b) => colNames[b]),
    vertex: initialPt,
    objectiveValue: evalTrueObjective(initialPt),
    note: 'Initial basic feasible vertex.',
  });

  // Phase II objective row: minimize (sense === 'min' ? c : -c)
  for (let c = 0; c <= totalCols; c++) tableau[m][c] = 0;
  for (let j = 0; j < nVars; j++) {
    tableau[m][j] = spec.sense === 'min' ? spec.objectiveCoeffs[j] : -spec.objectiveCoeffs[j];
  }
  for (let r = 0; r < m; r++) {
    const bCol = basis[r];
    if (bCol < artStartCol && Math.abs(tableau[m][bCol]) > EPS) {
      const factor = tableau[m][bCol];
      for (let c = 0; c <= totalCols; c++) tableau[m][c] -= factor * tableau[r][c];
    }
  }

  const p2Status = runSimplex(tableau, basis, artStartCol, 'Simplex', true);
  if (p2Status === 'unbounded') {
    return {
      feasible: true,
      bounded: false,
      status: 'unbounded',
      optimalPoint: extractDecisionPoint(tableau, basis),
      optimalValue: spec.sense === 'min' ? -Infinity : Infinity,
      steps,
      constraintResiduals: [],
      feasibleVertices: computeFeasibleVertices(spec),
    };
  }

  const optimalPoint = extractDecisionPoint(tableau, basis);
  const optimalValue = evalTrueObjective(optimalPoint);
  const feasibleVertices = computeFeasibleVertices(spec);

  const constraintResiduals: ConstraintResidual[] = spec.constraints.map((c) => {
    const lhsValue = c.coeffs.reduce((acc, a, i) => acc + a * optimalPoint[i], 0);
    const diff = c.rhs - lhsValue;
    const satisfied =
      c.op === '<='
        ? lhsValue <= c.rhs + 1e-5
        : c.op === '>='
          ? lhsValue >= c.rhs - 1e-5
          : Math.abs(lhsValue - c.rhs) <= 1e-5;
    const active = Math.abs(diff) <= 1e-5;
    return {
      id: c.id,
      label: c.label,
      lhsValue,
      op: c.op,
      rhs: c.rhs,
      slackOrResidual: c.op === '>=' ? lhsValue - c.rhs : diff,
      satisfied,
      active,
    };
  });

  return {
    feasible: true,
    bounded: true,
    status: 'optimal',
    optimalPoint,
    optimalValue,
    steps,
    constraintResiduals,
    feasibleVertices,
  };
}
