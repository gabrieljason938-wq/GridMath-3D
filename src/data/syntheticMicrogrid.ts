import type {
  Battery,
  CityNodeInfo,
  Generator,
  HourlyDemand,
  SimulationScenario,
} from '../types/grid';

function buildHourlyRecord(
  hour: number,
  residentialMW: number,
  commercialMW: number,
  industrialMW: number,
  temperatureDegC: number,
  solarIrradianceWm2: number,
  windCapacityFactor: number,
  tariffInrPerMWh: number,
): HourlyDemand {
  const totalMW = Number((residentialMW + commercialMW + industrialMW).toFixed(2));
  return {
    hour,
    timestampLabel: `${hour.toString().padStart(2, '0')}:00`,
    totalMW,
    residentialMW: Number(residentialMW.toFixed(2)),
    commercialMW: Number(commercialMW.toFixed(2)),
    industrialMW: Number(industrialMW.toFixed(2)),
    temperatureDegC: Number(temperatureDegC.toFixed(1)),
    solarIrradianceWm2: Number(solarIrradianceWm2.toFixed(0)),
    windCapacityFactor: Number(windCapacityFactor.toFixed(3)),
    tariffInrPerMWh: Number(tariffInrPerMWh.toFixed(0)),
    isSynthetic: true,
  };
}

const BASE_GENERATORS: Generator[] = [
  {
    id: 'gen-solar-01',
    name: 'Solar PV Array North',
    technology: 'solar',
    dispatchable: false,
    minMW: 0,
    maxMW: 160,
    rampRateMWPerHour: 160,
    marginalCostInrPerMWh: 0,
    carbonIntensityKgPerMWh: 0,
    available: true,
    zoneId: 'solar',
  },
  {
    id: 'gen-wind-01',
    name: 'Wind Corridor East',
    technology: 'wind',
    dispatchable: false,
    minMW: 0,
    maxMW: 95,
    rampRateMWPerHour: 95,
    marginalCostInrPerMWh: 0,
    carbonIntensityKgPerMWh: 0,
    available: true,
    zoneId: 'wind',
  },
  {
    id: 'gen-hydro-01',
    name: 'Run-of-River Hydro Unit',
    technology: 'hydro',
    dispatchable: true,
    minMW: 10,
    maxMW: 45,
    rampRateMWPerHour: 35,
    marginalCostInrPerMWh: 1850,
    carbonIntensityKgPerMWh: 24,
    available: true,
    zoneId: 'substation',
  },
  {
    id: 'gen-gas-01',
    name: 'CCGT Gas Turbine Unit',
    technology: 'gas',
    dispatchable: true,
    minMW: 25,
    maxMW: 150,
    rampRateMWPerHour: 90,
    marginalCostInrPerMWh: 4650,
    carbonIntensityKgPerMWh: 410,
    available: true,
    zoneId: 'thermal',
  },
  {
    id: 'gen-coal-01',
    name: 'Supercritical Thermal Peaker',
    technology: 'coal',
    dispatchable: true,
    minMW: 30,
    maxMW: 140,
    rampRateMWPerHour: 55,
    marginalCostInrPerMWh: 5850,
    carbonIntensityKgPerMWh: 820,
    available: true,
    zoneId: 'thermal',
  },
];

const BASE_BATTERY: Battery = {
  id: 'bess-01',
  name: 'Central LFP BESS Bank',
  capacityMWh: 180,
  maxChargeMW: 45,
  maxDischargeMW: 45,
  roundTripEfficiency: 0.9,
  minSocRatio: 0.1,
  maxSocRatio: 0.95,
  initialSocMWh: 90,
  currentSocMWh: 90,
  degradationCostInrPerMWh: 420,
};

// Synthetic Indian Urban Microgrid — Nominal Weekday (~448 MW peak)
const NOMINAL_HOURLY_DEMAND: HourlyDemand[] = [
  buildHourlyRecord(0, 108, 62, 74, 24.1, 0, 0.56, 3850),
  buildHourlyRecord(1, 98, 56, 72, 23.6, 0, 0.58, 3700),
  buildHourlyRecord(2, 92, 52, 70, 23.2, 0, 0.61, 3600),
  buildHourlyRecord(3, 89, 50, 71, 22.9, 0, 0.59, 3600),
  buildHourlyRecord(4, 94, 54, 76, 22.8, 0, 0.55, 3750),
  buildHourlyRecord(5, 112, 68, 86, 23.4, 15, 0.51, 4100),
  buildHourlyRecord(6, 134, 88, 96, 24.5, 95, 0.46, 4450),
  buildHourlyRecord(7, 152, 112, 106, 26.0, 260, 0.42, 4800),
  buildHourlyRecord(8, 158, 138, 114, 28.1, 470, 0.39, 5200),
  buildHourlyRecord(9, 146, 158, 118, 30.2, 680, 0.36, 5450),
  buildHourlyRecord(10, 138, 168, 120, 32.0, 830, 0.34, 5600),
  buildHourlyRecord(11, 134, 174, 120, 33.4, 920, 0.33, 5750),
  buildHourlyRecord(12, 132, 178, 116, 34.5, 950, 0.35, 5800),
  buildHourlyRecord(13, 136, 180, 116, 35.1, 910, 0.38, 5850),
  buildHourlyRecord(14, 142, 184, 118, 35.4, 820, 0.41, 6100),
  buildHourlyRecord(15, 148, 182, 116, 34.8, 670, 0.45, 6250),
  buildHourlyRecord(16, 156, 172, 112, 33.7, 460, 0.48, 6350),
  buildHourlyRecord(17, 174, 154, 104, 32.1, 210, 0.52, 6600),
  buildHourlyRecord(18, 198, 136, 98, 30.4, 35, 0.57, 7200),
  buildHourlyRecord(19, 218, 128, 96, 29.0, 0, 0.62, 7550),
  buildHourlyRecord(20, 224, 126, 98, 28.0, 0, 0.64, 7600),
  buildHourlyRecord(21, 206, 112, 94, 27.1, 0, 0.63, 6900),
  buildHourlyRecord(22, 172, 92, 86, 26.2, 0, 0.6, 5400),
  buildHourlyRecord(23, 134, 74, 78, 25.1, 0, 0.58, 4300),
];

// Summer Peak Heatwave Stress (~486 MW peak)
const HEATWAVE_HOURLY_DEMAND: HourlyDemand[] = NOMINAL_HOURLY_DEMAND.map((h) => {
  const hvacBoost = h.hour >= 11 && h.hour <= 21 ? 1.11 : 1.05;
  const res = Number((h.residentialMW * (h.hour >= 18 ? 1.12 : 1.05)).toFixed(2));
  const com = Number((h.commercialMW * hvacBoost).toFixed(2));
  const ind = Number((h.industrialMW * 1.03).toFixed(2));
  return buildHourlyRecord(
    h.hour,
    res,
    com,
    ind,
    h.temperatureDegC + 4.8,
    Math.min(1040, h.solarIrradianceWm2 * 1.08),
    Math.max(0.18, h.windCapacityFactor * 0.78),
    Math.round(h.tariffInrPerMWh * 1.14),
  );
});

// Monsoon Cloud-Ramp Event (~412 MW peak, mid-day PV drop)
const CLOUD_RAMP_HOURLY_DEMAND: HourlyDemand[] = NOMINAL_HOURLY_DEMAND.map((h) => {
  const cloudFactor = h.hour >= 11 && h.hour <= 15 ? 0.28 : 0.72;
  const res = Number((h.residentialMW * 0.93).toFixed(2));
  const com = Number((h.commercialMW * 0.91).toFixed(2));
  const ind = Number((h.industrialMW * 0.96).toFixed(2));
  return buildHourlyRecord(
    h.hour,
    res,
    com,
    ind,
    h.temperatureDegC - 3.2,
    h.solarIrradianceWm2 * cloudFactor,
    Math.min(0.92, h.windCapacityFactor * 1.32),
    Math.round(h.tariffInrPerMWh * 1.05),
  );
});

// 4. High-Wind Renewable Surplus (~392 MW mild load + strong wind corridor)
const HIGH_WIND_SURPLUS_DEMAND: HourlyDemand[] = NOMINAL_HOURLY_DEMAND.map((h) =>
  buildHourlyRecord(
    h.hour,
    h.residentialMW * 0.88,
    h.commercialMW * 0.87,
    h.industrialMW * 0.92,
    h.temperatureDegC - 2.4,
    h.solarIrradianceWm2 * 0.95,
    Math.min(1, h.windCapacityFactor * 1.55),
    Math.round(h.tariffInrPerMWh * 0.9),
  ),
);

// 6. Evening Peak Surge (17:00-22:00 residential & commercial dusk load +28%, zero solar)
const EVENING_PEAK_DEMAND: HourlyDemand[] = NOMINAL_HOURLY_DEMAND.map((h) => {
  const isEvening = h.hour >= 17 && h.hour <= 22;
  const resMult = isEvening ? 1.28 : 1.0;
  const comMult = isEvening ? 1.18 : 1.0;
  return buildHourlyRecord(
    h.hour,
    h.residentialMW * resMult,
    h.commercialMW * comMult,
    h.industrialMW,
    h.temperatureDegC + (isEvening ? 2.1 : 0.4),
    h.solarIrradianceWm2,
    h.windCapacityFactor * (isEvening ? 0.75 : 1.0),
    Math.round(h.tariffInrPerMWh * (isEvening ? 1.22 : 1.0)),
  );
});

// 7. Industrial Production Surge (+55 MW industrial park demand across 08:00-21:00 shift)
const INDUSTRIAL_SURGE_DEMAND: HourlyDemand[] = NOMINAL_HOURLY_DEMAND.map((h) => {
  const inShift = h.hour >= 8 && h.hour <= 21;
  return buildHourlyRecord(
    h.hour,
    h.residentialMW,
    h.commercialMW,
    h.industrialMW + (inShift ? 55 : 20),
    h.temperatureDegC,
    h.solarIrradianceWm2,
    h.windCapacityFactor,
    Math.round(h.tariffInrPerMWh * (inShift ? 1.08 : 1.0)),
  );
});

interface ScenarioOverrides {
  generatorMods?: Record<string, Partial<Generator>>;
  batteryMods?: Partial<Battery>;
  changedProperties?: string[];
}

function createScenario(
  id: string,
  name: string,
  subtitle: string,
  seasonTag: string,
  hourlyDemand: HourlyDemand[],
  overrides: ScenarioOverrides = {},
): SimulationScenario {
  const peakDemandMW = Number(
    Math.max(...hourlyDemand.map((d) => d.totalMW)).toFixed(2),
  );
  const generators = BASE_GENERATORS.map((g) => ({
    ...g,
    ...(overrides.generatorMods?.[g.id] ?? {}),
  }));
  const battery: Battery = {
    ...BASE_BATTERY,
    ...(overrides.batteryMods ?? {}),
  };
  const installedGenerationMW = generators
    .filter((g) => g.available)
    .reduce((acc, g) => acc + g.maxMW, 0);
  const renewableCapacityMW = generators
    .filter(
      (g) =>
        g.available &&
        (g.technology === 'solar' || g.technology === 'wind' || g.technology === 'hydro'),
    )
    .reduce((acc, g) => acc + g.maxMW, 0);

  return {
    id,
    name,
    subtitle,
    regionLabel: 'Urban Smart Microgrid · Synthetic Baseline (INR Tariff)',
    seasonTag,
    peakDemandMW,
    installedGenerationMW,
    renewableCapacityMW,
    batteryCapacityMWh: battery.capacityMWh,
    hourlyDemand,
    generators,
    battery,
    isSynthetic: true,
    changedProperties: overrides.changedProperties ?? ['Baseline profile'],
  };
}

export const SYNTHETIC_SCENARIOS: SimulationScenario[] = [
  createScenario(
    'urban-nominal',
    '1. Normal Weekday (~448 MW)',
    'Balanced diurnal solar generation, commercial midday peak, and evening residential load',
    'Normal Weekday · Synthetic Baseline',
    NOMINAL_HOURLY_DEMAND,
    {
      changedProperties: ['Canonical baseline weather, load, fleet, and 50% BESS initial SoC'],
    },
  ),
  createScenario(
    'urban-heatwave',
    '2. Summer Peak Demand (~489 MW)',
    'Afternoon +4.8°C heatwave boosting residential & commercial HVAC cooling demand',
    'Summer Peak · Synthetic Stress',
    HEATWAVE_HOURLY_DEMAND,
    {
      changedProperties: ['+4.8°C ambient temp', '+5–12% HVAC demand', '22% lower coastal wind'],
    },
  ),
  createScenario(
    'urban-cloud-ramp',
    '3. Cloudy Low-Solar Day (~418 MW)',
    'Overcast monsoon cloud cover reducing mid-day PV irradiance by 72%',
    'Cloudy Low-Solar · Synthetic Stress',
    CLOUD_RAMP_HOURLY_DEMAND,
    {
      changedProperties: ['-72% midday solar irradiance', '-3.2°C temp', '+32% monsoon wind'],
    },
  ),
  createScenario(
    'urban-high-wind-surplus',
    '4. High-Wind Renewable Surplus (~398 MW)',
    'Strong 1.55x wind corridor inflow paired with mild weekday load',
    'Renewable Surplus · Synthetic Case',
    HIGH_WIND_SURPLUS_DEMAND,
    {
      changedProperties: ['1.55x wind CF (capped at 100%)', '-10% mild weekday demand'],
    },
  ),
  createScenario(
    'urban-thermal-outage',
    '5. Thermal Generator Outage (Coal Offline)',
    'Forced outage of 140 MW Supercritical Thermal Peaker testing reserve adequacy',
    'N-1 Thermal Outage · Contingency',
    NOMINAL_HOURLY_DEMAND.map((h) => ({ ...h })),
    {
      generatorMods: {
        'gen-coal-01': { available: false },
      },
      changedProperties: ['Supercritical Thermal Peaker (140 MW) forced offline', 'Demand & weather preserved'],
    },
  ),
  createScenario(
    'urban-evening-peak',
    '6. Evening Peak Surge (~497 MW)',
    'Sharp 17:00–22:00 residential & commercial dusk demand spike after solar sunset',
    'Evening Ramp Stress · Synthetic Case',
    EVENING_PEAK_DEMAND,
    {
      changedProperties: ['+28% residential / +18% commercial load (17:00–22:00)', '+22% evening tariff'],
    },
  ),
  createScenario(
    'urban-industrial-surge',
    '7. Industrial Production Surge (~499 MW)',
    'Sustained +55 MW heavy manufacturing shift across industrial district',
    'Industrial Surge · Synthetic Case',
    INDUSTRIAL_SURGE_DEMAND,
    {
      changedProperties: ['+55 MW industrial demand (08:00–21:00)', 'Residential, commercial & weather preserved'],
    },
  ),
  createScenario(
    'urban-battery-depletion',
    '8. Battery Storage Depletion (12.2% SoC)',
    'BESS begins cycle depleted at 22 MWh near 18 MWh floor requiring early recharge',
    'Depleted BESS · Synthetic Case',
    NOMINAL_HOURLY_DEMAND.map((h) => ({ ...h })),
    {
      batteryMods: {
        initialSocMWh: 22,
        currentSocMWh: 22,
      },
      changedProperties: ['BESS initial SoC 22 MWh (12.2%) vs 90 MWh nominal', 'Demand & fleet preserved'],
    },
  ),
];

export const CITY_NODE_CATALOG: CityNodeInfo[] = [
  {
    id: 'substation',
    label: 'Central 220/33 kV Substation',
    category: 'Transmission',
    description: 'Six step-down transformers, twin 220 kV H-frame gantries, copper busbars, SF6 bays, and SCADA control.',
    coordinates: [0, 0, 0],
  },
  {
    id: 'solar',
    label: 'Solar PV Park North (160 MW)',
    category: 'Generation',
    description: '96 dual-module solar tracking arrays across four quadrants with 4 inverter skids and met tower.',
    coordinates: [-34, 0, -28],
  },
  {
    id: 'wind',
    label: 'Wind Farm Ridge (95 MW)',
    category: 'Generation',
    description: 'Twelve staggered horizontal-axis wind turbines on a terraced ridge modulated by wind capacity factor.',
    coordinates: [34, 0, -28],
  },
  {
    id: 'bess',
    label: 'Central LFP BESS Campus (180 MWh)',
    category: 'Storage',
    description: 'Twelve bidirectional 45 MW LFP battery containers with 4 PCS inverter stations and live SoC gantry.',
    coordinates: [-34, 0, 0],
  },
  {
    id: 'thermal',
    label: 'CCGT & Thermal Station (290 MW)',
    category: 'Generation',
    description: 'Twin turbine halls, HRSG boiler headers, three exhaust stacks, and four hyperboloid cooling towers.',
    coordinates: [34, 0, 0],
  },
  {
    id: 'commercial',
    label: 'Commercial CBD & Medical Center',
    category: 'Demand',
    description: 'Eight curtain-wall skyscrapers up to 19.5u, skybridge towers, transit galleria, and hospital helipad.',
    coordinates: [0, 0, 27.5],
  },
  {
    id: 'residential',
    label: 'Residential Smart District',
    category: 'Demand',
    description: 'Eight mid/high-rise apartment towers, 16 suburban villas, collector streets, and central park.',
    coordinates: [-34.2, 0, 27.5],
  },
  {
    id: 'industrial',
    label: 'Industrial & Process Park',
    category: 'Demand',
    description: 'Sawtooth manufacturing halls, assembly plants, logistics bays, silos, spherical tanks, and pipe racks.',
    coordinates: [34.2, 0, 27.5],
  },
];
