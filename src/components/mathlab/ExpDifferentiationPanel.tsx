import { useEffect, useMemo, useState } from 'react';
import { Download, Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react';
import { KaTeXFormula } from '../KaTeXFormula';
import { StatusBadge } from '../StatusBadge';
import { Differentiation3D } from '../math3d/Differentiation3D';
import { MathLabViewport } from '../math3d/MathLabViewport';
import {
  computeNumericalDifferentiation,
  type FiniteDiffMethod,
} from '../../math/differentiation';
import { useSimulationStore } from '../../store/useSimulationStore';

interface Props {
  datasetMode: 'microgrid' | 'benchmark';
  precision: number;
  onExport: (filename: string, payload: unknown) => void;
}

function catmullRomDemand(hourlyValues: number[], t: number): number {
  const clamped = Math.max(0, Math.min(23, t));
  const i = Math.min(22, Math.floor(clamped));
  const u = clamped - i;

  const p0 = hourlyValues[Math.max(0, i - 1)];
  const p1 = hourlyValues[i];
  const p2 = hourlyValues[Math.min(23, i + 1)];
  const p3 = hourlyValues[Math.min(23, i + 2)];

  const u2 = u * u;
  const u3 = u2 * u;

  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  );
}

const benchmarkFn = (t: number) =>
  320 + 95 * Math.sin((Math.PI * t) / 12) - 40 * Math.cos((Math.PI * t) / 6);

const benchmarkExactDfn = (t: number) =>
  ((95 * Math.PI) / 12) * Math.cos((Math.PI * t) / 12) +
  ((40 * Math.PI) / 6) * Math.sin((Math.PI * t) / 6);

export function ExpDifferentiationPanel({ datasetMode, precision, onExport }: Props) {
  const activeScenario = useSimulationStore((s) => s.activeScenario);
  const [method, setMethod] = useState<FiniteDiffMethod>('central');
  const [x0, setX0] = useState<number>(8);
  const [stepH, setStepH] = useState<number>(1.0);
  const [playing, setPlaying] = useState(false);

  const hourlyMW = useMemo(
    () => activeScenario.hourlyDemand.map((d) => d.totalMW),
    [activeScenario],
  );

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setX0((prev) => {
        if (prev >= 22) {
          setPlaying(false);
          return 22;
        }
        return Number((prev + 1).toFixed(2));
      });
    }, 850);
    return () => window.clearInterval(id);
  }, [playing]);

  const result = useMemo(() => {
    const fn =
      datasetMode === 'benchmark' ? benchmarkFn : (t: number) => catmullRomDemand(hourlyMW, t);
    const exactDfn = datasetMode === 'benchmark' ? benchmarkExactDfn : undefined;

    return computeNumericalDifferentiation({
      fn,
      exactDfn,
      x0,
      h: stepH,
      method,
      xMin: 0,
      xMax: 23,
    });
  }, [datasetMode, hourlyMW, x0, stepH, method]);

  const trendTone =
    result.demandTrend === 'rising'
      ? 'nominal'
      : result.demandTrend === 'falling'
        ? 'warning'
        : 'info';

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left Parameters & Playback Controls */}
      <div className="space-y-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0F172A]">Finite Difference Parameters</h3>
          <button
            type="button"
            onClick={() => {
              setMethod('central');
              setX0(8);
              setStepH(1.0);
              setPlaying(false);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#F8FAFC] p-1">
          {(['forward', 'backward', 'central'] as FiniteDiffMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`rounded-md py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                method === m
                  ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-[#64748B]">
            <span>Evaluation Point t₀ (h)</span>
            <input
              type="number"
              min={1}
              max={22}
              step={0.5}
              value={x0}
              onChange={(e) => {
                setPlaying(false);
                setX0(Math.max(1, Math.min(22, Number(e.target.value) || 1)));
              }}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 font-mono-tabular text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
            />
          </label>
          <label className="block text-xs text-[#64748B]">
            <span>Step Size h (hours)</span>
            <input
              type="number"
              min={0.05}
              max={4}
              step={0.1}
              value={stepH}
              onChange={(e) => setStepH(Math.max(0.05, Math.min(4, Number(e.target.value) || 0.5)))}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 font-mono-tabular text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
            />
          </label>
        </div>

        <div className="space-y-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-[#64748B]">P(t₀ - h)</span>
            <span className="font-mono-tabular text-[#0F172A]">
              {result.fxMinus.toFixed(precision)} MW
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748B]">P(t₀)</span>
            <span className="font-mono-tabular font-semibold text-[#2563EB]">
              {result.fx0.toFixed(precision)} MW
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748B]">P(t₀ + h)</span>
            <span className="font-mono-tabular text-[#0F172A]">
              {result.fxPlus.toFixed(precision)} MW
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setX0((prev) => Math.max(1, Number((prev - 1).toFixed(2))));
              }}
              aria-label="Previous hour"
              className="rounded border border-[#E2E8F0] p-1.5 text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              <StepBack className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap"
            >
              {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {playing ? 'Pause Sweep' : 'Sweep t₀'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setX0((prev) => Math.min(22, Number((prev + 1).toFixed(2))));
              }}
              aria-label="Next hour"
              className="rounded border border-[#E2E8F0] p-1.5 text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              <StepForward className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onExport('numerical-differentiation.json', result)}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5 text-[#2563EB]" />
            Export
          </button>
        </div>
      </div>

      {/* Center Formula & 3D Demand Curve */}
      <div className="space-y-4 xl:col-span-8">
        <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A]">
                1. Mathematical Formula — Finite Difference Demand Ramp Rate (MW/h)
              </h3>
              <p className="text-xs text-[#64748B]">
                Emerald segments mark rising load (<KaTeXFormula tex="P'(t) > 0" />); amber segments mark falling load (<KaTeXFormula tex="P'(t) < 0" />).
              </p>
            </div>
            <StatusBadge
              tone={trendTone}
              label={`${result.demandTrend.toUpperCase()} · ${result.selectedSlope >= 0 ? '+' : ''}${result.selectedSlope.toFixed(2)} MW/h`}
            />
          </div>
          <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <KaTeXFormula
              displayMode
              tex="D_+(t_0) = \frac{P(t_0+h)-P(t_0)}{h} + \mathcal{O}(h), \quad D_-(t_0) = \frac{P(t_0)-P(t_0-h)}{h} + \mathcal{O}(h), \quad D_c(t_0) = \frac{P(t_0+h)-P(t_0-h)}{2h} + \mathcal{O}(h^2)"
            />
          </div>
        </div>

        <MathLabViewport
          cameraPosition={[0, 3.1, 11.2]}
          caption="3. Interactive 3D Demand Curve · Blue: Tangent Line · Cyan: Secant · Green/Amber: Rising/Falling Ramp"
        >
          <Differentiation3D result={result} precision={precision} />
        </MathLabViewport>
      </div>

      {/* Step-by-Step Quotient Calculation & Truncation Error Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-5">
        <h3 className="text-sm font-semibold text-[#0F172A]">
          2. Step-by-Step Numerical Derivative (t₀ = {x0}, h = {result.h.toFixed(2)})
        </h3>
        <dl className="mt-3 divide-y divide-[#E2E8F0] text-xs">
          <div className="flex justify-between py-2">
            <dt className="text-[#64748B]">Forward Difference D₊(t₀)</dt>
            <dd className="font-mono-tabular text-[#0F172A]">
              {result.forwardDiff.toFixed(precision)} MW/h
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[#64748B]">Backward Difference D₋(t₀)</dt>
            <dd className="font-mono-tabular text-[#0F172A]">
              {result.backwardDiff.toFixed(precision)} MW/h
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[#64748B]">Central Difference D_c(t₀)</dt>
            <dd className="font-mono-tabular font-semibold text-[#2563EB]">
              {result.centralDiff.toFixed(precision)} MW/h
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[#64748B]">Selected Estimator ({method})</dt>
            <dd className="font-mono-tabular font-semibold text-[#10B981]">
              {result.selectedSlope.toFixed(precision)} MW/h
            </dd>
          </div>
          {result.exactDerivative !== null ? (
            <div className="flex justify-between py-2">
              <dt className="text-[#64748B]">Analytical P&apos;(t₀)</dt>
              <dd className="font-mono-tabular font-semibold text-[#06B6D4]">
                {result.exactDerivative.toFixed(precision)} MW/h
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-7">
        <h3 className="text-sm font-semibold text-[#0F172A]">
          4. Step-Size Refinement &amp; Truncation Error Analysis (h, h/2, h/4)
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-right text-xs font-mono-tabular">
            <thead>
              <tr className="border-b border-[#E2E8F0] font-sans text-[#64748B]">
                <th className="py-2 text-left font-medium">Step h</th>
                <th className="py-2 font-medium">Forward</th>
                <th className="py-2 font-medium">Backward</th>
                <th className="py-2 font-medium text-[#2563EB]">Central</th>
                <th className="py-2 font-medium">Fwd |Err|</th>
                <th className="py-2 font-medium text-[#10B981]">Cen |Err|</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {result.stepSizeComparison.map((row) => (
                <tr key={row.h}>
                  <td className="py-2 text-left text-[#0F172A]">{row.h.toFixed(4)}</td>
                  <td className="py-2 text-[#64748B]">{row.forwardDiff.toFixed(precision)}</td>
                  <td className="py-2 text-[#64748B]">{row.backwardDiff.toFixed(precision)}</td>
                  <td className="py-2 font-semibold text-[#2563EB]">
                    {row.centralDiff.toFixed(precision)}
                  </td>
                  <td className="py-2 text-[#64748B]">
                    {row.forwardError !== null ? row.forwardError.toExponential(2) : '—'}
                  </td>
                  <td className="py-2 font-semibold text-[#10B981]">
                    {row.centralError !== null ? row.centralError.toExponential(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {datasetMode === 'microgrid' ? (
          <p className="mt-2 text-xs text-[#64748B]">
            Switch Dataset to Analytical Benchmark to inspect exact <KaTeXFormula tex="\mathcal{O}(h)" /> vs <KaTeXFormula tex="\mathcal{O}(h^2)" /> truncation error decay.
          </p>
        ) : null}
      </div>
    </div>
  );
}
