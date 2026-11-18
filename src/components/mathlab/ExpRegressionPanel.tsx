import { useMemo, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { KaTeXFormula } from '../KaTeXFormula';
import { StatusBadge } from '../StatusBadge';
import { MathLabViewport } from '../math3d/MathLabViewport';
import { Regression3D } from '../math3d/Regression3D';
import {
  solveLeastSquaresRegression,
  type RegressionObservation,
} from '../../math/regression';
import { useSimulationStore } from '../../store/useSimulationStore';

interface Props {
  datasetMode: 'microgrid' | 'benchmark';
  precision: number;
  onExport: (filename: string, payload: unknown) => void;
}

const ANALYTICAL_OBS: RegressionObservation[] = [
  { id: 'obs-0', label: 'Pt 1', x1: 1, x2: 2, y: 11.2 },
  { id: 'obs-1', label: 'Pt 2', x1: 2, x2: 1, y: 12.1 },
  { id: 'obs-2', label: 'Pt 3', x1: 3, x2: 4, y: 19.8 },
  { id: 'obs-3', label: 'Pt 4', x1: 4, x2: 2, y: 19.2 },
  { id: 'obs-4', label: 'Pt 5', x1: 5, x2: 5, y: 26.4 },
  { id: 'obs-5', label: 'Pt 6', x1: 6, x2: 3, y: 26.1 },
  { id: 'obs-6', label: 'Pt 7', x1: 7, x2: 6, y: 33.8 },
];

export function ExpRegressionPanel({ datasetMode, precision, onExport }: Props) {
  const activeScenario = useSimulationStore((s) => s.activeScenario);
  const [predictorCount, setPredictorCount] = useState<1 | 2>(2);
  const [selectedObsId, setSelectedObsId] = useState<string | null>(null);
  const [customObs, setCustomObs] = useState<RegressionObservation[] | null>(null);

  const baseObs = useMemo<RegressionObservation[]>(() => {
    if (datasetMode === 'benchmark') return ANALYTICAL_OBS;
    return [0, 3, 6, 9, 12, 15, 18, 21].map((hr) => {
      const d = activeScenario.hourlyDemand[hr];
      return {
        id: `hr-${hr}`,
        label: d.timestampLabel,
        x1: d.temperatureDegC,
        x2: d.hour,
        y: d.totalMW,
      };
    });
  }, [datasetMode, activeScenario]);

  const observations = customObs ?? baseObs;

  const result = useMemo(
    () => solveLeastSquaresRegression(observations, predictorCount),
    [observations, predictorCount],
  );

  const updateY = (idx: number, val: number) => {
    setCustomObs(observations.map((o, i) => (i === idx ? { ...o, y: val } : o)));
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left Method & Data Editor */}
      <div className="space-y-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0F172A]">Predictor Model &amp; Data</h3>
          <button
            type="button"
            onClick={() => {
              setCustomObs(null);
              setSelectedObsId(null);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-[#F8FAFC] p-1">
          <button
            type="button"
            onClick={() => setPredictorCount(1)}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
              predictorCount === 1
                ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            1 Predictor (Linear)
          </button>
          <button
            type="button"
            onClick={() => setPredictorCount(2)}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
              predictorCount === 2
                ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            2 Predictors (Plane)
          </button>
        </div>

        <div className="max-h-56 overflow-y-auto rounded-lg border border-[#E2E8F0]">
          <table className="w-full text-left text-xs font-mono-tabular">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] font-sans text-[#64748B]">
              <tr>
                <th className="px-2 py-1.5 font-medium">Obs</th>
                <th className="px-2 py-1.5 font-medium">x₁</th>
                {predictorCount === 2 ? <th className="px-2 py-1.5 font-medium">x₂</th> : null}
                <th className="px-2 py-1.5 font-medium">y</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {observations.map((obs, idx) => (
                <tr
                  key={obs.id}
                  onClick={() => setSelectedObsId(obs.id)}
                  className={`cursor-pointer ${
                    selectedObsId === obs.id ? 'bg-[#2563EB]/6' : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  <td className="px-2 py-1 text-[#0F172A]">{obs.label}</td>
                  <td className="px-2 py-1 text-[#64748B]">{obs.x1.toFixed(1)}</td>
                  {predictorCount === 2 ? (
                    <td className="px-2 py-1 text-[#64748B]">{(obs.x2 ?? 0).toFixed(1)}</td>
                  ) : null}
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step={5}
                      value={obs.y}
                      onChange={(e) => updateY(idx, Number(e.target.value) || 0)}
                      className="w-20 rounded border border-[#E2E8F0] px-1.5 py-0.5 text-xs text-[#0F172A]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={() => onExport('least-squares-qr.json', result)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          <Download className="h-3.5 w-3.5 text-[#2563EB]" />
          Export Regression Diagnostics
        </button>
      </div>

      {/* Center Formula & 3D Regression Visualization */}
      <div className="space-y-4 xl:col-span-8">
        <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#0F172A]">
              1. Mathematical Formula — Householder QR Least Squares &amp; Normal Equations
            </h3>
            <StatusBadge
              tone={result.valid ? 'nominal' : 'deficit'}
              label={result.valid ? 'QR Factorized' : 'Rank Deficient'}
            />
          </div>
          <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <KaTeXFormula
              displayMode
              tex="X = QR \implies R\boldsymbol{\beta} = Q^T\mathbf{y}, \qquad \text{Normal Eqs (Educational): } (X^T X)\boldsymbol{\beta} = X^T\mathbf{y}"
            />
          </div>
        </div>

        <MathLabViewport
          cameraPosition={predictorCount === 1 ? [0, 3, 10.5] : [8.5, 6.2, 9]}
          caption={
            predictorCount === 1
              ? '3. Embedded 2D Regression Line & Vertical Residuals (1 Predictor)'
              : '3. Interactive 3D Regression Plane & Vertical Residuals (2 Predictors)'
          }
        >
          {result.valid ? (
            <Regression3D
              observations={observations}
              result={result}
              selectedObsId={selectedObsId}
              onSelectObs={setSelectedObsId}
              precision={precision}
            />
          ) : null}
        </MathLabViewport>
      </div>

      {/* Step-by-Step Normal Matrix + Residual Diagnostics */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-7">
        <h3 className="text-sm font-semibold text-[#0F172A]">
          2. Fitted Parameters &amp; Educational Normal Equations Matrix XᵀX
        </h3>
        {result.valid ? (
          <div className="mt-3 space-y-3 text-xs">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 font-mono-tabular text-[#0F172A]">
              {predictorCount === 1
                ? `ŷ = ${result.coefficients[0].toFixed(precision)} + (${result.coefficients[1].toFixed(precision)})·x₁`
                : `ŷ = ${result.coefficients[0].toFixed(precision)} + (${result.coefficients[1].toFixed(precision)})·x₁ + (${result.coefficients[2].toFixed(precision)})·x₂`}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right font-mono-tabular">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                    <th className="py-1.5 text-left font-sans font-medium">Row</th>
                    {result.normalMatrixXTX[0].map((_, j) => (
                      <th key={j} className="py-1.5 font-medium">
                        (XᵀX)_{j}
                      </th>
                    ))}
                    <th className="py-1.5 font-medium text-[#2563EB]">Xᵀy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {result.normalMatrixXTX.map((row, i) => (
                    <tr key={i}>
                      <td className="py-1.5 text-left text-[#64748B]">β_{i}</td>
                      {row.map((val, j) => (
                        <td key={j} className="py-1.5 text-[#0F172A]">
                          {val.toFixed(1)}
                        </td>
                      ))}
                      <td className="py-1.5 font-semibold text-[#2563EB]">
                        {result.normalVectorXTy[i].toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-rose-600">{result.error}</p>
        )}
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 xl:col-span-5">
        <h3 className="text-sm font-semibold text-[#0F172A]">
          4. Numerical Accuracy &amp; Residual Metrics
        </h3>
        <dl className="mt-3 divide-y divide-[#E2E8F0] text-xs">
          <div className="flex justify-between py-2">
            <dt className="text-[#64748B]">Mean Absolute Error (MAE)</dt>
            <dd className="font-mono-tabular font-semibold text-[#0F172A]">
              {result.mae.toFixed(precision)}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[#64748B]">Root Mean Squared Error (RMSE)</dt>
            <dd className="font-mono-tabular font-semibold text-[#2563EB]">
              {result.rmse.toFixed(precision)}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[#64748B]">R² Coefficient</dt>
            <dd className="font-mono-tabular font-semibold text-[#10B981]">
              {result.rSquared.toFixed(precision)}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[#64748B]">QR Orthogonality ||QᵀQ - I||_F</dt>
            <dd className="font-mono-tabular text-[#06B6D4]">
              {result.qrOrthogonalityError.toExponential(3)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
