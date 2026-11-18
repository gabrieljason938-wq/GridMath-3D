import { useEffect, useMemo, useState } from 'react';
import { Download, Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react';
import { KaTeXFormula } from '../KaTeXFormula';
import { StatusBadge } from '../StatusBadge';
import { LinearProgramming3D } from '../math3d/LinearProgramming3D';
import { MathLabViewport } from '../math3d/MathLabViewport';
import {
  solveLinearProgram,
  type LinearProgramSpec,
} from '../../math/linearProgramming';
import { useSimulationStore } from '../../store/useSimulationStore';

interface Props {
  datasetMode: 'microgrid' | 'benchmark';
  precision: number;
  onExport: (filename: string, payload: unknown) => void;
}

export function ExpLinearProgrammingPanel({ datasetMode, precision, onExport }: Props) {
  const activeHourlyDemand = useSimulationStore((s) => s.activeHourlyDemand);
  const [dimension, setDimension] = useState<2 | 3>(2);
  const [customSpec, setCustomSpec] = useState<LinearProgramSpec | null>(null);
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);

  const defaultSpec = useMemo<LinearProgramSpec>(() => {
    const demandTarget =
      datasetMode === 'benchmark'
        ? 220
        : Math.max(180, Math.round(activeHourlyDemand.totalMW * 0.72));

    if (dimension === 2) {
      return {
        sense: 'min',
        variableNames: ['x₁ (Solar MW)', 'x₂ (Gas MW)'],
        objectiveCoeffs: [1650, 4800],
        constraints: [
          {
            id: 'demand',
            label: 'x₁ + x₂ ≥ Demand Target',
            coeffs: [1, 1],
            op: '>=',
            rhs: demandTarget,
          },
          {
            id: 'solar-cap',
            label: 'Solar Capacity Limit x₁ ≤ U₁',
            coeffs: [1, 0],
            op: '<=',
            rhs: 165,
          },
          {
            id: 'gas-cap',
            label: 'Gas Turbine Limit x₂ ≤ U₂',
            coeffs: [0, 1],
            op: '<=',
            rhs: 220,
          },
          {
            id: 'co2-cap',
            label: 'Emissions 0.04x₁ + 0.55x₂ ≤ E_max',
            coeffs: [0.04, 0.55],
            op: '<=',
            rhs: 85,
          },
        ],
      };
    }

    return {
      sense: 'min',
      variableNames: ['x₁ (Solar)', 'x₂ (Gas)', 'x₃ (BESS)'],
      objectiveCoeffs: [1650, 4800, 2900],
      constraints: [
        {
          id: 'demand-3d',
          label: 'x₁ + x₂ + x₃ ≥ Demand Target',
          coeffs: [1, 1, 1],
          op: '>=',
          rhs: Math.max(200, demandTarget),
        },
        {
          id: 'cap-1',
          label: 'Solar Limit x₁ ≤ 150',
          coeffs: [1, 0, 0],
          op: '<=',
          rhs: 150,
        },
        {
          id: 'cap-2',
          label: 'Gas Limit x₂ ≤ 190',
          coeffs: [0, 1, 0],
          op: '<=',
          rhs: 190,
        },
        {
          id: 'cap-3',
          label: 'BESS Discharge x₃ ≤ 75',
          coeffs: [0, 0, 1],
          op: '<=',
          rhs: 75,
        },
        {
          id: 'co2-3d',
          label: 'Emissions 0.04x₁ + 0.55x₂ + 0.08x₃ ≤ 72',
          coeffs: [0.04, 0.55, 0.08],
          op: '<=',
          rhs: 72,
        },
      ],
    };
  }, [dimension, datasetMode, activeHourlyDemand.totalMW]);

  const spec = customSpec ?? defaultSpec;
  const result = useMemo(() => solveLinearProgram(spec), [spec]);

  const totalSteps = Math.max(1, result.steps.length);
  const clampedIdx = Math.min(stepIdx, totalSteps - 1);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setStepIdx((prev) => {
        if (prev >= totalSteps - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 950);
    return () => window.clearInterval(id);
  }, [playing, totalSteps]);

  const updateObjective = (idx: number, val: number) => {
    const nextCoeffs = spec.objectiveCoeffs.map((c, i) => (i === idx ? val : c));
    setCustomSpec({ ...spec, objectiveCoeffs: nextCoeffs });
    setStepIdx(0);
  };

  const updateRhs = (idx: number, val: number) => {
    const nextCons = spec.constraints.map((c, i) => (i === idx ? { ...c, rhs: val } : c));
    setCustomSpec({ ...spec, constraints: nextCons });
    setStepIdx(0);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left LP Formulation Controls */}
      <div className="space-y-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0F172A]">Simplex Dispatch Problem</h3>
          <button
            type="button"
            onClick={() => {
              setCustomSpec(null);
              setStepIdx(0);
              setPlaying(false);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-[#F8FAFC] p-1">
          <button
            type="button"
            onClick={() => {
              setDimension(2);
              setCustomSpec(null);
              setStepIdx(0);
            }}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              dimension === 2
                ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            2-Var Polygon LP
          </button>
          <button
            type="button"
            onClick={() => {
              setDimension(3);
              setCustomSpec(null);
              setStepIdx(0);
            }}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              dimension === 3
                ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            3-Var Polyhedron LP
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-[#64748B]">Objective Cost Coefficients (INR/MWh)</p>
          <div className={`grid gap-2 ${dimension === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {spec.objectiveCoeffs.map((coeff, i) => (
              <label key={i} className="block text-[11px] text-[#64748B]">
                <span className="truncate block">{spec.variableNames[i]}</span>
                <input
                  type="number"
                  step={100}
                  value={coeff}
                  onChange={(e) => updateObjective(i, Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded border border-[#E2E8F0] px-2 py-1 font-mono-tabular text-xs text-[#0F172A]"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-[#64748B]">Constraint Bounds (RHS)</p>
          <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
            {spec.constraints.map((c, idx) => (
              <label
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs"
              >
                <span className="truncate text-[#0F172A]">{c.label}</span>
                <input
                  type="number"
                  step={5}
                  value={c.rhs}
                  onChange={(e) => updateRhs(idx, Number(e.target.value) || 0)}
                  className="w-20 shrink-0 rounded border border-[#E2E8F0] px-2 py-0.5 text-right font-mono-tabular text-xs text-[#2563EB]"
                />
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const infeasibleSpec: LinearProgramSpec = {
              ...spec,
              constraints: spec.constraints.map((c, i) =>
                i === 0 ? { ...c, rhs: 950 } : c,
              ),
            };
            setCustomSpec(infeasibleSpec);
            setStepIdx(0);
          }}
          className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A]"
        >
          Test Infeasible Demand Detection
        </button>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setStepIdx((s) => Math.max(0, s - 1));
              }}
              aria-label="Previous Simplex step"
              className="rounded border border-[#E2E8F0] p-1.5 text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              <StepBack className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              disabled={!result.feasible}
              className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50 whitespace-nowrap"
            >
              {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {playing ? 'Pause' : 'Play Path'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setStepIdx((s) => Math.min(totalSteps - 1, s + 1));
              }}
              aria-label="Next Simplex step"
              className="rounded border border-[#E2E8F0] p-1.5 text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              <StepForward className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="font-mono-tabular text-xs text-[#64748B]">
            Iter {clampedIdx + 1}/{totalSteps}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onExport('linear-programming-simplex.json', { spec, result })}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          <Download className="h-3.5 w-3.5 text-[#2563EB]" />
          Export Simplex Solution
        </button>
      </div>

      {/* Center Formula & 3D Polytope Visualization */}
      <div className="space-y-4 xl:col-span-8">
        <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A]">
                1. Mathematical Formula — Two-Phase Simplex Linear Programming
              </h3>
              <p className="text-xs text-[#64748B]">
                Exact Two-Phase Simplex computes optimal dispatch <KaTeXFormula tex="\mathbf{x}^*" />; the 3D viewport renders the feasible {dimension === 2 ? 'polygon & cost plane' : 'polyhedron'} and Simplex vertex path.
              </p>
            </div>
            <StatusBadge
              tone={result.status === 'optimal' ? 'nominal' : 'deficit'}
              label={
                result.status === 'optimal'
                  ? `Optimal Z* = ₹${Math.round(result.optimalValue).toLocaleString('en-IN')}`
                  : result.status.toUpperCase()
              }
            />
          </div>
          <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <KaTeXFormula
              displayMode
              tex="\min_{\mathbf{x} \ge 0} \; Z = \mathbf{c}^T \mathbf{x} \quad \text{subject to} \quad A\mathbf{x} \lesseqgtr \mathbf{b}, \quad \bar{c}_j = c_j - \mathbf{c}_B^T B^{-1} \mathbf{a}_j \ge 0"
            />
          </div>
        </div>

        <MathLabViewport
          cameraPosition={dimension === 2 ? [7.5, 6.2, 8.5] : [8.5, 6.8, 9.2]}
          caption={`3. Interactive 3D Feasible ${dimension === 2 ? 'Polygon & Objective Cost Plane' : 'Polyhedron'} · Green Octahedron: Optimal Vertex`}
        >
          <LinearProgramming3D
            spec={spec}
            result={result}
            activeStepIndex={clampedIdx}
            precision={precision}
          />
        </MathLabViewport>
      </div>

      {/* Step-by-Step Simplex Vertex Log & Constraint Verification */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-5">
        <h3 className="text-sm font-semibold text-[#0F172A]">
          2. Step-by-Step Simplex Vertex Traversal
        </h3>
        <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto text-xs">
          {result.steps.map((s) => (
            <button
              key={s.iteration}
              type="button"
              onClick={() => {
                setPlaying(false);
                setStepIdx(s.iteration);
              }}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                s.iteration === clampedIdx
                  ? 'border-[#2563EB] bg-[#2563EB]/6 text-[#0F172A]'
                  : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center justify-between font-mono-tabular">
                <span className="font-semibold text-[#0F172A]">
                  Iter {s.iteration}: ({s.vertex.map((v) => v.toFixed(1)).join(', ')})
                </span>
                <span className="text-[#2563EB]">₹{s.objectiveValue.toFixed(0)}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#64748B]">{s.note}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-7">
        <h3 className="text-sm font-semibold text-[#0F172A]">
          4. Constraint Residuals &amp; Active (Binding) Verification
        </h3>
        {result.feasible && result.bounded ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-right text-xs font-mono-tabular">
              <thead>
                <tr className="border-b border-[#E2E8F0] font-sans text-[#64748B]">
                  <th className="py-1.5 text-left font-medium">Constraint</th>
                  <th className="py-1.5 font-medium">LHS(x*)</th>
                  <th className="py-1.5 font-medium">Op</th>
                  <th className="py-1.5 font-medium">RHS</th>
                  <th className="py-1.5 font-medium">Slack</th>
                  <th className="py-1.5 text-left pl-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {result.constraintResiduals.map((cr) => (
                  <tr key={cr.id}>
                    <td className="py-1.5 text-left font-sans text-[#0F172A]">{cr.label}</td>
                    <td className="py-1.5 text-[#0F172A]">{cr.lhsValue.toFixed(precision)}</td>
                    <td className="py-1.5 text-[#64748B]">{cr.op}</td>
                    <td className="py-1.5 text-[#64748B]">{cr.rhs.toFixed(2)}</td>
                    <td className="py-1.5 text-[#2563EB]">
                      {cr.slackOrResidual.toFixed(precision)}
                    </td>
                    <td className="py-1.5 pl-3 text-left font-sans">
                      <StatusBadge
                        tone={cr.satisfied ? (cr.active ? 'info' : 'nominal') : 'deficit'}
                        label={cr.active ? 'Binding' : cr.satisfied ? 'Feasible' : 'Violated'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            No feasible solution exists under the current constraint set ({result.status}). Reduce demand RHS or relax capacity/emissions caps.
          </div>
        )}
      </div>
    </div>
  );
}
