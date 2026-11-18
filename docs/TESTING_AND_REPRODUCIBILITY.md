# Testing, Performance & Reproducibility — GRIDMATH 3D

## Automated Verification Commands

```bash
npm test      # Executes Vitest numerical & integration suites (src/tests/*.test.ts)
npm run lint  # Executes TypeScript compiler check (tsc --noEmit)
npm run build # Produces production Vite bundle with route-level code splitting
```

## Test Coverage Summary
- `src/tests/mathAndGrid.test.ts`: Validates all 8 synthetic scenarios, Phase 1–7 numerical algorithms, Householder QR forecasting (zero future leakage), multi-period Two-Phase Bounded Simplex LP optimality vs heuristic/thermal baselines, carbon pricing/cap infeasibility handling, unified digital twin state transitions, and all 8 Phase 7 scientific experiments.
- `src/tests/qaAndIntegration.test.ts`: Verifies numerical edge cases (unsorted/duplicate interpolation nodes, singular and 5×5 Hilbert ill-conditioned systems, collinear least squares, zero/negative finite-difference steps, inverted integration bounds, unbounded/large-scale LPs, depleted/zero-efficiency batteries, invalid CSV units like `demand_kw` / `temperature_f`) and end-to-end integration flows (forecast-to-dispatch coupling, 3D telemetry scaling, numerical steppers, 8-scenario switching, quality presets, and CSV/JSON exports).

## 3D Performance & Accessibility Architecture
- **Route Code-Splitting**: All 7 pages in `src/App.tsx` load lazily via `React.lazy()` + `<Suspense>`.
- **Performance Quality Selector (`High` | `Balanced` | `Low`)**: Controlled via `useSimulationStore.renderQuality` (exposed in both `/smart-city` dock and `/dashboard` 3D preview header) and honored by `SmartCityViewport`, `SmartCityScene`, `TransmissionNetwork`, `EnergyInfrastructure`, `InfrastructureDistricts`, and `MathLabViewport`:
  - `High`: DPR up to `2`, `2048×2048` shadow maps, `RoomEnvironment` PMREM reflections, 28-segment cable conduits, full 18 instanced trees, up to 8 particles/corridor.
  - `Balanced` (default): DPR up to `1.5`, `1024×1024` shadow maps, `RoomEnvironment` PMREM, 20-segment conduits, up to 6 particles/corridor.
  - `Low`: DPR `1`, shadows disabled, PMREM skipped, 12-segment conduits, 10 trees, up to 4 particles/corridor.
- **Software WebGL & Fallback**: `detectSoftwareWebGL()` automatically avoids heavy shadows/PMREM on SwiftShader/llvmpipe; `StaticCityFallback` provides a live 2D architectural schematic if WebGL is unavailable or context-lost.
- **Accessibility**: `usePrefersReducedMotion()` + CSS `@media (prefers-reduced-motion: reduce)` freeze continuous 3D rotor/particle/fan motion and snap camera transitions; `KaTeXFormula` exposes `role="math"` + `aria-label`; `HourlyProfileChart` supports keyboard `Tab`/`Enter`/`Space`; global `:focus-visible` outlines and skip-to-content navigation are enabled.

## Experiment Reproducibility
Every Phase 7 experiment (`EXP-01` through `EXP-08`) records a `ReproducibilityManifest` containing `softwareVersion`, `timestampIso`, `dataProvenance`, `algorithmName`, `parameters`, `numericalTolerance`, `seedLabel` (using deterministic Mulberry32 PRNG for synthetic noise in `EXP-04`), and live measured `computeMs`. Full manifests can be exported via CSV or JSON from `/experiments` and `/reports`.
