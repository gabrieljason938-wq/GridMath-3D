import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CityZoneId, RenderQuality } from '../../types/grid';
import type { CityMaterialRegistry } from './cityMaterials';
import { createHelipadTexture } from './webglUtils';

interface InfrastructureDistrictsProps {
  materials: CityMaterialRegistry;
  selectedZone: CityZoneId | null;
  hoveredZone: CityZoneId | null;
  onSelectZone: (zone: CityZoneId) => void;
  onHoverZone: (zone: CityZoneId | null) => void;
  residentialMW: number;
  commercialMW: number;
  industrialMW: number;
  nightIlluminationFactor: number;
  surfaceWetness?: number;
  vegetationTintHex?: string;
  isSunset?: boolean;
  isRainy?: boolean;
  showLandscaping: boolean;
  supplyShortage?: boolean;
  quality?: RenderQuality;
  reducedMotion?: boolean;
}

const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

// 140+ deterministic eco-trees framing lakes, conservatory plaza, curved boulevards, parks & villas
const TREE_COORDS: [number, number, number][] = [
  // Waterfront & Conservatory Promenade
  [-13.8, 10.6, 1.15],
  [13.8, 10.6, 1.15],
  [-14.4, 15.2, 1.1],
  [14.4, 15.2, 1.1],
  [-13.8, 19.6, 1.12],
  [13.8, 19.6, 1.12],
  [-6.2, 9.6, 0.96],
  [6.2, 9.6, 0.96],
  [-12.5, 22.8, 1.08],
  [12.5, 22.8, 1.08],
  [-12.5, 31.0, 1.12],
  [12.5, 31.0, 1.12],
  [-12.5, 39.2, 1.05],
  [12.5, 39.2, 1.05],
  // West & East N-S Arterial Boulevards (X = +/-17)
  [-14.8, -12.0, 1.06],
  [-14.8, -5.0, 1.0],
  [-14.8, 2.5, 1.08],
  [-14.8, 25.0, 1.02],
  [-14.8, 34.0, 1.1],
  [-14.8, 40.5, 1.04],
  [14.8, -12.0, 1.06],
  [14.8, -5.0, 1.0],
  [14.8, 2.5, 1.08],
  [14.8, 25.0, 1.02],
  [14.8, 34.0, 1.1],
  [14.8, 40.5, 1.04],
  // Crosstown Boulevard (Z = 8.0)
  [-48, 6.3, 1.14],
  [-41, 6.3, 1.04],
  [-34, 6.3, 1.08],
  [-27, 6.3, 0.98],
  [-21, 6.3, 1.06],
  [-12, 6.3, 1.0],
  [12, 6.3, 1.0],
  [21, 6.3, 1.06],
  [27, 6.3, 0.98],
  [34, 6.3, 1.1],
  [41, 6.3, 1.02],
  [48, 6.3, 1.12],
  // Canal Promenade Trees (Z = -12.2)
  [-46, -12.2, 1.15],
  [-38, -12.2, 1.05],
  [-30, -12.2, 1.12],
  [-22, -12.2, 1.02],
  [-10, -12.2, 1.08],
  [10, -12.2, 1.08],
  [22, -12.2, 1.02],
  [30, -12.2, 1.12],
  [38, -12.2, 1.05],
  [46, -12.2, 1.15],
  // Residential Eco-Park & Villa Gardens
  [-28.5, 19.2, 1.2],
  [-25.5, 18.0, 1.05],
  [-23.2, 20.5, 1.15],
  [-26.8, 22.8, 0.98],
  [-30.5, 22.2, 1.08],
  [-24.2, 24.4, 1.12],
  [-33.0, 27.0, 1.0],
  [-42.0, 27.0, 1.06],
  [-38.5, 21.5, 1.04],
  [-44.5, 21.5, 1.1],
  [-27.5, 34.5, 1.02],
  [-36.5, 34.5, 1.08],
  [-45.0, 34.5, 1.04],
  [-48.5, 16.0, 1.12],
  [-48.5, 24.0, 1.04],
  [-48.5, 34.0, 1.1],
  [-48.5, 42.0, 1.02],
  // Foreground Curved Parkway & Southern Greenbelt (Z = 46..51)
  [-46, 47.4, 1.14],
  [-38, 47.8, 1.06],
  [-30, 48.2, 1.12],
  [-22, 48.6, 1.04],
  [-14, 49.0, 1.1],
  [-6, 49.4, 1.08],
  [6, 49.4, 1.08],
  [14, 49.0, 1.1],
  [22, 48.6, 1.04],
  [30, 48.2, 1.12],
  [38, 47.8, 1.06],
  [46, 47.4, 1.14],
  [-11, 42.6, 1.02],
  [11, 42.6, 1.02],
  [-2, 42.8, 1.06],
  [2, 42.8, 1.06],
  // Northern Energy Park Perimeter Greenbelt
  [-50, -18, 1.18],
  [-50, -28, 1.12],
  [-50, -38, 1.2],
  [-42, -41.5, 1.12],
  [-30, -41.5, 1.08],
  [-15, -20, 1.1],
  [-15, -34, 1.15],
  [15, -20, 1.1],
  [15, -34, 1.15],
  [30, -41.5, 1.1],
  [42, -41.5, 1.14],
  [50, -18, 1.18],
  [50, -28, 1.12],
  [50, -38, 1.2],
  // Industrial Eco-Buffer Screening
  [54.2, 15.0, 1.06],
  [54.2, 22.0, 1.12],
  [54.2, 29.0, 1.06],
  [54.2, 36.0, 1.12],
  [54.2, 42.0, 1.08],
  [19.5, 14.0, 1.04],
  [19.5, 22.0, 1.06],
  [19.5, 32.0, 1.08],
];

// Boulevard streetlights across the expanded metropolitan grid
const STREETLIGHT_COORDS: [number, number, number][] = [
  [-45, 6.8, 0],
  [-35, 6.8, 0],
  [-25, 6.8, 0],
  [-12, 6.8, 0],
  [12, 6.8, 0],
  [25, 6.8, 0],
  [35, 6.8, 0],
  [45, 6.8, 0],
  [-45, 43.2, Math.PI],
  [-35, 43.2, Math.PI],
  [-25, 43.2, Math.PI],
  [-12, 44.2, Math.PI],
  [0, 44.8, Math.PI],
  [12, 44.2, Math.PI],
  [25, 43.2, Math.PI],
  [35, 43.2, Math.PI],
  [45, 43.2, Math.PI],
  [-15.5, -10.0, Math.PI / 2],
  [-15.5, 0.0, Math.PI / 2],
  [-15.5, 16.0, Math.PI / 2],
  [-15.5, 28.0, Math.PI / 2],
  [-15.5, 38.0, Math.PI / 2],
  [15.5, -10.0, -Math.PI / 2],
  [15.5, 0.0, -Math.PI / 2],
  [15.5, 16.0, -Math.PI / 2],
  [15.5, 28.0, -Math.PI / 2],
  [15.5, 38.0, -Math.PI / 2],
  [-40, -12.8, 0],
  [-26, -12.8, 0],
  [-8, -12.8, 0],
  [8, -12.8, 0],
  [26, -12.8, 0],
  [40, -12.8, 0],
];

// Dashed lane markings along primary boulevards & curved foreground parkway
const LANE_STRIPE_COORDS: [number, number, number][] = [
  ...Array.from({ length: 24 }, (_, i) => [-48 + i * 4.2, 8.0, 0] as [number, number, number]),
  ...Array.from({ length: 24 }, (_, i) => {
    const x = -48 + i * 4.2;
    const curveZ = 44.5 + Math.cos((x / 52) * Math.PI * 0.5) * 1.8;
    const slope = -Math.sin((x / 52) * Math.PI * 0.5) * (Math.PI * 0.5 / 52) * 1.8;
    return [x, curveZ, -Math.atan(slope)] as [number, number, number];
  }),
  ...Array.from({ length: 22 }, (_, i) => [-46 + i * 4.4, -14.0, 0] as [number, number, number]),
  ...Array.from({ length: 16 }, (_, i) => [-17.0, -12.0 + i * 3.8, Math.PI / 2] as [number, number, number]),
  ...Array.from({ length: 16 }, (_, i) => [17.0, -12.0 + i * 3.8, Math.PI / 2] as [number, number, number]),
];

// Parked freight trailers at industrial logistics docks
const TRAILER_COORDS: [number, number][] = [
  [21.5, 41.2],
  [24.0, 41.2],
  [26.5, 41.2],
  [29.0, 41.2],
  [35.5, 41.2],
  [38.0, 41.2],
  [40.5, 41.2],
  [43.0, 41.2],
];

const VEHICLE_SPECS: {
  loop: 'west-district' | 'east-district' | 'crosstown-north' | 'foreground-parkway';
  phase: number;
  speed: number;
  color: string;
}[] = [
  { loop: 'crosstown-north', phase: 0.04, speed: 0.036, color: '#2563EB' },
  { loop: 'crosstown-north', phase: 0.24, speed: 0.034, color: '#10B981' },
  { loop: 'crosstown-north', phase: 0.48, speed: 0.038, color: '#F8FAFC' },
  { loop: 'crosstown-north', phase: 0.72, speed: 0.035, color: '#06B6D4' },
  { loop: 'crosstown-north', phase: 0.91, speed: 0.037, color: '#CBD5E1' },
  { loop: 'west-district', phase: 0.1, speed: 0.042, color: '#F8FAFC' },
  { loop: 'west-district', phase: 0.36, speed: 0.04, color: '#2563EB' },
  { loop: 'west-district', phase: 0.62, speed: 0.044, color: '#10B981' },
  { loop: 'west-district', phase: 0.85, speed: 0.041, color: '#06B6D4' },
  { loop: 'east-district', phase: 0.08, speed: 0.039, color: '#CBD5E1' },
  { loop: 'east-district', phase: 0.34, speed: 0.043, color: '#F8FAFC' },
  { loop: 'east-district', phase: 0.64, speed: 0.037, color: '#06B6D4' },
  { loop: 'east-district', phase: 0.88, speed: 0.04, color: '#2563EB' },
  { loop: 'foreground-parkway', phase: 0.12, speed: 0.045, color: '#F8FAFC' },
  { loop: 'foreground-parkway', phase: 0.38, speed: 0.044, color: '#CBD5E1' },
  { loop: 'foreground-parkway', phase: 0.64, speed: 0.046, color: '#10B981' },
  { loop: 'foreground-parkway', phase: 0.86, speed: 0.043, color: '#2563EB' },
];

function sampleRectLoop(
  t: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
): [number, number, number] {
  const u = ((t % 1) + 1) % 1;
  const w = x1 - x0;
  const h = z1 - z0;
  const p = 2 * (w + h);
  const d = u * p;
  if (d < w) return [x0 + d, z0, 0];
  if (d < w + h) return [x1, z0 + (d - w), -Math.PI / 2];
  if (d < 2 * w + h) return [x1 - (d - w - h), z1, Math.PI];
  return [x0, z1 - (d - 2 * w - h), Math.PI / 2];
}

export function InfrastructureDistricts({
  materials,
  selectedZone,
  hoveredZone,
  onSelectZone,
  onHoverZone,
  residentialMW,
  commercialMW,
  industrialMW,
  nightIlluminationFactor,
  surfaceWetness = 0,
  vegetationTintHex = '#FFFFFF',
  isSunset = false,
  isRainy = false,
  showLandscaping,
  supplyShortage = false,
  quality = 'balanced',
  reducedMotion = false,
}: InfrastructureDistrictsProps) {
  const trunkInstRef = useRef<THREE.InstancedMesh | null>(null);
  const canopyInstRef = useRef<THREE.InstancedMesh | null>(null);
  const canopyTopInstRef = useRef<THREE.InstancedMesh | null>(null);
  const canopyMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const canopyTopMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const poleInstRef = useRef<THREE.InstancedMesh | null>(null);
  const bulbInstRef = useRef<THREE.InstancedMesh | null>(null);
  const lightPoolInstRef = useRef<THREE.InstancedMesh | null>(null);
  const stripeInstRef = useRef<THREE.InstancedMesh | null>(null);
  const trailerInstRef = useRef<THREE.InstancedMesh | null>(null);
  const vehicleInstRef = useRef<THREE.InstancedMesh | null>(null);
  const vehicleCabinInstRef = useRef<THREE.InstancedMesh | null>(null);
  const vehicleHeadInstRef = useRef<THREE.InstancedMesh | null>(null);
  const vehicleTailInstRef = useRef<THREE.InstancedMesh | null>(null);
  const fanRefs = useRef<Array<THREE.Mesh | null>>([]);
  const simTimeRef = useRef(0);

  const activeTrees = useMemo(
    () => (quality === 'low' ? TREE_COORDS.slice(0, 54) : TREE_COORDS),
    [quality],
  );
  const activeVehicles = useMemo(
    () => (quality === 'low' ? VEHICLE_SPECS.slice(0, 8) : VEHICLE_SPECS),
    [quality],
  );

  // Sweeping curved foreground eco-parkway geometry
  const curvedRoadGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const x = -54 + t * 108;
      const z = 44.5 + Math.cos((x / 52) * Math.PI * 0.5) * 1.8;
      pts.push(new THREE.Vector3(x, 0.045, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const shape = new THREE.Shape();
    shape.moveTo(-0.04, -1.55);
    shape.lineTo(0.04, -1.55);
    shape.lineTo(0.04, 1.55);
    shape.lineTo(-0.04, 1.55);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { steps: 36, extrudePath: curve, bevelEnabled: false });
  }, []);

  const curvedWalkGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const x = -54 + t * 108;
      const z = 44.5 + Math.cos((x / 52) * Math.PI * 0.5) * 1.8;
      pts.push(new THREE.Vector3(x, 0.018, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const shape = new THREE.Shape();
    shape.moveTo(-0.03, -2.3);
    shape.lineTo(0.03, -2.3);
    shape.lineTo(0.03, 2.3);
    shape.lineTo(-0.03, 2.3);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { steps: 36, extrudePath: curve, bevelEnabled: false });
  }, []);

  const sharedBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sharedCyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 16), []);
  const helipadTexture = useMemo(
    () => createHelipadTexture(quality === 'high' ? 8 : quality === 'balanced' ? 4 : 1),
    [quality],
  );
  const helipadMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: helipadTexture,
        roughness: 0.72,
        metalness: 0.08,
      }),
    [helipadTexture],
  );

  useEffect(() => {
    return () => {
      sharedBox.dispose();
      sharedCyl.dispose();
      curvedRoadGeo.dispose();
      curvedWalkGeo.dispose();
      helipadMaterial.dispose();
      helipadTexture.dispose();
    };
  }, [sharedBox, sharedCyl, curvedRoadGeo, curvedWalkGeo, helipadMaterial, helipadTexture]);

  // Populate road lane stripes
  useEffect(() => {
    const stripes = stripeInstRef.current;
    if (!stripes) return;
    LANE_STRIPE_COORDS.forEach(([x, z, rotY], idx) => {
      _quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      _pos.set(x, 0.072, z);
      _scale.set(1.9, 0.012, 0.18);
      _mat4.compose(_pos, _quat, _scale);
      stripes.setMatrixAt(idx, _mat4);
    });
    stripes.instanceMatrix.needsUpdate = true;
    stripes.computeBoundingSphere();
  }, []);

  // Populate parked logistics freight trailers
  useEffect(() => {
    const trailers = trailerInstRef.current;
    if (!trailers) return;
    TRAILER_COORDS.forEach(([x, z], idx) => {
      _quat.identity();
      _pos.set(x, 0.64, z);
      _scale.set(1.15, 0.92, 2.75);
      _mat4.compose(_pos, _quat, _scale);
      trailers.setMatrixAt(idx, _mat4);
      _color.set(idx % 3 === 0 ? '#E2E8F0' : idx % 3 === 1 ? '#CBD5E1' : '#DBEAFE');
      trailers.setColorAt(idx, _color);
    });
    trailers.instanceMatrix.needsUpdate = true;
    if (trailers.instanceColor) trailers.instanceColor.needsUpdate = true;
    trailers.computeBoundingSphere();
  }, []);

  // Populate instanced dual-tier landscaping trees
  useEffect(() => {
    if (!showLandscaping) return;
    const trunks = trunkInstRef.current;
    const canopies = canopyInstRef.current;
    const canopyTops = canopyTopInstRef.current;
    if (!trunks || !canopies || !canopyTops) return;

    activeTrees.forEach(([x, z, s], idx) => {
      _pos.set(x, 0.48 * s, z);
      _quat.identity();
      _scale.set(0.14 * s, 0.96 * s, 0.14 * s);
      _mat4.compose(_pos, _quat, _scale);
      trunks.setMatrixAt(idx, _mat4);

      _pos.set(x, 1.32 * s, z);
      _scale.set(0.76 * s, 0.95 * s, 0.76 * s);
      _mat4.compose(_pos, _quat, _scale);
      canopies.setMatrixAt(idx, _mat4);

      _pos.set(x + 0.14 * s, 1.78 * s, z - 0.1 * s);
      _scale.set(0.5 * s, 0.62 * s, 0.5 * s);
      _mat4.compose(_pos, _quat, _scale);
      canopyTops.setMatrixAt(idx, _mat4);

      const palette = ['#34D399', '#10B981', '#6EE7B7', '#2DD4BF'];
      _color.set(palette[idx % palette.length]);
      canopies.setColorAt(idx, _color);
      _color.set(palette[(idx + 1) % palette.length]);
      canopyTops.setColorAt(idx, _color);
    });

    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    canopyTops.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    if (canopyTops.instanceColor) canopyTops.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    canopies.computeBoundingSphere();
    canopyTops.computeBoundingSphere();
  }, [showLandscaping, activeTrees]);

  // Populate instanced streetlights and ground illumination pools
  useEffect(() => {
    if (!showLandscaping) return;
    const poles = poleInstRef.current;
    const bulbs = bulbInstRef.current;
    const pools = lightPoolInstRef.current;
    if (!poles || !bulbs) return;

    STREETLIGHT_COORDS.forEach(([x, z, rotY], idx) => {
      _quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      _pos.set(x, 1.35, z);
      _scale.set(0.08, 2.7, 0.08);
      _mat4.compose(_pos, _quat, _scale);
      poles.setMatrixAt(idx, _mat4);

      const lx = x + Math.sin(rotY) * 0.32;
      const lz = z + Math.cos(rotY) * 0.32;
      _pos.set(lx, 2.74, lz);
      _scale.set(0.26, 0.09, 0.16);
      _mat4.compose(_pos, _quat, _scale);
      bulbs.setMatrixAt(idx, _mat4);

      if (pools) {
        _quat.identity();
        _pos.set(lx, 0.082, lz);
        _scale.set(2.1, 0.015, 2.1);
        _mat4.compose(_pos, _quat, _scale);
        pools.setMatrixAt(idx, _mat4);
      }
    });

    poles.instanceMatrix.needsUpdate = true;
    bulbs.instanceMatrix.needsUpdate = true;
    poles.computeBoundingSphere();
    bulbs.computeBoundingSphere();
    if (pools) {
      pools.instanceMatrix.needsUpdate = true;
      pools.computeBoundingSphere();
    }
  }, [showLandscaping]);

  const targetWetRef = useRef(Math.max(0, Math.min(1, surfaceWetness)));
  const currentWetRef = useRef(targetWetRef.current);
  const targetNightRef = useRef(nightIlluminationFactor);
  const currentNightRef = useRef(nightIlluminationFactor);
  const targetVegColorRef = useRef(new THREE.Color(vegetationTintHex));
  const targetCanopyEmissiveRef = useRef(new THREE.Color(isSunset ? '#D97706' : '#000000'));
  const targetCanopyTopEmissiveRef = useRef(new THREE.Color(isSunset ? '#F59E0B' : '#000000'));
  const targetCanopyRoughnessRef = useRef(isRainy ? 0.54 : 0.84);
  const targetCanopyTopRoughnessRef = useRef(isRainy ? 0.5 : 0.82);
  const targetCanopyEmissiveIntensityRef = useRef(isSunset ? 0.07 : 0);
  const targetCanopyTopEmissiveIntensityRef = useRef(isSunset ? 0.09 : 0);

  const applyDistrictSurfaceState = (wet: number, night: number) => {
    materials.roadAsphaltLight.roughness = 0.88 - wet * 0.72;
    materials.roadAsphaltLight.metalness = 0.04 + wet * 0.26;
    materials.roadAsphaltLight.clearcoat = 0.05 + wet * 0.9;
    materials.roadAsphaltLight.clearcoatRoughness = 0.35 - wet * 0.27;
    materials.roadAsphaltLight.envMapIntensity = 1.0 + wet * 1.45;
    materials.roadAsphaltLight.normalScale.set(wet * 0.14, wet * 0.14);

    materials.sidewalkConcrete.roughness = 0.82 - wet * 0.56;
    materials.sidewalkConcrete.metalness = 0.03 + wet * 0.18;

    materials.limestoneWalkway.roughness = 0.78 - wet * 0.56;
    materials.limestoneWalkway.metalness = 0.03 + wet * 0.16;
    materials.limestoneWalkway.clearcoat = 0.04 + wet * 0.65;
    materials.limestoneWalkway.clearcoatRoughness = 0.35 - wet * 0.24;
    materials.limestoneWalkway.envMapIntensity = 1.0 + wet * 0.85;
    materials.limestoneWalkway.normalScale.set(wet * 0.1, wet * 0.1);

    materials.alabasterPad.roughness = 0.86 - wet * 0.54;
    materials.alabasterPad.metalness = 0.03 + wet * 0.16;

    const glassGlow = Math.max(0, night - 0.18);
    materials.architecturalGlass.emissive.set('#0EA5E9');
    materials.architecturalGlass.emissiveIntensity = glassGlow * 0.42;
    materials.skylineGlassTeal.emissive.set('#06B6D4');
    materials.skylineGlassTeal.emissiveIntensity = glassGlow * 0.38;

    materials.evHeadlight.emissiveIntensity = 0.55 + night * 1.75;
    materials.evTaillight.emissiveIntensity = 0.48 + night * 1.45;
  };

  // Update target lighting/weather values and snap immediately if reducedMotion is enabled
  useEffect(() => {
    targetWetRef.current = Math.max(0, Math.min(1, surfaceWetness));
    targetNightRef.current = nightIlluminationFactor;
    targetVegColorRef.current.set(vegetationTintHex);
    targetCanopyEmissiveRef.current.set(isSunset ? '#D97706' : '#000000');
    targetCanopyTopEmissiveRef.current.set(isSunset ? '#F59E0B' : '#000000');
    targetCanopyRoughnessRef.current = isRainy ? 0.54 : 0.84;
    targetCanopyTopRoughnessRef.current = isRainy ? 0.5 : 0.82;
    targetCanopyEmissiveIntensityRef.current = isSunset ? 0.07 : 0;
    targetCanopyTopEmissiveIntensityRef.current = isSunset ? 0.09 : 0;

    if (reducedMotion) {
      currentWetRef.current = targetWetRef.current;
      currentNightRef.current = targetNightRef.current;
      applyDistrictSurfaceState(currentWetRef.current, currentNightRef.current);

      if (canopyMatRef.current) {
        canopyMatRef.current.color.copy(targetVegColorRef.current);
        canopyMatRef.current.roughness = targetCanopyRoughnessRef.current;
        canopyMatRef.current.emissive.copy(targetCanopyEmissiveRef.current);
        canopyMatRef.current.emissiveIntensity = targetCanopyEmissiveIntensityRef.current;
      }
      if (canopyTopMatRef.current) {
        canopyTopMatRef.current.color.copy(targetVegColorRef.current);
        canopyTopMatRef.current.roughness = targetCanopyTopRoughnessRef.current;
        canopyTopMatRef.current.emissive.copy(targetCanopyTopEmissiveRef.current);
        canopyTopMatRef.current.emissiveIntensity = targetCanopyTopEmissiveIntensityRef.current;
      }
    }
  }, [surfaceWetness, nightIlluminationFactor, vegetationTintHex, isSunset, isRainy, materials, reducedMotion]);

  useEffect(() => {
    const cars = vehicleInstRef.current;
    if (!cars) return;
    activeVehicles.forEach((v, idx) => {
      _color.set(v.color);
      cars.setColorAt(idx, _color);
    });
    if (cars.instanceColor) cars.instanceColor.needsUpdate = true;
  }, [activeVehicles]);

  useFrame((_, delta) => {
    const dt = reducedMotion ? 0 : Math.min(delta, 0.05);
    simTimeRef.current += dt;

    if (dt > 0) {
      const alpha = 1 - Math.exp(-3.8 * dt);
      currentWetRef.current = THREE.MathUtils.damp(currentWetRef.current, targetWetRef.current, 3.8, dt);
      currentNightRef.current = THREE.MathUtils.damp(currentNightRef.current, targetNightRef.current, 3.8, dt);

      applyDistrictSurfaceState(currentWetRef.current, currentNightRef.current);

      if (canopyMatRef.current) {
        canopyMatRef.current.color.lerp(targetVegColorRef.current, alpha);
        canopyMatRef.current.roughness = THREE.MathUtils.damp(
          canopyMatRef.current.roughness,
          targetCanopyRoughnessRef.current,
          3.8,
          dt,
        );
        canopyMatRef.current.emissive.lerp(targetCanopyEmissiveRef.current, alpha);
        canopyMatRef.current.emissiveIntensity = THREE.MathUtils.damp(
          canopyMatRef.current.emissiveIntensity,
          targetCanopyEmissiveIntensityRef.current,
          3.8,
          dt,
        );
      }
      if (canopyTopMatRef.current) {
        canopyTopMatRef.current.color.lerp(targetVegColorRef.current, alpha);
        canopyTopMatRef.current.roughness = THREE.MathUtils.damp(
          canopyTopMatRef.current.roughness,
          targetCanopyTopRoughnessRef.current,
          3.8,
          dt,
        );
        canopyTopMatRef.current.emissive.lerp(targetCanopyTopEmissiveRef.current, alpha);
        canopyTopMatRef.current.emissiveIntensity = THREE.MathUtils.damp(
          canopyTopMatRef.current.emissiveIntensity,
          targetCanopyTopEmissiveIntensityRef.current,
          3.8,
          dt,
        );
      }
    }

    const nightFactor = currentNightRef.current;
    const loadIntensity = Math.min(1, (residentialMW + commercialMW) / 420);
    const brownoutFactor = supplyShortage ? 0.52 : 1.0;
    materials.windowGlow.emissiveIntensity =
      (0.14 + nightFactor * (0.65 + loadIntensity * 0.55)) * brownoutFactor;
    materials.resWindowWarmGlow.emissiveIntensity =
      (0.08 + nightFactor * (0.78 + loadIntensity * 0.45)) * brownoutFactor;
    materials.streetlightBulb.emissiveIntensity =
      (0.08 + nightFactor * 1.45) * brownoutFactor;
    materials.lightPoolDisc.opacity =
      nightFactor > 0.25 ? (nightFactor - 0.2) * 0.24 * brownoutFactor : 0;

    if (dt > 0) {
      const fanSpeed = 1.0 + (industrialMW / 130) * 4.8;
      for (let i = 0; i < fanRefs.current.length; i++) {
        const fan = fanRefs.current[i];
        if (fan) fan.rotation.y += dt * fanSpeed;
      }
    }

    const cars = vehicleInstRef.current;
    const cabins = vehicleCabinInstRef.current;
    const heads = vehicleHeadInstRef.current;
    const tails = vehicleTailInstRef.current;
    if (cars) {
      const t = simTimeRef.current;
      activeVehicles.forEach((v, idx) => {
        const progress = v.phase + t * v.speed;
        let sample: [number, number, number];
        if (v.loop === 'crosstown-north') {
          sample = sampleRectLoop(progress, -50, 50, -14.4, 8.0);
        } else if (v.loop === 'west-district') {
          sample = sampleRectLoop(progress, -51.0, -17.5, 8.5, 43.8);
        } else if (v.loop === 'east-district') {
          sample = sampleRectLoop(progress, 17.5, 51.0, 8.5, 43.8);
        } else {
          // Curved foreground eco-parkway sweep
          const u = ((progress % 1) + 1) % 1;
          const x = -50 + u * 100;
          const z = 44.5 + Math.cos((x / 52) * Math.PI * 0.5) * 1.8 + 0.55;
          const slope = -Math.sin((x / 52) * Math.PI * 0.5) * (Math.PI * 0.5 / 52) * 1.8;
          sample = [x, z, -Math.atan(slope)];
        }
        const [vx, vz, yaw] = sample;
        _euler.set(0, yaw, 0);
        _quat.setFromEuler(_euler);
        const dirX = Math.cos(yaw);
        const dirZ = -Math.sin(yaw);

        _pos.set(vx, 0.24, vz);
        _scale.set(1.18, 0.28, 0.54);
        _mat4.compose(_pos, _quat, _scale);
        cars.setMatrixAt(idx, _mat4);

        if (cabins) {
          _pos.set(vx - dirX * 0.06, 0.44, vz - dirZ * 0.06);
          _scale.set(0.68, 0.18, 0.46);
          _mat4.compose(_pos, _quat, _scale);
          cabins.setMatrixAt(idx, _mat4);
        }
        if (heads) {
          _pos.set(vx + dirX * 0.59, 0.24, vz + dirZ * 0.59);
          _scale.set(0.06, 0.08, 0.42);
          _mat4.compose(_pos, _quat, _scale);
          heads.setMatrixAt(idx, _mat4);
        }
        if (tails) {
          _pos.set(vx - dirX * 0.59, 0.24, vz - dirZ * 0.59);
          _scale.set(0.06, 0.08, 0.42);
          _mat4.compose(_pos, _quat, _scale);
          tails.setMatrixAt(idx, _mat4);
        }
      });
      cars.instanceMatrix.needsUpdate = true;
      if (cabins) cabins.instanceMatrix.needsUpdate = true;
      if (heads) heads.instanceMatrix.needsUpdate = true;
      if (tails) tails.instanceMatrix.needsUpdate = true;
    }
  });

  const makeHoverProps = (zone: CityZoneId) => ({
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onSelectZone(zone);
    },
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onHoverZone(zone);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      onHoverZone(null);
      document.body.style.cursor = 'auto';
    },
  });

  const zoneBorderMaterial = (zone: CityZoneId, nominalMat: THREE.Material) =>
    selectedZone === zone
      ? materials.cobaltAccent
      : supplyShortage
        ? materials.alertCrimson
        : hoveredZone === zone
          ? materials.cyanAccent
          : nominalMat;

  return (
    <group>
      {/* =================================================================== */}
      {/* CANAL WATERWAY SPINE, CURVED FOREGROUND PARKWAY & ROAD GRID         */}
      {/* =================================================================== */}
      <group>
        {/* Architectural Cooling & Urban Canal (Z = -10.5) */}
        <mesh position={[0, 0.02, -10.5]} receiveShadow geometry={sharedBox} scale={[118, 0.04, 3.6]} material={materials.limestoneWalkway} />
        <mesh position={[0, 0.06, -10.5]} geometry={sharedBox} scale={[118, 0.05, 2.7]} material={materials.pondWater} />

        {/* Sidewalks & Curving Foreground Parkway */}
        <mesh position={[0, 0.015, 8.0]} receiveShadow geometry={sharedBox} scale={[108, 0.03, 2.8]} material={materials.limestoneWalkway} />
        <mesh geometry={curvedWalkGeo} receiveShadow material={materials.limestoneWalkway} />
        <mesh position={[0, 0.015, -14.0]} receiveShadow geometry={sharedBox} scale={[104, 0.03, 2.8]} material={materials.limestoneWalkway} />
        <mesh position={[-17.0, 0.015, 16.0]} receiveShadow geometry={sharedBox} scale={[3.4, 0.03, 62]} material={materials.limestoneWalkway} />
        <mesh position={[17.0, 0.015, 16.0]} receiveShadow geometry={sharedBox} scale={[3.4, 0.03, 62]} material={materials.limestoneWalkway} />
        <mesh position={[-51.5, 0.015, 27.5]} receiveShadow geometry={sharedBox} scale={[2.8, 0.03, 38]} material={materials.limestoneWalkway} />
        <mesh position={[51.5, 0.015, 27.5]} receiveShadow geometry={sharedBox} scale={[2.8, 0.03, 38]} material={materials.limestoneWalkway} />

        {/* Slate-Gray Asphalt Boulevards */}
        <mesh position={[0, 0.045, 8.0]} receiveShadow geometry={sharedBox} scale={[107, 0.04, 2.1]} material={materials.roadAsphaltLight} />
        <mesh geometry={curvedRoadGeo} receiveShadow material={materials.roadAsphaltLight} />
        <mesh position={[0, 0.045, -14.0]} receiveShadow geometry={sharedBox} scale={[103, 0.04, 2.1]} material={materials.roadAsphaltLight} />
        <mesh position={[-17.0, 0.045, 16.0]} receiveShadow geometry={sharedBox} scale={[2.5, 0.04, 61]} material={materials.roadAsphaltLight} />
        <mesh position={[17.0, 0.045, 16.0]} receiveShadow geometry={sharedBox} scale={[2.5, 0.04, 61]} material={materials.roadAsphaltLight} />
        <mesh position={[-51.5, 0.045, 27.5]} receiveShadow geometry={sharedBox} scale={[2.1, 0.04, 37]} material={materials.roadAsphaltLight} />
        <mesh position={[51.5, 0.045, 27.5]} receiveShadow geometry={sharedBox} scale={[2.1, 0.04, 37]} material={materials.roadAsphaltLight} />

        {/* Canal Road Bridges with Timber & Steel Parapets */}
        {[-17.0, 17.0].map((bx) => (
          <group key={bx} position={[bx, 0.14, -10.5]}>
            <mesh position={[-1.4, 0.12, 0]} castShadow geometry={sharedBox} scale={[0.18, 0.24, 3.8]} material={materials.warmTimber} />
            <mesh position={[1.4, 0.12, 0]} castShadow geometry={sharedBox} scale={[0.18, 0.24, 3.8]} material={materials.warmTimber} />
          </group>
        ))}

        {/* Instanced Lane Centerline Markings */}
        <instancedMesh
          ref={stripeInstRef}
          args={[sharedBox, materials.laneMarkingWhite, LANE_STRIPE_COORDS.length]}
        />

        {/* Intersection Zebra Crosswalks */}
        {[-17.0, 17.0].map((ix) =>
          [8.0, 44.5].map((iz) =>
            [-0.7, 0, 0.7].map((offset) => (
              <mesh
                key={`${ix}-${iz}-${offset}`}
                position={[ix + offset, 0.074, iz + 1.55]}
                geometry={sharedBox}
                scale={[0.28, 0.015, 0.85]}
                material={materials.laneMarkingWhite}
              />
            )),
          ),
        )}

        {/* Instanced Multi-Part Aerodynamic Electric Vehicles */}
        <instancedMesh
          key={`vehicles-${activeVehicles.length}`}
          ref={vehicleInstRef}
          args={[sharedBox, materials.plasterWhite, activeVehicles.length]}
          castShadow={quality !== 'low'}
        />
        <instancedMesh
          key={`vehicle-cabins-${activeVehicles.length}`}
          ref={vehicleCabinInstRef}
          args={[sharedBox, materials.evCabinGlass, activeVehicles.length]}
        />
        <instancedMesh
          key={`vehicle-heads-${activeVehicles.length}`}
          ref={vehicleHeadInstRef}
          args={[sharedBox, materials.evHeadlight, activeVehicles.length]}
        />
        <instancedMesh
          key={`vehicle-tails-${activeVehicles.length}`}
          ref={vehicleTailInstRef}
          args={[sharedBox, materials.evTaillight, activeVehicles.length]}
        />
      </group>

      {/* =================================================================== */}
      {/* INSTANCED LANDSCAPING TREES & STREETLIGHTS                          */}
      {/* =================================================================== */}
      {showLandscaping ? (
        <group>
          <instancedMesh
            key={`trunks-${activeTrees.length}`}
            ref={trunkInstRef}
            args={[sharedCyl, materials.foliageTrunk, activeTrees.length]}
            castShadow={quality !== 'low'}
          />
          <instancedMesh
            key={`canopies-${activeTrees.length}`}
            ref={canopyInstRef}
            args={[undefined, undefined, activeTrees.length]}
            castShadow={quality !== 'low'}
            receiveShadow={quality !== 'low'}
          >
            <dodecahedronGeometry args={[0.92, 0]} />
            <meshStandardMaterial ref={canopyMatRef} roughness={0.84} metalness={0.0} />
          </instancedMesh>
          <instancedMesh
            key={`canopy-tops-${activeTrees.length}`}
            ref={canopyTopInstRef}
            args={[undefined, undefined, activeTrees.length]}
            castShadow={quality !== 'low'}
          >
            <dodecahedronGeometry args={[0.8, 0]} />
            <meshStandardMaterial ref={canopyTopMatRef} roughness={0.82} metalness={0.0} />
          </instancedMesh>
          <instancedMesh
            ref={poleInstRef}
            args={[sharedCyl, materials.brushedSteel, STREETLIGHT_COORDS.length]}
            castShadow={quality !== 'low'}
          />
          <instancedMesh
            ref={bulbInstRef}
            args={[sharedBox, materials.streetlightBulb, STREETLIGHT_COORDS.length]}
          />
          <instancedMesh
            ref={lightPoolInstRef}
            args={[sharedCyl, materials.lightPoolDisc, STREETLIGHT_COORDS.length]}
          />
        </group>
      ) : null}

      {/* =================================================================== */}
      {/* 1. EXPANDED RESIDENTIAL DISTRICT (32x30 Multi-Block Neighborhood)   */}
      {/* =================================================================== */}
      <group position={[-34.2, 0, 27.5]} {...makeHoverProps('residential')}>
        <mesh position={[0, 0.12, 0]} receiveShadow geometry={sharedBox} scale={[31.0, 0.24, 30.0]} material={materials.alabasterPad} />
        <mesh
          position={[0, 0.25, 14.95]}
          geometry={sharedBox}
          scale={[31.0, 0.08, 0.18]}
          material={zoneBorderMaterial('residential', materials.resTerracottaRoof)}
        />

        {/* Internal Neighborhood Collector Streets */}
        <mesh position={[0, 0.255, -0.5]} receiveShadow geometry={sharedBox} scale={[29.2, 0.03, 1.8]} material={materials.roadAsphaltLight} />
        <mesh position={[0, 0.255, 7.6]} receiveShadow geometry={sharedBox} scale={[29.2, 0.03, 1.4]} material={materials.roadAsphaltLight} />
        <mesh position={[-1.5, 0.255, 0]} receiveShadow geometry={sharedBox} scale={[1.6, 0.03, 28.4]} material={materials.roadAsphaltLight} />

        {/* Central Community Park, Reflection Pond & Multi-Sport Court */}
        <group position={[7.2, 0.26, -7.2]}>
          <mesh position={[0, 0.02, 0]} receiveShadow geometry={sharedBox} scale={[12.5, 0.04, 10.5]} material={materials.parkLawn} />
          <mesh position={[-2.2, 0.05, 0]} geometry={sharedCyl} scale={[2.0, 0.04, 2.0]} material={materials.waterPool} />
          {/* Sports Court */}
          <mesh position={[3.0, 0.05, 1.2]} geometry={sharedBox} scale={[4.2, 0.04, 2.6]} material={materials.cobaltAccent} />
          <mesh position={[3.0, 0.06, 1.2]} geometry={sharedBox} scale={[3.8, 0.04, 2.2]} material={materials.emeraldAccent} />
        </group>

        {/* 8 Biophilic Terraced Eco-Apartment Pavilions with Green Roofs & Warm Timber */}
        {[
          { x: -12.0, z: -10.5, w: 3.8, d: 3.1, h: 7.4, wall: materials.resWarmStucco },
          { x: -7.2, z: -10.8, w: 3.4, d: 2.9, h: 6.2, wall: materials.resSandstone },
          { x: -12.2, z: -5.4, w: 3.5, d: 3.0, h: 5.4, wall: materials.resSandstone },
          { x: -7.0, z: -5.2, w: 3.2, d: 2.8, h: 6.8, wall: materials.resWarmStucco },
          { x: 3.5, z: -11.8, w: 3.6, d: 2.6, h: 5.2, wall: materials.resWarmStucco },
          { x: 9.8, z: -11.8, w: 3.4, d: 2.6, h: 4.6, wall: materials.resSandstone },
          { x: 12.0, z: 3.5, w: 3.2, d: 2.8, h: 4.9, wall: materials.resWarmStucco },
          { x: 7.5, z: 3.5, w: 3.0, d: 2.6, h: 4.2, wall: materials.resSandstone },
        ].map((t, idx) => (
          <group key={idx} position={[t.x, 0.24, t.z]}>
            <mesh position={[0, t.h / 2, 0]} castShadow receiveShadow geometry={sharedBox} scale={[t.w, t.h, t.d]} material={t.wall} />
            {[0.25, 0.5, 0.75].map((f) => (
              <group key={f}>
                <mesh position={[0, t.h * f, 0]} castShadow geometry={sharedBox} scale={[t.w + 0.42, 0.12, t.d + 0.42]} material={materials.limestoneWalkway} />
                <mesh position={[0, t.h * f + 0.18, 0]} geometry={sharedBox} scale={[t.w + 0.08, 0.24, t.d + 0.08]} material={materials.resWindowWarmGlow} />
                <mesh position={[0, t.h * f - 0.12, t.d / 2 + 0.14]} geometry={sharedBox} scale={[t.w * 0.78, 0.08, 0.08]} material={materials.warmTimber} />
              </group>
            ))}
            {/* Cantilevered Limestone Crown + Lush Green Roof Terrace + Solar Pergola */}
            <mesh position={[0, t.h + 0.1, 0]} castShadow geometry={sharedBox} scale={[t.w + 0.48, 0.18, t.d + 0.48]} material={materials.limestoneWalkway} />
            <mesh position={[0, t.h + 0.22, 0]} receiveShadow geometry={sharedBox} scale={[t.w + 0.2, 0.08, t.d + 0.2]} material={materials.greenRoof} />
            <mesh position={[0, t.h + 0.36, 0]} rotation={[0.16, 0, 0]} castShadow geometry={sharedBox} scale={[t.w * 0.62, 0.07, t.d * 0.52]} material={materials.solarSilicon} />
          </group>
        ))}

        {/* 16 Biophilic Eco-Villas with Wrap-Around Warm Glass & Green Roof Gardens */}
        {[
          { x: -12.6, z: 3.5, roof: materials.greenRoof },
          { x: -8.6, z: 3.5, roof: materials.resTerracottaRoof },
          { x: -4.6, z: 3.5, roof: materials.greenRoof },
          { x: 2.5, z: 3.5, roof: materials.greenRoof },
          { x: -12.6, z: 11.4, roof: materials.greenRoof },
          { x: -8.6, z: 11.4, roof: materials.resTerracottaRoof },
          { x: -4.6, z: 11.4, roof: materials.greenRoof },
          { x: 2.0, z: 11.4, roof: materials.greenRoof },
          { x: 6.0, z: 11.4, roof: materials.resSageRoof },
          { x: 10.0, z: 11.4, roof: materials.greenRoof },
          { x: -12.6, z: 13.6, roof: materials.resTerracottaRoof },
          { x: -8.6, z: 13.6, roof: materials.greenRoof },
          { x: -4.6, z: 13.6, roof: materials.greenRoof },
          { x: 2.0, z: 13.6, roof: materials.resSlateRoof },
          { x: 6.0, z: 13.6, roof: materials.greenRoof },
          { x: 10.0, z: 13.6, roof: materials.greenRoof },
        ].map((h, idx) => (
          <group key={idx} position={[h.x, 0.24, h.z]}>
            <mesh position={[0, 0.04, 0]} receiveShadow geometry={sharedBox} scale={[3.4, 0.08, 2.3]} material={materials.parkLawn} />
            <mesh position={[-0.2, 0.68, 0]} castShadow receiveShadow geometry={sharedBox} scale={[2.2, 1.24, 1.75]} material={materials.resWarmStucco} />
            <mesh position={[1.15, 0.48, 0.1]} castShadow receiveShadow geometry={sharedBox} scale={[0.95, 0.92, 1.4]} material={materials.warmTimber} />
            <mesh position={[-0.2, 0.68, 0]} geometry={sharedBox} scale={[2.24, 0.68, 1.79]} material={materials.resWindowWarmGlow} />
            {h.roof === materials.greenRoof ? (
              <group>
                <mesh position={[-0.1, 1.38, 0]} castShadow geometry={sharedBox} scale={[2.55, 0.14, 2.05]} material={materials.limestoneWalkway} />
                <mesh position={[-0.1, 1.48, 0]} geometry={sharedBox} scale={[2.3, 0.08, 1.8]} material={materials.greenRoof} />
                <mesh position={[0.3, 1.58, 0]} rotation={[0.2, 0, 0]} geometry={sharedBox} scale={[1.1, 0.06, 0.9]} material={materials.solarSilicon} />
              </group>
            ) : (
              <mesh position={[-0.2, 1.68, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[1.64, 0.74, 4]} />
                <primitive object={h.roof} attach="material" />
              </mesh>
            )}
          </group>
        ))}
      </group>

      {/* =================================================================== */}
      {/* 2. COMMERCIAL & INSTITUTIONAL ECO-DISTRICT (Biophilic CBD Spine)    */}
      {/* =================================================================== */}
      <group position={[0, 0, 27.5]} {...makeHoverProps('commercial')}>
        <mesh position={[0, 0.12, 3.4]} receiveShadow geometry={sharedBox} scale={[29.0, 0.24, 21.0]} material={materials.alabasterPad} />
        <mesh
          position={[0, 0.25, 13.85]}
          geometry={sharedBox}
          scale={[29.0, 0.08, 0.18]}
          material={zoneBorderMaterial('commercial', materials.cyanAccent)}
        />

        {/* Biophilic Green-Roof Entry Promenade linking to Conservatory Hub */}
        <mesh position={[0, 0.04, -7.2]} receiveShadow geometry={sharedBox} scale={[12.0, 0.08, 2.2]} material={materials.limestoneWalkway} />

        {/* 1. Flagship Apex Grid Spire Tower (with Timber-Glass Eco-Podium & Sky Gardens) */}
        <group position={[-0.5, 0.24, -3.8]}>
          <mesh position={[0, 1.2, 0]} castShadow receiveShadow geometry={sharedBox} scale={[5.6, 2.4, 5.0]} material={materials.limestoneWalkway} />
          <mesh position={[0, 2.46, 0]} geometry={sharedBox} scale={[5.2, 0.1, 4.6]} material={materials.greenRoof} />
          <mesh position={[0, 9.2, 0]} castShadow receiveShadow geometry={sharedBox} scale={[3.8, 15.2, 3.6]} material={materials.architecturalGlass} />
          {[-1.4, 0, 1.4].map((fx) => (
            <mesh key={fx} position={[fx, 9.2, 0]} castShadow geometry={sharedBox} scale={[0.22, 15.6, 3.8]} material={materials.towerSlateTrim} />
          ))}
          <mesh position={[0, 17.2, 0]} castShadow geometry={sharedBox} scale={[2.6, 1.0, 2.5]} material={materials.towerSlateTrim} />
          <mesh position={[0, 17.78, 0]} geometry={sharedBox} scale={[2.3, 0.08, 2.2]} material={materials.greenRoof} />
          <mesh position={[0, 18.8, 0]} castShadow geometry={sharedCyl} scale={[0.09, 2.0, 0.09]} material={materials.cyanAccent} />
        </group>

        {/* 2. Twin Diagrid Research Towers + Biophilic Skybridge */}
        <group position={[5.8, 0.24, -4.6]}>
          <mesh position={[0, 7.2, 0]} castShadow receiveShadow geometry={sharedBox} scale={[3.6, 14.4, 3.4]} material={materials.skylineGlassTeal} />
          <mesh position={[0, 14.55, 0]} castShadow geometry={sharedBox} scale={[3.8, 0.32, 3.6]} material={materials.limestoneWalkway} />
          <mesh position={[0, 14.76, 0]} geometry={sharedBox} scale={[3.4, 0.1, 3.2]} material={materials.greenRoof} />
        </group>
        <group position={[10.4, 0.24, -3.8]}>
          <mesh position={[0, 6.4, 0]} castShadow receiveShadow geometry={sharedBox} scale={[3.3, 12.8, 3.2]} material={materials.architecturalGlass} />
          <mesh position={[-2.3, 8.0, -0.4]} castShadow geometry={sharedBox} scale={[2.6, 0.72, 1.1]} material={materials.skylineGlassTeal} />
          <mesh position={[-2.3, 8.42, -0.4]} geometry={sharedBox} scale={[2.4, 0.1, 0.9]} material={materials.greenRoof} />
          <mesh position={[0, 12.95, 0]} geometry={sharedBox} scale={[3.38, 0.22, 3.28]} material={materials.towerSlateTrim} />
        </group>

        {/* 3. Innovation Cantilever Tower with Green Terrace Slabs */}
        <group position={[-6.8, 0.24, -4.5]}>
          <mesh position={[0, 5.8, 0]} castShadow receiveShadow geometry={sharedBox} scale={[3.5, 11.6, 3.4]} material={materials.architecturalGlass} />
          {[2.2, 4.4, 6.6, 8.8, 10.8].map((fy) => (
            <group key={fy}>
              <mesh position={[0, fy, 0]} geometry={sharedBox} scale={[3.85, 0.16, 3.75]} material={materials.limestoneWalkway} />
              <mesh position={[0, fy + 0.11, 0]} geometry={sharedBox} scale={[3.68, 0.06, 3.58]} material={materials.greenRoof} />
            </group>
          ))}
          <mesh position={[0, 11.8, 0]} geometry={sharedBox} scale={[3.55, 0.2, 3.45]} material={materials.cobaltAccent} />
        </group>

        {/* 4. West & East Biophilic Corporate Eco-Pavilions */}
        {[
          { x: -11.2, z: -2.5, w: 3.1, d: 3.0, h: 8.8, mat: materials.skylineGlassTeal },
          { x: -10.8, z: 3.2, w: 3.4, d: 3.2, h: 7.6, mat: materials.architecturalGlass },
          { x: 10.6, z: 2.2, w: 3.2, d: 3.0, h: 8.0, mat: materials.skylineGlassTeal },
          { x: -5.4, z: 2.2, w: 3.4, d: 3.0, h: 6.8, mat: materials.architecturalGlass },
        ].map((b, idx) => (
          <group key={idx} position={[b.x, 0.24, b.z]}>
            <mesh position={[0, b.h / 2, 0]} castShadow receiveShadow geometry={sharedBox} scale={[b.w, b.h, b.d]} material={b.mat} />
            <mesh position={[0, b.h + 0.12, 0]} castShadow geometry={sharedBox} scale={[b.w + 0.24, 0.2, b.d + 0.24]} material={materials.limestoneWalkway} />
            <mesh position={[0, b.h + 0.26, 0]} geometry={sharedBox} scale={[b.w * 0.9, 0.08, b.d * 0.9]} material={materials.greenRoof} />
          </group>
        ))}

        {/* 5. Eco-Galleria & Transit Atrium with Timber Canopy & Green Roof */}
        <group position={[-5.8, 0.24, 9.0]}>
          <mesh position={[0, 1.35, 0]} castShadow receiveShadow geometry={sharedBox} scale={[10.5, 2.7, 6.2]} material={materials.limestoneWalkway} />
          <mesh position={[0, 2.76, 0]} geometry={sharedBox} scale={[9.8, 0.1, 5.6]} material={materials.greenRoof} />
          <mesh position={[0, 3.08, 0]} castShadow geometry={sharedBox} scale={[7.8, 0.52, 4.0]} material={materials.skylineGlassTeal} />
          <mesh position={[0, 1.1, 3.14]} geometry={sharedBox} scale={[8.4, 1.5, 0.08]} material={materials.resWindowWarmGlow} />
          <mesh position={[0, 2.05, 3.45]} castShadow geometry={sharedBox} scale={[9.4, 0.18, 0.85]} material={materials.warmTimber} />
        </group>

        {/* 6. Expanded Regional Medical Center (Hospital + Helipad + Oxygen Farm) */}
        <group position={[6.8, 0.24, 9.2]}>
          <mesh position={[0, 2.7, 0]} castShadow receiveShadow geometry={sharedBox} scale={[8.2, 5.4, 5.4]} material={materials.plasterWhite} />
          <mesh position={[0, 2.8, 0]} geometry={sharedBox} scale={[8.28, 3.5, 4.5]} material={materials.windowGlow} />
          <mesh position={[-4.6, 1.5, 1.0]} castShadow receiveShadow geometry={sharedBox} scale={[2.8, 3.0, 3.6]} material={materials.warmPlaster} />
          <mesh position={[0, 0.85, 3.2]} castShadow geometry={sharedBox} scale={[3.8, 0.22, 1.7]} material={materials.cobaltAccent} />
          <mesh position={[1.4, 5.45, 0]} geometry={sharedCyl} scale={[1.85, 0.1, 1.85]} material={helipadMaterial} />
          <mesh position={[-2.6, 4.35, 2.74]} geometry={sharedBox} scale={[1.05, 0.28, 0.08]} material={materials.hospitalCross} />
          <mesh position={[-2.6, 4.35, 2.74]} geometry={sharedBox} scale={[0.28, 1.05, 0.08]} material={materials.hospitalCross} />
          {/* Medical Oxygen Cylinders */}
          <mesh position={[4.8, 1.2, -1.6]} castShadow geometry={sharedCyl} scale={[0.42, 2.4, 0.42]} material={materials.plasterWhite} />
          <mesh position={[4.8, 1.2, -0.4]} castShadow geometry={sharedCyl} scale={[0.42, 2.4, 0.42]} material={materials.plasterWhite} />
        </group>
      </group>

      {/* =================================================================== */}
      {/* 3. INDUSTRIAL & PROCESS LOGISTICS COMPLEX (32x30 Mega Yard)         */}
      {/* =================================================================== */}
      <group position={[34.2, 0, 27.5]} {...makeHoverProps('industrial')}>
        <mesh position={[0, 0.12, 0]} receiveShadow geometry={sharedBox} scale={[31.0, 0.24, 30.0]} material={materials.alabasterPad} />
        <mesh
          position={[0, 0.25, 14.95]}
          geometry={sharedBox}
          scale={[31.0, 0.08, 0.18]}
          material={zoneBorderMaterial('industrial', materials.industrialAmber)}
        />

        {/* 3 Sawtooth Automated Manufacturing Halls */}
        {[-11.0, -5.6, -0.2].map((fx, idx) => (
          <group key={idx} position={[fx, 0.24, -8.2]}>
            <mesh position={[0, 1.65, 0]} castShadow receiveShadow geometry={sharedBox} scale={[4.6, 3.3, 8.8]} material={materials.industrialCladding} />
            <mesh position={[0, 3.15, 0]} geometry={sharedBox} scale={[4.68, 0.26, 8.88]} material={materials.thermalAccentOrange} />
            {[-2.8, 0, 2.8].map((rz) => (
              <group key={rz} position={[0, 3.55, rz]}>
                <mesh rotation={[0.3, 0, 0]} castShadow geometry={sharedBox} scale={[4.45, 0.42, 1.9]} material={materials.industrialSteel} />
                <mesh position={[0, 0.18, 0.72]} geometry={sharedBox} scale={[4.2, 0.26, 0.14]} material={materials.architecturalGlass} />
              </group>
            ))}
            <mesh
              ref={(el) => {
                fanRefs.current[idx] = el;
              }}
              position={[0, 3.95, 0]}
              geometry={sharedBox}
              scale={[1.45, 0.12, 0.28]}
              material={materials.cobaltAccent}
            />
          </group>
        ))}

        {/* 2 Vaulted Heavy Assembly Plants with Overhead Crane Gantry */}
        {[-9.6, -2.6].map((fx, idx) => (
          <group key={idx} position={[fx, 0.24, 0.8]}>
            <mesh position={[0, 1.85, 0]} castShadow receiveShadow geometry={sharedBox} scale={[5.8, 3.7, 5.2]} material={materials.industrialCladding} />
            <mesh position={[0, 3.82, 0]} geometry={sharedBox} scale={[5.9, 0.24, 5.3]} material={materials.cobaltAccent} />
            <mesh
              ref={(el) => {
                fanRefs.current[3 + idx] = el;
              }}
              position={[0, 4.1, 0]}
              geometry={sharedBox}
              scale={[1.35, 0.12, 0.26]}
              material={materials.cobaltAccent}
            />
          </group>
        ))}
        {/* Yellow Overhead Gantry Crane spanning yard */}
        <mesh position={[-6.0, 4.6, 4.4]} castShadow geometry={sharedBox} scale={[12.8, 0.42, 0.55]} material={materials.industrialAmber} />
        <mesh position={[-12.0, 2.4, 4.4]} castShadow geometry={sharedBox} scale={[0.42, 4.4, 0.42]} material={materials.industrialAmber} />
        <mesh position={[0.0, 2.4, 4.4]} castShadow geometry={sharedBox} scale={[0.42, 4.4, 0.42]} material={materials.industrialAmber} />

        {/* Twin Mega Logistics & Cold-Chain Distribution Warehouses (10 Loading Bays) */}
        {[-8.2, 5.8].map((wx, wIdx) => (
          <group key={wIdx} position={[wx, 0.24, 9.6]}>
            <mesh position={[0, 1.3, 0]} castShadow receiveShadow geometry={sharedBox} scale={[12.4, 2.6, 5.4]} material={materials.warmPlaster} />
            <mesh position={[0, 2.68, 0]} geometry={sharedBox} scale={[12.5, 0.16, 5.5]} material={materials.industrialSteel} />
            <mesh position={[0, 2.84, 0]} rotation={[0.1, 0, 0]} castShadow geometry={sharedBox} scale={[10.4, 0.08, 3.6]} material={materials.solarSilicon} />
            {[-4.4, -2.2, 0, 2.2, 4.4].map((dx) => (
              <mesh key={dx} position={[dx, 0.72, 2.74]} geometry={sharedBox} scale={[1.25, 1.44, 0.08]} material={materials.industrialSteel} />
            ))}
          </group>
        ))}

        {/* Process & Petrochemical Yard: 8 Silos, 3 Hortonspheres, 3 Distillation Columns, Pipe Rack & 2 Chimneys */}
        <group position={[8.6, 0.24, -2.5]}>
          {/* 8 Material Silos (2 rows of 4) */}
          {[-7.2, -4.6, -2.0, 0.6].map((sz, rIdx) =>
            [-2.2, 0.4].map((sx, cIdx) => (
              <group key={`${rIdx}-${cIdx}`} position={[sx, 0, sz]}>
                <mesh position={[0, 2.4, 0]} castShadow receiveShadow geometry={sharedCyl} scale={[0.92, 4.8, 0.92]} material={materials.plasterWhite} />
                <mesh position={[0, 4.92, 0]} castShadow geometry={sharedCyl} scale={[0.98, 0.28, 0.98]} material={materials.industrialSteel} />
              </group>
            )),
          )}
          {/* Elevated Orange & Steel Pipe-Rack Network */}
          <mesh position={[-4.5, 3.8, -3.5]} castShadow geometry={sharedBox} scale={[8.8, 0.34, 0.56]} material={materials.industrialSteel} />
          <mesh position={[-4.5, 4.12, -3.5]} geometry={sharedBox} scale={[8.6, 0.18, 0.28]} material={materials.thermalAccentOrange} />

          {/* 3 Spherical Pressurized Hortonsphere Tanks */}
          {[-4.5, -1.6, 1.3].map((tx, idx) => (
            <group key={idx} position={[tx, 0, 5.2]}>
              <mesh position={[0, 1.55, 0]} castShadow receiveShadow>
                <sphereGeometry args={[1.18, quality === 'low' ? 10 : 18, quality === 'low' ? 10 : 18]} />
                <primitive object={materials.plasterWhite} attach="material" />
              </mesh>
              <mesh position={[0, 1.55, 0]} geometry={sharedCyl} scale={[1.22, 0.18, 1.22]} material={materials.industrialAmber} />
              <mesh position={[0, 0.65, 0]} geometry={sharedCyl} scale={[0.68, 1.3, 0.68]} material={materials.industrialSteel} />
            </group>
          ))}

          {/* 3 Distillation Columns & 2 Tall Ringed Chimneys */}
          {[
            { x: 3.6, z: -6.5, h: 7.4 },
            { x: 3.6, z: -3.2, h: 6.4 },
            { x: 3.6, z: 0.2, h: 5.8 },
          ].map((col, idx) => (
            <group key={idx} position={[col.x, 0, col.z]}>
              <mesh position={[0, col.h / 2, 0]} castShadow geometry={sharedCyl} scale={[0.52, col.h, 0.52]} material={materials.industrialSteel} />
              <mesh position={[0, col.h * 0.82, 0]} geometry={sharedCyl} scale={[0.68, 0.26, 0.68]} material={materials.thermalAccentOrange} />
            </group>
          ))}
          {[-8.8, 3.8].map((cz, idx) => (
            <group key={idx} position={[4.5, 0, cz]}>
              <mesh position={[0, 4.6, 0]} castShadow geometry={sharedCyl} scale={[0.46, 9.2, 0.46]} material={materials.plasterWhite} />
              <mesh position={[0, 8.4, 0]} geometry={sharedCyl} scale={[0.5, 0.9, 0.5]} material={materials.thermalAccentOrange} />
              <mesh position={[0, 6.2, 0]} geometry={sharedCyl} scale={[0.5, 0.6, 0.5]} material={materials.thermalAccentOrange} />
            </group>
          ))}
        </group>
      </group>

      {/* Instanced Parked Freight Semi-Trailers at Logistics Docks */}
      <instancedMesh
        ref={trailerInstRef}
        args={[sharedBox, materials.plasterWhite, TRAILER_COORDS.length]}
        castShadow={quality !== 'low'}
      />
    </group>
  );
}
