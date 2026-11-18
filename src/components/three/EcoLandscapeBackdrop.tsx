import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import type { RenderQuality } from '../../types/grid';
import type { DiurnalLightingState } from './powerFlowMath';

interface EcoLandscapeBackdropProps {
  lighting: DiurnalLightingState;
  windCapacityFactor: number;
  stormFlashRef?: React.MutableRefObject<{ intensity: number }>;
  quality: RenderQuality;
  reducedMotion?: boolean;
}

const NIGHT_OVERLAY_VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const NIGHT_OVERLAY_FRAGMENT_SHADER = `
  uniform vec3 uNightTopColor;
  uniform vec3 uNightHorizonColor;
  uniform float uNightAtmosphere;
  uniform float uStarFactor;
  uniform float uTime;
  varying vec3 vWorldPosition;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    if (uNightAtmosphere <= 0.005 && uStarFactor <= 0.005) {
      discard;
    }

    vec3 dir = normalize(vWorldPosition);
    float h = clamp(dir.y * 1.45 + 0.06, 0.0, 1.0);
    vec3 nightGlow = mix(uNightHorizonColor, uNightTopColor, pow(h, 0.65)) * uNightAtmosphere;

    if (uStarFactor > 0.01 && dir.y > 0.05) {
      float starNoise = hash(floor(dir * 270.0));
      float twinkle = 0.8 + 0.2 * sin(uTime * 2.5 + starNoise * 60.0);
      float star = smoothstep(0.9964, 0.9994, starNoise) * uStarFactor * twinkle * smoothstep(0.05, 0.34, dir.y);
      nightGlow += vec3(0.86, 0.93, 1.0) * star;
    }

    gl_FragColor = vec4(nightGlow, 1.0);
  }
`;

interface HillSpec {
  x: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  rotY: number;
  tier: 'near' | 'far';
}

const HORIZON_HILLS: HillSpec[] = [
  // Near emerald foothills bordering north, west, and east edges
  { x: -64, z: -68, rx: 22, ry: 9.5, rz: 16, rotY: 0.3, tier: 'near' },
  { x: -32, z: -72, rx: 26, ry: 11.2, rz: 17, rotY: -0.2, tier: 'near' },
  { x: 2, z: -74, rx: 24, ry: 10.0, rz: 16, rotY: 0.15, tier: 'near' },
  { x: 36, z: -72, rx: 27, ry: 12.0, rz: 18, rotY: -0.35, tier: 'near' },
  { x: 68, z: -66, rx: 22, ry: 9.0, rz: 16, rotY: 0.45, tier: 'near' },
  { x: -74, z: -38, rx: 18, ry: 8.8, rz: 24, rotY: 0.25, tier: 'near' },
  { x: -76, z: -4, rx: 17, ry: 7.4, rz: 22, rotY: -0.1, tier: 'near' },
  { x: -74, z: 30, rx: 16, ry: 6.5, rz: 20, rotY: 0.4, tier: 'near' },
  { x: 74, z: -34, rx: 17, ry: 8.2, rz: 22, rotY: -0.3, tier: 'near' },
  // Outer hazy mountain ridge inspired by scenic horizon in reference
  { x: -82, z: -92, rx: 32, ry: 17.5, rz: 24, rotY: 0.2, tier: 'far' },
  { x: -42, z: -98, rx: 36, ry: 21.0, rz: 25, rotY: -0.15, tier: 'far' },
  { x: 0, z: -102, rx: 34, ry: 18.5, rz: 24, rotY: 0.1, tier: 'far' },
  { x: 44, z: -96, rx: 36, ry: 22.0, rz: 26, rotY: -0.25, tier: 'far' },
  { x: 84, z: -88, rx: 30, ry: 16.5, rz: 24, rotY: 0.35, tier: 'far' },
  { x: -98, z: -54, rx: 24, ry: 15.0, rz: 30, rotY: 0.15, tier: 'far' },
  { x: -102, z: -12, rx: 22, ry: 13.5, rz: 28, rotY: -0.2, tier: 'far' },
];

const HORIZON_TURBINES: [number, number, number, number][] = [
  [-58, 7.6, -65, 8.6],
  [-24, 9.2, -68, 9.4],
  [12, 8.2, -70, 8.8],
  [48, 9.6, -68, 9.6],
  [-70, 7.0, -35, 8.2],
  [-70, 5.8, 2, 7.6],
];

interface CloudClusterSpec {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  speed: number;
  minCoverage: number;
}

const CLOUD_CLUSTERS: CloudClusterSpec[] = [
  { x: -42, y: 40, z: -36, sx: 11.5, sy: 2.3, sz: 6.2, speed: 0.9, minCoverage: 0.12 },
  { x: 18, y: 43, z: -42, sx: 13.0, sy: 2.6, sz: 7.0, speed: 0.78, minCoverage: 0.12 },
  { x: -12, y: 41, z: -10, sx: 12.2, sy: 2.4, sz: 6.6, speed: 0.85, minCoverage: 0.25 },
  { x: 46, y: 44, z: 8, sx: 10.5, sy: 2.1, sz: 5.8, speed: 1.0, minCoverage: 0.2 },
  { x: -50, y: 39, z: 18, sx: 12.8, sy: 2.5, sz: 6.5, speed: 0.82, minCoverage: 0.3 },
  { x: 6, y: 45, z: 32, sx: 11.0, sy: 2.2, sz: 6.0, speed: 0.94, minCoverage: 0.18 },
  { x: -24, y: 38, z: -56, sx: 14.5, sy: 2.8, sz: 7.4, speed: 0.74, minCoverage: 0.45 },
  { x: 34, y: 42, z: -22, sx: 13.5, sy: 2.7, sz: 6.8, speed: 0.88, minCoverage: 0.55 },
  { x: -4, y: 40, z: 10, sx: 14.0, sy: 2.8, sz: 7.2, speed: 0.8, minCoverage: 0.65 },
  { x: 26, y: 39, z: 22, sx: 12.5, sy: 2.4, sz: 6.4, speed: 0.92, minCoverage: 0.65 },
  { x: -38, y: 42, z: -4, sx: 13.8, sy: 2.6, sz: 6.9, speed: 0.84, minCoverage: 0.72 },
  { x: 52, y: 41, z: -48, sx: 14.2, sy: 2.9, sz: 7.2, speed: 0.76, minCoverage: 0.78 },
];

const LOBE_OFFSETS: [number, number, number, number, number, number][] = [
  [0, 0, 0, 1.0, 1.0, 1.0],
  [-0.56, -0.18, 0.12, 0.72, 0.74, 0.78],
  [0.58, -0.16, -0.1, 0.7, 0.72, 0.76],
  [0.12, 0.34, 0.08, 0.64, 0.78, 0.66],
];

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _vec3 = new THREE.Vector3();
const _zeroEmissive = new THREE.Color('#000000');
const _lightningCloudEmissive = new THREE.Color('#BFDBFE');

function computeBackdropTargets(lighting: DiurnalLightingState) {
  const starFactor = lighting.isNight
    ? lighting.isRainy
      ? 0.0
      : lighting.isCloudy
        ? 0.2
        : 0.95
    : 0.0;
  const nightAtmosphere = lighting.isNight
    ? lighting.isRainy
      ? 0.32
      : lighting.isCloudy
        ? 0.55
        : 0.92
    : 0.0;
  const showSunDisc = lighting.isRainy ? 0.1 : 1.0;
  const hasSunsetHillRim = lighting.sunsetWeight > 0.2 && !lighting.isNight;
  const nearHillEmissiveHex = hasSunsetHillRim ? '#EA580C' : '#000000';
  const farHillEmissiveHex = hasSunsetHillRim ? '#F97316' : '#000000';
  const nearHillEmissiveIntensity = hasSunsetHillRim ? lighting.sunsetWeight * 0.08 : 0;
  const farHillEmissiveIntensity = hasSunsetHillRim ? lighting.sunsetWeight * 0.16 : 0;
  const cloudEmissiveIntensity = lighting.isSunset
    ? 0.34
    : lighting.isNight
      ? 0.08
      : lighting.isRainy
        ? 0.06
        : 0.14;
  const cloudOpacity = lighting.isRainy
    ? 0.88
    : lighting.isCloudy
      ? 0.84
      : lighting.isNight
        ? 0.36
        : lighting.isSunset
          ? 0.72
          : 0.68;
  const turbineHex = lighting.isNight
    ? '#94A3B8'
    : lighting.isSunset
      ? '#FFEAD5'
      : '#F8FAFC';
  const cloudAltDrop = lighting.isRainy ? -5.8 : lighting.isCloudy ? -2.0 : 0;

  return {
    starFactor,
    nightAtmosphere,
    showSunDisc,
    nearHillEmissiveHex,
    farHillEmissiveHex,
    nearHillEmissiveIntensity,
    farHillEmissiveIntensity,
    cloudEmissiveIntensity,
    cloudOpacity,
    turbineHex,
    cloudAltDrop,
  };
}

export function EcoLandscapeBackdrop({
  lighting,
  windCapacityFactor,
  stormFlashRef,
  quality,
  reducedMotion = false,
}: EcoLandscapeBackdropProps) {
  const rotorRefs = useRef<Array<THREE.Group | null>>([]);
  const cloudInstRef = useRef<THREE.InstancedMesh | null>(null);
  const cloudDriftRef = useRef(0);
  const cloudAltDropCurrentRef = useRef(
    lighting.isRainy ? -5.8 : lighting.isCloudy ? -2.0 : 0,
  );
  const cloudBaseEmissiveRef = useRef(new THREE.Color(lighting.cloudRimHex));
  const cloudBaseEmissiveIntensityRef = useRef(0.14);

  const initialTargets = useMemo(() => computeBackdropTargets(lighting), []);

  // Three.js physical atmospheric Sky component (Preetham scattering + volumetric clouds)
  const threeSky = useMemo(() => {
    const sky = new Sky();
    sky.scale.setScalar(620);
    sky.renderOrder = -2;
    const mat = sky.material as THREE.ShaderMaterial;
    mat.fog = false;
    mat.uniforms.turbidity.value = lighting.skyTurbidity;
    mat.uniforms.rayleigh.value = lighting.skyRayleigh;
    mat.uniforms.mieCoefficient.value = lighting.skyMieCoefficient;
    mat.uniforms.mieDirectionalG.value = lighting.skyMieDirectionalG;
    mat.uniforms.sunPosition.value.set(...lighting.skySunPosition).normalize();
    mat.uniforms.cloudScale.value = 0.00042;
    mat.uniforms.cloudSpeed.value = 0.00008;
    mat.uniforms.cloudCoverage.value = lighting.cloudCoverage;
    mat.uniforms.cloudDensity.value = lighting.skyCloudDensity;
    mat.uniforms.cloudElevation.value = lighting.skyCloudElevation;
    mat.uniforms.showSunDisc.value = initialTargets.showSunDisc;
    mat.uniforms.time.value = 0;
    return sky;
  }, []);

  // Additive nocturnal cobalt twilight glow + twinkling starfield layered over night Sky
  const nightOverlayMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: NIGHT_OVERLAY_VERTEX_SHADER,
        fragmentShader: NIGHT_OVERLAY_FRAGMENT_SHADER,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        uniforms: {
          uNightTopColor: { value: new THREE.Color('#061229') },
          uNightHorizonColor: { value: new THREE.Color('#19366E') },
          uNightAtmosphere: { value: initialTargets.nightAtmosphere },
          uStarFactor: { value: initialTargets.starFactor },
          uTime: { value: 0 },
        },
      }),
    [],
  );

  const nearHillMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: lighting.hillNearHex,
        roughness: 0.94,
        metalness: 0.0,
        emissive: initialTargets.nearHillEmissiveHex,
        emissiveIntensity: initialTargets.nearHillEmissiveIntensity,
      }),
    [],
  );

  const farHillMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: lighting.hillFarHex,
        roughness: 0.96,
        metalness: 0.0,
        emissive: initialTargets.farHillEmissiveHex,
        emissiveIntensity: initialTargets.farHillEmissiveIntensity,
      }),
    [],
  );

  const cloudMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: lighting.cloudTintHex,
        emissive: lighting.cloudRimHex,
        emissiveIntensity: initialTargets.cloudEmissiveIntensity,
        roughness: 0.96,
        metalness: 0.0,
        transparent: true,
        opacity: initialTargets.cloudOpacity,
        depthWrite: false,
      }),
    [],
  );

  const turbineMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: initialTargets.turbineHex,
        roughness: 0.45,
        metalness: 0.12,
      }),
    [],
  );

  const sharedBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sharedCyl = useMemo(() => new THREE.CylinderGeometry(0.14, 0.28, 1, 12), []);
  const cloudPuffGeo = useMemo(
    () => new THREE.DodecahedronGeometry(1, quality === 'low' ? 0 : 1),
    [quality],
  );

  // Target values updated synchronously on lighting change and smoothly damped per-frame
  const targetsRef = useRef({
    skySunDir: new THREE.Vector3(...lighting.skySunPosition).normalize(),
    skyTurbidity: lighting.skyTurbidity,
    skyRayleigh: lighting.skyRayleigh,
    skyMieCoefficient: lighting.skyMieCoefficient,
    skyMieDirectionalG: lighting.skyMieDirectionalG,
    skyCloudCoverage: lighting.cloudCoverage,
    skyCloudDensity: lighting.skyCloudDensity,
    skyCloudElevation: lighting.skyCloudElevation,
    showSunDisc: initialTargets.showSunDisc,
    nightAtmosphere: initialTargets.nightAtmosphere,
    starFactor: initialTargets.starFactor,
    cloudTint: new THREE.Color(lighting.cloudTintHex),
    cloudRim: new THREE.Color(lighting.cloudRimHex),
    nearHillColor: new THREE.Color(lighting.hillNearHex),
    farHillColor: new THREE.Color(lighting.hillFarHex),
    nearHillEmissive: new THREE.Color(initialTargets.nearHillEmissiveHex),
    farHillEmissive: new THREE.Color(initialTargets.farHillEmissiveHex),
    nearHillEmissiveIntensity: initialTargets.nearHillEmissiveIntensity,
    farHillEmissiveIntensity: initialTargets.farHillEmissiveIntensity,
    cloudEmissiveIntensity: initialTargets.cloudEmissiveIntensity,
    cloudOpacity: initialTargets.cloudOpacity,
    turbineColor: new THREE.Color(initialTargets.turbineHex),
    cloudAltDrop: initialTargets.cloudAltDrop,
  });

  useEffect(() => {
    const next = computeBackdropTargets(lighting);
    const t = targetsRef.current;

    t.skySunDir.set(...lighting.skySunPosition).normalize();
    t.skyTurbidity = lighting.skyTurbidity;
    t.skyRayleigh = lighting.skyRayleigh;
    t.skyMieCoefficient = lighting.skyMieCoefficient;
    t.skyMieDirectionalG = lighting.skyMieDirectionalG;
    t.skyCloudCoverage = lighting.cloudCoverage;
    t.skyCloudDensity = lighting.skyCloudDensity;
    t.skyCloudElevation = lighting.skyCloudElevation;
    t.showSunDisc = next.showSunDisc;
    t.nightAtmosphere = next.nightAtmosphere;
    t.starFactor = next.starFactor;

    t.cloudTint.set(lighting.cloudTintHex);
    t.cloudRim.set(lighting.cloudRimHex);
    t.nearHillColor.set(lighting.hillNearHex);
    t.farHillColor.set(lighting.hillFarHex);
    t.nearHillEmissive.set(next.nearHillEmissiveHex);
    t.farHillEmissive.set(next.farHillEmissiveHex);
    t.nearHillEmissiveIntensity = next.nearHillEmissiveIntensity;
    t.farHillEmissiveIntensity = next.farHillEmissiveIntensity;

    t.cloudEmissiveIntensity = next.cloudEmissiveIntensity;
    t.cloudOpacity = next.cloudOpacity;
    t.turbineColor.set(next.turbineHex);
    t.cloudAltDrop = next.cloudAltDrop;

    if (reducedMotion) {
      const skyUniforms = (threeSky.material as THREE.ShaderMaterial).uniforms;
      skyUniforms.sunPosition.value.copy(t.skySunDir);
      skyUniforms.turbidity.value = t.skyTurbidity;
      skyUniforms.rayleigh.value = t.skyRayleigh;
      skyUniforms.mieCoefficient.value = t.skyMieCoefficient;
      skyUniforms.mieDirectionalG.value = t.skyMieDirectionalG;
      skyUniforms.cloudCoverage.value = t.skyCloudCoverage;
      skyUniforms.cloudDensity.value = t.skyCloudDensity;
      skyUniforms.cloudElevation.value = t.skyCloudElevation;
      skyUniforms.showSunDisc.value = t.showSunDisc;

      nightOverlayMaterial.uniforms.uNightAtmosphere.value = t.nightAtmosphere;
      nightOverlayMaterial.uniforms.uStarFactor.value = t.starFactor;

      nearHillMat.color.copy(t.nearHillColor);
      farHillMat.color.copy(t.farHillColor);
      nearHillMat.emissive.copy(t.nearHillEmissive);
      farHillMat.emissive.copy(t.farHillEmissive);
      nearHillMat.emissiveIntensity = t.nearHillEmissiveIntensity;
      farHillMat.emissiveIntensity = t.farHillEmissiveIntensity;

      cloudMat.color.copy(t.cloudTint);
      cloudMat.emissive.copy(t.cloudRim);
      cloudBaseEmissiveRef.current.copy(t.cloudRim);
      cloudMat.emissiveIntensity = t.cloudEmissiveIntensity;
      cloudBaseEmissiveIntensityRef.current = t.cloudEmissiveIntensity;
      cloudMat.opacity = t.cloudOpacity;
      turbineMat.color.copy(t.turbineColor);
      cloudAltDropCurrentRef.current = t.cloudAltDrop;
    }
  }, [
    lighting,
    reducedMotion,
    threeSky,
    nightOverlayMaterial,
    nearHillMat,
    farHillMat,
    cloudMat,
    turbineMat,
  ]);

  useEffect(() => {
    return () => {
      threeSky.geometry.dispose();
      (threeSky.material as THREE.Material).dispose();
      nightOverlayMaterial.dispose();
      nearHillMat.dispose();
      farHillMat.dispose();
      cloudMat.dispose();
      turbineMat.dispose();
      sharedBox.dispose();
      sharedCyl.dispose();
      cloudPuffGeo.dispose();
    };
  }, [
    threeSky,
    nightOverlayMaterial,
    nearHillMat,
    farHillMat,
    cloudMat,
    turbineMat,
    sharedBox,
    sharedCyl,
    cloudPuffGeo,
  ]);

  const activeCloudClusters = useMemo(
    () => (quality === 'low' ? CLOUD_CLUSTERS.slice(0, 6) : CLOUD_CLUSTERS),
    [quality],
  );
  const totalCloudLobes = activeCloudClusters.length * LOBE_OFFSETS.length;

  useFrame((_, delta) => {
    const dt = reducedMotion ? 0 : Math.min(delta, 0.05);
    const t = targetsRef.current;
    const skyUniforms = (threeSky.material as THREE.ShaderMaterial).uniforms;

    if (dt > 0) {
      skyUniforms.time.value += dt;
      nightOverlayMaterial.uniforms.uTime.value += dt;
      cloudDriftRef.current += dt * (1.2 + windCapacityFactor * 2.8);

      const lambda = 3.6;
      const alpha = 1 - Math.exp(-lambda * dt);

      // Arc Three.js Sky sunPosition smoothly across sky dome without collapsing through origin
      _vec3.copy(skyUniforms.sunPosition.value).lerp(t.skySunDir, alpha);
      if (_vec3.lengthSq() < 0.002) {
        _vec3.set(0, 1, 0);
      } else {
        _vec3.normalize();
      }
      skyUniforms.sunPosition.value.copy(_vec3);

      skyUniforms.turbidity.value = THREE.MathUtils.damp(
        skyUniforms.turbidity.value,
        t.skyTurbidity,
        lambda,
        dt,
      );
      skyUniforms.rayleigh.value = THREE.MathUtils.damp(
        skyUniforms.rayleigh.value,
        t.skyRayleigh,
        lambda,
        dt,
      );
      skyUniforms.mieCoefficient.value = THREE.MathUtils.damp(
        skyUniforms.mieCoefficient.value,
        t.skyMieCoefficient,
        lambda,
        dt,
      );
      skyUniforms.mieDirectionalG.value = THREE.MathUtils.damp(
        skyUniforms.mieDirectionalG.value,
        t.skyMieDirectionalG,
        lambda,
        dt,
      );
      skyUniforms.cloudCoverage.value = THREE.MathUtils.damp(
        skyUniforms.cloudCoverage.value,
        t.skyCloudCoverage,
        3.4,
        dt,
      );
      skyUniforms.cloudDensity.value = THREE.MathUtils.damp(
        skyUniforms.cloudDensity.value,
        t.skyCloudDensity,
        3.4,
        dt,
      );
      skyUniforms.cloudElevation.value = THREE.MathUtils.damp(
        skyUniforms.cloudElevation.value,
        t.skyCloudElevation,
        3.4,
        dt,
      );
      skyUniforms.showSunDisc.value = THREE.MathUtils.damp(
        skyUniforms.showSunDisc.value,
        t.showSunDisc,
        lambda,
        dt,
      );

      nightOverlayMaterial.uniforms.uNightAtmosphere.value = THREE.MathUtils.damp(
        nightOverlayMaterial.uniforms.uNightAtmosphere.value,
        t.nightAtmosphere,
        3.2,
        dt,
      );
      nightOverlayMaterial.uniforms.uStarFactor.value = THREE.MathUtils.damp(
        nightOverlayMaterial.uniforms.uStarFactor.value,
        t.starFactor,
        3.2,
        dt,
      );

      nearHillMat.color.lerp(t.nearHillColor, alpha);
      farHillMat.color.lerp(t.farHillColor, alpha);
      nearHillMat.emissive.lerp(
        t.nearHillEmissiveIntensity > 0.001 ? t.nearHillEmissive : _zeroEmissive,
        alpha,
      );
      farHillMat.emissive.lerp(
        t.farHillEmissiveIntensity > 0.001 ? t.farHillEmissive : _zeroEmissive,
        alpha,
      );
      nearHillMat.emissiveIntensity = THREE.MathUtils.damp(
        nearHillMat.emissiveIntensity,
        t.nearHillEmissiveIntensity,
        3.8,
        dt,
      );
      farHillMat.emissiveIntensity = THREE.MathUtils.damp(
        farHillMat.emissiveIntensity,
        t.farHillEmissiveIntensity,
        3.8,
        dt,
      );

      cloudBaseEmissiveRef.current.lerp(t.cloudRim, alpha);
      cloudBaseEmissiveIntensityRef.current = THREE.MathUtils.damp(
        cloudBaseEmissiveIntensityRef.current,
        t.cloudEmissiveIntensity,
        3.8,
        dt,
      );

      const flash = stormFlashRef ? stormFlashRef.current.intensity : 0;
      cloudMat.color.lerp(t.cloudTint, alpha);
      cloudMat.emissive.copy(cloudBaseEmissiveRef.current);
      if (flash > 0.005) {
        cloudMat.emissive.lerp(_lightningCloudEmissive, Math.min(1, flash * 0.92));
      }
      cloudMat.emissiveIntensity = cloudBaseEmissiveIntensityRef.current + flash * 0.85;
      cloudMat.opacity = THREE.MathUtils.damp(cloudMat.opacity, t.cloudOpacity, 3.8, dt);

      turbineMat.color.lerp(t.turbineColor, alpha);
      cloudAltDropCurrentRef.current = THREE.MathUtils.damp(
        cloudAltDropCurrentRef.current,
        t.cloudAltDrop,
        3.4,
        dt,
      );
    }

    const omega = 0.6 + windCapacityFactor * 2.8;
    for (let i = 0; i < rotorRefs.current.length; i++) {
      const r = rotorRefs.current[i];
      if (r && dt > 0) r.rotation.z -= dt * (omega + (i % 3) * 0.08);
    }

    const cloudInst = cloudInstRef.current;
    if (cloudInst) {
      let idx = 0;
      const drift = cloudDriftRef.current;
      const span = 150;
      const currentCoverage = skyUniforms.cloudCoverage.value;
      const altDrop = cloudAltDropCurrentRef.current;

      for (let c = 0; c < activeCloudClusters.length; c++) {
        const cl = activeCloudClusters[c];
        const fade = THREE.MathUtils.smoothstep(
          currentCoverage,
          Math.max(0, cl.minCoverage - 0.14),
          cl.minCoverage + 0.06,
        );
        const wrappedX = ((((cl.x + drift * cl.speed + span / 2) % span) + span) % span) - span / 2;

        for (let l = 0; l < LOBE_OFFSETS.length; l++) {
          const [ox, oy, oz, lsx, lsy, lsz] = LOBE_OFFSETS[l];
          if (fade > 0.01) {
            _pos.set(
              wrappedX + ox * cl.sx,
              cl.y + altDrop + oy * cl.sy,
              cl.z + oz * cl.sz,
            );
            _quat.identity();
            _scale.set(cl.sx * 0.56 * lsx * fade, cl.sy * lsy * fade, cl.sz * 0.56 * lsz * fade);
          } else {
            _pos.set(0, -100, 0);
            _quat.identity();
            _scale.setScalar(0);
          }
          _mat4.compose(_pos, _quat, _scale);
          cloudInst.setMatrixAt(idx, _mat4);
          idx++;
        }
      }
      cloudInst.instanceMatrix.needsUpdate = true;
    }
  });

  const activeHills = quality === 'low' ? HORIZON_HILLS.filter((_, i) => i % 2 === 0) : HORIZON_HILLS;
  const activeHorizonTurbines =
    quality === 'low' ? HORIZON_TURBINES.slice(0, 3) : HORIZON_TURBINES;

  return (
    <group>
      {/* Dynamic Three.js Preetham Skybox with Live Solar Position & Volumetric Clouds */}
      <primitive object={threeSky} />

      {/* Additive Nocturnal Cobalt Twilight Glow & Starfield Overlay */}
      <mesh material={nightOverlayMaterial} renderOrder={-1}>
        <sphereGeometry args={[265, 28, 20]} />
      </mesh>

      {/* Drifting Instanced 3D Cloud Deck above City Skyline */}
      <instancedMesh
        key={`clouds-${totalCloudLobes}`}
        ref={cloudInstRef}
        args={[cloudPuffGeo, cloudMat, totalCloudLobes]}
        frustumCulled={false}
      />

      {/* Layered Scenic Foothills & Distant Mountain Ridge */}
      {activeHills.map((hill, idx) => (
        <mesh
          key={idx}
          position={[hill.x, -0.5, hill.z]}
          rotation={[0, hill.rotY, 0]}
          scale={[hill.rx, hill.ry, hill.rz]}
          material={hill.tier === 'near' ? nearHillMat : farHillMat}
        >
          <sphereGeometry args={[1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      ))}

      {/* Distant Horizon Wind Turbines along Foothill Ridge */}
      {activeHorizonTurbines.map(([x, y, z, h], idx) => (
        <group key={idx} position={[x, y, z]} rotation={[0, 0.55, 0]}>
          <mesh position={[0, h / 2, 0]} geometry={sharedCyl} scale={[1, h, 1]} material={turbineMat} />
          <mesh position={[0, h, 0.15]} geometry={sharedBox} scale={[0.42, 0.42, 1.05]} material={turbineMat} />
          <group
            position={[0, h, 0.72]}
            ref={(el) => {
              rotorRefs.current[idx] = el;
            }}
          >
            {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((ang, bIdx) => (
              <group key={bIdx} rotation={[0, 0, ang]}>
                <mesh position={[0, 1.4, 0]} geometry={sharedBox} scale={[0.14, 2.8, 0.05]} material={turbineMat} />
              </group>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}
