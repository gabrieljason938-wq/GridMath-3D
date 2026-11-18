import { create } from 'zustand';
import { SYNTHETIC_SCENARIOS } from '../data/syntheticMicrogrid';
import {
  generateSyntheticHistoryDataset,
  type ForecastDatasetBundle,
} from '../forecasting/datasetManager';
import type {
  NumericalForecastEngineResult,
  WeatherScenarioId,
} from '../forecasting/numericalForecaster';
import {
  createDefaultDispatchConfig,
  type DispatchOptimizationConfig,
  type DispatchStrategyId,
  type OptimalDispatchBundle,
} from '../optimization/optimalDispatchEngine';
import {
  DEFAULT_EXPERIMENT_PARAMETERS,
  runAllEightExperiments,
  type ExperimentId,
  type ExperimentParameters,
  type ScientificExperimentResult,
} from '../experiments/scientificExperiments';
import {
  DEFAULT_WEATHER_CONTROLS,
  executeDigitalTwinPipeline,
  type AppliedForecastPoint,
} from '../simulation/digitalTwinPipeline';
import { ENVIRONMENT_MODE_PRESETS } from '../components/three/powerFlowMath';
import type {
  CalculationHistoryEntry,
  CityZoneId,
  DaySimulationSummary,
  DispatchResult,
  EnvironmentMode,
  ForecastResult,
  GeneratorOverride,
  HourlyDemand,
  PlaybackSpeed,
  RenderQuality,
  ScenarioValidationReport,
  SimulationScenario,
  WeatherControls,
} from '../types/grid';

export interface ToastNotification {
  id: string;
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warning';
}

interface SimulationState {
  scenarios: SimulationScenario[];
  activeScenarioId: string;
  activeHour: number;
  simulationTimestampIso: string;
  selectedNodeId: CityZoneId | null;
  sidebarCollapsed: boolean;
  isComputing: boolean;
  notifications: ToastNotification[];

  // Deterministic Playback, Environment & 3D Quality Controls
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  renderQuality: RenderQuality;
  environmentMode: EnvironmentMode;

  // Authoritative Twin Input Controls
  weatherControls: WeatherControls;
  generatorOverrides: Record<string, GeneratorOverride>;
  batteryInitialSocOverrideMWh: number | null;
  useForecastDrivenDemand: boolean;
  customForecastSeries: AppliedForecastPoint[] | null;
  appliedForecastLabel: string | null;

  // Shared Forecasting State
  forecastDataset: ForecastDatasetBundle;
  weatherScenarioId: WeatherScenarioId;
  holdoutHours: number;

  // Dispatch Optimization Config
  dispatchConfig: DispatchOptimizationConfig;

  // Derived Authoritative Outputs (single source of truth across all pages)
  activeScenario: SimulationScenario;
  validationReport: ScenarioValidationReport;
  numericalForecast: NumericalForecastEngineResult;
  forecastResult: ForecastResult;
  dispatchBundle: OptimalDispatchBundle;
  daySummary: DaySimulationSummary;
  activeDispatch: DispatchResult;
  activeHourlyDemand: HourlyDemand;
  lastComputeMs: number;
  calculationHistory: CalculationHistoryEntry[];

  // Phase 7 Scientific Experiment Workspace & Report Archive
  activeExperimentId: ExperimentId;
  experimentParams: ExperimentParameters;
  pinnedExperiments: Partial<Record<ExperimentId, ScientificExperimentResult>>;

  // Actions
  setScenario: (scenarioId: string) => void;
  setActiveHour: (hour: number) => void;
  stepHour: (delta: number) => void;
  playSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setRenderQuality: (quality: RenderQuality) => void;
  setEnvironmentMode: (mode: EnvironmentMode) => void;
  setSelectedNode: (zoneId: CityZoneId | null) => void;
  toggleSidebar: () => void;
  recomputeSimulation: (triggerLabel?: string) => void;

  updateWeatherControls: (patch: Partial<WeatherControls>, triggerLabel?: string) => void;
  resetWeatherControls: () => void;
  updateGeneratorOverride: (
    generatorId: string,
    patch: GeneratorOverride,
    triggerLabel?: string,
  ) => void;
  resetGeneratorOverrides: () => void;
  setBatteryInitialSocOverride: (socMWh: number | null) => void;
  setUseForecastDrivenDemand: (enabled: boolean) => void;
  setForecastSettings: (patch: {
    forecastDataset?: ForecastDatasetBundle;
    weatherScenarioId?: WeatherScenarioId;
    holdoutHours?: number;
  }) => void;

  setDispatchStrategy: (strategy: DispatchStrategyId) => void;
  updateDispatchConfig: (patch: Partial<DispatchOptimizationConfig>) => void;
  resetDispatchConfig: () => void;

  applyForecastToDispatch: (
    hourlyForecast: AppliedForecastPoint[],
    label: string,
  ) => void;
  clearAppliedForecast: () => void;
  addNotification: (toast: Omit<ToastNotification, 'id'>) => void;
  dismissNotification: (id: string) => void;

  // Phase 7 Actions
  setActiveExperimentId: (id: ExperimentId) => void;
  updateExperimentParams: (patch: Partial<ExperimentParameters>) => void;
  pinExperimentResult: (result: ScientificExperimentResult) => void;
  runAndPinAllExperiments: () => Record<ExperimentId, ScientificExperimentResult>;
}

function makeHistoryEntry(
  trigger: string,
  scenario: SimulationScenario,
  bundle: OptimalDispatchBundle,
  computeMs: number,
  timestampIso: string,
): CalculationHistoryEntry {
  const unservedMWh = bundle.summary.hourlyDispatches.reduce(
    (a, h) => a + h.unservedEnergyMW,
    0,
  );
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestampIso,
    trigger,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    peakDemandMW: bundle.summary.predictedPeakDemandMW,
    totalDailyCostInr: bundle.summary.totalDailyCostInr,
    totalEmissionsTonnesCO2e: bundle.summary.totalDailyEmissionsTonnesCO2e,
    unservedEnergyMWh: Number(unservedMWh.toFixed(2)),
    maxBalanceResidualMW: bundle.residualSummary.maxPowerBalanceResidualMW,
    solverStatus: bundle.feasible ? bundle.solverStatus.toUpperCase() : 'INFEASIBLE',
    computeMs,
  };
}

function runPipelineFromArgs(args: {
  baseScenario: SimulationScenario;
  weatherControls: WeatherControls;
  generatorOverrides: Record<string, GeneratorOverride>;
  batteryInitialSocOverrideMWh: number | null;
  dispatchConfig: DispatchOptimizationConfig;
  forecastDataset: ForecastDatasetBundle;
  weatherScenarioId: WeatherScenarioId;
  holdoutHours: number;
  activeHour: number;
  useForecastDrivenDemand: boolean;
  customForecastSeries: AppliedForecastPoint[] | null;
}) {
  const out = executeDigitalTwinPipeline(args);
  const safeHour = ((Math.round(args.activeHour) % 24) + 24) % 24;
  const activeDispatch =
    out.dispatchBundle.summary.hourlyDispatches[safeHour] ??
    out.dispatchBundle.summary.hourlyDispatches[0];
  const activeHourlyDemand =
    out.effectiveScenario.hourlyDemand[safeHour] ?? out.effectiveScenario.hourlyDemand[0];

  return {
    activeScenario: out.effectiveScenario,
    validationReport: out.validationReport,
    numericalForecast: out.numericalForecast,
    forecastResult: out.forecastResult,
    dispatchBundle: out.dispatchBundle,
    daySummary: out.dispatchBundle.summary,
    activeDispatch,
    activeHourlyDemand,
    simulationTimestampIso: out.simulationTimestampIso,
    lastComputeMs: out.computeMs,
  };
}

const initialBaseScenario = SYNTHETIC_SCENARIOS[0];
const initialHour = 14;
const initialDataset = generateSyntheticHistoryDataset('Asia/Kolkata', 14);
const initialDispatchConfig = createDefaultDispatchConfig(initialBaseScenario);
const initialPipeline = runPipelineFromArgs({
  baseScenario: initialBaseScenario,
  weatherControls: DEFAULT_WEATHER_CONTROLS,
  generatorOverrides: {},
  batteryInitialSocOverrideMWh: null,
  dispatchConfig: initialDispatchConfig,
  forecastDataset: initialDataset,
  weatherScenarioId: 'nominal',
  holdoutHours: 24,
  activeHour: initialHour,
  useForecastDrivenDemand: false,
  customForecastSeries: null,
});

const initialHistoryEntry = makeHistoryEntry(
  'Initial Twin Seed',
  initialPipeline.activeScenario,
  initialPipeline.dispatchBundle,
  initialPipeline.lastComputeMs,
  initialPipeline.simulationTimestampIso,
);

export const useSimulationStore = create<SimulationState>((set, get) => {
  const runAndCommit = (
    patchState: Partial<SimulationState>,
    triggerLabel: string,
    overrideBaseScenario?: SimulationScenario,
  ) => {
    const state = get();
    const nextScenarioId = patchState.activeScenarioId ?? state.activeScenarioId;
    const baseScenario =
      overrideBaseScenario ??
      state.scenarios.find((s) => s.id === nextScenarioId) ??
      state.scenarios[0];

    const weatherControls = patchState.weatherControls ?? state.weatherControls;
    const generatorOverrides = patchState.generatorOverrides ?? state.generatorOverrides;
    const batteryInitialSocOverrideMWh =
      patchState.batteryInitialSocOverrideMWh !== undefined
        ? patchState.batteryInitialSocOverrideMWh
        : state.batteryInitialSocOverrideMWh;
    const dispatchConfig = patchState.dispatchConfig ?? state.dispatchConfig;
    const forecastDataset = patchState.forecastDataset ?? state.forecastDataset;
    const weatherScenarioId = patchState.weatherScenarioId ?? state.weatherScenarioId;
    const holdoutHours = patchState.holdoutHours ?? state.holdoutHours;
    const activeHour = patchState.activeHour ?? state.activeHour;
    const useForecastDrivenDemand =
      patchState.useForecastDrivenDemand !== undefined
        ? patchState.useForecastDrivenDemand
        : state.useForecastDrivenDemand;
    const customForecastSeries =
      patchState.customForecastSeries !== undefined
        ? patchState.customForecastSeries
        : state.customForecastSeries;

    const evaluated = runPipelineFromArgs({
      baseScenario,
      weatherControls,
      generatorOverrides,
      batteryInitialSocOverrideMWh,
      dispatchConfig,
      forecastDataset,
      weatherScenarioId,
      holdoutHours,
      activeHour,
      useForecastDrivenDemand,
      customForecastSeries,
    });

    const entry = makeHistoryEntry(
      triggerLabel,
      evaluated.activeScenario,
      evaluated.dispatchBundle,
      evaluated.lastComputeMs,
      evaluated.simulationTimestampIso,
    );

    set({
      ...patchState,
      ...evaluated,
      isComputing: false,
      calculationHistory: [entry, ...state.calculationHistory].slice(0, 15),
    });

    return evaluated;
  };

  return {
    scenarios: SYNTHETIC_SCENARIOS,
    activeScenarioId: initialBaseScenario.id,
    activeHour: initialHour,
    selectedNodeId: null,
    sidebarCollapsed: false,
    isComputing: false,
    notifications: [],

    isPlaying: false,
    playbackSpeed: 1,
    renderQuality: 'balanced',
    environmentMode: 'day',

    weatherControls: { ...DEFAULT_WEATHER_CONTROLS },
    generatorOverrides: {},
    batteryInitialSocOverrideMWh: null,
    useForecastDrivenDemand: false,
    customForecastSeries: null,
    appliedForecastLabel: null,

    forecastDataset: initialDataset,
    weatherScenarioId: 'nominal',
    holdoutHours: 24,
    dispatchConfig: initialDispatchConfig,

    ...initialPipeline,
    calculationHistory: [initialHistoryEntry],

    activeExperimentId: 'forecast-accuracy',
    experimentParams: { ...DEFAULT_EXPERIMENT_PARAMETERS },
    pinnedExperiments: {},

    setScenario: (scenarioId) => {
      const { scenarios, activeScenario, dispatchConfig, addNotification } = get();
      const target = scenarios.find((s) => s.id === scenarioId);
      if (!target) return;

      const minSoc = target.battery.capacityMWh * target.battery.minSocRatio;
      const maxSoc = target.battery.capacityMWh * target.battery.maxSocRatio;
      const syncedTerminalSoc =
        Math.abs(dispatchConfig.terminalSocTargetMWh - activeScenario.battery.initialSocMWh) < 0.5
          ? target.battery.initialSocMWh
          : Math.max(minSoc, Math.min(maxSoc, dispatchConfig.terminalSocTargetMWh));

      const nextConfig: DispatchOptimizationConfig = {
        ...dispatchConfig,
        terminalSocTargetMWh: syncedTerminalSoc,
      };

      const evaluated = runAndCommit(
        {
          activeScenarioId: target.id,
          environmentMode: 'day',
          weatherControls: { ...DEFAULT_WEATHER_CONTROLS },
          generatorOverrides: {},
          batteryInitialSocOverrideMWh: null,
          useForecastDrivenDemand: false,
          customForecastSeries: null,
          appliedForecastLabel: null,
          dispatchConfig: nextConfig,
        },
        `Scenario: ${target.name}`,
        target,
      );

      addNotification({
        title: 'Scenario Activated',
        detail: `${target.name} · Cost ₹${evaluated.daySummary.totalDailyCostInr.toLocaleString('en-IN')} (${evaluated.dispatchBundle.solverStatus.toUpperCase()}).`,
        tone:
          evaluated.validationReport.valid && evaluated.dispatchBundle.feasible
            ? 'success'
            : 'warning',
      });
    },

    // O(1) deterministic time step: never re-runs LP solver during playback/scrubbing
    setActiveHour: (hour) => {
      const safeHour = ((Math.round(hour) % 24) + 24) % 24;
      const { activeScenario, daySummary, environmentMode } = get();
      const timestampIso = `2026-10-15T${safeHour.toString().padStart(2, '0')}:00:00+05:30`;
      const autoEnv: EnvironmentMode =
        environmentMode === 'cloudy' || environmentMode === 'rainy'
          ? environmentMode
          : safeHour >= 19 || safeHour <= 5
            ? 'night'
            : safeHour === 6 || safeHour === 17 || safeHour === 18
              ? 'sunset'
              : 'day';
      set({
        activeHour: safeHour,
        environmentMode: autoEnv,
        simulationTimestampIso: timestampIso,
        activeDispatch: daySummary.hourlyDispatches[safeHour] ?? daySummary.hourlyDispatches[0],
        activeHourlyDemand: activeScenario.hourlyDemand[safeHour] ?? activeScenario.hourlyDemand[0],
      });
    },

    stepHour: (delta) => {
      const { activeHour, setActiveHour } = get();
      setActiveHour(activeHour + delta);
    },

    playSimulation: () => set({ isPlaying: true }),
    pauseSimulation: () => set({ isPlaying: false }),
    resetSimulation: () => {
      const { scenarios, activeScenarioId, addNotification } = get();
      const baseTarget = scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0];
      const freshConfig = createDefaultDispatchConfig(baseTarget);
      runAndCommit(
        {
          isPlaying: false,
          activeHour: 14,
          environmentMode: 'day',
          weatherControls: { ...DEFAULT_WEATHER_CONTROLS },
          generatorOverrides: {},
          batteryInitialSocOverrideMWh: null,
          useForecastDrivenDemand: false,
          customForecastSeries: null,
          appliedForecastLabel: null,
          dispatchConfig: freshConfig,
        },
        'Reset Digital Twin State',
        baseTarget,
      );
      addNotification({
        title: 'Digital Twin Reset',
        detail: `Restored ${baseTarget.name} at 14:00 IST with default weather & fleet parameters.`,
        tone: 'info',
      });
    },

    setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
    setRenderQuality: (renderQuality) => set({ renderQuality }),
    setEnvironmentMode: (mode) => {
      const preset = ENVIRONMENT_MODE_PRESETS[mode];
      const nextWeather: WeatherControls = {
        temperatureDeltaDegC: preset.temperatureDeltaDegC,
        solarIrradianceScale: preset.solarIrradianceScale,
        windResourceScale: preset.windResourceScale,
        demandScaleFactor: preset.demandScaleFactor,
      };
      const evaluated = runAndCommit(
        {
          isPlaying: false,
          environmentMode: mode,
          activeHour: preset.defaultHour,
          weatherControls: nextWeather,
        },
        `Environment Mode: ${preset.label}`,
      );
      get().addNotification({
        title: `${preset.label} Environment Active`,
        detail: `${preset.summary} · Demand ${evaluated.activeDispatch.totalDemandMW.toFixed(1)} MW.`,
        tone: evaluated.dispatchBundle.feasible ? 'info' : 'warning',
      });
    },
    setSelectedNode: (zoneId) => set({ selectedNodeId: zoneId }),
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

    recomputeSimulation: (triggerLabel = 'Manual Verification') => {
      const { activeHour, addNotification } = get();
      set({ isComputing: true });
      const evaluated = runAndCommit({}, triggerLabel);
      addNotification({
        title: 'Digital Twin Recalculated',
        detail: `Hour ${activeHour.toString().padStart(2, '0')}:00 (${evaluated.activeDispatch.balanceStatus}) · Residual ${evaluated.dispatchBundle.residualSummary.maxPowerBalanceResidualMW.toExponential(1)} MW in ${evaluated.lastComputeMs} ms.`,
        tone: evaluated.dispatchBundle.feasible ? 'success' : 'warning',
      });
    },

    updateWeatherControls: (patch, triggerLabel = 'Weather Perturbation') => {
      const nextWeather = { ...get().weatherControls, ...patch };
      runAndCommit({ weatherControls: nextWeather }, triggerLabel);
    },

    resetWeatherControls: () => {
      runAndCommit(
        { weatherControls: { ...DEFAULT_WEATHER_CONTROLS } },
        'Reset Weather Controls',
      );
    },

    updateGeneratorOverride: (generatorId, patch, triggerLabel = 'Fleet Capacity Override') => {
      const cur = get().generatorOverrides;
      const nextOverrides = {
        ...cur,
        [generatorId]: { ...(cur[generatorId] ?? {}), ...patch },
      };
      runAndCommit({ generatorOverrides: nextOverrides }, triggerLabel);
    },

    resetGeneratorOverrides: () => {
      runAndCommit(
        { generatorOverrides: {}, batteryInitialSocOverrideMWh: null },
        'Reset Fleet & BESS Overrides',
      );
    },

    setBatteryInitialSocOverride: (socMWh) => {
      runAndCommit(
        { batteryInitialSocOverrideMWh: socMWh },
        socMWh !== null ? `BESS Init SoC: ${socMWh.toFixed(0)} MWh` : 'Reset BESS Init SoC',
      );
    },

    setUseForecastDrivenDemand: (enabled) => {
      const evaluated = runAndCommit(
        {
          useForecastDrivenDemand: enabled,
          customForecastSeries: null,
          appliedForecastLabel: enabled ? 'Householder QR Live Forecast Coupled' : null,
        },
        enabled ? 'Enable Forecast-Driven Dispatch' : 'Disable Forecast Coupling',
      );
      get().addNotification({
        title: enabled ? 'Forecast Coupled to Twin' : 'Scenario Demand Restored',
        detail: `Peak ${evaluated.daySummary.predictedPeakDemandMW.toFixed(1)} MW · 24h cost ₹${evaluated.daySummary.totalDailyCostInr.toLocaleString('en-IN')}.`,
        tone: 'info',
      });
    },

    setForecastSettings: (patch) => {
      runAndCommit(
        {
          forecastDataset: patch.forecastDataset ?? get().forecastDataset,
          weatherScenarioId: patch.weatherScenarioId ?? get().weatherScenarioId,
          holdoutHours: patch.holdoutHours ?? get().holdoutHours,
        },
        'Forecast Model Parameters Updated',
      );
    },

    setDispatchStrategy: (strategy) => {
      const { dispatchConfig, addNotification } = get();
      const nextConfig: DispatchOptimizationConfig = { ...dispatchConfig, strategy };
      const evaluated = runAndCommit({ dispatchConfig: nextConfig }, `Strategy: ${strategy}`);
      const labels: Record<DispatchStrategyId, string> = {
        'lp-optimal': 'Numerical LP Optimal Dispatch',
        'renewable-heuristic': 'Renewable-Priority Heuristic',
        'thermal-first': 'Thermal-First Baseline',
      };
      addNotification({
        title: 'Dispatch Strategy Updated',
        detail: `${labels[strategy]} · 24h cost ₹${evaluated.daySummary.totalDailyCostInr.toLocaleString('en-IN')}.`,
        tone: evaluated.dispatchBundle.feasible ? 'success' : 'warning',
      });
    },

    updateDispatchConfig: (patch) => {
      const cur = get().dispatchConfig;
      const nextConfig: DispatchOptimizationConfig = {
        ...cur,
        ...patch,
        emissionFactorsKgPerMWh: patch.emissionFactorsKgPerMWh
          ? { ...cur.emissionFactorsKgPerMWh, ...patch.emissionFactorsKgPerMWh }
          : cur.emissionFactorsKgPerMWh,
      };
      runAndCommit({ dispatchConfig: nextConfig }, 'Dispatch Objective / Constraints Updated');
    },

    resetDispatchConfig: () => {
      const fresh = createDefaultDispatchConfig(get().activeScenario);
      runAndCommit({ dispatchConfig: fresh }, 'Reset Dispatch Configuration');
      get().addNotification({
        title: 'Dispatch Parameters Reset',
        detail: 'Restored default LP cost, BESS terminal target, and emission factors.',
        tone: 'info',
      });
    },

    applyForecastToDispatch: (hourlyForecast, label) => {
      const evaluated = runAndCommit(
        {
          customForecastSeries: hourlyForecast,
          useForecastDrivenDemand: true,
          appliedForecastLabel: label,
        },
        `Apply Forecast: ${label}`,
      );
      get().addNotification({
        title: '24h Forecast Applied to Unified Twin',
        detail: `${label} · Peak ${evaluated.daySummary.predictedPeakDemandMW.toFixed(1)} MW optimized (${evaluated.dispatchBundle.solverStatus}).`,
        tone: evaluated.dispatchBundle.feasible ? 'success' : 'warning',
      });
    },

    clearAppliedForecast: () => {
      runAndCommit(
        {
          customForecastSeries: null,
          useForecastDrivenDemand: false,
          appliedForecastLabel: null,
        },
        'Clear Applied Forecast',
      );
      get().addNotification({
        title: 'Scenario Baseline Restored',
        detail: `Reverted dispatch demand to ${get().activeScenario.name}.`,
        tone: 'info',
      });
    },

    addNotification: (toast) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      set((state) => ({
        notifications: [...state.notifications.slice(-2), { ...toast, id }],
      }));
      globalThis.setTimeout(() => {
        get().dismissNotification(id);
      }, 4500);
    },

    dismissNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),

    setActiveExperimentId: (id) => set({ activeExperimentId: id }),

    updateExperimentParams: (patch) =>
      set((state) => ({
        experimentParams: { ...state.experimentParams, ...patch },
      })),

    pinExperimentResult: (result) =>
      set((state) => ({
        pinnedExperiments: {
          ...state.pinnedExperiments,
          [result.manifest.experimentId]: result,
        },
      })),

    runAndPinAllExperiments: () => {
      const { activeScenario, dispatchConfig, forecastDataset, experimentParams, addNotification } =
        get();
      const all = runAllEightExperiments({
        scenario: activeScenario,
        dispatchConfig,
        forecastDataset,
        expParams: experimentParams,
      });
      set({ pinnedExperiments: all });
      addNotification({
        title: '8-Experiment Suite Evaluated',
        detail: `Captured reproducible manifests across all 8 Phase 7 numerical benchmarks.`,
        tone: 'success',
      });
      return all;
    },
  };
});
