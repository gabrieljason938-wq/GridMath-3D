import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RenderQuality } from '../../types/grid';

interface RainSystemProps {
  active: boolean;
  windCapacityFactor?: number;
  stormFlashRef?: React.MutableRefObject<{ intensity: number }>;
  quality: RenderQuality;
  reducedMotion?: boolean;
}

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _streakEuler = new THREE.Euler();
const _rippleQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const _scale = new THREE.Vector3();

function createRainSeed(index: number) {
  const s1 = Math.sin(index * 12.9898) * 43758.5453;
  const s2 = Math.sin(index * 78.233) * 24634.6345;
  const s3 = Math.sin(index * 45.164) * 19384.231;
  const s4 = Math.sin(index * 93.719) * 31924.812;
  const f1 = s1 - Math.floor(s1);
  const f2 = s2 - Math.floor(s2);
  const f3 = s3 - Math.floor(s3);
  const f4 = s4 - Math.floor(s4);
  return {
    x: -58 + f1 * 116,
    z: -48 + f2 * 96,
    phase: f3,
    speed: 28 + f4 * 16,
    length: 1.3 + f4 * 0.85,
  };
}

export function RainSystem({
  active,
  windCapacityFactor = 0.5,
  stormFlashRef,
  quality,
  reducedMotion = false,
}: RainSystemProps) {
  const streakMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const rippleMeshRef = useRef<THREE.InstancedMesh | null>(null);

  const count = quality === 'low' ? 220 : quality === 'high' ? 640 : 420;
  const rippleCount = quality === 'low' ? 36 : quality === 'high' ? 112 : 72;

  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => createRainSeed(i)), [count]);
  const rippleSeeds = useMemo(
    () => Array.from({ length: rippleCount }, (_, i) => createRainSeed(i + 900)),
    [rippleCount],
  );

  const streakGeo = useMemo(() => new THREE.BoxGeometry(0.036, 1, 0.036), []);
  const rippleGeo = useMemo(() => new THREE.RingGeometry(0.28, 0.44, 16), []);

  const streakMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#E2E8F0',
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  const rippleMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#BAE6FD',
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      streakGeo.dispose();
      rippleGeo.dispose();
      streakMat.dispose();
      rippleMat.dispose();
    };
  }, [streakGeo, rippleGeo, streakMat, rippleMat]);

  useFrame((state) => {
    if (!active) return;

    const flash = stormFlashRef ? stormFlashRef.current.intensity : 0;
    streakMat.opacity = Math.min(0.92, 0.62 + flash * 0.28);
    rippleMat.opacity = Math.min(0.65, 0.36 + flash * 0.24);

    const t = reducedMotion ? 0.35 : state.clock.getElapsedTime();
    const tiltAngle = -(0.1 + windCapacityFactor * 0.24);
    const windDriftSpan = 2.0 + windCapacityFactor * 4.8;
    _streakEuler.set(0.06, 0, tiltAngle);
    _quat.setFromEuler(_streakEuler);

    const streaks = streakMeshRef.current;
    if (streaks) {
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        const heightSpan = 36;
        const cycle = ((s.phase + (t * s.speed) / heightSpan) % 1 + 1) % 1;
        const y = heightSpan * (1 - cycle) + 0.5;
        const windDrift = (1 - cycle) * -windDriftSpan;
        _pos.set(s.x + windDrift, y, s.z);
        _scale.set(1, s.length, 1);
        _mat4.compose(_pos, _quat, _scale);
        streaks.setMatrixAt(i, _mat4);
      }
      streaks.instanceMatrix.needsUpdate = true;
    }

    const ripples = rippleMeshRef.current;
    if (ripples) {
      for (let i = 0; i < rippleCount; i++) {
        const r = rippleSeeds[i];
        const cycle = ((r.phase + t * 1.55) % 1 + 1) % 1;
        const expand = 0.25 + cycle * 1.7;
        _pos.set(r.x, 0.14, r.z);
        _scale.set(expand, expand, 1);
        _mat4.compose(_pos, _rippleQuat, _scale);
        ripples.setMatrixAt(i, _mat4);
      }
      ripples.instanceMatrix.needsUpdate = true;
    }
  });

  if (!active) return null;

  return (
    <group>
      <instancedMesh
        key={`rain-${count}`}
        ref={streakMeshRef}
        args={[streakGeo, streakMat, count]}
        frustumCulled={false}
      />
      <instancedMesh
        key={`rain-ripples-${rippleCount}`}
        ref={rippleMeshRef}
        args={[rippleGeo, rippleMat, rippleCount]}
        frustumCulled={false}
      />
    </group>
  );
}
