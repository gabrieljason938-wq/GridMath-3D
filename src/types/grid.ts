/**
 * Shared Domain Types for GRIDMATH 3D
 *
 * Canonical Engineering Units:
 * - Power: MW
 * - Energy: MWh
 * - Price / Marginal Cost / Tariff: INR/MWh
 * - Total Cost: INR
 * - Carbon Emissions: kgCO2e or tCO2e
 */

export type PowerMW = number;
export type EnergyMWh = number;
export type PriceInrPerMWh = number;
export type CostInr = number;
export type EmissionsKgCO2e = number;
export type EmissionsTonnesCO2e = number;

export type GeneratorTechnology = 'solar' | 'wind' | 'gas' | 'coal' | 'hydro';

export type GridBalanceStatus = 'Surplus' | 'Balanced' | 'Deficit';

export type SubsystemPhaseStatus =
  | 'Phase 1 Synthetic Baseline'
  | 'Phase 1 Merit-Order Baseline'
  | 'Phase 1 Linear/Root Core'
  | 'Ready for Phase 2'
  | 'Ready for Phase 3'
  | 'Optimal LP Active'
  | 'Heuristic Active'
  | 'Constraint Infeasible';

export type CityZoneId =
  | 'substation'
  | 'solar'
  | 'wind'
  | 'bess'
  | 'thermal'
  | 'commercial'
  | 'residential'
  | 'industrial';

export interface HourlyDemand {
  /** Hour index in [0, 23] */
  hour: number;
  /** Formatted 24h label e.g. "14:00" */
  timestampLabel: string;
  /** Total demand in MW */
  totalMW: PowerMW;
  /** Residential sector demand in MW */
  residentialMW: PowerMW;
  /** Commercial district demand in MW */
  commercialMW: PowerMW;
  /** Industrial zone demand in MW */
  industrialMW: PowerMW;
  /** Ambient dry-bulb temperature in degrees Celsius */
  temperatureDegC: number;
  /** Global horizontal solar irradiance in W/m^2 */
  solarIrradianceWm2: number;
  /** Normalized wind resource factor in [0, 1] */
  windCapacityFactor: number;
  /** Time-of-use electricity tariff in INR/MWh */
  tariffInrPerMWh: PriceInrPerMWh;
  /** Provenance flag indicating synthetic dataset origin */
  isSynthetic: boolean;
}

export interface Generator {
  id: string;
  name: string;
  technology: GeneratorTechnology;
  /** Whether the unit can be actively ramped by dispatch */
  dispatchable: boolean;
  /** Minimum stable generation in MW */
  minMW: PowerMW;
  /** Nameplate maximum generation capacity in MW */
  maxMW: PowerMW;
  /** Maximum hourly ramp rate in MW/h */
  rampRateMWPerHour: PowerMW;
  /** Marginal generation cost in INR/MWh */
  marginalCostInrPerMWh: PriceInrPerMWh;
  /** Carbon emission factor in kgCO2e/MWh */
  carbonIntensityKgPerMWh: number;
  /** Operational availability */
  available: boolean;
  /** Corresponding 3D city twin zone */
  zoneId: CityZoneId;
}

export interface Battery {
  id: string;
  name: string;
  /** Rated energy storage capacity in MWh */
  capacityMWh: EnergyMWh;
  /** Maximum charging power in MW */
  maxChargeMW: PowerMW;
  /** Maximum discharging power in MW */
  maxDischargeMW: PowerMW;
  /** Round-trip AC-to-AC efficiency in (0, 1] */
  roundTripEfficiency: number;
  /** Minimum allowable State of Charge fraction [0, 1] */
  minSocRatio: number;
  /** Maximum allowable State of Charge fraction [0, 1] */
  maxSocRatio: number;
  /** Initial State of Charge at hour 0 in MWh */
  initialSocMWh: EnergyMWh;
  /** Current simulated State of Charge in MWh */
  currentSocMWh: EnergyMWh;
  /** Cycling degradation cost in INR/MWh */
  degradationCostInrPerMWh: PriceInrPerMWh;
}

export interface ForecastPoint {
  hour: number;
  timestampLabel: string;
  actualSyntheticMW: PowerMW;
  predictedMW: PowerMW;
  lowerBoundMW: PowerMW;
  upperBoundMW: PowerMW;
  residualMW: PowerMW;
}

export interface ForecastResult {
  scenarioId: string;
  horizonHours: number;
  modelName: string;
  modelStatus: SubsystemPhaseStatus;
  maeMW: PowerMW;
  rmseMW: PowerMW;
  mapePercent: number;
  rSquared: number;
  points: ForecastPoint[];
  isSyntheticBaseline: boolean;
}

export interface GeneratorSetpoint {
  generatorId: string;
  name: string;
  technology: GeneratorTechnology;
  availableMaxMW: PowerMW;
  dispatchedMW: PowerMW;
  utilizationPercent: number;
  hourlyCostInr: CostInr;
  hourlyEmissionsKgCO2e: EmissionsKgCO2e;
}

export interface DispatchResult {
  hour: number;
  timestampLabel: string;
  totalDemandMW: PowerMW;
  totalAvailableGenerationMW: PowerMW;
  totalDispatchedGenerationMW: PowerMW;
  renewableGenerationMW: PowerMW;
  renewableContributionPercent: number;
  /** Positive = discharging to grid (MW); Negative = charging from grid (MW) */
  batteryNetPowerMW: PowerMW;
  batterySocMWh: EnergyMWh;
  batterySocPercent: number;
  unservedEnergyMW: PowerMW;
  curtailmentMW: PowerMW;
  dispatchCostInr: CostInr;
  averageCostInrPerMWh: PriceInrPerMWh;
  emissionsKgCO2e: EmissionsKgCO2e;
  emissionsTonnesCO2e: EmissionsTonnesCO2e;
  balanceStatus: GridBalanceStatus;
  reserveMarginMW: PowerMW;
  generatorSetpoints: GeneratorSetpoint[];
  solverName: string;
  solverStatus: SubsystemPhaseStatus;
}

export interface NumericalStep {
  iteration: number;
  estimate: number;
  residualNorm: number;
  stepSize: number;
  objectiveValue?: number;
  converged: boolean;
  note: string;
}

export interface SimulationScenario {
  id: string;
  name: string;
  subtitle: string;
  regionLabel: string;
  seasonTag: string;
  peakDemandMW: PowerMW;
  installedGenerationMW: PowerMW;
  renewableCapacityMW: PowerMW;
  batteryCapacityMWh: EnergyMWh;
  hourlyDemand: HourlyDemand[];
  generators: Generator[];
  battery: Battery;
  isSynthetic: boolean;
  /** Explicit list of properties modified relative to the baseline scenario */
  changedProperties?: string[];
}

export interface WeatherControls {
  /** Additive temperature perturbation in deg C relative to scenario baseline */
  temperatureDeltaDegC: number;
  /** Multiplicative scalar on solar irradiance [0.1, 1.3] */
  solarIrradianceScale: number;
  /** Multiplicative scalar on wind capacity factor [0.2, 1.6] */
  windResourceScale: number;
  /** Multiplicative scalar on base city electricity demand [0.75, 1.35] */
  demandScaleFactor: number;
}

export interface GeneratorOverride {
  maxMW?: PowerMW;
  available?: boolean;
}

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

export type RenderQuality = 'high' | 'balanced' | 'low';

export type EnvironmentMode = 'day' | 'sunset' | 'night' | 'cloudy' | 'rainy';

export interface CalculationHistoryEntry {
  id: string;
  timestampIso: string;
  trigger: string;
  scenarioId: string;
  scenarioName: string;
  peakDemandMW: PowerMW;
  totalDailyCostInr: CostInr;
  totalEmissionsTonnesCO2e: EmissionsTonnesCO2e;
  unservedEnergyMWh: EnergyMWh;
  maxBalanceResidualMW: number;
  solverStatus: string;
  computeMs: number;
}

export interface ScenarioValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checkedRecords: number;
}

export interface DaySimulationSummary {
  scenarioId: string;
  predictedPeakDemandMW: PowerMW;
  peakDemandHour: number;
  totalDailyEnergyMWh: EnergyMWh;
  totalDailyCostInr: CostInr;
  totalDailyEmissionsTonnesCO2e: EmissionsTonnesCO2e;
  averageRenewableSharePercent: number;
  hourlyDispatches: DispatchResult[];
}

export interface CityNodeInfo {
  id: CityZoneId;
  label: string;
  category: 'Generation' | 'Storage' | 'Transmission' | 'Demand';
  description: string;
  coordinates: [number, number, number];
}
