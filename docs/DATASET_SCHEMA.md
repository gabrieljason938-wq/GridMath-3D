# Dataset Schema, Canonical Units & Validation — GRIDMATH 3D

## Canonical Engineering Units
All modules enforce consistent units without implicit unit conversions:
- **Electrical Power**: `MW` (Megawatts)
- **Electrical Energy**: `MWh` (Megawatt-hours)
- **Tariff / Marginal Cost**: `INR/MWh`
- **Total Operational Cost**: `INR`
- **Carbon Emissions**: `kgCO2e` (hourly) / `tCO2e` (tonnes $\text{CO}_2\text{e}$)
- **Temperature**: `°C` (Celsius)
- **Solar Irradiance**: `W/m²`

## Forecasting CSV Upload Schema (`datasetManager.ts`)
Uploaded CSV files must include a header row with canonical units:

| Column Header (Accepted Aliases) | Unit | Required | Validation Rule |
| :--- | :--- | :--- | :--- |
| `timestamp` (`datetime`, `time`, `date`) | ISO-8601 / `YYYY-MM-DD HH:mm` | Yes | Parsed under chosen timezone (`Asia/Kolkata`, `UTC`, `Local`); duplicates rejected |
| `demand_mw` (`demand`, `load_mw`, `load`, `mw`) | `MW` | Yes | Finite, $\ge 0$ (`_kw`, `_w`, `_gw` rejected) |
| `temperature_c` (`temperature`, `temp_c`, `temp`) | `°C` | Yes | Finite, `[-45, 60]` (`_f`, `fahrenheit`, `kelvin` rejected) |
| `humidity_pct` (`humidity`, `rh`) | `%` | Optional | Finite, `[0, 100]` |
| `weather` (`condition`) | String | Optional | Stored as label (`Clear`, `Cloudy`, etc.) |
| `is_holiday` (`holiday`) | `0/1`, `true/false` | Optional | Parsed into boolean holiday indicator |

### Ingestion Cleaning & Audit Counters (`DataQualityReport`)
- `missingValueCount`: Rows missing required timestamp, demand, or temperature cells.
- `duplicateTimestampCount`: Rows colliding within 1-minute epoch resolution.
- `invalidValueCount`: Non-finite values, negative demand MW, out-of-range temperatures, invalid humidity, or rejected unit headers.
- `chronologicallySorted`: All retained valid rows sorted ascending by `epochMs` before causal train/holdout splitting.

## Microgrid Scenario Schema (`syntheticMicrogrid.ts`, `ingestion.ts`)
Each `SimulationScenario` contains 24 `HourlyDemand` objects (`hour` `0..23`), a `Generator[]` fleet (`Solar PV`, `Wind`, `CCGT Gas`, `Coal`), and a `Battery` (`LFP BESS`, 120 MWh / 45 MW, $\eta = 0.90$). `validateScenario()` enforces:
- `|residentialMW + commercialMW + industrialMW - totalMW| <= 0.05` MW
- `solarIrradianceWm2` in `[0, 1400]`, `windCapacityFactor` in `[0, 1]`
- Positive generator ramp rates, valid `[minMW, maxMW]`, and BESS initial SoC inside `[minSocRatio * capacityMWh, maxSocRatio * capacityMWh]`.
