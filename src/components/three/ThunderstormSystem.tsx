import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RenderQuality } from '../../types/grid';

export interface StormFlashState {
  intensity: number;
  cloudFlashX: number;
  cloudFlashY: number;
  cloudFlashZ: number;
  strikeId: number;
}

interface ThunderstormSystemProps {
  active: boolean;
  flashStateRef: React.MutableRefObject<StormFlashState>;
  quality: RenderQuality;
  reducedMotion?: boolean;
  onStrike?: (info: { distanceNorm: number; pan: number }) => void;
}

const MAX_TRUNK_SEGMENTS = 14;
const MAX_FORK_SEGMENTS = 16;
const MAX_TOTAL_SEGMENTS = MAX_TRUNK_SEGMENTS + MAX_FORK_SEGMENTS;

interface BoltSegmentData {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  radius: number;
}

interface StrikeZoneAnchor {
  x: number;
  z: number;
  groundY: number;
  distanceNorm: number;
}

// Peripheral foothills, open skyline flanks, and outer canal zones so bolts frame the city cleanly
const STRIKE_ANCHORS: StrikeZoneAnchor[] = [
  { x: -54, z: -56, groundY: 6.2, distanceNorm: 0.65 },
  { x: -18, z: -62, groundY: 7.4, distanceNorm: 0.72 },
  { x: 24, z: -60, groundY: 6.8, distanceNorm: 0.68 },
  { x: 58, z: -50, groundY: 5.2, distanceNorm: 0.58 },
  { x: -64, z: -18, groundY: 5.5, distanceNorm: 0.52 },
  { x: 64, z: 14, groundY: 1.0, distanceNorm: 0.36 },
  { x: -52, z: 46, groundY: 0.8, distanceNorm: 0.28 },
  { x: 42, z: 52, groundY: 0.8, distanceNorm: 0.3 },
];

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);

export function computeBoltEnvelope(age: number, duration: number, reducedMotion: boolean): number {
  if (age < 0 || age > duration) return 0;
  const u = age / duration;
  if (reducedMotion) {
    // Smooth, non-strobing storm sheet pulse for reduced-motion accessibility
    return Math.sin(u * Math.PI) * 0.32;
  }
  // Realistic double-return-stroke envelope: sharp primary flash + brief dip + secondary restrike + exponential decay
  if (u < 0.08) return u / 0.08;
  if (u < 0.22) return 1.0 - ((u - 0.08) / 0.14) * 0.78;
  if (u < 0.34) return 0.22 + ((u - 0.22) / 0.12) * 0.7;
  const tail = (u - 0.34) / 0.66;
  return 0.92 * Math.exp(-tail * 4.4);
}

export function buildForkedBolt(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  maxForkCount: number,
  outSegments: { ax: number; ay: number; az: number; bx: number; by: number; bz: number; radius: number }[],
): number {
  let count = 0;

  // Generate primary jagged trunk with 14 segments via sinusoidal + random lateral jitter
  const trunkPtsX = new Float32Array(MAX_TRUNK_SEGMENTS + 1);
  const trunkPtsY = new Float32Array(MAX_TRUNK_SEGMENTS + 1);
  const trunkPtsZ = new Float32Array(MAX_TRUNK_SEGMENTS + 1);

  for (let i = 0; i <= MAX_TRUNK_SEGMENTS; i++) {
    const t = i / MAX_TRUNK_SEGMENTS;
    const envelope = Math.sin(t * Math.PI);
    const jitterScale = 4.6 * envelope;
    trunkPtsX[i] = startX + (endX - startX) * t + (Math.random() - 0.5) * 2 * jitterScale;
    trunkPtsY[i] = startY + (endY - startY) * t;
    trunkPtsZ[i] = startZ + (endZ - startZ) * t + (Math.random() - 0.5) * 2 * jitterScale;
  }
  trunkPtsX[0] = startX;
  trunkPtsY[0] = startY;
  trunkPtsZ[0] = startZ;
  trunkPtsX[MAX_TRUNK_SEGMENTS] = endX;
  trunkPtsY[MAX_TRUNK_SEGMENTS] = endY;
  trunkPtsZ[MAX_TRUNK_SEGMENTS] = endZ;

  for (let i = 0; i < MAX_TRUNK_SEGMENTS; i++) {
    const taper = 1 - (i / MAX_TRUNK_SEGMENTS) * 0.38;
    outSegments[count++] = {
      ax: trunkPtsX[i],
      ay: trunkPtsY[i],
      az: trunkPtsZ[i],
      bx: trunkPtsX[i + 1],
      by: trunkPtsY[i + 1],
      bz: trunkPtsZ[i + 1],
      radius: 0.24 * taper,
    };
  }

  // Generate secondary downward branches splitting off the upper-middle trunk
  const branchSteps = 3;
  for (let f = 0; f < maxForkCount; f++) {
    const anchorIdx = 2 + Math.floor(Math.random() * (MAX_TRUNK_SEGMENTS - 5));
    let cx = trunkPtsX[anchorIdx];
    let cy = trunkPtsY[anchorIdx];
    let cz = trunkPtsZ[anchorIdx];
    const sideAngle = Math.random() * Math.PI * 2;
    const horizRate = 2.6 + Math.random() * 2.8;
    const dropRate = 3.2 + Math.random() * 2.4;

    for (let s = 0; s < branchSteps && count < MAX_TOTAL_SEGMENTS; s++) {
      const nx = cx + Math.cos(sideAngle) * horizRate + (Math.random() - 0.5) * 2.2;
      const ny = cy - dropRate;
      const nz = cz + Math.sin(sideAngle) * horizRate + (Math.random() - 0.5) * 2.2;
      const forkRadius = 0.13 * (1 - s * 0.26);
      outSegments[count++] = {
        ax: cx,
        ay: cy,
        az: cz,
        bx: nx,
        by: ny,
        bz: nz,
        radius: forkRadius,
      };
      cx = nx;
      cy = ny;
      cz = nz;
    }
  }

  return count;
}

export function ThunderstormSystem({
  active,
  flashStateRef,
  quality,
  reducedMotion = false,
  onStrike,
}: ThunderstormSystemProps) {
  const coreMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const haloMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const cloudGlowRef = useRef<THREE.Mesh | null>(null);
  const flashLightRef = useRef<THREE.PointLight | null>(null);
  const onStrikeRef = useRef(onStrike);
  onStrikeRef.current = onStrike;

  const maxForks = quality === 'low' ? 1 : quality === 'high' ? 5 : 3;

  // Pre-allocated bolt pool & scheduler refs (zero GC inside useFrame)
  const segmentsRef = useRef<BoltSegmentData[]>(
    Array.from({ length: MAX_TOTAL_SEGMENTS }, () => ({
      ax: 0,
      ay: 0,
      az: 0,
      bx: 0,
      by: 0,
      bz: 0,
      radius: 0.15,
    })),
  );
  const activeSegmentCountRef = useRef(0);
  const schedulerRef = useRef({
    wasActive: false,
    countdown: 0.85,
    strikeAge: -1,
    strikeDuration: 0.46,
    lastAnchorIdx: -1,
  });

  const segmentGeo = useMemo(() => new THREE.CylinderGeometry(0.85, 1.0, 1, 6, 1), []);
  const cloudGlowGeo = useMemo(() => new THREE.SphereGeometry(1, 16, 12), []);

  const coreMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#F8FAFC',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#93C5FD',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  const cloudGlowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#BAE6FD',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      segmentGeo.dispose();
      cloudGlowGeo.dispose();
      coreMat.dispose();
      haloMat.dispose();
      cloudGlowMat.dispose();
    };
  }, [segmentGeo, cloudGlowGeo, coreMat, haloMat, cloudGlowMat]);

  const hideMeshes = () => {
    const core = coreMeshRef.current;
    const halo = haloMeshRef.current;
    if (core && halo) {
      for (let i = 0; i < MAX_TOTAL_SEGMENTS; i++) {
        core.setMatrixAt(i, _zeroMat);
        halo.setMatrixAt(i, _zeroMat);
      }
      core.instanceMatrix.needsUpdate = true;
      halo.instanceMatrix.needsUpdate = true;
    }
    coreMat.opacity = 0;
    haloMat.opacity = 0;
    cloudGlowMat.opacity = 0;
    if (flashLightRef.current) {
      flashLightRef.current.intensity = 0;
    }
    flashStateRef.current.intensity = 0;
  };

  useEffect(() => {
    if (!active) {
      schedulerRef.current.wasActive = false;
      schedulerRef.current.strikeAge = -1;
      schedulerRef.current.countdown = 0.75;
      hideMeshes();
    }
  }, [active]);

  useFrame((_, delta) => {
    if (!active) return;

    const dt = Math.min(delta, 0.05);
    const sched = schedulerRef.current;

    if (!sched.wasActive) {
      sched.wasActive = true;
      sched.countdown = 0.75;
      sched.strikeAge = -1;
    }

    if (sched.strikeAge >= 0) {
      sched.strikeAge += dt;
      if (sched.strikeAge > sched.strikeDuration) {
        sched.strikeAge = -1;
        hideMeshes();
      }
    } else {
      sched.countdown -= dt;
      if (sched.countdown <= 0) {
        // Pick a fresh peripheral storm anchor
        let idx = Math.floor(Math.random() * STRIKE_ANCHORS.length);
        if (idx === sched.lastAnchorIdx) {
          idx = (idx + 1 + Math.floor(Math.random() * (STRIKE_ANCHORS.length - 1))) % STRIKE_ANCHORS.length;
        }
        sched.lastAnchorIdx = idx;
        const anchor = STRIKE_ANCHORS[idx];

        const cloudX = anchor.x + (Math.random() - 0.5) * 10;
        const cloudY = 33.5 + Math.random() * 2.5;
        const cloudZ = anchor.z + (Math.random() - 0.5) * 10;

        activeSegmentCountRef.current = buildForkedBolt(
          cloudX,
          cloudY,
          cloudZ,
          anchor.x,
          anchor.groundY,
          anchor.z,
          maxForks,
          segmentsRef.current,
        );

        sched.strikeDuration = reducedMotion ? 0.85 : 0.42 + Math.random() * 0.14;
        sched.strikeAge = 0;
        sched.countdown = 3.2 + Math.random() * 4.6;

        flashStateRef.current.cloudFlashX = cloudX;
        flashStateRef.current.cloudFlashY = cloudY + 2.5;
        flashStateRef.current.cloudFlashZ = cloudZ;
        flashStateRef.current.strikeId += 1;

        if (!reducedMotion) {
          onStrikeRef.current?.({
            distanceNorm: anchor.distanceNorm,
            pan: THREE.MathUtils.clamp(anchor.x / 65, -1, 1),
          });
        }
      }
    }

    const intensity =
      sched.strikeAge >= 0 ? computeBoltEnvelope(sched.strikeAge, sched.strikeDuration, reducedMotion) : 0;

    flashStateRef.current.intensity = intensity;

    if (intensity <= 0.005) {
      if (coreMat.opacity > 0) hideMeshes();
      return;
    }

    const core = coreMeshRef.current;
    const halo = haloMeshRef.current;
    if (core && halo) {
      const segCount = activeSegmentCountRef.current;
      const segs = segmentsRef.current;
      for (let i = 0; i < MAX_TOTAL_SEGMENTS; i++) {
        if (i < segCount) {
          const s = segs[i];
          _dir.set(s.bx - s.ax, s.by - s.ay, s.bz - s.az);
          const len = _dir.length();
          if (len > 0.001) {
            _dir.divideScalar(len);
            _quat.setFromUnitVectors(_up, _dir);
            _mid.set((s.ax + s.bx) * 0.5, (s.ay + s.by) * 0.5, (s.az + s.bz) * 0.5);

            _scale.set(s.radius, len * 1.03, s.radius);
            _mat4.compose(_mid, _quat, _scale);
            core.setMatrixAt(i, _mat4);

            _scale.set(s.radius * 3.1, len * 1.04, s.radius * 3.1);
            _mat4.compose(_mid, _quat, _scale);
            halo.setMatrixAt(i, _mat4);
          } else {
            core.setMatrixAt(i, _zeroMat);
            halo.setMatrixAt(i, _zeroMat);
          }
        } else {
          core.setMatrixAt(i, _zeroMat);
          halo.setMatrixAt(i, _zeroMat);
        }
      }
      core.instanceMatrix.needsUpdate = true;
      halo.instanceMatrix.needsUpdate = true;
    }

    coreMat.opacity = Math.min(1, intensity * 1.15);
    haloMat.opacity = Math.min(0.65, intensity * 0.55);

    const cloudGlow = cloudGlowRef.current;
    if (cloudGlow) {
      cloudGlow.position.set(
        flashStateRef.current.cloudFlashX,
        flashStateRef.current.cloudFlashY,
        flashStateRef.current.cloudFlashZ,
      );
      const glowRadius = 18 + intensity * 14;
      cloudGlow.scale.set(glowRadius * 1.35, glowRadius * 0.45, glowRadius);
      cloudGlowMat.opacity = intensity * (reducedMotion ? 0.18 : 0.46);
    }

    if (flashLightRef.current) {
      flashLightRef.current.position.set(
        flashStateRef.current.cloudFlashX * 0.65,
        29,
        flashStateRef.current.cloudFlashZ * 0.65,
      );
      flashLightRef.current.intensity = reducedMotion ? intensity * 18 : intensity * 95;
    }
  });

  if (!active) return null;

  return (
    <group>
      {/* Electric White-Cyan Lightning Bolt Core */}
      <instancedMesh
        ref={coreMeshRef}
        args={[segmentGeo, coreMat, MAX_TOTAL_SEGMENTS]}
        frustumCulled={false}
        renderOrder={6}
      />
      {/* Soft Additive Atmospheric Bolt Corona */}
      <instancedMesh
        ref={haloMeshRef}
        args={[segmentGeo, haloMat, MAX_TOTAL_SEGMENTS]}
        frustumCulled={false}
        renderOrder={5}
      />
      {/* Internal Storm Cloud Sheet Flash Volume */}
      <mesh ref={cloudGlowRef} geometry={cloudGlowGeo} material={cloudGlowMat} renderOrder={4} />
      {/* Transient Non-Shadow-Casting Storm Illumination Burst */}
      <pointLight
        ref={flashLightRef}
        color="#DBEAFE"
        intensity={0}
        distance={210}
        decay={1.3}
        castShadow={false}
      />
    </group>
  );
}
