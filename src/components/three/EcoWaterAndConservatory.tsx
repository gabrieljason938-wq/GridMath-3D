import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CityZoneId, RenderQuality } from '../../types/grid';
import type { CityMaterialRegistry } from './cityMaterials';

interface EcoWaterAndConservatoryProps {
  materials: CityMaterialRegistry;
  selectedZone: CityZoneId | null;
  hoveredZone: CityZoneId | null;
  onSelectZone: (zone: CityZoneId) => void;
  onHoverZone: (zone: CityZoneId | null) => void;
  nightIlluminationFactor: number;
  surfaceWetness?: number;
  sunsetWeight?: number;
  commercialMW: number;
  quality: RenderQuality;
  reducedMotion?: boolean;
}

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

// Vibrant lakeside & conservatory plaza flowerbed clusters
const FLOWER_COORDS: [number, number, number, string][] = [
  [-5.6, 0.22, 14.2, '#A855F7'],
  [-5.2, 0.22, 15.6, '#EC4899'],
  [-4.4, 0.22, 16.9, '#F59E0B'],
  [-3.2, 0.22, 17.8, '#F97316'],
  [5.6, 0.22, 14.2, '#EC4899'],
  [5.2, 0.22, 15.6, '#A855F7'],
  [4.4, 0.22, 16.9, '#F97316'],
  [3.2, 0.22, 17.8, '#F59E0B'],
  [-6.8, 0.24, 11.2, '#A855F7'],
  [-7.5, 0.24, 12.4, '#EC4899'],
  [-8.2, 0.24, 13.6, '#F59E0B'],
  [-11.8, 0.24, 17.2, '#EC4899'],
  [-11.2, 0.24, 18.4, '#A855F7'],
  [-10.4, 0.24, 19.2, '#F97316'],
  [6.8, 0.24, 11.2, '#EC4899'],
  [7.5, 0.24, 12.4, '#A855F7'],
  [8.2, 0.24, 13.6, '#F59E0B'],
  [11.8, 0.24, 17.2, '#A855F7'],
  [11.2, 0.24, 18.4, '#EC4899'],
  [10.4, 0.24, 19.2, '#F97316'],
  // Foreground lakeside garden beds
  [-12.4, 0.22, 42.2, '#A855F7'],
  [-10.8, 0.22, 42.4, '#EC4899'],
  [-9.2, 0.22, 42.2, '#F59E0B'],
  [9.2, 0.22, 42.2, '#F97316'],
  [10.8, 0.22, 42.4, '#A855F7'],
  [12.4, 0.22, 42.2, '#EC4899'],
];

function createOrganicPondGeometry(rx: number, rz: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wobble = 1 + 0.14 * Math.sin(a * 2.0 + 0.5) + 0.08 * Math.cos(a * 3.0);
    const x = Math.cos(a) * rx * wobble;
    const y = Math.sin(a) * rz * wobble;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: false,
    curveSegments: 16,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function EcoWaterAndConservatory({
  materials,
  selectedZone,
  hoveredZone,
  onSelectZone,
  onHoverZone,
  nightIlluminationFactor,
  surfaceWetness = 0,
  sunsetWeight = 0,
  commercialMW,
  quality,
  reducedMotion = false,
}: EcoWaterAndConservatoryProps) {
  const flowerInstRef = useRef<THREE.InstancedMesh | null>(null);
  const cascadeRefs = useRef<Array<THREE.Mesh | null>>([]);
  const atriumLightRef = useRef<THREE.PointLight | null>(null);
  const smoothNightRef = useRef(nightIlluminationFactor);
  const smoothSunsetRef = useRef(sunsetWeight);
  const smoothWetRef = useRef(surfaceWetness);

  const sharedBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sharedCyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 24), []);
  const flowerGeo = useMemo(() => new THREE.DodecahedronGeometry(0.28, 0), []);
  const domeGeo = useMemo(
    () => new THREE.SphereGeometry(3.25, quality === 'low' ? 14 : 22, quality === 'low' ? 10 : 14, 0, Math.PI * 2, 0, Math.PI / 2),
    [quality],
  );
  const domeWireGeo = useMemo(
    () =>
      new THREE.SphereGeometry(
        3.29,
        quality === 'low' ? 10 : 16,
        quality === 'low' ? 6 : 8,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      ),
    [quality],
  );

  // Organic extruded water basins framing the Conservatory Hub
  const westPondGeo = useMemo(() => createOrganicPondGeometry(4.1, 3.2), []);
  const eastUpperPondGeo = useMemo(() => createOrganicPondGeometry(4.0, 2.7), []);
  const eastLowerPondGeo = useMemo(() => createOrganicPondGeometry(4.3, 2.9), []);

  const flowerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.72,
        metalness: 0.02,
      }),
    [],
  );

  const domeAtriumCoreMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#FEF3C7',
        emissive: '#F59E0B',
        emissiveIntensity: 0.45,
        roughness: 0.35,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      sharedBox.dispose();
      sharedCyl.dispose();
      flowerGeo.dispose();
      domeGeo.dispose();
      domeWireGeo.dispose();
      westPondGeo.dispose();
      eastUpperPondGeo.dispose();
      eastLowerPondGeo.dispose();
      flowerMat.dispose();
      domeAtriumCoreMat.dispose();
    };
  }, [
    sharedBox,
    sharedCyl,
    flowerGeo,
    domeGeo,
    domeWireGeo,
    westPondGeo,
    eastUpperPondGeo,
    eastLowerPondGeo,
    flowerMat,
    domeAtriumCoreMat,
  ]);

  useEffect(() => {
    const inst = flowerInstRef.current;
    if (!inst) return;
    FLOWER_COORDS.forEach(([x, y, z, hex], idx) => {
      _pos.set(x, y, z);
      _quat.identity();
      const s = 0.85 + (idx % 4) * 0.14;
      _scale.set(s * 1.4, s * 0.72, s * 1.4);
      _mat4.compose(_pos, _quat, _scale);
      inst.setMatrixAt(idx, _mat4);
      _color.set(hex);
      inst.setColorAt(idx, _color);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
  }, []);

  useFrame((state, delta) => {
    const dt = reducedMotion ? 0 : Math.min(delta, 0.05);
    if (reducedMotion || dt === 0) {
      smoothNightRef.current = nightIlluminationFactor;
      smoothSunsetRef.current = sunsetWeight;
      smoothWetRef.current = surfaceWetness;
    } else {
      smoothNightRef.current = THREE.MathUtils.damp(
        smoothNightRef.current,
        nightIlluminationFactor,
        3.8,
        dt,
      );
      smoothSunsetRef.current = THREE.MathUtils.damp(
        smoothSunsetRef.current,
        sunsetWeight,
        3.8,
        dt,
      );
      smoothWetRef.current = THREE.MathUtils.damp(
        smoothWetRef.current,
        surfaceWetness,
        3.8,
        dt,
      );
    }

    const n = smoothNightRef.current;
    const s = smoothSunsetRef.current;
    const w = smoothWetRef.current;
    const loadBoost = Math.min(1, commercialMW / 180);

    domeAtriumCoreMat.emissiveIntensity = 0.22 + s * 0.48 + n * (0.98 + loadBoost * 0.42);
    materials.domeGlass.emissiveIntensity = 0.06 + s * 0.16 + n * 0.36;
    materials.waterfallFoam.emissiveIntensity = 0.24 + s * 0.16 + n * 0.22;
    if (atriumLightRef.current) {
      atriumLightRef.current.intensity = n > 0.05 ? n * 2.6 : 0;
    }

    if (!reducedMotion && dt > 0) {
      const t = state.clock.getElapsedTime();
      for (let i = 0; i < cascadeRefs.current.length; i++) {
        const mesh = cascadeRefs.current[i];
        if (!mesh) continue;
        mesh.position.y = 0.18 + Math.sin(t * 5.0 + i * 1.2) * 0.025;
      }

      // Gently scroll procedural water normal map for live ripple reflections
      const waterNormal = materials.pondWater.normalMap;
      if (waterNormal) {
        const rippleRate = 0.045 + w * 0.05;
        waterNormal.offset.x = (waterNormal.offset.x + dt * rippleRate) % 1;
        waterNormal.offset.y = (waterNormal.offset.y + dt * rippleRate * 0.68) % 1;
      }
    }
  });

  const isHighlighted = selectedZone === 'commercial' || hoveredZone === 'commercial';

  return (
    <group>
      {/* =================================================================== */}
      {/* 1. CENTRAL GEODESIC GLASS CONSERVATORY & SUSTAINABILITY HUB         */}
      {/*    Inspired directly by the iconic domed centerpiece in reference   */}
      {/* =================================================================== */}
      <group
        position={[0, 0, 14.8]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectZone('commercial');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverZone('commercial');
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onHoverZone(null);
          document.body.style.cursor = 'auto';
        }}
      >
        {/* Stepped Limestone Civic Plaza Base */}
        <mesh position={[0, 0.14, 0]} receiveShadow geometry={sharedCyl} scale={[5.2, 0.28, 5.2]} material={materials.limestoneWalkway} />
        <mesh
          position={[0, 0.3, 0]}
          geometry={sharedCyl}
          scale={[5.28, 0.06, 5.28]}
          material={isHighlighted ? materials.cobaltAccent : materials.cyanAccent}
        />

        {/* Ground Floor Wrap-Around Warm Glass Pavilion */}
        <mesh position={[0, 1.05, 0]} castShadow receiveShadow geometry={sharedCyl} scale={[4.9, 1.55, 4.9]} material={materials.resWindowWarmGlow} />
        {/* Warm Interior Atrium Core + Radiating Evening/Night Hub Glow */}
        <mesh position={[0, 1.2, 0]} geometry={sharedCyl} scale={[3.4, 1.8, 3.4]} material={domeAtriumCoreMat} />
        <pointLight
          ref={atriumLightRef}
          position={[0, 2.2, 0]}
          color="#FBBF24"
          intensity={nightIlluminationFactor > 0.05 ? nightIlluminationFactor * 2.6 : 0}
          distance={24}
          decay={2}
        />
        {/* Exterior Timber & Slate Structural Columns */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 5.05, 1.05, Math.sin(a) * 5.05]}
              castShadow
              geometry={sharedCyl}
              scale={[0.14, 1.75, 0.14]}
              material={materials.towerSlateTrim}
            />
          );
        })}

        {/* Upper Cantilevered Green-Roof Terrace Deck */}
        <mesh position={[0, 1.98, 0]} castShadow receiveShadow geometry={sharedCyl} scale={[5.45, 0.28, 5.45]} material={materials.limestoneWalkway} />
        <mesh position={[0, 2.16, 0]} receiveShadow geometry={sharedCyl} scale={[5.15, 0.1, 5.15]} material={materials.greenRoof} />

        {/* Second-Tier Glass Promenade Gallery */}
        <mesh position={[0, 2.65, 0]} castShadow geometry={sharedCyl} scale={[3.7, 0.9, 3.7]} material={materials.resWindowWarmGlow} />
        <mesh position={[0, 3.16, 0]} castShadow geometry={sharedCyl} scale={[3.95, 0.22, 3.95]} material={materials.limestoneWalkway} />

        {/* Signature Geodesic Glass Dome & Steel Structural Lattice */}
        <mesh position={[0, 3.2, 0]} geometry={domeGeo} material={materials.domeGlass} />
        <mesh position={[0, 3.2, 0]} scale={[1, 0.92, 1]} geometry={domeWireGeo}>
          <meshStandardMaterial color="#1E293B" wireframe roughness={0.3} metalness={0.75} />
        </mesh>

        {/* Rooftop Sustainability Hub Beacon Spire */}
        <mesh position={[0, 6.75, 0]} geometry={sharedCyl} scale={[0.08, 0.95, 0.08]} material={materials.cyanAccent} />
      </group>

      {/* =================================================================== */}
      {/* 2. TERRACED REFLECTIVE PONDS, WEIR WATERFALLS & ARCHED BRIDGES      */}
      {/* =================================================================== */}
      {/* West Bio-Retention Lagoon & Walkway Rim */}
      <group position={[-9.6, 0, 14.8]}>
        <mesh position={[0, 0.06, 0]} receiveShadow geometry={westPondGeo} material={materials.limestoneWalkway} scale={[1.1, 0.85, 1.1]} />
        <mesh position={[0, 0.11, 0]} geometry={westPondGeo} material={materials.pondWater} />
        {/* Arched Pedestrian Bridge across West Lagoon */}
        <group position={[0, 0.34, 0]}>
          <mesh position={[0, 0.18, 0]} castShadow geometry={sharedBox} scale={[6.6, 0.18, 1.15]} material={materials.warmTimber} />
          <mesh position={[0, 0.42, -0.52]} geometry={sharedBox} scale={[6.4, 0.24, 0.08]} material={materials.towerSlateTrim} />
          <mesh position={[0, 0.42, 0.52]} geometry={sharedBox} scale={[6.4, 0.24, 0.08]} material={materials.towerSlateTrim} />
        </group>
      </group>

      {/* East Stepped Terraced Ponds & Cascading Weir Waterfalls */}
      <group position={[9.6, 0, 14.8]}>
        {/* Upper Terrace Pond (North Wing) */}
        <group position={[0, 0.12, -2.5]}>
          <mesh position={[0, 0.06, 0]} receiveShadow geometry={eastUpperPondGeo} material={materials.limestoneWalkway} scale={[1.1, 0.85, 1.1]} />
          <mesh position={[0, 0.11, 0]} geometry={eastUpperPondGeo} material={materials.pondWater} />
        </group>

        {/* Cascading White-Water Weir Dam & Shimmering Waterfall */}
        <mesh position={[0, 0.2, 0.2]} receiveShadow geometry={sharedBox} scale={[5.6, 0.22, 0.55]} material={materials.limestoneWalkway} />
        {[-1.8, -0.6, 0.6, 1.8].map((wx, idx) => (
          <mesh
            key={idx}
            ref={(el) => {
              cascadeRefs.current[idx] = el;
            }}
            position={[wx, 0.18, 0.52]}
            rotation={[-0.25, 0, 0]}
            geometry={sharedBox}
            scale={[1.0, 0.32, 0.18]}
            material={materials.waterfallFoam}
          />
        ))}

        {/* Lower Reflection Pond (South Wing) */}
        <group position={[0, 0, 2.8]}>
          <mesh position={[0, 0.06, 0]} receiveShadow geometry={eastLowerPondGeo} material={materials.limestoneWalkway} scale={[1.1, 0.85, 1.1]} />
          <mesh position={[0, 0.11, 0]} geometry={eastLowerPondGeo} material={materials.pondWater} />
        </group>

        {/* Arched Promenade Bridge spanning Lower Pond */}
        <group position={[0, 0.32, 2.8]}>
          <mesh position={[0, 0.2, 0]} castShadow geometry={sharedBox} scale={[6.8, 0.18, 1.2]} material={materials.warmTimber} />
          <mesh position={[0, 0.44, -0.54]} geometry={sharedBox} scale={[6.6, 0.24, 0.08]} material={materials.towerSlateTrim} />
          <mesh position={[0, 0.44, 0.54]} geometry={sharedBox} scale={[6.6, 0.24, 0.08]} material={materials.towerSlateTrim} />
        </group>
      </group>

      {/* Instanced Colorful Lakeside Flowerbeds */}
      <instancedMesh
        ref={flowerInstRef}
        args={[flowerGeo, flowerMat, FLOWER_COORDS.length]}
        castShadow={quality !== 'low'}
      />
    </group>
  );
}
