import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { ExpDifferentiationPanel } from '../components/mathlab/ExpDifferentiationPanel';
import { ExpGaussianPanel } from '../components/mathlab/ExpGaussianPanel';
import { ExpIntegrationPanel } from '../components/mathlab/ExpIntegrationPanel';
import { ExpInterpolationPanel } from '../components/mathlab/ExpInterpolationPanel';
import { ExpLinearProgrammingPanel } from '../components/mathlab/ExpLinearProgrammingPanel';
import { ExpRegressionPanel } from '../components/mathlab/ExpRegressionPanel';
import { useSimulationStore } from '../store/useSimulationStore';

type ExperimentId =
  | 'interpolation'
  | 'gaussian'
  | 'regression'
  | 'differentiation'
  | 'integration'
  | 'lp';

const EXPERIMENTS: { id: ExperimentId; code: string; label: string; subtitle: string }[] = [
  {
    id: 'interpolation',
    code: 'EXP 01',
    label: 'Newton Interpolation',
    subtitle: 'Divided Differences & 2D Plane',
  },
  {
    id: 'gaussian',
    code: 'EXP 02',
    label: 'Gaussian Elimination',
    subtitle: 'Partial Pivoting & Residual Check',
  },
  {
    id: 'regression',
    code: 'EXP 03',
    label: 'Least Squares QR',
    subtitle: '1D Line & 2-Predictor 3D Plane',
  },
  {
    id: 'differentiation',
    code: 'EXP 04',
    label: 'Differentiation',
    subtitle: 'Forward / Backward / Central (MW/h)',
  },
  {
    id: 'integration',
    code: 'EXP 05',
    label: 'Integration (MWh)',
    subtitle: "Trapezoidal & Simpson's 1/3",
  },
  {
    id: 'lp',
    code: 'EXP 06',
    label: 'Linear Programming',
    subtitle: 'Two-Phase Simplex & Polytope',
  },
];

export function MathematicsPage() {
  const activeScenario = useSimulationStore((s) => s.activeScenario);
  const addNotification = useSimulationStore((s) => s.addNotification);

  const [activeExp, setActiveExp] = useState<ExperimentId>('interpolation');
  const [datasetMode, setDatasetMode] = useState<'microgrid' | 'benchmark'>('microgrid');
  const [precision, setPrecision] = useState<number>(4);

  const handleExport = (filename: string, payload: unknown) => {
    const serialized = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        datasetMode,
        scenarioId: activeScenario.id,
        precision,
        payload,
      },
      null,
      2,
    );
    const blob = new Blob([serialized], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addNotification({
      title: 'Calculations Exported',
      detail: `Saved ${filename} (${precision}-decimal precision).`,
      tone: 'success',
    });
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      {/* Scientific Workspace Toolbar */}
      <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] text-[#2563EB] dark:text-[#60A5FA]">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Numerical Mathematics Laboratory
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Synchronized KaTeX derivations, step-by-step numerical algorithms, interactive 3D mathematical geometry, and error validation.
              </p>
            </div>
          </div>

          {/* Shared Controls: Dataset & Precision */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] p-1">
              <button
                type="button"
                onClick={() => setDatasetMode('microgrid')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  datasetMode === 'microgrid'
                    ? 'bg-[#FFFFFF] dark:bg-[#172033] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                }`}
              >
                Active Microgrid Scenario
              </button>
              <button
                type="button"
                onClick={() => setDatasetMode('benchmark')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  datasetMode === 'benchmark'
                    ? 'bg-[#FFFFFF] dark:bg-[#172033] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                }`}
              >
                Analytical Benchmark
              </button>
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-3 py-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span>Precision</span>
              <select
                value={precision}
                onChange={(e) => setPrecision(Number(e.target.value))}
                aria-label="Decimal precision"
                className="bg-transparent font-mono-tabular font-semibold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none"
              >
                <option value={2}>2 dec</option>
                <option value={4}>4 dec</option>
                <option value={6}>6 dec</option>
              </select>
            </label>
          </div>
        </div>

        {/* 6-Experiment Navigation Strip */}
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {EXPERIMENTS.map((exp) => {
            const selected = activeExp === exp.id;
            return (
              <button
                key={exp.id}
                type="button"
                onClick={() => setActiveExp(exp.id)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? 'border-[#2563EB] dark:border-[#60A5FA] bg-[#2563EB]/6'
                    : 'border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                }`}
              >
                <p
                  className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${
                    selected ? 'text-[#2563EB] dark:text-[#60A5FA]' : 'text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                >
                  {exp.code}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                  {exp.label}
                </p>
                <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">{exp.subtitle}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Active Synchronized Experiment Workspace */}
      {activeExp === 'interpolation' ? (
        <ExpInterpolationPanel
          key={`interp-${datasetMode}`}
          datasetMode={datasetMode}
          precision={precision}
          onExport={handleExport}
        />
      ) : null}

      {activeExp === 'gaussian' ? (
        <ExpGaussianPanel
          key={`gauss-${datasetMode}`}
          datasetMode={datasetMode}
          precision={precision}
          onExport={handleExport}
        />
      ) : null}

      {activeExp === 'regression' ? (
        <ExpRegressionPanel
          key={`reg-${datasetMode}`}
          datasetMode={datasetMode}
          precision={precision}
          onExport={handleExport}
        />
      ) : null}

      {activeExp === 'differentiation' ? (
        <ExpDifferentiationPanel
          key={`diff-${datasetMode}`}
          datasetMode={datasetMode}
          precision={precision}
          onExport={handleExport}
        />
      ) : null}

      {activeExp === 'integration' ? (
        <ExpIntegrationPanel
          key={`integ-${datasetMode}`}
          datasetMode={datasetMode}
          precision={precision}
          onExport={handleExport}
        />
      ) : null}

      {activeExp === 'lp' ? (
        <ExpLinearProgrammingPanel
          key={`lp-${datasetMode}`}
          datasetMode={datasetMode}
          precision={precision}
          onExport={handleExport}
        />
      ) : null}
    </div>
  );
}
