import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RenderQuality } from '../../types/grid';
import type { CityMaterialRegistry } from './cityMaterials';
import type { TransmissionCorridorSpec } from './powerFlowMath';

interface TransmissionNetworkProps {
  materials: CityMaterialRegistry;
  corridors: TransmissionCorridorSpec[];
  showFlowVectors: boolean;
  supplyShortage: boolean;
  tightReserve: boolean;
  powerLineGlowIntensity?: number;
  nightIlluminationFactor?: number;
  quality?: RenderQuality;
  reducedMotion?: boolean;
}

const MAX_PARTICLES_PER_CORRIDOR = 8;
const _dummy = new THREE.Object3D();
const _pos = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _color = new THREE.Color();

// Tall steel lattice transmission pylons routed across the 135x115 grid
const PYLON_COORDS: [number, number, number][] = [
  [-22.0, -16.8, 0.65],
  [-11.5, -9.2, 0.65],
  [22.0, -16.8, -0.65],
  [11.5, -9.2, -0.65],
  [-15.0, 0.0, 0.04],
  [-7.5, -0.1, 0.04],
  [15.0, 0.0, -0.04],
  [7.5, -0.1, -0.04],
  [-17.5, 16.0, 0.55],
  [17.5, 16.0, -0.55],
  [-25.5, 22.0, 0.55],
  [25.5, 22.0, -0.55],
];

// City distribution feeder substations at district boulevard entry gates
const DISTRIBUTION_NODES: [number, number][] = [
  [0, 14.5],
  [-17.5, 16.0],
  [-32.0, 14.5],
  [17.5, 16.0],
  [32.0, 14.5],
];

// Glowing network intersection terminals around the central Substation
const HUB_TERMINAL_NODES: { pos: [number, number, number]; color: 'emerald' | 'cyan' | 'orange' }[] = [
  { pos: [-4.2, 3.5, -3.8], color: 'emerald' },
  { pos: [4.2, 3.5, -3.8], color: 'emerald' },
  { pos: [-5.6, 3.2, -0.2], color: 'cyan' },
  { pos: [5.6, 3.3, -0.2], color: 'orange' },
  { pos: [0, 0.85, 5.8], color: 'cyan' },
  { pos: [-4.5, 0.85, 4.8], color: 'cyan' },
  { pos: [4.5, 0.85, 4.8], color: 'cyan' },
];

export function TransmissionNetwork({
  materials,
  corridors,
  showFlowVectors,
  supplyShortage,
  tightReserve,
  powerLineGlowIntensity = 0.65,
  nightIlluminationFactor = 0.05,
  quality = 'balanced',
  reducedMotion = false,
}: TransmissionNetworkProps) {
  const particleMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const beaconRingRefs = useRef<Array<THREE.Mesh | null>>([]);
  const progressRef = useRef<Float32Array>(
    new Float32Array(corridors.length * MAX_PARTICLES_PER_CORRIDOR),
  );

  const tubularSegments = quality === 'high' ? 36 : quality === 'balanced' ? 24 : 14;
  const radialSegments = quality === 'high' ? 8 : quality === 'balanced' ? 6 : 5;
  const particleCapPerCorridor = quality === 'high' ? 8 : quality === 'balanced' ? 6 : 4;
  const castLineShadow = quality !== 'low';

  const pooledTubeMaterials = useMemo(() => {
    const map = new Map<
      string,
      { core: THREE.MeshStandardMaterial; halo: THREE.MeshBasicMaterial }
    >();
    for (const corridor of corridors) {
      if (!map.has(corridor.colorHex)) {
        map.set(corridor.colorHex, {
          core: new THREE.MeshStandardMaterial({
            color: corridor.colorHex,
            emissive: corridor.colorHex,
            emissiveIntensity: 0.72,
            roughness: 0.24,
            metalness: 0.15,
            transparent: true,
            opacity: 0.9,
            toneMapped: false,
          }),
          halo: new THREE.MeshBasicMaterial({
            color: corridor.colorHex,
            transparent: true,
            opacity: 0.24,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        });
      }
    }
    return map;
  }, [corridors]);

  useEffect(() => {
    pooledTubeMaterials.forEach(({ core, halo }) => {
      core.emissiveIntensity = 0.45 + powerLineGlowIntensity * 0.9;
      halo.opacity = Math.min(0.55, 0.14 + powerLineGlowIntensity * 0.25);
    });
  }, [pooledTubeMaterials, powerLineGlowIntensity]);

  useEffect(() => {
    return () => {
      pooledTubeMaterials.forEach(({ core, halo }) => {
        core.dispose();
        halo.dispose();
      });
    };
  }, [pooledTubeMaterials]);

  const corridorTubes = useMemo(() => {
    return corridors.map((corridor) => ({
      id: corridor.id,
      colorHex: corridor.colorHex,
      coreGeo: new THREE.TubeGeometry(
        corridor.curve,
        tubularSegments,
        corridor.lineRadius,
        radialSegments,
        false,
      ),
      haloGeo: new THREE.TubeGeometry(
        corridor.curve,
        tubularSegments,
        corridor.lineRadius * (2.2 + nightIlluminationFactor * 0.45),
        radialSegments,
        false,
      ),
    }));
  }, [corridors, tubularSegments, radialSegments, nightIlluminationFactor]);

  useEffect(() => {
    return () => {
      corridorTubes.forEach((t) => {
        t.coreGeo.dispose();
        t.haloGeo.dispose();
      });
    };
  }, [corridorTubes]);

  useEffect(() => {
    const total = corridors.length * MAX_PARTICLES_PER_CORRIDOR;
    if (progressRef.current.length !== total) {
      progressRef.current = new Float32Array(total);
    }
    for (let i = 0; i < total; i++) {
      progressRef.current[i] = (i % MAX_PARTICLES_PER_CORRIDOR) / MAX_PARTICLES_PER_CORRIDOR;
    }
  }, [corridors.length]);

  useFrame((state, delta) => {
    const mesh = particleMeshRef.current;
    const dt = reducedMotion ? 0 : Math.min(delta, 0.05);

    if (mesh && showFlowVectors) {
      let idx = 0;
      for (let c = 0; c < corridors.length; c++) {
        const corridor = corridors[c];
        _color.set(corridor.colorHex);
        const effectiveCount = Math.min(corridor.particleCount, particleCapPerCorridor);

        for (let p = 0; p < MAX_PARTICLES_PER_CORRIDOR; p++) {
          const active = p < effectiveCount;
          if (active) {
            let t = progressRef.current[idx] + dt * corridor.particleSpeed;
            if (t > 1) t -= 1;
            progressRef.current[idx] = t;

            corridor.curve.getPointAt(t, _pos);
            corridor.curve.getTangentAt(t, _tangent);
            _quat.setFromUnitVectors(_up, _tangent);

            _dummy.position.copy(_pos);
            _dummy.quaternion.copy(_quat);
            const s = (0.95 + corridor.utilizationRatio * 0.7) * (1 + nightIlluminationFactor * 0.16);
            _dummy.scale.set(s, s * 2.1, s);
          } else {
            _dummy.position.set(0, -50, 0);
            _dummy.quaternion.identity();
            _dummy.scale.setScalar(0);
          }
          _dummy.updateMatrix();
          mesh.setMatrixAt(idx, _dummy.matrix);
          mesh.setColorAt(idx, _color);
          idx++;
        }
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // Subtle harmonic pulse on distribution node halo rings
    const elapsed = reducedMotion ? 0 : state.clock.getElapsedTime();
    for (let i = 0; i < beaconRingRefs.current.length; i++) {
      const ring = beaconRingRefs.current[i];
      if (!ring) continue;
      const pulse = 1 + Math.sin(elapsed * 2.4 + i * 0.9) * 0.14;
      ring.scale.set(pulse, pulse, 1);
    }
  });

  const totalInstances = corridors.length * MAX_PARTICLES_PER_CORRIDOR;
  const nodeRingMaterial = supplyShortage
    ? materials.alertCrimson
    : tightReserve
      ? materials.amberWarning
      : materials.emeraldAccent;

  return (
    <group>
      {/* Overhead Lattice Steel Transmission Pylons */}
      {PYLON_COORDS.map(([px, pz, rotY], idx) => (
        <group key={idx} position={[px, 0, pz]} rotation={[0, rotY, 0]}>
          <mesh position={[0, 0.18, 0]} castShadow={castLineShadow}>
            <boxGeometry args={[1.1, 0.36, 1.1]} />
            <primitive object={materials.alabasterPad} attach="material" />
          </mesh>
          <mesh position={[0, 2.3, 0]} castShadow={castLineShadow}>
            <cylinderGeometry args={[0.14, 0.34, 4.3, 4]} />
            <primitive object={materials.industrialSteel} attach="material" />
          </mesh>
          <mesh position={[0, 3.2, 0]} castShadow={castLineShadow}>
            <boxGeometry args={[1.9, 0.12, 0.16]} />
            <primitive object={materials.brushedSteel} attach="material" />
          </mesh>
          <mesh position={[0, 4.1, 0]} castShadow={castLineShadow}>
            <boxGeometry args={[2.4, 0.12, 0.16]} />
            <primitive object={materials.brushedSteel} attach="material" />
          </mesh>
          {[-1.02, 1.02].map((ix) => (
            <mesh key={ix} position={[ix, 3.85, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.38, 8]} />
              <primitive object={materials.cyanAccent} attach="material" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Glowing Network Intersection Terminal Beacons around Central Hub */}
      {showFlowVectors
        ? HUB_TERMINAL_NODES.map((node, idx) => {
            const mat =
              supplyShortage && node.color === 'cyan'
                ? materials.alertCrimson
                : node.color === 'emerald'
                  ? materials.emeraldAccent
                  : node.color === 'orange'
                    ? materials.thermalAccentOrange
                    : materials.cyanAccent;
            return (
              <mesh key={idx} position={node.pos}>
                <sphereGeometry args={[0.26, 12, 12]} />
                <primitive object={mat} attach="material" />
              </mesh>
            );
          })
        : null}

      {/* City Distribution Feeder Kiosks with Glowing Status Rings */}
      {DISTRIBUTION_NODES.map(([nx, nz], idx) => (
        <group key={idx} position={[nx, 0, nz]}>
          <mesh position={[0, 0.42, 0]} castShadow={castLineShadow} receiveShadow={castLineShadow}>
            <boxGeometry args={[1.45, 0.84, 1.45]} />
            <primitive object={materials.plasterWhite} attach="material" />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.52, 0.52, 0.14, 16]} />
            <primitive object={nodeRingMaterial} attach="material" />
          </mesh>
          <mesh
            ref={(el) => {
              beaconRingRefs.current[idx] = el;
            }}
            position={[0, 0.09, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.92, 1.24, 24]} />
            <primitive object={materials.cyanAccent} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Dual-Layer Glowing Conduits + Directional Energy Capsules */}
      {showFlowVectors ? (
        <group>
          {corridorTubes.map((t) => {
            const mats = pooledTubeMaterials.get(t.colorHex);
            return mats ? (
              <group key={t.id}>
                <mesh geometry={t.coreGeo} material={mats.core} />
                <mesh geometry={t.haloGeo} material={mats.halo} />
              </group>
            ) : null;
          })}
          <instancedMesh
            ref={particleMeshRef}
            args={[undefined, undefined, totalInstances]}
            frustumCulled={false}
          >
            <capsuleGeometry args={[0.17, 0.32, 4, 8]} />
            <meshBasicMaterial toneMapped={false} />
          </instancedMesh>
        </group>
      ) : null}
    </group>
  );
}
