import * as THREE from 'three';
import type {
  CityZoneId,
  DispatchResult,
  EnvironmentMode,
  HourlyDemand,
} from '../../types/grid';

export interface TransmissionCorridorSpec {
  id: string;
  label: string;
  fromZone: CityZoneId;
  toZone: CityZoneId;
  curve: THREE.CatmullRomCurve3;
  flowMW: number;
  maxCapacityMW: number;
  utilizationRatio: number;
  particleCount: number;
  particleSpeed: number;
  colorHex: string;
  lineRadius: number;
  isShortage: boolean;
}

export interface DiurnalLightingState {
  hour: number;
  environmentMode: EnvironmentMode;
  isDaytime: boolean;
  isNight: boolean;
  isRainy: boolean;
  isCloudy: boolean;
  isSunset: boolean;
  sunsetWeight: number;
  daylightFactor: number;
  nightIlluminationFactor: number;
  powerLineGlowIntensity: number;
  surfaceWetness: number;
  backgroundHex: string;
  fogHex: string;
  fogNear: number;
  fogFar: number;
  sunPosition: [number, number, number];
  keyLightIntensity: number;
  hemiIntensity: number;
  fillLightIntensity: number;
  keyLightColor: string;
  skyTintColor: string;
  groundTintColor: string;
  fillLightColor: string;
  skyTopHex: string;
  skyHorizonHex: string;
  sunGlowHex: string;
  hillNearHex: string;
  hillFarHex: string;
  cloudCoverage: number;
  cloudTintHex: string;
  cloudRimHex: string;
  waterTintHex: string;
  waterSheenColorHex: string;
  waterSheenIntensity: number;
  vegetationTintHex: string;
  meadowTintHex: string;
  sunHaloRadiusFactor: number;
  exposure: number;
  skySunPosition: [number, number, number];
  skyTurbidity: number;
  skyRayleigh: number;
  skyMieCoefficient: number;
  skyMieDirectionalG: number;
  skyCloudDensity: number;
  skyCloudElevation: number;
}

export interface GridVisualTelemetry {
  solarMW: number;
  windMW: number;
  hydroMW: number;
  thermalMW: number;
  bessNetMW: number;
  bessSocPercent: number;
  residentialMW: number;
  commercialMW: number;
  industrialMW: number;
  supplyShortage: boolean;
  tightReserve: boolean;
  corridors: TransmissionCorridorSpec[];
  lighting: DiurnalLightingState;
}

export const ENVIRONMENT_MODE_PRESETS: Record<
  EnvironmentMode,
  {
    label: string;
    defaultHour: number;
    temperatureDeltaDegC: number;
    solarIrradianceScale: number;
    windResourceScale: number;
    demandScaleFactor: number;
    summary: string;
  }
> = {
  day: {
    label: 'Day',
    defaultHour: 14,
    temperatureDeltaDegC: 0,
    solarIrradianceScale: 1.0,
    windResourceScale: 1.0,
    demandScaleFactor: 1.0,
    summary: 'Clear sky · Peak solar irradiance · Crisp architectural daylight',
  },
  sunset: {
    label: 'Sunset',
    defaultHour: 18,
    temperatureDeltaDegC: 1.5,
    solarIrradianceScale: 0.45,
    windResourceScale: 1.08,
    demandScaleFactor: 1.04,
    summary: 'Golden hour · Low sun angle · Evening ramp & building glow',
  },
  night: {
    label: 'Night',
    defaultHour: 21,
    temperatureDeltaDegC: -1.5,
    solarIrradianceScale: 0.05,
    windResourceScale: 1.12,
    demandScaleFactor: 1.0,
    summary: 'Dark blue night · Zero solar · Luminous grid lines & city lights',
  },
  cloudy: {
    label: 'Cloudy',
    defaultHour: 13,
    temperatureDeltaDegC: -2.0,
    solarIrradianceScale: 0.42,
    windResourceScale: 1.18,
    demandScaleFactor: 0.98,
    summary: 'Overcast sky · Diffused shadows · Reduced PV & stronger wind',
  },
  rainy: {
    label: 'Rainy',
    defaultHour: 15,
    temperatureDeltaDegC: -4.0,
    solarIrradianceScale: 0.2,
    windResourceScale: 1.35,
    demandScaleFactor: 1.03,
    summary: 'Thunderstorm · Forked lightning · Wet streets & elevated wind output',
  },
};

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function lerpHex(hexA: string, hexB: string, t: number): string {
  const c = new THREE.Color(hexA);
  c.lerp(new THREE.Color(hexB), Math.max(0, Math.min(1, t)));
  return `#${c.getHexString()}`;
}

function normalizeDirectionTuple(x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z) || 1;
  return [
    Number((x / len).toFixed(4)),
    Number((y / len).toFixed(4)),
    Number((z / len).toFixed(4)),
  ];
}

/**
 * Computes continuous solar arc lighting, Three.js Sky scattering uniforms,
 * cloud/fog gradients, water sheen, wet road reflections, and vegetation shading
 * for hour in [0, 23] and active EnvironmentMode.
 */
export function computeDiurnalLighting(
  hour: number,
  environmentMode: EnvironmentMode = 'day',
): DiurnalLightingState {
  const safeHour = ((hour % 24) + 24) % 24;
  const solarPhase = Math.sin(((safeHour - 6) / 12.5) * Math.PI);
  const rawDaylight = Math.max(0, Math.min(1, solarPhase));
  const isClockNight = safeHour >= 19 || safeHour <= 5;
  const isClockSunset = safeHour === 6 || safeHour === 17 || safeHour === 18;

  const isNight = environmentMode === 'night' || (environmentMode !== 'sunset' && isClockNight);
  const isSunset =
    !isNight && (environmentMode === 'sunset' || (environmentMode === 'day' && isClockSunset));
  const isRainy = environmentMode === 'rainy';
  const isCloudy = environmentMode === 'cloudy';
  const isDaytime = !isNight;

  const clockSunsetWeight =
    safeHour === 18
      ? 1.0
      : safeHour === 17
        ? 0.68
        : safeHour === 6
          ? 0.88
          : safeHour === 7
            ? 0.32
            : 0.0;
  const sunsetWeight =
    environmentMode === 'sunset' ? Math.max(0.92, clockSunsetWeight) : clockSunsetWeight;

  // Continuous solar arc: rises East (+X), peaks overhead at noon, sets West-NW (-X, -Z) behind foothills
  const dayProgress = Math.max(0, Math.min(1, (safeHour - 6) / 12));
  const arcAngle = dayProgress * Math.PI;
  let sunX = Math.cos(arcAngle) * 82;
  let sunY = 18 + Math.sin(arcAngle) * 56;
  let sunZ = 34 - Math.pow(Math.abs(dayProgress - 0.5) * 2, 1.5) * 102;

  if (environmentMode === 'sunset' && safeHour >= 17 && safeHour <= 19) {
    sunX = -82;
    sunY = 19;
    sunZ = -68;
  } else if (isNight) {
    sunX = -46;
    sunY = 58;
    sunZ = -34;
  }

  const sunPos: [number, number, number] = [
    Number(sunX.toFixed(2)),
    Number(sunY.toFixed(2)),
    Number(sunZ.toFixed(2)),
  ];

  // Physical solar vector for Three.js Sky Preetham shader (low at sunset, below horizon at night)
  const skySunPos: [number, number, number] = isNight
    ? normalizeDirectionTuple(-0.68, -0.18, -0.71)
    : isSunset || sunsetWeight > 0.75
      ? normalizeDirectionTuple(
          lerpNumber(sunX, -82, Math.max(sunsetWeight, isSunset ? 0.92 : 0)),
          lerpNumber(sunY, 5.2, Math.max(sunsetWeight, isSunset ? 0.92 : 0)),
          lerpNumber(sunZ, -68, Math.max(sunsetWeight, isSunset ? 0.92 : 0)),
        )
      : normalizeDirectionTuple(sunX, sunY, sunZ);

  if (isNight) {
    return {
      hour: safeHour,
      environmentMode,
      isDaytime: false,
      isNight: true,
      isRainy,
      isCloudy,
      isSunset: false,
      sunsetWeight: 0,
      daylightFactor: 0,
      nightIlluminationFactor: 1.0,
      powerLineGlowIntensity: isRainy ? 1.45 : 1.38,
      surfaceWetness: isRainy ? 0.94 : 0.12,
      backgroundHex: isRainy ? '#050B16' : '#0A1428',
      fogHex: isRainy ? '#091322' : '#0F1E3B',
      fogNear: isRainy ? 118 : 150,
      fogFar: isRainy ? 275 : 340,
      sunPosition: sunPos,
      keyLightIntensity: isRainy ? 0.44 : 0.68,
      hemiIntensity: isRainy ? 0.46 : 0.62,
      fillLightIntensity: isRainy ? 0.34 : 0.46,
      keyLightColor: isRainy ? '#64748B' : '#93C5FD',
      skyTintColor: isRainy ? '#1E293B' : '#1E3A8A',
      groundTintColor: '#0F172A',
      fillLightColor: '#38BDF8',
      skyTopHex: isRainy ? '#020617' : '#050C1D',
      skyHorizonHex: isRainy ? '#1A2538' : '#1D356C',
      sunGlowHex: isRainy ? '#334155' : '#2563EB',
      hillNearHex: isRainy ? '#0D1826' : '#142642',
      hillFarHex: isRainy ? '#09121F' : '#0E1C36',
      cloudCoverage: isRainy ? 0.99 : isCloudy ? 0.82 : 0.16,
      cloudTintHex: isRainy ? '#172233' : '#1E3A8A',
      cloudRimHex: isRainy ? '#334155' : '#38BDF8',
      waterTintHex: isRainy ? '#0A2E3D' : '#0B3F52',
      waterSheenColorHex: '#38BDF8',
      waterSheenIntensity: 0.42,
      vegetationTintHex: isRainy ? '#2B4740' : '#3A5E54',
      meadowTintHex: isRainy ? '#264038' : '#325244',
      sunHaloRadiusFactor: 0.9,
      exposure: isRainy ? 1.06 : 1.18,
      skySunPosition: skySunPos,
      skyTurbidity: 1.6,
      skyRayleigh: 0.45,
      skyMieCoefficient: 0.002,
      skyMieDirectionalG: 0.72,
      skyCloudDensity: isRainy ? 0.92 : isCloudy ? 0.65 : 0.24,
      skyCloudElevation: isRainy ? 0.28 : 0.52,
    };
  }

  if (isRainy) {
    return {
      hour: safeHour,
      environmentMode,
      isDaytime: true,
      isNight: false,
      isRainy: true,
      isCloudy: false,
      isSunset: false,
      sunsetWeight: sunsetWeight * 0.35,
      daylightFactor: Math.min(0.4, rawDaylight * 0.45),
      nightIlluminationFactor: Math.max(0.84, sunsetWeight * 0.92),
      powerLineGlowIntensity: 1.28,
      surfaceWetness: 0.96,
      backgroundHex: '#425268',
      fogHex: '#465870',
      fogNear: 102,
      fogFar: 245,
      sunPosition: [sunPos[0], Math.max(32, sunPos[1]), sunPos[2]],
      keyLightIntensity: 0.62,
      hemiIntensity: 0.78,
      fillLightIntensity: 0.44,
      keyLightColor: '#CBD5E1',
      skyTintColor: '#7C8FA6',
      groundTintColor: '#3B485B',
      fillLightColor: '#93C5FD',
      skyTopHex: '#1D293B',
      skyHorizonHex: '#4B5E76',
      sunGlowHex: '#7C8FA6',
      hillNearHex: '#2B4343',
      hillFarHex: '#3D4D61',
      cloudCoverage: 0.99,
      cloudTintHex: '#3B4A5E',
      cloudRimHex: '#7B93B0',
      waterTintHex: '#154B5C',
      waterSheenColorHex: '#93C5FD',
      waterSheenIntensity: 0.38,
      vegetationTintHex: '#84AD95',
      meadowTintHex: '#729A83',
      sunHaloRadiusFactor: 0.75,
      exposure: 1.02,
      skySunPosition: normalizeDirectionTuple(sunX, Math.max(16, sunY * 0.5), sunZ),
      skyTurbidity: 13.5,
      skyRayleigh: 2.3,
      skyMieCoefficient: 0.025,
      skyMieDirectionalG: 0.6,
      skyCloudDensity: 0.94,
      skyCloudElevation: 0.28,
    };
  }

  if (isCloudy) {
    const duskMix = sunsetWeight * 0.45;
    return {
      hour: safeHour,
      environmentMode,
      isDaytime: true,
      isNight: false,
      isRainy: false,
      isCloudy: true,
      isSunset: false,
      sunsetWeight: duskMix,
      daylightFactor: Math.min(0.55, rawDaylight * 0.6),
      nightIlluminationFactor: Math.max(0.28, duskMix * 0.75),
      powerLineGlowIntensity: 0.78 + duskMix * 0.32,
      surfaceWetness: 0.08,
      backgroundHex: lerpHex('#D9E4F0', '#C9B8BD', duskMix),
      fogHex: lerpHex('#DCE5F0', '#D4BBAE', duskMix),
      fogNear: 140,
      fogFar: 315,
      sunPosition: [sunPos[0], Math.max(36, sunPos[1]), sunPos[2]],
      keyLightIntensity: 0.92,
      hemiIntensity: 0.96,
      fillLightIntensity: 0.52,
      keyLightColor: lerpHex('#E2E8F0', '#FCD34D', duskMix * 0.4),
      skyTintColor: '#E2E8F0',
      groundTintColor: '#CBD5E1',
      fillLightColor: '#DBEAFE',
      skyTopHex: lerpHex('#7C93AC', '#5C638C', duskMix),
      skyHorizonHex: lerpHex('#DCE5F0', '#E2B49A', duskMix),
      sunGlowHex: lerpHex('#F1F5F9', '#FDBA74', duskMix),
      hillNearHex: '#587E70',
      hillFarHex: '#89A1AE',
      cloudCoverage: 0.88,
      cloudTintHex: lerpHex('#E2E8F0', '#E5BFA8', duskMix),
      cloudRimHex: lerpHex('#F8FAFC', '#FDBA74', duskMix),
      waterTintHex: '#226E7C',
      waterSheenColorHex: lerpHex('#E2E8F0', '#FDBA74', duskMix),
      waterSheenIntensity: 0.18 + duskMix * 0.35,
      vegetationTintHex: '#D1E2D8',
      meadowTintHex: '#C6DAD0',
      sunHaloRadiusFactor: 1.0,
      exposure: 1.02,
      skySunPosition: normalizeDirectionTuple(sunX, Math.max(24, sunY * 0.75), sunZ),
      skyTurbidity: lerpNumber(6.4, 8.2, duskMix),
      skyRayleigh: lerpNumber(1.45, 2.2, duskMix),
      skyMieCoefficient: 0.012,
      skyMieDirectionalG: 0.7,
      skyCloudDensity: 0.72,
      skyCloudElevation: 0.4,
    };
  }

  if (isSunset || sunsetWeight > 0.25) {
    const w = Math.max(isSunset ? 0.92 : 0.35, sunsetWeight);
    return {
      hour: safeHour,
      environmentMode,
      isDaytime: true,
      isNight: false,
      isRainy: false,
      isCloudy: false,
      isSunset: true,
      sunsetWeight: w,
      daylightFactor: lerpNumber(rawDaylight, 0.36, w),
      nightIlluminationFactor: lerpNumber(0.12, 0.78, w),
      powerLineGlowIntensity: lerpNumber(0.68, 1.14, w),
      surfaceWetness: 0.06,
      backgroundHex: lerpHex('#DCECFB', '#F4B688', w),
      fogHex: lerpHex('#E5F0FB', '#F7A976', w),
      fogNear: 145,
      fogFar: 335,
      sunPosition: sunPos,
      keyLightIntensity: lerpNumber(1.45, 1.72, w),
      hemiIntensity: lerpNumber(0.84, 0.76, w),
      fillLightIntensity: lerpNumber(0.5, 0.66, w),
      keyLightColor: lerpHex('#FFF1D6', '#FB923C', w),
      skyTintColor: lerpHex('#E0F2FE', '#FDBA74', w),
      groundTintColor: lerpHex('#CBD5E1', '#8C7B88', w),
      fillLightColor: lerpHex('#DBEAFE', '#FDE68A', w),
      skyTopHex: lerpHex('#5B9CF5', '#3B427B', w),
      skyHorizonHex: lerpHex('#EFF6FF', '#F97316', w),
      sunGlowHex: lerpHex('#FEF9C3', '#FDE047', w),
      hillNearHex: lerpHex('#4E8264', '#35544E', w),
      hillFarHex: lerpHex('#8FB2C9', '#79557A', w),
      cloudCoverage: 0.38,
      cloudTintHex: lerpHex('#FFFFFF', '#FDBA74', w),
      cloudRimHex: lerpHex('#F8FAFC', '#F97316', w),
      waterTintHex: lerpHex('#0D9488', '#147A8A', w),
      waterSheenColorHex: lerpHex('#BAE6FD', '#FDBA74', w),
      waterSheenIntensity: lerpNumber(0.24, 0.95, w),
      vegetationTintHex: lerpHex('#FFFFFF', '#FFE4B5', w),
      meadowTintHex: lerpHex('#FFFFFF', '#EBD99D', w),
      sunHaloRadiusFactor: lerpNumber(1.05, 1.7, w),
      exposure: lerpNumber(1.05, 1.09, w),
      skySunPosition: skySunPos,
      skyTurbidity: lerpNumber(3.4, 8.8, w),
      skyRayleigh: lerpNumber(1.4, 2.95, w),
      skyMieCoefficient: lerpNumber(0.005, 0.009, w),
      skyMieDirectionalG: lerpNumber(0.82, 0.88, w),
      skyCloudDensity: 0.46,
      skyCloudElevation: 0.48,
    };
  }

  return {
    hour: safeHour,
    environmentMode,
    isDaytime: true,
    isNight: false,
    isRainy: false,
    isCloudy: false,
    isSunset: false,
    sunsetWeight: 0,
    daylightFactor: rawDaylight,
    nightIlluminationFactor: 0.05,
    powerLineGlowIntensity: 0.58,
    surfaceWetness: 0.0,
    backgroundHex: '#DCECFB',
    fogHex: '#E5F0FB',
    fogNear: 165,
    fogFar: 375,
    sunPosition: sunPos,
    keyLightIntensity: Number((1.38 + rawDaylight * 0.52).toFixed(2)),
    hemiIntensity: Number((0.76 + rawDaylight * 0.2).toFixed(2)),
    fillLightIntensity: 0.5,
    keyLightColor: '#FFFDF9',
    skyTintColor: '#E0F2FE',
    groundTintColor: '#CBD5E1',
    fillLightColor: '#DBEAFE',
    skyTopHex: '#4B96F3',
    skyHorizonHex: '#EFF6FF',
    sunGlowHex: '#FEF9C3',
    hillNearHex: '#4E8264',
    hillFarHex: '#8FB2C9',
    cloudCoverage: 0.26,
    cloudTintHex: '#FFFFFF',
    cloudRimHex: '#F8FAFC',
    waterTintHex: '#0D9488',
    waterSheenColorHex: '#BAE6FD',
    waterSheenIntensity: 0.2,
    vegetationTintHex: '#FFFFFF',
    meadowTintHex: '#FFFFFF',
    sunHaloRadiusFactor: 1.0,
    exposure: 1.05,
    skySunPosition: skySunPos,
    skyTurbidity: 2.2,
    skyRayleigh: 1.15,
    skyMieCoefficient: 0.0042,
    skyMieDirectionalG: 0.82,
    skyCloudDensity: 0.36,
    skyCloudElevation: 0.56,
  };
}

/**
 * Builds deterministic transmission corridor flow specs from MW allocations
 * aligned to the 135x115 metropolitan Smart City masterplan.
 */
export function buildTransmissionCorridors(params: {
  solarMW: number;
  windMW: number;
  thermalMW: number;
  bessNetMW: number;
  residentialMW: number;
  commercialMW: number;
  industrialMW: number;
  supplyShortage: boolean;
}): TransmissionCorridorSpec[] {
  const {
    solarMW,
    windMW,
    thermalMW,
    bessNetMW,
    residentialMW,
    commercialMW,
    industrialMW,
    supplyShortage,
  } = params;

  const mkCurve = (pts: [number, number, number][]) =>
    new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));

  const buildSpec = (
    id: string,
    label: string,
    fromZone: CityZoneId,
    toZone: CityZoneId,
    pts: [number, number, number][],
    flowMW: number,
    maxCapacityMW: number,
    nominalColor: string,
    reverseWhenNegative = false,
  ): TransmissionCorridorSpec => {
    const absFlow = Math.abs(flowMW);
    const ratio = Math.min(1, absFlow / Math.max(1, maxCapacityMW));
    const activePts = reverseWhenNegative && flowMW < 0 ? [...pts].reverse() : pts;

    const particleCount = absFlow < 0.5 ? 0 : Math.max(1, Math.min(8, Math.round(1 + ratio * 7)));
    const particleSpeed = absFlow < 0.5 ? 0 : Number((0.14 + ratio * 0.48).toFixed(3));
    const lineRadius = Number((0.092 + ratio * 0.072).toFixed(3));
    const isShortage =
      supplyShortage &&
      (toZone === 'commercial' || toZone === 'residential' || toZone === 'industrial');

    return {
      id,
      label,
      fromZone,
      toZone,
      curve: mkCurve(activePts),
      flowMW: Number(absFlow.toFixed(2)),
      maxCapacityMW,
      utilizationRatio: Number(ratio.toFixed(3)),
      particleCount,
      particleSpeed,
      colorHex: isShortage ? '#DC2626' : nominalColor,
      lineRadius,
      isShortage,
    };
  };

  return [
    buildSpec(
      'solar-substation',
      'Solar PV Trunk (132 kV)',
      'solar',
      'substation',
      [
        [-32.0, 2.8, -24.5],
        [-22.0, 4.6, -16.8],
        [-11.5, 4.4, -9.2],
        [-4.2, 3.5, -3.8],
      ],
      solarMW,
      160,
      '#10B981',
    ),
    buildSpec(
      'wind-substation',
      'Wind Corridor Tie-Line (132 kV)',
      'wind',
      'substation',
      [
        [32.0, 3.2, -24.5],
        [22.0, 4.8, -16.8],
        [11.5, 4.4, -9.2],
        [4.2, 3.5, -3.8],
      ],
      windMW,
      95,
      '#10B981',
    ),
    buildSpec(
      'bess-substation',
      bessNetMW >= 0 ? 'BESS Discharge Link' : 'BESS Charge Link',
      bessNetMW >= 0 ? 'bess' : 'substation',
      bessNetMW >= 0 ? 'substation' : 'bess',
      [
        [-23.5, 2.4, 0.2],
        [-15.0, 3.5, 0.0],
        [-5.6, 3.2, -0.2],
      ],
      bessNetMW,
      45,
      bessNetMW >= 0 ? '#06B6D4' : '#2563EB',
      true,
    ),
    buildSpec(
      'thermal-substation',
      'Thermal Generation Trunk (220 kV)',
      'thermal',
      'substation',
      [
        [23.5, 3.0, 0.2],
        [15.0, 4.0, 0.0],
        [5.6, 3.3, -0.2],
      ],
      thermalMW,
      290,
      '#F97316',
    ),
    buildSpec(
      'substation-commercial',
      'Commercial CBD Underground Feeder',
      'substation',
      'commercial',
      [
        [0, 0.76, 5.8],
        [0, 0.76, 16.5],
        [0, 0.76, 27.5],
      ],
      commercialMW,
      220,
      '#06B6D4',
    ),
    buildSpec(
      'substation-residential',
      'Residential Distribution Feeder',
      'substation',
      'residential',
      [
        [-4.5, 0.76, 4.8],
        [-17.5, 0.76, 16.0],
        [-32.0, 0.76, 27.5],
      ],
      residentialMW,
      240,
      '#2563EB',
    ),
    buildSpec(
      'substation-industrial',
      'Industrial High-Capacity Feeder',
      'substation',
      'industrial',
      [
        [4.5, 0.76, 4.8],
        [17.5, 0.76, 16.0],
        [32.0, 0.76, 27.5],
      ],
      industrialMW,
      160,
      '#06B6D4',
    ),
  ];
}

/**
 * Translates structured DispatchResult and HourlyDemand into deterministic 3D scene telemetry.
 */
export function computeGridVisualTelemetry(
  dispatch: DispatchResult,
  hourlyDemand: HourlyDemand,
  environmentMode: EnvironmentMode = 'day',
): GridVisualTelemetry {
  const solarMW =
    dispatch.generatorSetpoints.find((g) => g.technology === 'solar')?.dispatchedMW ?? 0;
  const windMW =
    dispatch.generatorSetpoints.find((g) => g.technology === 'wind')?.dispatchedMW ?? 0;
  const hydroMW =
    dispatch.generatorSetpoints.find((g) => g.technology === 'hydro')?.dispatchedMW ?? 0;
  const thermalMW = dispatch.generatorSetpoints
    .filter((g) => g.technology === 'gas' || g.technology === 'coal')
    .reduce((acc, g) => acc + g.dispatchedMW, 0);

  const supplyShortage = dispatch.unservedEnergyMW > 0.5 || dispatch.balanceStatus === 'Deficit';
  const tightReserve = !supplyShortage && dispatch.reserveMarginMW < 35;

  const corridors = buildTransmissionCorridors({
    solarMW,
    windMW,
    thermalMW,
    bessNetMW: dispatch.batteryNetPowerMW,
    residentialMW: hourlyDemand.residentialMW,
    commercialMW: hourlyDemand.commercialMW,
    industrialMW: hourlyDemand.industrialMW,
    supplyShortage,
  });

  return {
    solarMW,
    windMW,
    hydroMW,
    thermalMW,
    bessNetMW: dispatch.batteryNetPowerMW,
    bessSocPercent: dispatch.batterySocPercent,
    residentialMW: hourlyDemand.residentialMW,
    commercialMW: hourlyDemand.commercialMW,
    industrialMW: hourlyDemand.industrialMW,
    supplyShortage,
    tightReserve,
    corridors,
    lighting: computeDiurnalLighting(hourlyDemand.hour, environmentMode),
  };
}
