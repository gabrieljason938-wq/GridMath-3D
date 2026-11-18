import * as THREE from 'three';

export interface CityMaterialTextures {
  solarMap?: THREE.Texture;
  curtainBlueMap?: THREE.Texture;
  curtainTealMap?: THREE.Texture;
  apartmentWarmMap?: THREE.Texture;
  apartmentSandMap?: THREE.Texture;
  industrialCladdingMap?: THREE.Texture;
  meadowMap?: THREE.Texture;
  waterNormalMap?: THREE.Texture;
}

export interface CityMaterialRegistry {
  plasterWhite: THREE.MeshStandardMaterial;
  warmPlaster: THREE.MeshStandardMaterial;
  alabasterPad: THREE.MeshStandardMaterial;
  switchyardGravel: THREE.MeshStandardMaterial;
  roadAsphaltLight: THREE.MeshPhysicalMaterial;
  sidewalkConcrete: THREE.MeshStandardMaterial;
  laneMarkingWhite: THREE.MeshStandardMaterial;
  parkLawn: THREE.MeshStandardMaterial;
  waterPool: THREE.MeshPhysicalMaterial;
  canalWall: THREE.MeshStandardMaterial;
  brushedSteel: THREE.MeshStandardMaterial;
  latticeSteel: THREE.MeshStandardMaterial;
  industrialSteel: THREE.MeshStandardMaterial;
  industrialCladding: THREE.MeshStandardMaterial;
  architecturalGlass: THREE.MeshPhysicalMaterial;
  skylineGlassTeal: THREE.MeshPhysicalMaterial;
  towerSlateTrim: THREE.MeshStandardMaterial;
  resTerracottaRoof: THREE.MeshStandardMaterial;
  resSlateRoof: THREE.MeshStandardMaterial;
  resSageRoof: THREE.MeshStandardMaterial;
  resOchreRoof: THREE.MeshStandardMaterial;
  resWarmStucco: THREE.MeshStandardMaterial;
  resSandstone: THREE.MeshStandardMaterial;
  solarSilicon: THREE.MeshStandardMaterial;
  cobaltAccent: THREE.MeshStandardMaterial;
  cyanAccent: THREE.MeshStandardMaterial;
  emeraldAccent: THREE.MeshStandardMaterial;
  thermalAccentOrange: THREE.MeshStandardMaterial;
  industrialAmber: THREE.MeshStandardMaterial;
  alertCrimson: THREE.MeshStandardMaterial;
  amberWarning: THREE.MeshStandardMaterial;
  foliageCanopy: THREE.MeshStandardMaterial;
  foliageTrunk: THREE.MeshStandardMaterial;
  windowGlow: THREE.MeshStandardMaterial;
  resWindowWarmGlow: THREE.MeshStandardMaterial;
  streetlightBulb: THREE.MeshStandardMaterial;
  lightPoolDisc: THREE.MeshBasicMaterial;
  dioramaPlinth: THREE.MeshStandardMaterial;
  dioramaTrimGlow: THREE.MeshStandardMaterial;
  copperBusbar: THREE.MeshStandardMaterial;
  hospitalCross: THREE.MeshStandardMaterial;
  meadowTerrain: THREE.MeshStandardMaterial;
  greenRoof: THREE.MeshStandardMaterial;
  warmTimber: THREE.MeshStandardMaterial;
  limestoneWalkway: THREE.MeshPhysicalMaterial;
  pondWater: THREE.MeshPhysicalMaterial;
  waterfallFoam: THREE.MeshStandardMaterial;
  domeGlass: THREE.MeshPhysicalMaterial;
  evCabinGlass: THREE.MeshPhysicalMaterial;
  evHeadlight: THREE.MeshStandardMaterial;
  evTaillight: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createCityMaterials(textures: CityMaterialTextures = {}): CityMaterialRegistry {
  const plasterWhite = new THREE.MeshStandardMaterial({
    color: '#F8FAFC',
    roughness: 0.72,
    metalness: 0.04,
  });

  const warmPlaster = new THREE.MeshStandardMaterial({
    color: '#F1F5F9',
    roughness: 0.78,
    metalness: 0.03,
  });

  const alabasterPad = new THREE.MeshStandardMaterial({
    color: '#E5ECF4',
    roughness: 0.86,
    metalness: 0.03,
  });

  const switchyardGravel = new THREE.MeshStandardMaterial({
    color: '#CBD5E1',
    roughness: 0.94,
    metalness: 0.02,
  });

  const roadAsphaltLight = new THREE.MeshPhysicalMaterial({
    color: '#526074',
    roughness: 0.88,
    metalness: 0.04,
    clearcoat: 0.05,
    clearcoatRoughness: 0.35,
    normalMap: textures.waterNormalMap ?? null,
    normalScale: new THREE.Vector2(0, 0),
  });

  const sidewalkConcrete = new THREE.MeshStandardMaterial({
    color: '#D8E1EC',
    roughness: 0.82,
    metalness: 0.03,
  });

  const laneMarkingWhite = new THREE.MeshStandardMaterial({
    color: '#F8FAFC',
    roughness: 0.65,
    metalness: 0.02,
  });

  const parkLawn = new THREE.MeshStandardMaterial({
    color: '#A7F3D0',
    roughness: 0.92,
    metalness: 0.0,
  });

  const waterPool = new THREE.MeshPhysicalMaterial({
    color: '#38BDF8',
    roughness: 0.08,
    metalness: 0.14,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    normalMap: textures.waterNormalMap ?? null,
    normalScale: new THREE.Vector2(0.22, 0.22),
  });

  const canalWall = new THREE.MeshStandardMaterial({
    color: '#CBD5E1',
    roughness: 0.85,
    metalness: 0.05,
  });

  const brushedSteel = new THREE.MeshStandardMaterial({
    color: '#64748B',
    roughness: 0.24,
    metalness: 0.86,
  });

  const latticeSteel = new THREE.MeshStandardMaterial({
    color: '#94A3B8',
    roughness: 0.34,
    metalness: 0.72,
  });

  const industrialSteel = new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.32,
    metalness: 0.78,
  });

  const industrialCladding = new THREE.MeshStandardMaterial({
    color: textures.industrialCladdingMap ? '#FFFFFF' : '#DDE5EF',
    map: textures.industrialCladdingMap ?? null,
    roughness: 0.5,
    metalness: 0.38,
  });

  const architecturalGlass = new THREE.MeshPhysicalMaterial({
    color: textures.curtainBlueMap ? '#FFFFFF' : '#60A5FA',
    map: textures.curtainBlueMap ?? null,
    roughness: 0.12,
    metalness: 0.24,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.35,
  });

  const skylineGlassTeal = new THREE.MeshPhysicalMaterial({
    color: textures.curtainTealMap ? '#FFFFFF' : '#38BDF8',
    map: textures.curtainTealMap ?? null,
    roughness: 0.12,
    metalness: 0.26,
    clearcoat: 0.95,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.3,
  });

  const towerSlateTrim = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    roughness: 0.34,
    metalness: 0.76,
  });

  const resTerracottaRoof = new THREE.MeshStandardMaterial({
    color: '#D97757',
    roughness: 0.76,
    metalness: 0.04,
  });

  const resSlateRoof = new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.7,
    metalness: 0.08,
  });

  const resSageRoof = new THREE.MeshStandardMaterial({
    color: '#10B981',
    roughness: 0.74,
    metalness: 0.05,
  });

  const resOchreRoof = new THREE.MeshStandardMaterial({
    color: '#D97706',
    roughness: 0.74,
    metalness: 0.05,
  });

  const resWarmStucco = new THREE.MeshStandardMaterial({
    color: textures.apartmentWarmMap ? '#FFFFFF' : '#FAF6F0',
    map: textures.apartmentWarmMap ?? null,
    roughness: 0.8,
    metalness: 0.02,
  });

  const resSandstone = new THREE.MeshStandardMaterial({
    color: textures.apartmentSandMap ? '#FFFFFF' : '#EFE5D8',
    map: textures.apartmentSandMap ?? null,
    roughness: 0.82,
    metalness: 0.02,
  });

  const solarSilicon = new THREE.MeshStandardMaterial({
    color: textures.solarMap ? '#FFFFFF' : '#0F4C81',
    map: textures.solarMap ?? null,
    roughness: 0.18,
    metalness: 0.65,
    emissive: '#06B6D4',
    emissiveIntensity: 0.08,
  });

  const cobaltAccent = new THREE.MeshStandardMaterial({
    color: '#2563EB',
    roughness: 0.28,
    metalness: 0.38,
    emissive: '#2563EB',
    emissiveIntensity: 0.1,
  });

  const cyanAccent = new THREE.MeshStandardMaterial({
    color: '#06B6D4',
    roughness: 0.24,
    metalness: 0.36,
    emissive: '#06B6D4',
    emissiveIntensity: 0.18,
  });

  const emeraldAccent = new THREE.MeshStandardMaterial({
    color: '#10B981',
    roughness: 0.28,
    metalness: 0.34,
    emissive: '#10B981',
    emissiveIntensity: 0.1,
  });

  const thermalAccentOrange = new THREE.MeshStandardMaterial({
    color: '#EA580C',
    roughness: 0.34,
    metalness: 0.32,
    emissive: '#F97316',
    emissiveIntensity: 0.08,
  });

  const industrialAmber = new THREE.MeshStandardMaterial({
    color: '#F59E0B',
    roughness: 0.36,
    metalness: 0.44,
  });

  const alertCrimson = new THREE.MeshStandardMaterial({
    color: '#DC2626',
    roughness: 0.32,
    metalness: 0.25,
    emissive: '#DC2626',
    emissiveIntensity: 0.42,
  });

  const amberWarning = new THREE.MeshStandardMaterial({
    color: '#D97706',
    roughness: 0.35,
    metalness: 0.25,
  });

  const foliageCanopy = new THREE.MeshStandardMaterial({
    color: '#34D399',
    roughness: 0.85,
    metalness: 0.0,
  });

  const foliageTrunk = new THREE.MeshStandardMaterial({
    color: '#78716C',
    roughness: 0.92,
    metalness: 0.02,
  });

  const windowGlow = new THREE.MeshStandardMaterial({
    color: '#BAE6FD',
    roughness: 0.18,
    metalness: 0.18,
    emissive: '#38BDF8',
    emissiveIntensity: 0.18,
  });

  const resWindowWarmGlow = new THREE.MeshStandardMaterial({
    color: '#FDE68A',
    roughness: 0.22,
    metalness: 0.1,
    emissive: '#F59E0B',
    emissiveIntensity: 0.12,
  });

  const streetlightBulb = new THREE.MeshStandardMaterial({
    color: '#FEF3C7',
    roughness: 0.2,
    metalness: 0.1,
    emissive: '#FBBF24',
    emissiveIntensity: 0.15,
  });

  const lightPoolDisc = new THREE.MeshBasicMaterial({
    color: '#FDE68A',
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const dioramaPlinth = new THREE.MeshStandardMaterial({
    color: '#CBD5E1',
    roughness: 0.65,
    metalness: 0.22,
  });

  const dioramaTrimGlow = new THREE.MeshStandardMaterial({
    color: '#06B6D4',
    roughness: 0.28,
    metalness: 0.4,
    emissive: '#06B6D4',
    emissiveIntensity: 0.25,
  });

  const copperBusbar = new THREE.MeshStandardMaterial({
    color: '#D97706',
    roughness: 0.22,
    metalness: 0.9,
  });

  const hospitalCross = new THREE.MeshStandardMaterial({
    color: '#10B981',
    roughness: 0.32,
    metalness: 0.15,
    emissive: '#10B981',
    emissiveIntensity: 0.14,
  });

  const meadowTerrain = new THREE.MeshStandardMaterial({
    color: textures.meadowMap ? '#FFFFFF' : '#5F9E59',
    map: textures.meadowMap ?? null,
    roughness: 0.94,
    metalness: 0.0,
  });

  const greenRoof = new THREE.MeshStandardMaterial({
    color: '#4ADE80',
    roughness: 0.88,
    metalness: 0.0,
  });

  const warmTimber = new THREE.MeshStandardMaterial({
    color: '#B47B48',
    roughness: 0.68,
    metalness: 0.04,
  });

  const limestoneWalkway = new THREE.MeshPhysicalMaterial({
    color: '#F3EFE6',
    roughness: 0.78,
    metalness: 0.03,
    clearcoat: 0.04,
    clearcoatRoughness: 0.35,
    normalMap: textures.waterNormalMap ?? null,
    normalScale: new THREE.Vector2(0, 0),
  });

  const pondWater = new THREE.MeshPhysicalMaterial({
    color: '#0D9488',
    roughness: 0.05,
    metalness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.8,
    normalMap: textures.waterNormalMap ?? null,
    normalScale: new THREE.Vector2(0.3, 0.3),
    emissive: '#FDBA74',
    emissiveIntensity: 0.04,
  });

  const waterfallFoam = new THREE.MeshStandardMaterial({
    color: '#F0F9FF',
    roughness: 0.25,
    metalness: 0.05,
    emissive: '#E0F2FE',
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.86,
  });

  const domeGlass = new THREE.MeshPhysicalMaterial({
    color: '#BAE6FD',
    roughness: 0.08,
    metalness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.52,
    envMapIntensity: 1.6,
    emissive: '#FDE68A',
    emissiveIntensity: 0.12,
  });

  const evCabinGlass = new THREE.MeshPhysicalMaterial({
    color: '#0F172A',
    roughness: 0.08,
    metalness: 0.45,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });

  const evHeadlight = new THREE.MeshStandardMaterial({
    color: '#FEF9C3',
    emissive: '#FEF08A',
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });

  const evTaillight = new THREE.MeshStandardMaterial({
    color: '#FCA5A5',
    emissive: '#EF4444',
    emissiveIntensity: 0.75,
    roughness: 0.2,
  });

  const allMaterials = [
    plasterWhite,
    warmPlaster,
    alabasterPad,
    switchyardGravel,
    roadAsphaltLight,
    sidewalkConcrete,
    laneMarkingWhite,
    parkLawn,
    waterPool,
    canalWall,
    brushedSteel,
    latticeSteel,
    industrialSteel,
    industrialCladding,
    architecturalGlass,
    skylineGlassTeal,
    towerSlateTrim,
    resTerracottaRoof,
    resSlateRoof,
    resSageRoof,
    resOchreRoof,
    resWarmStucco,
    resSandstone,
    solarSilicon,
    cobaltAccent,
    cyanAccent,
    emeraldAccent,
    thermalAccentOrange,
    industrialAmber,
    alertCrimson,
    amberWarning,
    foliageCanopy,
    foliageTrunk,
    windowGlow,
    resWindowWarmGlow,
    streetlightBulb,
    lightPoolDisc,
    dioramaPlinth,
    dioramaTrimGlow,
    copperBusbar,
    hospitalCross,
    meadowTerrain,
    greenRoof,
    warmTimber,
    limestoneWalkway,
    pondWater,
    waterfallFoam,
    domeGlass,
    evCabinGlass,
    evHeadlight,
    evTaillight,
  ];

  return {
    plasterWhite,
    warmPlaster,
    alabasterPad,
    switchyardGravel,
    roadAsphaltLight,
    sidewalkConcrete,
    laneMarkingWhite,
    parkLawn,
    waterPool,
    canalWall,
    brushedSteel,
    latticeSteel,
    industrialSteel,
    industrialCladding,
    architecturalGlass,
    skylineGlassTeal,
    towerSlateTrim,
    resTerracottaRoof,
    resSlateRoof,
    resSageRoof,
    resOchreRoof,
    resWarmStucco,
    resSandstone,
    solarSilicon,
    cobaltAccent,
    cyanAccent,
    emeraldAccent,
    thermalAccentOrange,
    industrialAmber,
    alertCrimson,
    amberWarning,
    foliageCanopy,
    foliageTrunk,
    windowGlow,
    resWindowWarmGlow,
    streetlightBulb,
    lightPoolDisc,
    dioramaPlinth,
    dioramaTrimGlow,
    copperBusbar,
    hospitalCross,
    meadowTerrain,
    greenRoof,
    warmTimber,
    limestoneWalkway,
    pondWater,
    waterfallFoam,
    domeGlass,
    evCabinGlass,
    evHeadlight,
    evTaillight,
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
    },
  };
}
