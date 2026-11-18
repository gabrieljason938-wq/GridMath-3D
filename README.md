# GRIDMATH 3D

**Numerical Intelligence for Smart Grid Demand Forecasting and Optimal Energy Dispatch**

GRIDMATH 3D is an engineering capstone platform combining a deterministic pure-TypeScript + `mathjs` numerical computation engine, an interactive Three.js / React Three Fiber 3D Smart City Digital Twin, a KaTeX-rendered Numerical Mathematics Laboratory, a causal Householder QR 24-hour demand forecaster, a Two-Phase Bounded Simplex multi-period optimal dispatch solver, and a reproducible 8-experiment scientific reporting workspace.

> **Data Provenance Notice:** Built-in scenarios and default 14-day load histories are calibrated **synthetic** demonstration models of an ~450 MW peak Indian urban smart microgrid (`INR` tariff). They are explicitly marked as synthetic and are never presented as measured real-world utility SCADA telemetry. Real CSV datasets can be uploaded in the Forecasting Lab.

---

## Core Capabilities

1. **Command Center (`/dashboard`)**: Synchronized 24-hour KPIs, interactive 3D architectural city preview, load/generation profile scrubber, deterministic playback (`0.5×`–`4×`), and live solver/forecast health indicators.
2. **3D Smart City Digital Twin (`/smart-city`)**: Orthographic isometric architectural white-theme city featuring Residential, Commercial & Hospital, Industrial, Solar PV, Wind, Thermal, LFP BESS, and 220/33 kV Substation zones; MW-proportional animated power-flow conduits; diurnal studio lighting; zone inspector; `High | Balanced | Low` rendering quality selector; and `prefers-reduced-motion` + 2D schematic WebGL fallback.
3. **Numerical Mathematics Laboratory (`/mathematics`)**: Six interactive experiments (Newton Divided Differences, Gaussian Elimination with Partial Pivoting, Householder QR Least Squares, Finite Differences, Composite Trapezoidal & Simpson's 1/3 Quadrature, and Two-Phase Simplex LP) with KaTeX derivations, step-by-step solvers, 3D WebGL plots, and residual verification.
4. **Demand Forecasting Lab (`/forecasting`)**: CSV ingestion with missing/duplicate/invalid-value/unit validation, consistent timezone parsing (`Asia/Kolkata`, `UTC`, `Local`), strict causal train/holdout splitting, Fourier harmonic + temperature + lagged-load Householder QR regression, MAE/RMSE/sMAPE/validity-aware MAPE diagnostics, and one-click coupling to optimal dispatch.
5. **Optimal Energy Dispatch Engine (`/dispatch`)**: 24-hour multi-period Two-Phase Bounded Simplex LP minimizing thermal cost, battery cycling cost, optional carbon pricing/cap, and Value of Lost Load (VOLL = ₹25,000/MWh) subject to power balance, generator capacities, thermal ramp limits, and BESS state-of-charge dynamics ($\eta = 0.90$). Includes fair same-constraint comparison against Renewable-Priority Heuristic and Thermal-First baselines.
6. **Unified Digital Twin & Scenarios (`/experiments`)**: Eight interactive scenarios (Normal Weekday, Summer Peak, Cloudy Low-Solar, High-Wind Surplus, Thermal Outage, Evening Peak, Industrial Surge, Battery Depletion), weather & fleet perturbation sliders, calculation audit log, and the **8-Experiment Reproducible Scientific Workspace (`EXP-01`–`EXP-08`)**.
7. **Academic Capstone Reports (`/reports`)**: 11-section browser-printable PDF manuscript (`@media print`) alongside 24-hour dispatch CSV, 8-experiment CSV, and full JSON reproducibility exports.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router v7 (lazy-loaded route chunks), Zustand v5
- **3D Visualization**: Three.js, React Three Fiber v9, Drei v10
- **Numerical Stack**: Pure TypeScript solvers (`Householder QR`, `Two-Phase Bounded Simplex`, `Partial-Pivoting Gaussian Elimination`, `Composite Quadrature`, `Newton Divided Differences`) + `mathjs` + `KaTeX`
- **Verification**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`), Vite production bundler (`npm run build`)

---

## Quick Start

```bash
npm install
npm run dev       # Start development server at http://localhost:3000
npm run lint      # Strict TypeScript type-check (tsc --noEmit)
npm test          # Run Vitest numerical & integration test suites
npm run build     # Build optimized production bundle into dist/
```

---

## Documentation Index

- [Architecture & State Pipeline](./docs/ARCHITECTURE.md)
- [Numerical Methodology & Tolerances](./docs/NUMERICAL_METHODOLOGY.md)
- [Dataset Schema, Units & Validation Rules](./docs/DATASET_SCHEMA.md)
- [Testing, Performance & Reproducibility](./docs/TESTING_AND_REPRODUCIBILITY.md)
