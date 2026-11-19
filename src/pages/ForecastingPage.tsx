import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Download, RotateCcw, Upload } from 'lucide-react';
import { KaTeXFormula } from '../components/KaTeXFormula';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { Forecasting3D } from '../components/math3d/Forecasting3D';
import { MathLabViewport } from '../components/math3d/MathLabViewport';
import {
  buildSampleForecastCsv,
  generateSyntheticHistoryDataset,
  parseForecastCsv,
  type TimezoneOption,
} from '../forecasting/datasetManager';
import {
  buildDefaultWeatherScenario,
  runNumericalDemandForecast,
  type FutureWeatherInput,
  type WeatherScenarioId,
} from '../forecasting/numericalForecaster';
import { useSimulationStore } from '../store/useSimulationStore';

export function ForecastingPage() {
  const navigate = useNavigate();
  const applyForecastToDispatch = useSimulationStore((s) => s.applyForecastToDispatch);
  const addNotification = useSimulationStore((s) => s.addNotification);
  const datasetBundle = useSimulationStore((s) => s.forecastDataset);
  const holdoutHours = useSimulationStore((s) => s.holdoutHours);
  const weatherScenarioId = useSimulationStore((s) => s.weatherScenarioId);
  const weatherControls = useSimulationStore((s) => s.weatherControls);
  const activeScenario = useSimulationStore((s) => s.activeScenario);
  const setForecastSettings = useSimulationStore((s) => s.setForecastSettings);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [timezone, setTimezone] = useState<TimezoneOption>(datasetBundle.timezone);
  const [uploadedCsvText, setUploadedCsvText] = useState<{
    text: string;
    name: string;
  } | null>(null);
  const [customWeather, setCustomWeather] = useState<FutureWeatherInput[] | null>(null);

  const [viewMode, setViewMode] = useState<'forecast24' | 'holdout'>('forecast24');
  const [tableTab, setTableTab] = useState<'next24' | 'holdout'>('next24');
  const [selectedHourIdx, setSelectedHourIdx] = useState<number>(14);

  const [showSurface, setShowSurface] = useState<boolean>(true);
  const [showIntervalBand, setShowIntervalBand] = useState<boolean>(true);
  const [showNaive, setShowNaive] = useState<boolean>(true);
  const [showResiduals, setShowResiduals] = useState<boolean>(true);

  const activeWeatherPlan = useMemo(() => {
    if (weatherScenarioId === 'custom' && customWeather) {
      return customWeather;
    }
    const basePlan = buildDefaultWeatherScenario(
      datasetBundle.records,
      weatherScenarioId === 'custom' ? 'nominal' : weatherScenarioId,
    );
    if (Math.abs(weatherControls.temperatureDeltaDegC) < 0.05) {
      return basePlan;
    }
    return basePlan.map((w) => {
      const scenH = activeScenario.hourlyDemand[w.hour];
      return {
        ...w,
        temperatureDegC: scenH
          ? scenH.temperatureDegC
          : Number((w.temperatureDegC + weatherControls.temperatureDeltaDegC).toFixed(1)),
      };
    });
  }, [
    datasetBundle.records,
    weatherScenarioId,
    customWeather,
    weatherControls.temperatureDeltaDegC,
    activeScenario.hourlyDemand,
  ]);

  const workedHour =
    viewMode === 'forecast24'
      ? Math.max(0, Math.min(23, selectedHourIdx))
      : 14;

  const forecast = useMemo(
    () =>
      runNumericalDemandForecast({
        records: datasetBundle.records,
        holdoutHours,
        weatherScenarioId:
          Math.abs(weatherControls.temperatureDeltaDegC) > 0.05 && weatherScenarioId !== 'custom'
            ? 'custom'
            : weatherScenarioId,
        futureWeather: activeWeatherPlan,
        workedHour,
      }),
    [
      datasetBundle.records,
      holdoutHours,
      weatherScenarioId,
      weatherControls.temperatureDeltaDegC,
      activeWeatherPlan,
      workedHour,
    ],
  );

  const handleTimezoneChange = (nextTz: TimezoneOption) => {
    setTimezone(nextTz);
    const nextBundle = uploadedCsvText
      ? parseForecastCsv(uploadedCsvText.text, uploadedCsvText.name, nextTz)
      : generateSyntheticHistoryDataset(nextTz, 14);
    setForecastSettings({ forecastDataset: nextBundle });
  };

  const handleCsvUpload = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseForecastCsv(text, file.name, timezone);
    setUploadedCsvText({ text, name: file.name });
    setCustomWeather(null);
    setSelectedHourIdx(14);
    setForecastSettings({ forecastDataset: parsed });
    addNotification({
      title: parsed.records.length >= 60 ? 'CSV Dataset Ingested' : 'CSV Requires Attention',
      detail: `${parsed.qualityReport.validRows} valid rows (${parsed.qualityReport.missingValueCount} missing, ${parsed.qualityReport.duplicateTimestampCount} duplicate).`,
      tone: parsed.records.length >= 60 ? 'success' : 'warning',
    });
  };

  const handleDownloadSampleCsv = () => {
    const csv = buildSampleForecastCsv(datasetBundle);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gridmath-demand-history-sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpdateFutureTemp = (hour: number, newTemp: number) => {
    const base = activeWeatherPlan.map((w) => ({ ...w }));
    const idx = base.findIndex((w) => w.hour === hour);
    if (idx !== -1) {
      base[idx].temperatureDegC = Math.max(-20, Math.min(55, newTemp));
      setCustomWeather(base);
      setForecastSettings({ weatherScenarioId: 'custom' });
    }
  };

  const handleSendToDispatch = () => {
    if (!forecast.valid || forecast.next24h.length !== 24) return;
    applyForecastToDispatch(
      forecast.next24h.map((row) => ({
        hour: row.hour,
        demandMW: row.fullModelMW,
        temperatureDegC: row.temperatureDegC,
      })),
      `Forecast: ${datasetBundle.isSynthetic ? 'Synthetic Reg.' : datasetBundle.datasetName} (${weatherScenarioId})`,
    );
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* Header & Data Management Bar */}
      <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span className="font-medium text-[#2563EB] dark:text-[#60A5FA]">
                {datasetBundle.isSynthetic ? 'Documented Synthetic Demonstration' : 'Uploaded CSV Telemetry'}
              </span>
              <span aria-hidden="true">·</span>
              <span>Householder QR Multiple Regression</span>
              <span aria-hidden="true">·</span>
              <span>Chronological Split (Zero Leakage)</span>
            </div>
            <h2 className="text-lg font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              24-Hour Numerical Demand Forecasting Laboratory
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{datasetBundle.provenanceNotice}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                void handleCsvUpload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
              Upload CSV
            </button>
            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-[#64748B] dark:text-[#94A3B8]" />
              Sample CSV
            </button>
            {uploadedCsvText ? (
              <button
                type="button"
                onClick={() => {
                  setUploadedCsvText(null);
                  setCustomWeather(null);
                  setForecastSettings({
                    forecastDataset: generateSyntheticHistoryDataset(timezone, 14),
                  });
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] dark:border-[#334155] px-3 py-1.5 text-xs font-medium text-[#2563EB] dark:text-[#60A5FA] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Use Synthetic 14d
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSendToDispatch}
              disabled={!forecast.valid}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              Send 24h Forecast to Dispatch
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                handleSendToDispatch();
                navigate('/dispatch');
              }}
              disabled={!forecast.valid}
              className="rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              Open Dispatch
            </button>
          </div>
        </div>

        {/* Data Quality Audit & Configuration Row */}
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#E2E8F0] dark:border-[#334155] pt-4 lg:grid-cols-12">
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B] dark:text-[#94A3B8] lg:col-span-6">
            <span>
              Valid Rows:{' '}
              <strong className="font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                {datasetBundle.qualityReport.validRows}/{datasetBundle.qualityReport.totalRawRows}
              </strong>
            </span>
            <span>
              Missing:{' '}
              <strong className="font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                {datasetBundle.qualityReport.missingValueCount}
              </strong>
            </span>
            <span>
              Duplicates:{' '}
              <strong className="font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                {datasetBundle.qualityReport.duplicateTimestampCount}
              </strong>
            </span>
            <span>
              Invalid:{' '}
              <strong className="font-mono-tabular text-[#0F172A] dark:text-[#F8FAFC]">
                {datasetBundle.qualityReport.invalidValueCount}
              </strong>
            </span>
            <span>
              Train/Holdout:{' '}
              <strong className="font-mono-tabular text-[#10B981] dark:text-[#34D399]">
                {forecast.trainCount}h / {forecast.holdoutCount}h
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2.5 lg:col-span-6 lg:justify-end">
            <label className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] px-2.5 py-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span>Timezone</span>
              <select
                value={timezone}
                onChange={(e) => handleTimezoneChange(e.target.value as TimezoneOption)}
                aria-label="Dataset timezone"
                className="bg-transparent font-medium text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
                <option value="Local">Browser Local</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] px-2.5 py-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span>Holdout</span>
              <select
                value={holdoutHours}
                onChange={(e) => {
                  setForecastSettings({ holdoutHours: Number(e.target.value) });
                  setSelectedHourIdx(0);
                }}
                aria-label="Chronological holdout window"
                className="bg-transparent font-mono-tabular font-medium text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none"
              >
                <option value={24}>24h</option>
                <option value={48}>48h</option>
                <option value={72}>72h</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] px-2.5 py-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span>Future Weather</span>
              <select
                value={weatherScenarioId}
                onChange={(e) => {
                  const next = e.target.value as WeatherScenarioId;
                  setForecastSettings({ weatherScenarioId: next });
                  if (next !== 'custom') setCustomWeather(null);
                }}
                aria-label="Future weather scenario"
                className="bg-transparent font-medium text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none"
              >
                <option value="nominal">Historical Mean (Assumed)</option>
                <option value="heatwave">Heatwave +4.5 °C (Assumed)</option>
                <option value="cool">Cool / Overcast -3.5 °C</option>
                <option value="custom">Custom Hourly Temps</option>
              </select>
            </label>
          </div>
        </div>

        {datasetBundle.qualityReport.issues.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            Data cleaning log: {datasetBundle.qualityReport.issues.slice(0, 3).join(' ')}
          </div>
        ) : null}
      </section>

      {!forecast.valid ? (
        <section className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 p-6 text-sm text-rose-700 dark:text-rose-300">
          {forecast.error}
        </section>
      ) : (
        <>
          {/* KPI Summary Strip */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Predicted Peak Demand"
              value={forecast.predictedPeakMW.toFixed(1)}
              unit="MW"
              accentColor="primary"
              detail={`Peak occurs at ${String(forecast.peakHour).padStart(2, '0')}:00 · Total ${forecast.totalForecastEnergyMWh.toFixed(0)} MWh`}
            />
            <MetricCard
              label="Lowest-Demand Period"
              value={forecast.lowestDemandMW.toFixed(1)}
              unit="MW"
              accentColor="secondary"
              detail={`Trough occurs at ${String(forecast.lowestHour).padStart(2, '0')}:00`}
            />
            <MetricCard
              label="Holdout RMSE (vs. Naive)"
              value={forecast.fullModelMetrics.rmseMW.toFixed(2)}
              unit="MW"
              accentColor="renewable"
              detail={`MAE ${forecast.fullModelMetrics.maeMW.toFixed(2)} MW · Naive RMSE ${forecast.naiveBaselineMetrics.rmseMW.toFixed(2)} MW`}
            />
            <MetricCard
              label="Holdout sMAPE & R²"
              value={forecast.fullModelMetrics.smapePercent.toFixed(2)}
              unit="%"
              detail={`R² = ${forecast.fullModelMetrics.rSquared?.toFixed(4) ?? 'N/A'} · MAPE = ${
                forecast.fullModelMetrics.mapeValid && forecast.fullModelMetrics.mapePercent !== null
                  ? `${forecast.fullModelMetrics.mapePercent.toFixed(2)}%`
                  : 'N/A (zero denom.)'
              }`}
            />
          </section>

          {/* 3D Forecasting Laboratory + Mathematical Derivation Split */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            {/* Left 7 cols: 3D Forecasting Scene */}
            <div className="space-y-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 xl:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    3D Forecasting Laboratory (Hour × Demand MW × Temp °C)
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {forecast.weatherScenarioLabel}. Click or hover any point to inspect worked math.
                  </p>
                </div>

                <div className="flex items-center gap-1 rounded-lg bg-[#F8FAFC] dark:bg-[#0B1220] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('forecast24');
                      setSelectedHourIdx((i) => Math.min(23, i));
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                      viewMode === 'forecast24'
                        ? 'bg-[#FFFFFF] dark:bg-[#172033] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                        : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                    }`}
                  >
                    Next 24h Forecast
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('holdout');
                      setSelectedHourIdx(0);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                      viewMode === 'holdout'
                        ? 'bg-[#FFFFFF] dark:bg-[#172033] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                        : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                    }`}
                  >
                    Holdout Backtest
                  </button>
                </div>
              </div>

              {/* Layer Visibility Controls */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showSurface}
                    onChange={(e) => setShowSurface(e.target.checked)}
                    className="accent-[#2563EB]"
                  />
                  <span>3D Regression Surface</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showIntervalBand}
                    onChange={(e) => setShowIntervalBand(e.target.checked)}
                    className="accent-[#2563EB]"
                  />
                  <span>95% Prediction Band</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={showNaive}
                    onChange={(e) => setShowNaive(e.target.checked)}
                    className="accent-[#D97706]"
                  />
                  <span>Seasonal-Naive Baseline</span>
                </label>
                {viewMode === 'holdout' ? (
                  <label className="inline-flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={showResiduals}
                      onChange={(e) => setShowResiduals(e.target.checked)}
                      className="accent-[#10B981]"
                    />
                    <span>Residual Bars</span>
                  </label>
                ) : null}
              </div>

              <MathLabViewport
                cameraPosition={[9.2, 6.4, 10.6]}
                cameraTarget={[0, 2.2, 0]}
                heightClass="h-[440px]"
                showResetCamera
                caption="Blue: Multiple Reg. · Emerald: 4-Feature Core OLS · Amber: Seasonal-Naive · Black: Holdout Actuals"
              >
                <Forecasting3D
                  mode={viewMode}
                  result={forecast}
                  selectedHourIndex={selectedHourIdx}
                  onSelectHourIndex={setSelectedHourIdx}
                  showSurface={showSurface}
                  showIntervalBand={showIntervalBand}
                  showNaive={showNaive}
                  showResiduals={showResiduals}
                />
              </MathLabViewport>
            </div>

            {/* Right 5 cols: Mathematical Derivation & Worked Prediction Substitution */}
            <div className="space-y-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 xl:col-span-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  Mathematical Derivation &amp; Worked Substitution
                </h3>
                <StatusBadge
                  tone={forecast.chronologicalVerified ? 'nominal' : 'deficit'}
                  label={forecast.chronologicalVerified ? 'Zero Data Leakage' : 'Check Split'}
                />
              </div>

              <div className="rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] p-3">
                <KaTeXFormula
                  displayMode
                  tex="D(t) = \beta_0 + \beta_1 T(t) + \beta_2 \sin\!\left(\frac{2\pi h}{24}\right) + \beta_3 \cos\!\left(\frac{2\pi h}{24}\right) + \dots + \beta_k D(t-24)"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  <span>
                    Design Matrix <KaTeXFormula tex={`X \\in \\mathbb{R}^{${forecast.designMatrixShape[0]} \\times ${forecast.designMatrixShape[1]}}`} />
                  </span>
                  <span className="font-mono-tabular">
                    ||QᵀQ - I||_F = {forecast.qrOrthogonalityError.toExponential(2)}
                  </span>
                </div>
              </div>

              {/* Worked Hour Interactive Controls */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] p-3">
                <label className="block text-xs text-[#64748B] dark:text-[#94A3B8]">
                  <span>Inspect Forecast Hour</span>
                  <select
                    value={forecast.workedHour}
                    onChange={(e) => {
                      setViewMode('forecast24');
                      setSelectedHourIdx(Number(e.target.value));
                    }}
                    className="mt-1 w-full rounded border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] px-2 py-1 font-mono-tabular text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                  >
                    {forecast.next24h.map((r) => (
                      <option key={r.hour} value={r.hour}>
                        {r.timestampLabel} ({r.fullModelMW.toFixed(1)} MW)
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs text-[#64748B] dark:text-[#94A3B8]">
                  <span>Scenario Temp T({String(forecast.workedHour).padStart(2, '0')}:00) °C</span>
                  <input
                    type="number"
                    step={0.5}
                    value={activeWeatherPlan[forecast.workedHour]?.temperatureDegC ?? 28}
                    onChange={(e) =>
                      handleUpdateFutureTemp(
                        forecast.workedHour,
                        Number(e.target.value) || 0,
                      )
                    }
                    className="mt-1 w-full rounded border border-[#E2E8F0] dark:border-[#334155] px-2 py-1 font-mono-tabular text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA]"
                  />
                </label>
              </div>

              {/* Coefficient Estimates & Worked Multiplication Table */}
              <div className="max-h-60 overflow-y-auto rounded-lg border border-[#E2E8F0] dark:border-[#334155]">
                <table className="w-full border-collapse text-right text-xs font-mono-tabular">
                  <thead className="border-b border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1220] font-sans text-[#64748B] dark:text-[#94A3B8]">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left font-medium">Feature xⱼ</th>
                      <th className="px-2 py-1.5 font-medium">β̂ⱼ</th>
                      <th className="px-2 py-1.5 font-medium">xⱼ(t)</th>
                      <th className="px-2.5 py-1.5 font-medium text-[#2563EB] dark:text-[#60A5FA]">β̂ⱼ·xⱼ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                    {forecast.workedTerms.map((term) => (
                      <tr key={term.featureName}>
                        <td className="px-2.5 py-1.5 text-left font-sans text-[#0F172A] dark:text-[#F8FAFC]">
                          {term.featureName}
                        </td>
                        <td className="px-2 py-1.5 text-[#64748B] dark:text-[#94A3B8]">
                          {term.beta.toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-[#0F172A] dark:text-[#F8FAFC]">
                          {term.featureValue.toFixed(3)}
                        </td>
                        <td className="px-2.5 py-1.5 font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                          {term.contributionMW >= 0 ? '+' : ''}
                          {term.contributionMW.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#2563EB]/25 bg-[#EFF6FF]/50 dark:bg-[#60A5FA]/10 px-3 py-2 text-xs">
                <span className="text-[#0F172A] dark:text-[#F8FAFC]">
                  Worked Sum <KaTeXFormula tex={`\\hat{D}(${forecast.workedHour})`} />
                </span>
                <span className="font-mono-tabular font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                  {forecast.workedPredictedMW.toFixed(2)} MW · 95% PI [{forecast.workedLower95MW.toFixed(1)}, {forecast.workedUpper95MW.toFixed(1)}]
                </span>
              </div>
            </div>
          </section>

          {/* Model Comparison & Design Matrix Diagnostics */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 lg:col-span-6">
              <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Chronological Holdout Model Comparison ({forecast.holdoutCount}h Out-of-Sample)
              </h3>
              <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Residual Standard Error <KaTeXFormula tex={`s = ${forecast.residualStdErrorMW.toFixed(2)}\\;\\text{MW}`} />. Strictly trained on timestamps prior to holdout.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-right text-xs font-mono-tabular">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] dark:border-[#334155] font-sans text-[#64748B] dark:text-[#94A3B8]">
                      <th className="py-2 text-left font-medium">Model</th>
                      <th className="py-2 font-medium">MAE (MW)</th>
                      <th className="py-2 font-medium">RMSE (MW)</th>
                      <th className="py-2 font-medium">sMAPE (%)</th>
                      <th className="py-2 font-medium">MAPE (%)</th>
                      <th className="py-2 font-medium">R²</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                    <tr className="bg-[#2563EB]/4 font-semibold">
                      <td className="py-2 text-left font-sans text-[#2563EB] dark:text-[#60A5FA]">
                        Multiple Regression (Full QR)
                      </td>
                      <td className="py-2 text-[#0F172A] dark:text-[#F8FAFC]">{forecast.fullModelMetrics.maeMW.toFixed(2)}</td>
                      <td className="py-2 text-[#2563EB] dark:text-[#60A5FA]">{forecast.fullModelMetrics.rmseMW.toFixed(2)}</td>
                      <td className="py-2 text-[#0F172A] dark:text-[#F8FAFC]">{forecast.fullModelMetrics.smapePercent.toFixed(2)}</td>
                      <td className="py-2 text-[#0F172A] dark:text-[#F8FAFC]">
                        {forecast.fullModelMetrics.mapeValid && forecast.fullModelMetrics.mapePercent !== null
                          ? forecast.fullModelMetrics.mapePercent.toFixed(2)
                          : 'N/A'}
                      </td>
                      <td className="py-2 text-[#10B981] dark:text-[#34D399]">
                        {forecast.fullModelMetrics.rSquared?.toFixed(4) ?? '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-left font-sans text-[#0F172A] dark:text-[#F8FAFC]">
                        4-Feature Core (T + 24h Harmonics)
                      </td>
                      <td className="py-2 text-[#64748B] dark:text-[#94A3B8]">{forecast.coreModelMetrics.maeMW.toFixed(2)}</td>
                      <td className="py-2 text-[#64748B] dark:text-[#94A3B8]">{forecast.coreModelMetrics.rmseMW.toFixed(2)}</td>
                      <td className="py-2 text-[#64748B] dark:text-[#94A3B8]">{forecast.coreModelMetrics.smapePercent.toFixed(2)}</td>
                      <td className="py-2 text-[#64748B] dark:text-[#94A3B8]">
                        {forecast.coreModelMetrics.mapeValid && forecast.coreModelMetrics.mapePercent !== null
                          ? forecast.coreModelMetrics.mapePercent.toFixed(2)
                          : 'N/A'}
                      </td>
                      <td className="py-2 text-[#64748B] dark:text-[#94A3B8]">
                        {forecast.coreModelMetrics.rSquared?.toFixed(4) ?? '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-left font-sans text-[#D97706] dark:text-[#FBBF24]">
                        Seasonal-Naive Baseline D(t-24)
                      </td>
                      <td className="py-2 text-[#64748B] dark:text-[#94A3B8]">{forecast.naiveBaselineMetrics.maeMW.toFixed(2)}</td>
                      <td className="py-2 text-[#64748B] dark:text-[#94A3B8]">{forecast.naiveBaselineMetrics.rmseMW.toFixed(2)}</td>
                      <td className="py-2 text-[#64748B] dark:text-[#94A3B8]">{forecast.naiveBaselineMetrics.smapePercent.toFixed(2)}</td>
                      <td className="py-2 text-[#64748B] dark:text-[#94A3B8]">
                        {forecast.naiveBaselineMetrics.mapeValid && forecast.naiveBaselineMetrics.mapePercent !== null
                          ? forecast.naiveBaselineMetrics.mapePercent.toFixed(2)
                          : 'N/A'}
                      </td>
                      <td className="py-2 text-[#64748B] dark:text-[#94A3B8]">
                        {forecast.naiveBaselineMetrics.rSquared?.toFixed(4) ?? '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Design Matrix Preview */}
            <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-5 lg:col-span-6">
              <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Design Matrix X Preview (First 6 Causal Training Rows)
              </h3>
              <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Normal equations <KaTeXFormula tex="(X^T X)\boldsymbol{\beta} = X^T \mathbf{y}" /> solved via Householder QR factorization.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-right text-[11px] font-mono-tabular">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] dark:border-[#334155] font-sans text-[#64748B] dark:text-[#94A3B8]">
                      <th className="py-1.5 pr-2 text-left font-medium">Row</th>
                      {forecast.featureNames.slice(0, 7).map((name) => (
                        <th key={name} className="px-1.5 py-1.5 font-medium truncate max-w-[82px]">
                          {name.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                    {forecast.designMatrixPreview.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 pr-2 text-left text-[#64748B] dark:text-[#94A3B8]">t={idx + 24}</td>
                        {row.slice(0, 7).map((val, cIdx) => (
                          <td key={cIdx} className="px-1.5 py-1.5 text-[#0F172A] dark:text-[#F8FAFC]">
                            {val.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Complete 24-Hour Operational Forecast & Holdout Residual Tables */}
          <section className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#FFFFFF] dark:bg-[#172033] p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {tableTab === 'next24'
                    ? 'Next 24-Hour Operational Load Forecast (Editable Scenario Temperatures)'
                    : 'Historical Chronological Holdout: Actual vs. Predicted Comparison'}
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  {tableTab === 'next24'
                    ? 'Edit any future hourly temperature (°C) to recalculate the regression demand forecast and mathematics live.'
                    : 'Out-of-sample evaluation comparing observed demand, multiple regression, and seasonal-naive baseline.'}
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-[#F8FAFC] dark:bg-[#0B1220] p-1">
                <button
                  type="button"
                  onClick={() => setTableTab('next24')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                    tableTab === 'next24'
                      ? 'bg-[#FFFFFF] dark:bg-[#172033] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                      : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                  }`}
                >
                  Next 24-Hour Forecast (24h)
                </button>
                <button
                  type="button"
                  onClick={() => setTableTab('holdout')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                    tableTab === 'holdout'
                      ? 'bg-[#FFFFFF] dark:bg-[#172033] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                      : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                  }`}
                >
                  Holdout Verification ({forecast.holdoutCount}h)
                </button>
              </div>
            </div>

            {tableTab === 'next24' ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-right text-xs font-mono-tabular">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] dark:border-[#334155] font-sans text-[#64748B] dark:text-[#94A3B8]">
                      <th className="py-2 pr-3 text-left font-medium">Hour</th>
                      <th className="py-2 pr-3 font-medium">Scenario Temp (°C)</th>
                      <th className="py-2 pr-3 font-medium">Lag D(t-24) MW</th>
                      <th className="py-2 pr-3 font-medium text-[#2563EB] dark:text-[#60A5FA]">Predicted MW</th>
                      <th className="py-2 pr-3 font-medium">4-Feat OLS MW</th>
                      <th className="py-2 pr-3 font-medium">95% PI Band (MW)</th>
                      <th className="py-2 font-medium">Peak / Trough</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                    {forecast.next24h.map((row) => {
                      const isPeak = row.hour === forecast.peakHour;
                      const isTrough = row.hour === forecast.lowestHour;
                      const isSelected = viewMode === 'forecast24' && row.hour === selectedHourIdx;
                      return (
                        <tr
                          key={row.hour}
                          onClick={() => {
                            setViewMode('forecast24');
                            setSelectedHourIdx(row.hour);
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#2563EB]/6' : 'hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                          }`}
                        >
                          <td className="py-1.5 pr-3 text-left font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                            {row.timestampLabel}
                          </td>
                          <td className="py-1.5 pr-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              step={0.5}
                              value={row.temperatureDegC}
                              aria-label={`Temperature hour ${row.hour}`}
                              onChange={(e) =>
                                handleUpdateFutureTemp(row.hour, Number(e.target.value) || 0)
                              }
                              className="w-20 rounded border border-[#E2E8F0] dark:border-[#334155] px-2 py-0.5 text-right text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                            />
                          </td>
                          <td className="py-1.5 pr-3 text-[#64748B] dark:text-[#94A3B8]">
                            {row.lag24DemandMW.toFixed(1)}
                          </td>
                          <td className="py-1.5 pr-3 font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                            {row.fullModelMW.toFixed(2)}
                          </td>
                          <td className="py-1.5 pr-3 text-[#10B981] dark:text-[#34D399]">
                            {row.coreModelMW.toFixed(2)}
                          </td>
                          <td className="py-1.5 pr-3 text-[#64748B] dark:text-[#94A3B8]">
                            [{row.lower95MW.toFixed(1)}, {row.upper95MW.toFixed(1)}]
                          </td>
                          <td className="py-1.5 font-sans">
                            {isPeak ? (
                              <StatusBadge tone="warning" label="Peak" />
                            ) : isTrough ? (
                              <StatusBadge tone="info" label="Lowest" />
                            ) : (
                              <span className="text-[#64748B] dark:text-[#94A3B8]">Nominal</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto overflow-x-auto">
                <table className="w-full border-collapse text-right text-xs font-mono-tabular">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] dark:border-[#334155] font-sans text-[#64748B] dark:text-[#94A3B8]">
                      <th className="py-2 pr-3 text-left font-medium">Timestamp</th>
                      <th className="py-2 pr-3 font-medium">Temp (°C)</th>
                      <th className="py-2 pr-3 font-medium">Actual (MW)</th>
                      <th className="py-2 pr-3 font-medium text-[#2563EB] dark:text-[#60A5FA]">Multi-Reg (MW)</th>
                      <th className="py-2 pr-3 font-medium">Naive (MW)</th>
                      <th className="py-2 font-medium">Residual e = D - D̂</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                    {forecast.holdoutComparison.map((row, idx) => (
                      <tr
                        key={row.index}
                        onClick={() => {
                          setViewMode('holdout');
                          setSelectedHourIdx(idx);
                        }}
                        className={`cursor-pointer ${
                          viewMode === 'holdout' && selectedHourIdx === idx
                            ? 'bg-[#2563EB]/6'
                            : 'hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                        }`}
                      >
                        <td className="py-1.5 pr-3 text-left text-[#0F172A] dark:text-[#F8FAFC]">
                          {row.timestampLabel}
                        </td>
                        <td className="py-1.5 pr-3 text-[#64748B] dark:text-[#94A3B8]">
                          {row.temperatureDegC.toFixed(1)}
                        </td>
                        <td className="py-1.5 pr-3 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                          {row.actualMW.toFixed(2)}
                        </td>
                        <td className="py-1.5 pr-3 font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                          {row.fullModelMW.toFixed(2)}
                        </td>
                        <td className="py-1.5 pr-3 text-[#D97706] dark:text-[#FBBF24]">
                          {row.naiveBaselineMW.toFixed(2)}
                        </td>
                        <td
                          className={`py-1.5 font-semibold ${
                            Math.abs(row.residualMW) <= 12 ? 'text-[#10B981] dark:text-[#34D399]' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {row.residualMW >= 0 ? '+' : ''}
                          {row.residualMW.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
