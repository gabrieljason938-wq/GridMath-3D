import { useMemo, useState } from 'react';
import { Download, Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react';
import { KaTeXFormula } from '../KaTeXFormula';
import { StatusBadge } from '../StatusBadge';
import { Interpolation3D } from '../math3d/Interpolation3D';
import { MathLabViewport } from '../math3d/MathLabViewport';
import {
  computeNewtonDividedDifference,
  type InterpolationPoint,
} from '../../math/interpolation';
import { useSimulationStore } from '../../store/useSimulationStore';

interface Props {
  datasetMode: 'microgrid' | 'benchmark';
  precision: number;
  onExport: (filename: string, payload: unknown) => void;
}

const BENCHMARK_POINTS: InterpolationPoint[] = [
  { x: 0, y: 1.0 },
  { x: 1, y: 2.7183 },
  { x: 2, y: 7.3891 },
  { x: 3, y: 20.0855 },
  { x: 4, y: 54.5982 },
];

export function ExpInterpolationPanel({ datasetMode, precision, onExport }: Props) {
  const activeScenario = useSimulationStore((s) => s.activeScenario);

  const defaultPoints = useMemo<InterpolationPoint[]>(() => {
    if (datasetMode === 'benchmark') return BENCHMARK_POINTS;
    return [0, 4, 8, 12, 16, 20].map((hr) => ({
      x: hr,
      y: activeScenario.hourlyDemand[hr].totalMW,
    }));
  }, [datasetMode, activeScenario]);

  const [customPoints, setCustomPoints] = useState<InterpolationPoint[] | null>(null);
  const points = customPoints ?? defaultPoints;
  const [queryX, setQueryX] = useState<number>(datasetMode === 'benchmark' ? 2.5 : 14);
  const [activeOrder, setActiveOrder] = useState<number>(1);
  const [playing, setPlaying] = useState(false);

  const exactFn = datasetMode === 'benchmark' ? (x: number) => Math.exp(x) : undefined;
  const result = useMemo(
    () => computeNewtonDividedDifference(points, queryX, exactFn),
    [points, queryX, exactFn],
  );

  const maxOrder = Math.max(1, points.length - 1);

  const updatePoint = (idx: number, field: 'x' | 'y', val: number) => {
    const next = points.map((p, i) => (i === idx ? { ...p, [field]: val } : p));
    setCustomPoints(next);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left Control & Editable Input Panel */}
      <div className="space-y-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0F172A]">Editable Nodes &amp; Query</h3>
          <button
            type="button"
            onClick={() => {
              setCustomPoints(null);
              setQueryX(datasetMode === 'benchmark' ? 2.5 : 14);
              setActiveOrder(1);
              setPlaying(false);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        <label className="block text-xs text-[#64748B]">
          <span>Query Coordinate x* ({datasetMode === 'benchmark' ? 'dimensionless' : 'hour'})</span>
          <input
            type="number"
            step={0.25}
            value={queryX}
            onChange={(e) => setQueryX(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 font-mono-tabular text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
          />
        </label>

        <div className="max-h-56 overflow-y-auto rounded-lg border border-[#E2E8F0]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]">
              <tr>
                <th className="px-2.5 py-1.5 font-medium">i</th>
                <th className="px-2.5 py-1.5 font-medium">xᵢ</th>
                <th className="px-2.5 py-1.5 font-medium">f(xᵢ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-mono-tabular">
              {points.map((pt, idx) => (
                <tr key={idx}>
                  <td className="px-2.5 py-1 text-[#64748B]">{idx}</td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step={0.5}
                      value={pt.x}
                      onChange={(e) => updatePoint(idx, 'x', Number(e.target.value) || 0)}
                      className="w-20 rounded border border-[#E2E8F0] px-1.5 py-0.5 text-xs text-[#0F172A]"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step={1}
                      value={pt.y}
                      onChange={(e) => updatePoint(idx, 'y', Number(e.target.value) || 0)}
                      className="w-24 rounded border border-[#E2E8F0] px-1.5 py-0.5 text-xs text-[#0F172A]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Step Controls for Divided Difference Order */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveOrder((o) => Math.max(1, o - 1))}
              aria-label="Previous divided difference order"
              className="rounded border border-[#E2E8F0] p-1.5 text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              <StepBack className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              Order {activeOrder}/{maxOrder}
            </button>
            <button
              type="button"
              onClick={() => setActiveOrder((o) => Math.min(maxOrder, o + 1))}
              aria-label="Next divided difference order"
              className="rounded border border-[#E2E8F0] p-1.5 text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              <StepForward className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onExport('newton-interpolation.json', result)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
          >
            <Download className="h-3.5 w-3.5 text-[#2563EB]" />
            Export
          </button>
        </div>
      </div>

      {/* Center 3D Visualization + Mathematical Formula */}
      <div className="space-y-4 xl:col-span-8">
        <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A]">
                1. Mathematical Formula — Newton Divided Difference Polynomial
              </h3>
              <p className="text-xs text-[#64748B]">
                Note: The mathematical function y = P(x) is strictly two-dimensional, displayed on an embedded coordinate plane in 3D space.
              </p>
            </div>
            <StatusBadge
              tone={result.valid ? 'nominal' : 'deficit'}
              label={result.valid ? `Degree ${points.length - 1}` : 'Invalid Nodes'}
            />
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <KaTeXFormula
              displayMode
              tex="P_{n-1}(x) = b_0 + \sum_{k=1}^{n-1} f[x_0, x_1, \dots, x_k] \prod_{j=0}^{k-1} (x - x_j), \quad f[x_i,\dots,x_{i+k}] = \frac{f[x_{i+1},\dots,x_{i+k}] - f[x_i,\dots,x_{i+k-1}]}{x_{i+k} - x_i}"
            />
          </div>
        </div>

        <MathLabViewport
          cameraPosition={[0, 3.2, 11.5]}
          caption="3. Interactive 3D Visualization · 2D Polynomial on Coordinate Plane"
        >
          {result.valid ? <Interpolation3D result={result} precision={precision} /> : null}
        </MathLabViewport>
      </div>

      {/* Bottom Synchronized Panels: Step-by-Step Solution + Numerical Accuracy */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-7">
        <h3 className="text-sm font-semibold text-[#0F172A]">
          2. Step-by-Step Divided Difference Table
        </h3>
        {result.valid ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs font-mono-tabular">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                  <th className="py-2 pr-3 font-medium">Order k</th>
                  <th className="py-2 pr-3 font-medium">Term</th>
                  <th className="py-2 pr-3 text-right font-medium">Numerator</th>
                  <th className="py-2 pr-3 text-right font-medium">Δx</th>
                  <th className="py-2 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {result.steps
                  .filter((s) => s.order <= activeOrder || !playing)
                  .slice(0, 12)
                  .map((s, idx) => (
                    <tr key={idx} className={s.order === activeOrder ? 'bg-[#2563EB]/6' : ''}>
                      <td className="py-1.5 pr-3 text-[#64748B]">{s.order}</td>
                      <td className="py-1.5 pr-3 text-[#0F172A]">
                        [{s.startIndex}..{s.endIndex}]
                      </td>
                      <td className="py-1.5 pr-3 text-right text-[#64748B]">
                        {s.numerator.toFixed(precision)}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-[#64748B]">
                        {s.denominator.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-right font-semibold text-[#2563EB]">
                        {s.value.toFixed(precision)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-xs text-rose-600">{result.error}</p>
        )}
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-5">
        <h3 className="text-sm font-semibold text-[#0F172A]">
          4. Numerical Accuracy &amp; Validation
        </h3>
        <dl className="mt-3 divide-y divide-[#E2E8F0] text-xs">
          <div className="flex justify-between py-2">
            <dt className="text-[#64748B]">Evaluated P(x*)</dt>
            <dd className="font-mono-tabular font-semibold text-[#2563EB]">
              {result.interpolatedY.toFixed(precision)}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[#64748B]">Max Node Collocation Residual</dt>
            <dd className="font-mono-tabular font-semibold text-[#10B981]">
              {result.maxNodeResidual.toExponential(3)}
            </dd>
          </div>
          {result.exactBenchmarkY !== null ? (
            <>
              <div className="flex justify-between py-2">
                <dt className="text-[#64748B]">Exact Benchmark exp(x*)</dt>
                <dd className="font-mono-tabular text-[#0F172A]">
                  {result.exactBenchmarkY.toFixed(precision)}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-[#64748B]">Absolute Interpolation Error</dt>
                <dd className="font-mono-tabular font-semibold text-[#06B6D4]">
                  {result.benchmarkError?.toExponential(3)}
                </dd>
              </div>
            </>
          ) : (
            <div className="py-2 text-[#64748B]">
              Analytical error comparison available when switching Dataset to Analytical Benchmark (exp(x)).
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
