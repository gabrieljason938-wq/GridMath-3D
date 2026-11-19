import { useEffect, useMemo, useState } from 'react';
import { Download, Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react';
import { KaTeXFormula } from '../KaTeXFormula';
import { StatusBadge } from '../StatusBadge';
import { Gaussian3D } from '../math3d/Gaussian3D';
import { MathLabViewport } from '../math3d/MathLabViewport';
import { solveGaussianElimination } from '../../math/gaussianElimination';

interface Props {
  datasetMode: 'microgrid' | 'benchmark';
  precision: number;
  onExport: (filename: string, payload: unknown) => void;
}

const DEFAULT_MICROGRID_A = [
  [12, -3.5, -2.0],
  [-3.5, 11, -2.5],
  [-2.0, -2.5, 10.5],
];
const DEFAULT_MICROGRID_B = [145, 120, 95];

const DEFAULT_PIVOT_A = [
  [0, 2, 1],
  [4, -1, 2],
  [2, 3, -1],
];
const DEFAULT_PIVOT_B = [7, 11, 5];

export function ExpGaussianPanel({ datasetMode, precision, onExport }: Props) {
  const baseA = datasetMode === 'benchmark' ? DEFAULT_PIVOT_A : DEFAULT_MICROGRID_A;
  const baseB = datasetMode === 'benchmark' ? DEFAULT_PIVOT_B : DEFAULT_MICROGRID_B;

  const [matrixA, setMatrixA] = useState<number[][] | null>(null);
  const [vectorB, setVectorB] = useState<number[] | null>(null);
  const A = matrixA ?? baseA;
  const b = vectorB ?? baseB;

  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const result = useMemo(() => solveGaussianElimination(A, b), [A, b]);
  const totalSteps = Math.max(1, result.steps.length);
  const clampedIdx = Math.min(stepIdx, totalSteps - 1);
  const activeStep = result.steps[clampedIdx];

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
    }, 1100);
    return () => window.clearInterval(id);
  }, [playing, totalSteps]);

  const updateA = (r: number, c: number, val: number) => {
    const next = A.map((row, ri) => row.map((v, ci) => (ri === r && ci === c ? val : v)));
    setMatrixA(next);
    setStepIdx(0);
  };

  const updateB = (r: number, val: number) => {
    const next = b.map((v, ri) => (ri === r ? val : v));
    setVectorB(next);
    setStepIdx(0);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left Matrix Editor & Playback Controls */}
      <div className="space-y-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 xl:col-span-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Augmented System [A | b]</h3>
          <button
            type="button"
            onClick={() => {
              setMatrixA(null);
              setVectorB(null);
              setStepIdx(0);
              setPlaying(false);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] dark:text-[#60A5FA] hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        <div className="space-y-2">
          {A.map((row, r) => (
            <div key={r} className="grid grid-cols-4 gap-2">
              {row.map((val, c) => (
                <input
                  key={c}
                  type="number"
                  step={0.5}
                  value={val}
                  aria-label={`A row ${r + 1} col ${c + 1}`}
                  onChange={(e) => updateA(r, c, Number(e.target.value) || 0)}
                  className="rounded-lg border border-[#E2E8F0] dark:border-[#334155] px-2 py-1.5 font-mono-tabular text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                />
              ))}
              <input
                type="number"
                step={1}
                value={b[r]}
                aria-label={`b row ${r + 1}`}
                onChange={(e) => updateB(r, Number(e.target.value) || 0)}
                className="rounded-lg border border-[#2563EB]/30 bg-[#EFF6FF]/40 dark:bg-[#60A5FA]/10 px-2 py-1.5 font-mono-tabular text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA]"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setMatrixA([
              [1, 2, 3],
              [2, 4, 6],
              [1, 1, 1],
            ]);
            setVectorB([6, 12, 3]);
            setStepIdx(0);
          }}
          className="w-full rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] px-3 py-1.5 text-xs font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
        >
          Test Singular Matrix Detection
        </button>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setStepIdx((s) => Math.max(0, s - 1));
              }}
              aria-label="Previous step"
              className="rounded border border-[#E2E8F0] dark:border-[#334155] p-1.5 text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]"
            >
              <StepBack className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] dark:border-[#334155] px-2.5 py-1 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]"
            >
              {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setStepIdx((s) => Math.min(totalSteps - 1, s + 1));
              }}
              aria-label="Next step"
              className="rounded border border-[#E2E8F0] dark:border-[#334155] p-1.5 text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]"
            >
              <StepForward className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="font-mono-tabular text-xs text-[#64748B] dark:text-[#94A3B8]">
            Step {clampedIdx + 1}/{totalSteps}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onExport('gaussian-elimination.json', result)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]"
        >
          <Download className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
          Export Elimination Trace
        </button>
      </div>

      {/* Center Formula & 3D Matrix Grid */}
      <div className="space-y-4 xl:col-span-8">
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              1. Mathematical Formula — Partial Pivoting &amp; Row Reduction
            </h3>
            <StatusBadge
              tone={result.singular ? 'deficit' : 'nominal'}
              label={result.singular ? 'Singular Matrix' : `${result.swapCount} Pivot Swap(s)`}
            />
          </div>
          <div className="mt-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] p-3">
            <KaTeXFormula
              displayMode
              tex="m_{ik} = \frac{a_{ik}^{(k)}}{a_{kk}^{(k)}}, \quad R_i \leftarrow R_i - m_{ik} R_k, \quad x_i = \frac{b_i^{(n)} - \sum_{j=i+1}^n a_{ij}^{(n)} x_j}{a_{ii}^{(n)}}"
            />
          </div>
        </div>

        <MathLabViewport
          cameraPosition={[8.5, 6.5, 9]}
          caption="3. Interactive 3D Spatial Matrix · Blue: Pivot · Cyan: Target Row · Green: RHS / Solution"
        >
          {activeStep ? (
            <Gaussian3D
              step={activeStep}
              solution={result.solution}
              size={result.size}
              precision={precision}
            />
          ) : null}
        </MathLabViewport>
      </div>

      {/* Step-by-Step Log & Residual Validation */}
      <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 xl:col-span-7">
        <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
          2. Step-by-Step Row Transformation Log
        </h3>
        <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto text-xs">
          {result.steps.map((s) => (
            <button
              key={s.stepIndex}
              type="button"
              onClick={() => {
                setPlaying(false);
                setStepIdx(s.stepIndex);
              }}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                s.stepIndex === clampedIdx
                  ? 'border-[#2563EB] dark:border-[#60A5FA] bg-[#2563EB]/6 text-[#0F172A] dark:text-[#F8FAFC]'
                  : 'border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
              }`}
            >
              <span className="font-mono-tabular">{s.stepIndex + 1}. {s.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 xl:col-span-5">
        <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
          4. Numerical Accuracy &amp; Residual Check
        </h3>
        {result.valid ? (
          <dl className="mt-3 divide-y divide-[#E2E8F0] dark:divide-[#334155] text-xs">
            <div className="flex justify-between py-2">
              <dt className="text-[#64748B] dark:text-[#94A3B8]">Solution Vector x</dt>
              <dd className="font-mono-tabular font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                [{result.solution.map((v) => v.toFixed(precision)).join(', ')}]
              </dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-[#64748B] dark:text-[#94A3B8]">Euclidean Residual ||Ax - b||₂</dt>
              <dd className="font-mono-tabular font-semibold text-[#10B981] dark:text-[#34D399]">
                {result.residualL2Norm.toExponential(3)}
              </dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-[#64748B] dark:text-[#94A3B8]">Infinity Norm ||Ax - b||∞</dt>
              <dd className="font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                {result.residualInfNorm.toExponential(3)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-400">{result.error}</p>
        )}
      </div>
    </div>
  );
}
