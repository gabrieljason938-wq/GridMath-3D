import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type {
  CityZoneId,
  DispatchResult,
  EnvironmentMode,
  HourlyDemand,
  RenderQuality,
} from '../../types/grid';
import { createCityMaterials } from './cityMaterials';
import { EcoLandscapeBackdrop } from './EcoLandscapeBackdrop';
import { EcoWaterAndConservatory } from './EcoWaterAndConservatory';
import { EnergyInfrastructure } from './EnergyInfrastructure';
import { InfrastructureDistricts } from './InfrastructureDistricts';
import { computeGridVisualTelemetry, type DiurnalLightingState } from './powerFlowMath';
import { RainSystem } from './RainSystem';
import { ThunderstormSystem, type StormFlashState } from './ThunderstormSystem';
import { TransmissionNetwork } from './TransmissionNetwork';
import {
  createApartmentFacadeTexture,
  createArchitecturalGridTexture,
  createCurtainWallTexture,
  createIndustrialCladdingTexture,
  createMeadowTerrainTexture,
  createSkyboxEnvironmentTexture,
  createSolarPanelTexture,
  createWaterNormalTexture,
} from './webglUtils';

export interface SmartCitySceneProps {
  dispatch: DispatchResult;
  hourlyDemand: HourlyDemand;
  environmentMode?: EnvironmentMode;
  selectedZone: CityZoneId | null;
  onSelectZone: (zone: CityZoneId) => void;
  showFlowVectors: boolean;
  showLabels: boolean;
  showLandscaping: boolean;
  isSoftwareGl: boolean;
  renderQuality: RenderQuality;
  reducedMotion: boolean;
  onLightningStrike?: (info: { distanceNorm: number; pan: number }) => void;
}

interface DynamicSkyboxEnvironmentProps {
  lighting: DiurnalLightingState;
  intensity: number;
  reducedMotion: boolean;
}

function DynamicSkyboxEnvironment({
  lighting,
  intensity,
  reducedMotion,
}: DynamicSkyboxEnvironmentProps) {
  const { gl, scene } = useThree();
  const targetIntensityRef = useRef(intensity);
  const envTexRef = useRef<THREE.Texture | null>(null);

  const pmremGenerator = useMemo(() => {
    const gen = new THREE.PMREMGenerator(gl);
    gen.compileEquirectangularShader();
    return gen;
  }, [gl]);

  useEffect(() => {
    return () => {
      if (scene.environment === envTexRef.current) {
        scene.environment = null;
      }
      envTexRef.current?.dispose();
      envTexRef.current = null;
      pmremGenerator.dispose();
    };
  }, [scene, pmremGenerator]);

  useEffect(() => {
    const sunStrength = lighting.isSunset
      ? 1.15
      : lighting.isRainy || lighting.isCloudy
        ? 0.35
        : lighting.isNight
          ? 0.28
          : 0.85;

    const equirect = createSkyboxEnvironmentTexture({
      skyTopHex: lighting.skyTopHex,
      skyHorizonHex: lighting.skyHorizonHex,
      sunGlowHex: lighting.sunGlowHex,
      groundHex: lighting.groundTintColor,
      sunPosition: lighting.sunPosition,
      sunIntensity: sunStrength,
    });

    const nextEnv = pmremGenerator.fromEquirectangular(equirect).texture;
    equirect.dispose();

    const prevEnv = envTexRef.current;
    envTexRef.current = nextEnv;
    scene.environment = nextEnv;
    if (prevEnv && prevEnv !== nextEnv) {
      prevEnv.dispose();
    }
  }, [
    lighting.skyTopHex,
    lighting.skyHorizonHex,
    lighting.sunGlowHex,
    lighting.groundTintColor,
    lighting.sunPosition,
    lighting.isSunset,
    lighting.isRainy,
    lighting.isCloudy,
    lighting.isNight,
    pmremGenerator,
    scene,
  ]);

  useEffect(() => {
    targetIntensityRef.current = intensity;
    if (reducedMotion || scene.environmentIntensity === undefined) {
      scene.environmentIntensity = intensity;
    }
  }, [scene, intensity, reducedMotion]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    const dt = Math.min(delta, 0.05);
    scene.environmentIntensity = THREE.MathUtils.damp(
      scene.environmentIntensity,
      targetIntensityRef.current,
      3.8,
      dt,
    );
  });

  return null;
}

interface SpatialOverlayProps {
  position: [number, number, number];
  category: string;
  title: string;
  metric: string;
  submetric?: string;
  accentColor: string;
  isPrimary: boolean;
  selected: boolean;
  hovered: boolean;
  warning?: boolean;
  onClick: () => void;
}

function SpatialAnchorLabel({
  position,
  category,
  title,
  metric,
  submetric,
  accentColor,
  isPrimary,
  selected,
  hovered,
  warning = false,
  onClick,
}: SpatialOverlayProps) {
  const showExpandedTooltip = hovered && !selected;
  const activeAccent = warning ? '#DC2626' : accentColor;

  return (
    <Html position={position} center zIndexRange={[5, 0]}>
      <div className="pointer-events-none flex flex-col items-center select-none">
        {showExpandedTooltip ? (
          <div
            role="tooltip"
            className={`min-w-[164px] rounded-lg border px-2.5 py-1.5 text-left shadow-[0_10px_24px_-6px_rgba(15,23,42,0.14)] transition-all ${
              warning
                ? 'border-rose-200 bg-[#FFFFFF]/98 text-rose-800'
                : 'border-[#E2E8F0] bg-[#FFFFFF]/98 text-[#0F172A]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-[9px] font-medium text-[#64748B]">
              <span>{category}</span>
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: activeAccent }}
              />
            </div>
            <div className="mt-0.5 text-[11px] font-semibold leading-tight tracking-tight text-[#0F172A] whitespace-nowrap">
              {title}
            </div>
            <div className="mt-1 flex items-center gap-1.5 border-t border-[#F1F5F9] pt-1 font-mono text-[10px] tabular-nums">
              <span
                className="font-semibold"
                style={{ color: warning ? '#DC2626' : '#2563EB' }}
              >
                {metric}
              </span>
              {submetric ? (
                <>
                  <span aria-hidden="true" className="text-[#CBD5E1]">
                    ·
                  </span>
                  <span className={warning ? 'font-medium text-rose-600' : 'text-[#64748B]'}>
                    {submetric}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            aria-pressed={selected}
            aria-label={`${title}: ${metric}${submetric ? `, ${submetric}` : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className={`${isPrimary || selected ? 'pointer-events-auto' : 'pointer-events-none'} inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-left transition-colors whitespace-nowrap shadow-[0_4px_12px_-3px_rgba(15,23,42,0.12)] ${
              selected
                ? 'border-[#2563EB] bg-[#2563EB] text-white'
                : warning
                  ? 'border-rose-200 bg-[#FFFFFF]/95 text-rose-700 hover:border-rose-400'
                  : 'border-[#E2E8F0] bg-[#FFFFFF]/95 text-[#0F172A] hover:border-[#2563EB]'
            }`}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: selected ? '#FFFFFF' : activeAccent }}
            />
            <span className="text-[10px] font-semibold tracking-tight">{title}</span>
            <span aria-hidden="true" className={selected ? 'text-blue-200' : 'text-[#CBD5E1]'}>
              ·
            </span>
            <span
              className={`font-mono text-[10px] font-medium tabular-nums ${
                selected ? 'text-blue-50' : warning ? 'text-rose-600' : 'text-[#475569]'
              }`}
            >
              {metric}
            </span>
          </button>
        )}

        {/* Delicate vertical architectural stem + anchor bead */}
        <div
          aria-hidden="true"
          className="h-2.5 w-px"
          style={{
            backgroundColor: selected ? '#2563EB' : warning ? '#FCA5A5' : '#94A3B8',
          }}
        />
        <div
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full border border-white shadow-xs"
          style={{
            backgroundColor: selected ? '#2563EB' : activeAccent,
          }}
        />
      </div>
    </Html>
  );
}

export default function SmartCityScene({
  dispatch,
  hourlyDemand,
  environmentMode = 'day',
  selectedZone,
  onSelectZone,
  showFlowVectors,
  showLabels,
  showLandscaping,
  isSoftwareGl,
  renderQuality,
  reducedMotion,
  onLightningStrike,
}: SmartCitySceneProps) {
  const { gl } = useThree();
  const [hoveredZone, setHoveredZone] = useState<CityZoneId | null>(null);
  const stormFlashRef = useRef<StormFlashState>({
    intensity: 0,
    cloudFlashX: 0,
    cloudFlashY: 34,
    cloudFlashZ: -36,
    strikeId: 0,
  });

  const maxAniso =
    renderQuality === 'low' ? 1 : Math.min(renderQuality === 'high' ? 8 : 4, gl.capabilities.getMaxAnisotropy());

  const textures = useMemo(() => {
    const grid = createArchitecturalGridTexture(maxAniso);
    const solarMap = createSolarPanelTexture(maxAniso);
    const curtainBlueMap = createCurtainWallTexture('#60A5FA', '#1E3A5F', maxAniso);
    const curtainTealMap = createCurtainWallTexture('#38BDF8', '#0F4C81', maxAniso);
    const apartmentWarmMap = createApartmentFacadeTexture('#FAF6F0', maxAniso);
    const apartmentSandMap = createApartmentFacadeTexture('#EFE5D8', maxAniso);
    const industrialCladdingMap = createIndustrialCladdingTexture(maxAniso);
    const meadowMap = createMeadowTerrainTexture(maxAniso);
    const waterNormalMap = createWaterNormalTexture(maxAniso);
    return {
      grid,
      solarMap,
      curtainBlueMap,
      curtainTealMap,
      apartmentWarmMap,
      apartmentSandMap,
      industrialCladdingMap,
      meadowMap,
      waterNormalMap,
    };
  }, [maxAniso]);

  const materials = useMemo(() => createCityMaterials(textures), [textures]);

  useEffect(() => {
    return () => {
      materials.dispose();
      textures.grid.dispose();
      textures.solarMap.dispose();
      textures.curtainBlueMap.dispose();
      textures.curtainTealMap.dispose();
      textures.apartmentWarmMap.dispose();
      textures.apartmentSandMap.dispose();
      textures.industrialCladdingMap.dispose();
      textures.meadowMap.dispose();
      textures.waterNormalMap.dispose();
    };
  }, [materials, textures]);

  const telemetry = useMemo(
    () => computeGridVisualTelemetry(dispatch, hourlyDemand, environmentMode),
    [dispatch, hourlyDemand, environmentMode],
  );

  const { lighting } = telemetry;

  const initialLighting = useMemo(() => lighting, []);
  const bgColorRef = useRef<THREE.Color | null>(null);
  const fogRef = useRef<THREE.Fog | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const baseplateMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const computeSceneTargets = (l: DiurnalLightingState) => {
    const plinthHex = l.isNight ? '#1E293B' : l.isSunset ? '#94A3B8' : '#CBD5E1';
    const trimGlowIntensity = 0.28 + l.nightIlluminationFactor * 0.95;
    const meadowRoughness = l.isRainy ? 0.72 : 0.94;
    const greenRoofHex = l.isNight
      ? '#1E5B43'
      : l.isRainy
        ? '#2F855A'
        : l.isSunset
          ? '#74C668'
          : l.isCloudy
            ? '#4B9B6E'
            : '#4ADE80';
    const greenRoofRoughness = l.isRainy ? 0.58 : 0.88;
    const parkLawnHex = l.isNight
      ? '#285947'
      : l.isRainy
        ? '#4D8A6B'
        : l.isSunset
          ? '#BEE38C'
          : '#A7F3D0';
    const pondEmissiveIntensity = 0.04 + l.waterSheenIntensity * 0.16;
    const pondEnvIntensity = l.isSunset ? 2.25 : l.isRainy ? 1.9 : 1.7;
    const rippleScale = l.isRainy ? 0.52 : 0.28;
    const waterPoolHex = l.isNight ? '#0E4F66' : l.isSunset ? '#2596AA' : '#38BDF8';
    const baseplateTintHex = l.isNight
      ? '#0E1C28'
      : l.isRainy
        ? '#4F656C'
        : l.isCloudy
          ? '#9DB8AA'
          : l.isSunset
            ? '#B89B72'
            : '#A8CCA6';
    const baseplateRoughness = 0.94 - l.surfaceWetness * 0.45;
    const baseplateMetalness = 0.01 + l.surfaceWetness * 0.14;
    const fillPos: [number, number, number] = [
      Math.max(-68, Math.min(68, -l.sunPosition[0] * 0.68)),
      36,
      Math.max(-62, Math.min(62, -l.sunPosition[2] * 0.68)),
    ];

    return {
      plinthHex,
      trimGlowIntensity,
      meadowRoughness,
      greenRoofHex,
      greenRoofRoughness,
      parkLawnHex,
      pondEmissiveIntensity,
      pondEnvIntensity,
      rippleScale,
      waterPoolHex,
      baseplateTintHex,
      baseplateRoughness,
      baseplateMetalness,
      fillPos,
    };
  };

  const initialTargets = useMemo(() => computeSceneTargets(initialLighting), [initialLighting]);

  const atmosphereTargetsRef = useRef({
    exposure: initialLighting.exposure,
    background: new THREE.Color(initialLighting.backgroundHex),
    fogColor: new THREE.Color(initialLighting.fogHex),
    fogNear: initialLighting.fogNear,
    fogFar: initialLighting.fogFar,
    skyTint: new THREE.Color(initialLighting.skyTintColor),
    groundTint: new THREE.Color(initialLighting.groundTintColor),
    hemiIntensity: initialLighting.hemiIntensity,
    sunPos: new THREE.Vector3(...initialLighting.sunPosition),
    keyColor: new THREE.Color(initialLighting.keyLightColor),
    keyIntensity: initialLighting.keyLightIntensity,
    fillPos: new THREE.Vector3(...initialTargets.fillPos),
    fillColor: new THREE.Color(initialLighting.fillLightColor),
    fillIntensity: initialLighting.fillLightIntensity,
    plinthColor: new THREE.Color(initialTargets.plinthHex),
    trimGlowIntensity: initialTargets.trimGlowIntensity,
    meadowColor: new THREE.Color(initialLighting.meadowTintHex),
    meadowRoughness: initialTargets.meadowRoughness,
    greenRoofColor: new THREE.Color(initialTargets.greenRoofHex),
    greenRoofRoughness: initialTargets.greenRoofRoughness,
    parkLawnColor: new THREE.Color(initialTargets.parkLawnHex),
    pondColor: new THREE.Color(initialLighting.waterTintHex),
    pondEmissive: new THREE.Color(initialLighting.waterSheenColorHex),
    pondEmissiveIntensity: initialTargets.pondEmissiveIntensity,
    pondEnvIntensity: initialTargets.pondEnvIntensity,
    rippleScale: initialTargets.rippleScale,
    waterPoolColor: new THREE.Color(initialTargets.waterPoolHex),
    baseplateColor: new THREE.Color(initialTargets.baseplateTintHex),
    baseplateRoughness: initialTargets.baseplateRoughness,
    baseplateMetalness: initialTargets.baseplateMetalness,
  });

  const stormBaseRef = useRef({
    skyTint: new THREE.Color(initialLighting.skyTintColor),
    hemiIntensity: initialLighting.hemiIntensity,
    keyColor: new THREE.Color(initialLighting.keyLightColor),
    keyIntensity: initialLighting.keyLightIntensity,
    pondEmissiveIntensity: initialTargets.pondEmissiveIntensity,
    lightningSkyTint: new THREE.Color('#E0F2FE'),
    lightningKeyTint: new THREE.Color('#EFF6FF'),
  });

  useEffect(() => {
    const next = computeSceneTargets(lighting);
    const t = atmosphereTargetsRef.current;

    t.exposure = lighting.exposure;
    t.background.set(lighting.backgroundHex);
    t.fogColor.set(lighting.fogHex);
    t.fogNear = lighting.fogNear;
    t.fogFar = lighting.fogFar;
    t.skyTint.set(lighting.skyTintColor);
    t.groundTint.set(lighting.groundTintColor);
    t.hemiIntensity = lighting.hemiIntensity;
    t.sunPos.set(...lighting.sunPosition);
    t.keyColor.set(lighting.keyLightColor);
    t.keyIntensity = lighting.keyLightIntensity;
    t.fillPos.set(...next.fillPos);
    t.fillColor.set(lighting.fillLightColor);
    t.fillIntensity = lighting.fillLightIntensity;

    t.plinthColor.set(next.plinthHex);
    t.trimGlowIntensity = next.trimGlowIntensity;
    t.meadowColor.set(lighting.meadowTintHex);
    t.meadowRoughness = next.meadowRoughness;
    t.greenRoofColor.set(next.greenRoofHex);
    t.greenRoofRoughness = next.greenRoofRoughness;
    t.parkLawnColor.set(next.parkLawnHex);
    t.pondColor.set(lighting.waterTintHex);
    t.pondEmissive.set(lighting.waterSheenColorHex);
    t.pondEmissiveIntensity = next.pondEmissiveIntensity;
    t.pondEnvIntensity = next.pondEnvIntensity;
    t.rippleScale = next.rippleScale;
    t.waterPoolColor.set(next.waterPoolHex);
    t.baseplateColor.set(next.baseplateTintHex);
    t.baseplateRoughness = next.baseplateRoughness;
    t.baseplateMetalness = next.baseplateMetalness;

    if (reducedMotion) {
      gl.toneMappingExposure = t.exposure;
      bgColorRef.current?.copy(t.background);
      if (fogRef.current) {
        fogRef.current.color.copy(t.fogColor);
        fogRef.current.near = t.fogNear;
        fogRef.current.far = t.fogFar;
      }
      if (hemiLightRef.current) {
        hemiLightRef.current.color.copy(t.skyTint);
        hemiLightRef.current.groundColor.copy(t.groundTint);
        hemiLightRef.current.intensity = t.hemiIntensity;
      }
      stormBaseRef.current.skyTint.copy(t.skyTint);
      stormBaseRef.current.hemiIntensity = t.hemiIntensity;
      if (keyLightRef.current) {
        keyLightRef.current.position.copy(t.sunPos);
        keyLightRef.current.color.copy(t.keyColor);
        keyLightRef.current.intensity = t.keyIntensity;
      }
      stormBaseRef.current.keyColor.copy(t.keyColor);
      stormBaseRef.current.keyIntensity = t.keyIntensity;
      if (fillLightRef.current) {
        fillLightRef.current.position.copy(t.fillPos);
        fillLightRef.current.color.copy(t.fillColor);
        fillLightRef.current.intensity = t.fillIntensity;
      }
      if (baseplateMatRef.current) {
        baseplateMatRef.current.color.copy(t.baseplateColor);
        baseplateMatRef.current.roughness = t.baseplateRoughness;
        baseplateMatRef.current.metalness = t.baseplateMetalness;
      }

      materials.dioramaPlinth.color.copy(t.plinthColor);
      materials.dioramaTrimGlow.emissiveIntensity = t.trimGlowIntensity;
      materials.meadowTerrain.color.copy(t.meadowColor);
      materials.meadowTerrain.roughness = t.meadowRoughness;
      materials.greenRoof.color.copy(t.greenRoofColor);
      materials.greenRoof.roughness = t.greenRoofRoughness;
      materials.parkLawn.color.copy(t.parkLawnColor);
      materials.pondWater.color.copy(t.pondColor);
      materials.pondWater.emissive.copy(t.pondEmissive);
      materials.pondWater.emissiveIntensity = t.pondEmissiveIntensity;
      stormBaseRef.current.pondEmissiveIntensity = t.pondEmissiveIntensity;
      materials.pondWater.envMapIntensity = t.pondEnvIntensity;
      materials.pondWater.normalScale.set(t.rippleScale, t.rippleScale);
      materials.waterPool.color.copy(t.waterPoolColor);
      materials.waterPool.normalScale.set(t.rippleScale * 0.8, t.rippleScale * 0.8);
    }
  }, [gl, materials, lighting, reducedMotion]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    const dt = Math.min(delta, 0.05);
    if (dt <= 0) return;

    const lambda = 3.8;
    const alpha = 1 - Math.exp(-lambda * dt);
    const t = atmosphereTargetsRef.current;

    gl.toneMappingExposure = THREE.MathUtils.damp(gl.toneMappingExposure, t.exposure, lambda, dt);

    bgColorRef.current?.lerp(t.background, alpha);

    if (fogRef.current) {
      fogRef.current.color.lerp(t.fogColor, alpha);
      fogRef.current.near = THREE.MathUtils.damp(fogRef.current.near, t.fogNear, lambda, dt);
      fogRef.current.far = THREE.MathUtils.damp(fogRef.current.far, t.fogFar, lambda, dt);
    }

    const sb = stormBaseRef.current;
    const flash = stormFlashRef.current.intensity;

    if (hemiLightRef.current) {
      sb.skyTint.lerp(t.skyTint, alpha);
      sb.hemiIntensity = THREE.MathUtils.damp(sb.hemiIntensity, t.hemiIntensity, lambda, dt);

      hemiLightRef.current.color.copy(sb.skyTint);
      if (flash > 0.005) {
        hemiLightRef.current.color.lerp(sb.lightningSkyTint, Math.min(1, flash * 0.78));
      }
      hemiLightRef.current.groundColor.lerp(t.groundTint, alpha);
      hemiLightRef.current.intensity = sb.hemiIntensity + flash * 0.82;
    }

    if (keyLightRef.current) {
      sb.keyColor.lerp(t.keyColor, alpha);
      sb.keyIntensity = THREE.MathUtils.damp(sb.keyIntensity, t.keyIntensity, lambda, dt);

      keyLightRef.current.position.lerp(t.sunPos, alpha);
      keyLightRef.current.color.copy(sb.keyColor);
      if (flash > 0.005) {
        keyLightRef.current.color.lerp(sb.lightningKeyTint, Math.min(1, flash * 0.85));
      }
      keyLightRef.current.intensity = sb.keyIntensity + flash * 1.15;
    }

    if (fillLightRef.current) {
      fillLightRef.current.position.lerp(t.fillPos, alpha);
      fillLightRef.current.color.lerp(t.fillColor, alpha);
      fillLightRef.current.intensity = THREE.MathUtils.damp(
        fillLightRef.current.intensity,
        t.fillIntensity,
        lambda,
        dt,
      );
    }

    if (baseplateMatRef.current) {
      baseplateMatRef.current.color.lerp(t.baseplateColor, alpha);
      baseplateMatRef.current.roughness = THREE.MathUtils.damp(
        baseplateMatRef.current.roughness,
        t.baseplateRoughness,
        lambda,
        dt,
      );
      baseplateMatRef.current.metalness = THREE.MathUtils.damp(
        baseplateMatRef.current.metalness,
        t.baseplateMetalness,
        lambda,
        dt,
      );
    }

    materials.dioramaPlinth.color.lerp(t.plinthColor, alpha);
    materials.dioramaTrimGlow.emissiveIntensity = THREE.MathUtils.damp(
      materials.dioramaTrimGlow.emissiveIntensity,
      t.trimGlowIntensity,
      lambda,
      dt,
    );

    materials.meadowTerrain.color.lerp(t.meadowColor, alpha);
    materials.meadowTerrain.roughness = THREE.MathUtils.damp(
      materials.meadowTerrain.roughness,
      t.meadowRoughness,
      lambda,
      dt,
    );
    materials.greenRoof.color.lerp(t.greenRoofColor, alpha);
    materials.greenRoof.roughness = THREE.MathUtils.damp(
      materials.greenRoof.roughness,
      t.greenRoofRoughness,
      lambda,
      dt,
    );
    materials.parkLawn.color.lerp(t.parkLawnColor, alpha);

    sb.pondEmissiveIntensity = THREE.MathUtils.damp(
      sb.pondEmissiveIntensity,
      t.pondEmissiveIntensity,
      lambda,
      dt,
    );
    materials.pondWater.color.lerp(t.pondColor, alpha);
    materials.pondWater.emissive.lerp(t.pondEmissive, alpha);
    materials.pondWater.emissiveIntensity = sb.pondEmissiveIntensity + flash * 0.42;
    materials.pondWater.envMapIntensity = THREE.MathUtils.damp(
      materials.pondWater.envMapIntensity,
      t.pondEnvIntensity,
      lambda,
      dt,
    );
    const nextRipple = THREE.MathUtils.damp(materials.pondWater.normalScale.x, t.rippleScale, lambda, dt);
    materials.pondWater.normalScale.set(nextRipple, nextRipple);
    materials.waterPool.color.lerp(t.waterPoolColor, alpha);
    materials.waterPool.normalScale.set(nextRipple * 0.8, nextRipple * 0.8);
  });

  const envIntensity = lighting.isNight
    ? 0.28
    : lighting.isRainy
      ? 0.56
      : lighting.isCloudy
        ? 0.72
        : lighting.isSunset
          ? 0.88
          : 1.0;

  const enableShadows = renderQuality !== 'low' && !isSoftwareGl;
  const shadowSize: [number, number] = renderQuality === 'high' ? [2048, 2048] : [1024, 1024];

  const isPrimaryZone = (zone: CityZoneId) => zone === 'substation' || zone === 'commercial';
  const showZoneLabel = (zone: CityZoneId) =>
    (showLabels && isPrimaryZone(zone)) || selectedZone === zone || hoveredZone === zone;

  return (
    <group>
      {renderQuality !== 'low' && !isSoftwareGl ? (
        <DynamicSkyboxEnvironment
          lighting={lighting}
          intensity={envIntensity}
          reducedMotion={reducedMotion}
        />
      ) : null}

      {/* Dynamic Weather & Diurnal Sky + Horizon Fog */}
      <color ref={bgColorRef} attach="background" args={[initialLighting.backgroundHex]} />
      <fog
        ref={fogRef}
        attach="fog"
        args={[initialLighting.fogHex, initialLighting.fogNear, initialLighting.fogFar]}
      />

      {/* Procedural Atmospheric Gradient Sky Dome, Horizon Hills & Ridge Turbines */}
      <EcoLandscapeBackdrop
        lighting={lighting}
        windCapacityFactor={hourlyDemand.windCapacityFactor}
        stormFlashRef={stormFlashRef}
        quality={renderQuality}
        reducedMotion={reducedMotion}
      />

      {/* Three-Point Atmospheric Rig with Smooth Sun Arc & Ambient Damping */}
      <hemisphereLight
        ref={hemiLightRef}
        args={[
          initialLighting.skyTintColor,
          initialLighting.groundTintColor,
          initialLighting.hemiIntensity,
        ]}
      />
      <directionalLight
        ref={keyLightRef}
        position={initialLighting.sunPosition}
        intensity={initialLighting.keyLightIntensity}
        color={initialLighting.keyLightColor}
        castShadow={enableShadows}
        shadow-mapSize={shadowSize}
        shadow-camera-left={-82}
        shadow-camera-right={82}
        shadow-camera-top={82}
        shadow-camera-bottom={-82}
        shadow-camera-near={5}
        shadow-camera-far={240}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight
        ref={fillLightRef}
        position={initialTargets.fillPos}
        intensity={initialLighting.fillLightIntensity}
        color={initialLighting.fillLightColor}
      />

      {/* Sweeping 280x280 Outer Valley Terrain Surround */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow={enableShadows}>
        <planeGeometry args={[280, 280]} />
        <meshStandardMaterial
          ref={baseplateMatRef}
          map={textures.grid}
          color={initialTargets.baseplateTintHex}
          roughness={initialTargets.baseplateRoughness}
          metalness={initialTargets.baseplateMetalness}
        />
      </mesh>

      {/* Lush 118x102 Eco-City Parkland Meadow Surface on Diorama Island */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.002, 1.5]}
        receiveShadow={enableShadows}
        material={materials.meadowTerrain}
      >
        <planeGeometry args={[118, 102]} />
      </mesh>

      {/* Stepped Isometric Miniature Diorama Plinth & Luminous Perimeter Rail */}
      <group position={[0, -0.62, 1.5]}>
        <mesh material={materials.dioramaPlinth}>
          <boxGeometry args={[118, 1.2, 102]} />
        </mesh>
        {/* Glowing cyan telemetry perimeter rail framing the city island */}
        <mesh position={[0, 0.51, -51.1]} material={materials.dioramaTrimGlow}>
          <boxGeometry args={[118.4, 0.14, 0.22]} />
        </mesh>
        <mesh position={[0, 0.51, 51.1]} material={materials.dioramaTrimGlow}>
          <boxGeometry args={[118.4, 0.14, 0.22]} />
        </mesh>
        <mesh position={[-59.1, 0.51, 0]} material={materials.dioramaTrimGlow}>
          <boxGeometry args={[0.22, 0.14, 102.4]} />
        </mesh>
        <mesh position={[59.1, 0.51, 0]} material={materials.dioramaTrimGlow}>
          <boxGeometry args={[0.22, 0.14, 102.4]} />
        </mesh>
      </group>

      {/* Central Geodesic Glass Conservatory Hub, Terraced Ponds, Waterfalls & Bridges */}
      <EcoWaterAndConservatory
        materials={materials}
        selectedZone={selectedZone}
        hoveredZone={hoveredZone}
        onSelectZone={onSelectZone}
        onHoverZone={setHoveredZone}
        nightIlluminationFactor={lighting.nightIlluminationFactor}
        surfaceWetness={lighting.surfaceWetness}
        sunsetWeight={lighting.sunsetWeight}
        commercialMW={telemetry.commercialMW}
        quality={renderQuality}
        reducedMotion={reducedMotion}
      />

      {/* City Districts, Canal, Boulevards, Parks, Vehicles, Streetlights */}
      <InfrastructureDistricts
        materials={materials}
        selectedZone={selectedZone}
        hoveredZone={hoveredZone}
        onSelectZone={onSelectZone}
        onHoverZone={setHoveredZone}
        residentialMW={telemetry.residentialMW}
        commercialMW={telemetry.commercialMW}
        industrialMW={telemetry.industrialMW}
        nightIlluminationFactor={lighting.nightIlluminationFactor}
        surfaceWetness={lighting.surfaceWetness}
        vegetationTintHex={lighting.vegetationTintHex}
        isSunset={lighting.isSunset}
        isRainy={lighting.isRainy}
        showLandscaping={showLandscaping}
        supplyShortage={telemetry.supplyShortage}
        quality={renderQuality}
        reducedMotion={reducedMotion}
      />

      {/* Generation, Storage & 220/33 kV Substation Hub */}
      <EnergyInfrastructure
        materials={materials}
        selectedZone={selectedZone}
        hoveredZone={hoveredZone}
        onSelectZone={onSelectZone}
        onHoverZone={setHoveredZone}
        solarMW={telemetry.solarMW}
        windMW={telemetry.windMW}
        windCapacityFactor={hourlyDemand.windCapacityFactor}
        thermalMW={telemetry.thermalMW}
        bessNetMW={telemetry.bessNetMW}
        bessSocPercent={telemetry.bessSocPercent}
        daylightFactor={lighting.daylightFactor}
        nightIlluminationFactor={lighting.nightIlluminationFactor}
        supplyShortage={telemetry.supplyShortage}
        quality={renderQuality}
        reducedMotion={reducedMotion}
      />

      {/* Overhead Lattice Pylons, Feeder Kiosks & Glowing Flow Conduits */}
      <TransmissionNetwork
        materials={materials}
        corridors={telemetry.corridors}
        showFlowVectors={showFlowVectors}
        supplyShortage={telemetry.supplyShortage}
        tightReserve={telemetry.tightReserve}
        powerLineGlowIntensity={lighting.powerLineGlowIntensity}
        nightIlluminationFactor={lighting.nightIlluminationFactor}
        quality={renderQuality}
        reducedMotion={reducedMotion}
      />

      {/* Dynamic Falling Rain Particle System when Rainy mode is active */}
      <RainSystem
        active={lighting.isRainy}
        windCapacityFactor={hourlyDemand.windCapacityFactor}
        stormFlashRef={stormFlashRef}
        quality={renderQuality}
        reducedMotion={reducedMotion}
      />

      {/* Forked 3D Lightning Bolts, Cloud Flash & Transient Burst when Rainy mode is active */}
      <ThunderstormSystem
        active={lighting.isRainy}
        flashStateRef={stormFlashRef}
        quality={renderQuality}
        reducedMotion={reducedMotion}
        onStrike={onLightningStrike}
      />

      {/* Two Primary Infrastructure Anchors by Default; Secondary Zones on Hover or Selection */}
      {showZoneLabel('substation') ? (
        <SpatialAnchorLabel
          position={[0, 6.2, -4.8]}
          category="Transmission Hub"
          title="220/33 kV Substation"
          metric={`${dispatch.totalDemandMW.toFixed(1)} MW`}
          submetric={
            telemetry.supplyShortage
              ? `Deficit ${dispatch.unservedEnergyMW.toFixed(1)} MW`
              : dispatch.balanceStatus
          }
          accentColor="#2563EB"
          isPrimary
          selected={selectedZone === 'substation'}
          hovered={hoveredZone === 'substation'}
          warning={telemetry.supplyShortage}
          onClick={() => onSelectZone('substation')}
        />
      ) : null}

      {showZoneLabel('commercial') ? (
        <SpatialAnchorLabel
          position={[-0.5, 23.0, 22.7]}
          category="Primary Load District"
          title="Commercial CBD"
          metric={`${telemetry.commercialMW.toFixed(1)} MW`}
          submetric="Hospital & Towers"
          accentColor="#06B6D4"
          isPrimary
          selected={selectedZone === 'commercial'}
          hovered={hoveredZone === 'commercial'}
          warning={telemetry.supplyShortage}
          onClick={() => onSelectZone('commercial')}
        />
      ) : null}

      {showZoneLabel('solar') ? (
        <SpatialAnchorLabel
          position={[-34, 3.8, -28]}
          category="Renewable Generation"
          title="Solar PV Park"
          metric={`${telemetry.solarMW.toFixed(1)} MW`}
          submetric={`${hourlyDemand.solarIrradianceWm2} W/m²`}
          accentColor="#10B981"
          isPrimary={false}
          selected={selectedZone === 'solar'}
          hovered={hoveredZone === 'solar'}
          onClick={() => onSelectZone('solar')}
        />
      ) : null}

      {showZoneLabel('wind') ? (
        <SpatialAnchorLabel
          position={[34, 13.6, -28]}
          category="Renewable Generation"
          title="Wind Farm Ridge"
          metric={`${telemetry.windMW.toFixed(1)} MW`}
          submetric={`${Math.round(hourlyDemand.windCapacityFactor * 100)}% CF`}
          accentColor="#10B981"
          isPrimary={false}
          selected={selectedZone === 'wind'}
          hovered={hoveredZone === 'wind'}
          onClick={() => onSelectZone('wind')}
        />
      ) : null}

      {showZoneLabel('bess') ? (
        <SpatialAnchorLabel
          position={[-34, 4.0, 0]}
          category="Grid Energy Storage"
          title="LFP BESS Campus"
          metric={`${dispatch.batterySocMWh.toFixed(0)} MWh`}
          submetric={`${telemetry.bessNetMW >= 0 ? '+' : ''}${telemetry.bessNetMW.toFixed(1)} MW`}
          accentColor="#06B6D4"
          isPrimary={false}
          selected={selectedZone === 'bess'}
          hovered={hoveredZone === 'bess'}
          onClick={() => onSelectZone('bess')}
        />
      ) : null}

      {showZoneLabel('thermal') ? (
        <SpatialAnchorLabel
          position={[34, 9.8, -1.5]}
          category="Dispatchable Generation"
          title="Thermal Station"
          metric={`${telemetry.thermalMW.toFixed(1)} MW`}
          submetric="CCGT & Peaker"
          accentColor="#EA580C"
          isPrimary={false}
          selected={selectedZone === 'thermal'}
          hovered={hoveredZone === 'thermal'}
          onClick={() => onSelectZone('thermal')}
        />
      ) : null}

      {showZoneLabel('residential') ? (
        <SpatialAnchorLabel
          position={[-34.2, 11.2, 23.5]}
          category="Demand District"
          title="Residential District"
          metric={`${telemetry.residentialMW.toFixed(1)} MW`}
          submetric="Apartments & Villas"
          accentColor="#D97757"
          isPrimary={false}
          selected={selectedZone === 'residential'}
          hovered={hoveredZone === 'residential'}
          warning={telemetry.supplyShortage}
          onClick={() => onSelectZone('residential')}
        />
      ) : null}

      {showZoneLabel('industrial') ? (
        <SpatialAnchorLabel
          position={[34.2, 10.8, 25.0]}
          category="Demand District"
          title="Industrial Park"
          metric={`${telemetry.industrialMW.toFixed(1)} MW`}
          submetric="Plants & Process"
          accentColor="#F59E0B"
          isPrimary={false}
          selected={selectedZone === 'industrial'}
          hovered={hoveredZone === 'industrial'}
          warning={telemetry.supplyShortage}
          onClick={() => onSelectZone('industrial')}
        />
      ) : null}
    </group>
  );
}
