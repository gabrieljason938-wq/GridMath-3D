# Architecture — GRIDMATH 3D

GRIDMATH 3D separates numerical algorithms, ingestion validation, unified simulation orchestration, global store state, React UI pages, and 3D WebGL scene rendering into distinct layers.

## Directory Structure

```text
src/
├── math/                  # Pure numerical algorithms & mathjs verification core
│   ├── differentiation.ts       # Forward, backward, central finite differences + O(h^2) convergence
│   ├── gaussianElimination.ts   # Partial-pivoting LU/elimination with step-by-step snapshots
│   ├── integration.ts           # Composite Trapezoidal & Simpson's 1/3 quadrature (MW -> MWh)
│   ├── interpolation.ts         # Newton Divided Differences + Horner evaluation
│   ├── linearProgramming.ts     # Educational Two-Phase Simplex + 2D/3D polytope enumeration
│   ├── numericalCore.ts         # mathjs LU solver, error metrics, Newton-Raphson scalar solver
│   └── regression.ts            # Householder QR least squares (1 & 2 predictors)
├── forecasting/
│   ├── datasetManager.ts        # CSV parser, schema/unit validator, timezone parser, synthetic 14d history
│   ├── numericalForecaster.ts   # Causal feature matrix builder, QR fitter, naive baseline comparison
│   └── baselineForecaster.ts    # Phase 1 diurnal harmonic baseline reference
├── optimization/
│   ├── boundedSimplex.ts        # Lower/upper-bounded Two-Phase Simplex LP solver
│   ├── optimalDispatchEngine.ts # 24h multi-period dispatch LP + heuristic & thermal-first comparators
│   └── meritOrderDispatch.ts    # Phase 1 merit-order baseline reference
├── simulation/
│   └── digitalTwinPipeline.ts   # Authoritative end-to-end execution pipeline & 8-scenario matrix
├── experiments/
│   └── scientificExperiments.ts # Reproducible EXP-01..EXP-08 benchmarks + CSV serialization
├── data/
│   ├── ingestion.ts             # Scenario, demand, generator, and battery physical validator
│   └── syntheticMicrogrid.ts    # 8 validated ~450 MW peak synthetic urban microgrid scenarios
├── store/
│   └── useSimulationStore.ts    # Single-source Zustand store (scenario, clock, quality, twin outputs)
├── components/
│   ├── three/                   # Architectural 3D Smart City Digital Twin (R3F + Drei)
│   ├── math3d/                  # Interactive 3D plots for Math Lab & Scientific Experiments
│   └── mathlab/                 # Synchronized 4-panel KaTeX/Stepper/3D/Validation workspaces
└── pages/                       # Lazy-loaded route views (/dashboard, /smart-city, ..., /reports)
```

## Single Authoritative Pipeline

All pages read from `useSimulationStore`, which executes `executeDigitalTwinPipeline()` whenever a scenario, weather perturbation, generator capacity override, BESS initial SoC, forecast dataset, or dispatch optimization config changes:

1. **Scenario & Perturbation Resolution**: Applies `WeatherControls` ($\Delta T$, solar scaling, wind scaling, load scaling), `GeneratorOverride` limits/outages, `batteryInitialSocOverrideMWh`, or coupled forecast demand (`useForecastDrivenDemand` / `customForecastSeries`).
2. **Physical Validation**: Runs `validateScenario()` to verify non-negative finite loads, sector-to-total reconciliation, physical irradiance (`[0, 1400] W/m²`), wind CF (`[0, 1]`), generator bounds, and BESS operating limits.
3. **Causal Forecasting**: Executes `runNumericalDemandForecast()` using Householder QR over strictly historical training windows (`maxTrainEpochMs < minHoldoutEpochMs`).
4. **Multi-Period Optimal Dispatch**: Executes `runOptimalEnergyDispatch()` via Two-Phase Bounded Simplex LP and evaluates constraint residuals across all 24 hours.
5. **O(1) Time Stepping**: Scrubbing `activeHour` (`0..23`) or running playback (`Play`/`Pause`) indexes pre-computed `hourlyDispatches[hour]` and `hourlyDemand[hour]` without re-invoking the LP solver on every tick.
6. **3D Telemetry Mapping**: `computeGridVisualTelemetry()` converts `DispatchResult` and `HourlyDemand` into deterministic diurnal lighting and 7 transmission corridor specs (`particleCount`, `particleSpeed`, `lineRadius`, shortage alerts, and bidirectional BESS flow direction).
