import { useEffect, useMemo, useState } from 'react';
import { Download, Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react';
import { KaTeXFormula } from '../KaTeXFormula';
import { StatusBadge } from '../StatusBadge';
import { Integration3D } from '../math3d/Integration3D';
import { MathLabViewport } from '../math3d/MathLabViewport';
import {
  computeNumericalIntegration,
  type IntegrationMethod,
} from '../../math/integration';
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

const benchmarkAntiderivative = (t: number) =>
  320 * t -
  ((95 * 12) / Math.PI) * Math.cos((Math.PI * t) / 12) -
  ((40 * 6) / Math.PI) * Math.sin((Math.PI * t) / 6);

export function ExpIntegrationPanel({ datasetMode, precision, onExport }: Props) {
  const activeScenario = useSimulationStore((s) => s.activeScenario);
  const [method, setMethod] = useState<IntegrationMethod>('simpson');
  const [a, setA] = useState<number>(6);
  const [b, setB] = useState<number>(20);
  const [subdivisions, setSubdivisions] = useState<number>(8);
  const [activeSliceIdx, setActiveSliceIdx] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);

  const hourlyMW = useMemo(
    () => activeScenario.hourlyDemand.map((d) => d.totalMW),
    [activeScenario],
  );

  const result = useMemo(() => {
    const fn =
      datasetMode === 'benchmark' ? benchmarkFn : (t: number) => catmullRomDemand(hourlyMW, t);
    const exactIntegral =
      datasetMode === 'benchmark'
        ? (lo: number, hi: number) => benchmarkAntiderivative(hi) - benchmarkAntiderivative(lo)
        : undefined;

    return computeNumericalIntegration({
      fn,
      exactIntegral,
      a,
      b,
      subdivisions,
      method,
    });
  }, [datasetMode, hourlyMW, a, b, subdivisions, method]);

  const totalSlices = Math.max(1, result.slices.length);
  const clampedIdx = Math.min(activeSliceIdx, totalSlices - 1);

  useEffect(() => {
    if (!playing || !result.valid) return;
    const id = window.setInterval(() => {
      setActiveSliceIdx((prev) => {
        if (prev >= totalSlices - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 850);
    return () => window.clearInterval(id);
  }, [playing, result.valid, totalSlices]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left Integration Parameters & Playback Controls */}
      <div className="space-y-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0F172A]">Quadrature Controls</h3>
          <button
            type="button"
            onClick={() => {
              setMethod('simpson');
              setA(6);
              setB(20);
              setSubdivisions(8);
              setActiveSliceIdx(0);
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
              setMethod('trapezoidal');
              setActiveSliceIdx(0);
            }}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              method === 'trapezoidal'
                ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Trapezoidal Rule
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod('simpson');
              setActiveSliceIdx(0);
            }}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              method === 'simpson'
                ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Simpson&apos;s 1/3 Rule
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="block text-xs text-[#64748B]">
            <span>Start a (h)</span>
            <input
              type="number"
              min={0}
              max={22}
              step={1}
              value={a}
              onChange={(e) => {
                setA(Math.max(0, Math.min(22, Number(e.target.value) || 0)));
                setActiveSliceIdx(0);
              }}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 font-mono-tabular text-xs text-[#0F172A]"
            />
          </label>
          <label className="block text-xs text-[#64748B]">
            <span>End b (h)</span>
            <input
              type="number"
              min={1}
              max={23}
              step={1}
              value={b}
              onChange={(e) => {
                setB(Math.max(1, Math.min(23, Number(e.target.value) || 1)));
                setActiveSliceIdx(0);
              }}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 font-mono-tabular text-xs text-[#0F172A]"
            />
          </label>
          <label className="block text-xs text-[#64748B]">
            <span>Intervals n</span>
            <input
              type="number"
              min={2}
              max={24}
              step={1}
              value={subdivisions}
              onChange={(e) => {
                setSubdivisions(Math.max(2, Math.min(24, Number(e.target.value) || 2)));
                setActiveSliceIdx(0);
              }}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 font-mono-tabular text-xs text-[#0F172A]"
            />
          </label>
        </div>

        {!result.valid ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <p className="font-medium">{result.error}</p>
            {method === 'simpson' && subdivisions % 2 !== 0 ? (
              <button
                type="button"
                onClick={() => setSubdivisions(subdivisions + 1)}
                className="mt-2 rounded border border-rose-300 bg-[#FFFFFF] px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
              >
                Adjust to Even n = {subdivisions + 1}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setActiveSliceIdx((s) => Math.max(0, s - 1));
              }}
              aria-label="Previous slice"
              className="rounded border border-[#E2E8F0] p-1.5 text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              <StepBack className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              disabled={!result.valid}
              className="inline-flex items-center gap-1 rounded border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50 whitespace-nowrap"
            >
              {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {playing ? 'Pause' : 'Accumulate'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setActiveSliceIdx((s) => Math.min(totalSlices - 1, s + 1));
              }}
              aria-label="Next slice"
              className="rounded border border-[#E2E8F0] p-1.5 text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              <StepForward className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="font-mono-tabular text-xs text-[#64748B]">
            Panel {clampedIdx + 1}/{totalSlices}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onExport('numerical-integration-mwh.json', result)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          <Download className="h-3.5 w-3.5 text-[#2563EB]" />
          Export Energy Integral (MWh)
        </button>
      </div>

      {/* Center Formula & 3D Extruded Subdivisions */}
      <div className="space-y-4 xl:col-span-8">
        <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A]">
                1. Mathematical Formula — Composite Energy Quadrature (MW → MWh)
              </h3>
              <p className="text-xs text-[#64748B]">
                Integrating instantaneous power <KaTeXFormula tex="P(t)\;[\text{MW}]" /> over time yields cumulative electrical energy strictly in <KaTeXFormula tex="\text{MWh}" />.
              </p>
            </div>
            <StatusBadge
              tone={result.valid ? 'nominal' : 'deficit'}
              label={
                result.valid
                  ? `${result.selectedEnergyMWh.toFixed(1)} MWh`
                  : 'Even n Required'
              }
            />
          </div>
          <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <KaTeXFormula
              displayMode
              tex="E_{[a,b]} = \int_a^b P(t)\,dt \;[\text{MWh}] \approx \frac{h}{3}\!\left[P_0 + 4\!\!\sum_{k\text{ odd}} P_k + 2\!\!\sum_{k\text{ even}} P_k + P_n\right], \quad h = \frac{b-a}{n}"
            />
          </div>
        </div>

        <MathLabViewport
          cameraPosition={[0, 3.6, 11.4]}
          caption="3. Interactive 3D Quadrature Slabs · Active Panel (Blue) & Accumulated Energy (Cyan MWh)"
        >
          {result.valid ? (
            <Integration3D
              result={result}
              activeStepIndex={clampedIdx}
              precision={precision}
            />
          ) : null}
        </MathLabViewport>
      </div>

      {/* Step-by-Step Slice Energy Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-7">
        <h3 className="text-sm font-semibold text-[#0F172A]">
          2. Step-by-Step Panel Energy Accumulation (MWh)
        </h3>
        {result.valid ? (
          <div className="mt-3 max-h-56 overflow-y-auto">
            <table className="w-full border-collapse text-right text-xs font-mono-tabular">
              <thead>
                <tr className="border-b border-[#E2E8F0] font-sans text-[#64748B]">
                  <th className="py-1.5 text-left font-medium">Interval [h]</th>
                  <th className="py-1.5 font-medium">P(t₀) MW</th>
                  <th className="py-1.5 font-medium">P(t₁) MW</th>
                  <th className="py-1.5 font-medium">Panel MWh</th>
                  <th className="py-1.5 font-medium text-[#2563EB]">Cumulative MWh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {result.slices.map((s) => (
                  <tr
                    key={s.index}
                    onClick={() => {
                      setPlaying(false);
                      setActiveSliceIdx(s.index);
                    }}
                    className={`cursor-pointer ${
                      s.index === clampedIdx ? 'bg-[#2563EB]/6' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <td className="py-1.5 text-left text-[#0F172A]">
                      [{s.xStart.toFixed(2)}, {s.xEnd.toFixed(2)}]
                    </td>
                    <td className="py-1.5 text-[#64748B]">{s.yStartMW.toFixed(1)}</td>
                    <td className="py-1.5 text-[#64748B]">{s.yEndMW.toFixed(1)}</td>
                    <td className="py-1.5 text-[#0F172A]">{s.sliceEnergyMWh.toFixed(precision)}</td>
                    <td className="py-1.5 font-semibold text-[#2563EB]">
                      {s.cumulativeEnergyMWh.toFixed(precision)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-xs text-rose-600">{result.error}</p>
        )}
      </div>

      {/* Quadrature Validation & Method Comparison */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-5">
        <h3 className="text-sm font-semibold text-[#0F172A]">
          4. Numerical Accuracy &amp; Method Comparison
        </h3>
        <dl className="mt-3 divide-y divide-[#E2E8F0] text-xs">
          <div className="flex justify-between py-2">
            <dt className="text-[#64748B]">Step Size h = (b - a)/n</dt>
            <dd className="font-mono-tabular text-[#0F172A]">
              {result.stepSizeH.toFixed(precision)} hours
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[#64748B]">Composite Trapezoidal Energy</dt>
            <dd className="font-mono-tabular text-[#0F172A]">
              {result.trapezoidalEnergyMWh.toFixed(precision)} MWh
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[#64748B]">Composite Simpson&apos;s 1/3 Energy</dt>
            <dd className="font-mono-tabular font-semibold text-[#2563EB]">
              {result.simpsonEnergyMWh !== null
                ? `${result.simpsonEnergyMWh.toFixed(precision)} MWh`
                : 'Requires even n'}
            </dd>
          </div>
          {result.exactEnergyMWh !== null ? (
            <>
              <div className="flex justify-between py-2">
                <dt className="text-[#64748B]">Exact Analytical Integral</dt>
                <dd className="font-mono-tabular font-semibold text-[#10B981]">
                  {result.exactEnergyMWh.toFixed(precision)} MWh
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-[#64748B]">Trapezoidal Abs Error</dt>
                <dd className="font-mono-tabular text-[#64748B]">
                  {result.trapezoidalAbsErrorMWh?.toExponential(3)} MWh
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-[#64748B]">Simpson&apos;s 1/3 Abs Error</dt>
                <dd className="font-mono-tabular font-semibold text-[#06B6D4]">
                  {result.simpsonAbsErrorMWh !== null
                    ? `${result.simpsonAbsErrorMWh.toExponential(3)} MWh`
                    : '—'}
                </dd>
              </div>
            </>
          ) : (
            <div className="py-2 text-[#64748B]">
              Analytical quadrature benchmark error comparison activates when Dataset is set to Analytical Benchmark.
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
