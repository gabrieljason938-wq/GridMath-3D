import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CityZoneId, RenderQuality } from '../../types/grid';
import type { CityMaterialRegistry } from './cityMaterials';

interface EnergyInfrastructureProps {
  materials: CityMaterialRegistry;
  selectedZone: CityZoneId | null;
  hoveredZone: CityZoneId | null;
  onSelectZone: (zone: CityZoneId) => void;
  onHoverZone: (zone: CityZoneId | null) => void;
  solarMW: number;
  windMW: number;
  windCapacityFactor: number;
  thermalMW: number;
  bessNetMW: number;
  bessSocPercent: number;
  daylightFactor: number;
  nightIlluminationFactor?: number;
  supplyShortage: boolean;
  quality?: RenderQuality;
  reducedMotion?: boolean;
}

const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();

// 12x8 utility solar tracker farm (96 arrays) separated into 4 sub-array quadrants
const PV_ARRAY_COORDS: [number, number][] = [];
for (let row = 0; row < 8; row++) {
  for (let col = 0; col < 12; col++) {
    const laneGapX = col >= 6 ? 1.6 : 0;
    const laneGapZ = row >= 4 ? 1.6 : 0;
    PV_ARRAY_COORDS.push([-13.2 + col * 2.25 + laneGapX, -9.2 + row * 2.25 + laneGapZ]);
  }
}

// 12 staggered composite wind turbines across terraced green ridge
const WIND_TURBINES: { x: number; z: number; towerH: number; bladeLen: number }[] = [
  { x: -12.0, z: -7.5, towerH: 7.4, bladeLen: 2.9 },
  { x: -4.2, z: -7.8, towerH: 8.6, bladeLen: 3.1 },
  { x: 3.6, z: -7.5, towerH: 7.8, bladeLen: 2.95 },
  { x: 11.4, z: -7.0, towerH: 9.0, bladeLen: 3.2 },
  { x: -10.5, z: -1.5, towerH: 6.9, bladeLen: 2.7 },
  { x: -2.8, z: -1.8, towerH: 8.1, bladeLen: 3.0 },
  { x: 5.0, z: -1.4, towerH: 7.5, bladeLen: 2.85 },
  { x: 12.2, z: -0.8, towerH: 8.4, bladeLen: 3.05 },
  { x: -8.5, z: 4.5, towerH: 6.6, bladeLen: 2.6 },
  { x: -0.6, z: 4.8, towerH: 7.6, bladeLen: 2.9 },
  { x: 7.2, z: 4.6, towerH: 7.1, bladeLen: 2.75 },
  { x: 11.8, z: 5.8, towerH: 6.8, bladeLen: 2.65 },
];

export function EnergyInfrastructure({
  materials,
  selectedZone,
  hoveredZone,
  onSelectZone,
  onHoverZone,
  solarMW,
  windMW,
  windCapacityFactor,
  thermalMW,
  bessNetMW,
  bessSocPercent,
  daylightFactor,
  nightIlluminationFactor = 0.05,
  supplyShortage,
  quality = 'balanced',
  reducedMotion = false,
}: EnergyInfrastructureProps) {
  const pvPanelInstRef = useRef<THREE.InstancedMesh | null>(null);
  const pvPostInstRef = useRef<THREE.InstancedMesh | null>(null);
  const rotorRefs = useRef<Array<THREE.Group | null>>([]);
  const steamRingRefs = useRef<Array<THREE.Mesh | null>>([]);
  const bessPulseRefs = useRef<Array<THREE.Mesh | null>>([]);

  const sharedBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sharedCyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 16), []);

  // Tall hyperboloid parabolic cooling tower LatheGeometry
  const coolingTowerGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const steps = 16;
    const height = 5.8;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const y = u * height;
      const r = 0.78 + 0.72 * Math.pow(u - 0.74, 2) + (1 - u) * 0.28;
      pts.push(new THREE.Vector2(r, y));
    }
    return new THREE.LatheGeometry(pts, quality === 'low' ? 14 : 24);
  }, [quality]);

  const steamMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#E2E8F0',
        transparent: true,
        opacity: 0.58,
        roughness: 0.95,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      sharedBox.dispose();
      sharedCyl.dispose();
      coolingTowerGeo.dispose();
      steamMaterial.dispose();
    };
  }, [sharedBox, sharedCyl, coolingTowerGeo, steamMaterial]);

  // Update 96 instanced Solar PV tracker angles & silicon glow
  useEffect(() => {
    const panels = pvPanelInstRef.current;
    const posts = pvPostInstRef.current;
    if (!panels || !posts) return;

    const trackingTilt = 0.22 + (1 - daylightFactor) * 0.36;
    _euler.set(trackingTilt, 0, 0);
    _quat.setFromEuler(_euler);

    PV_ARRAY_COORDS.forEach(([lx, lz], idx) => {
      _pos.set(lx, 0.98, lz);
      _scale.set(1.92, 0.09, 1.68);
      _mat4.compose(_pos, _quat, _scale);
      panels.setMatrixAt(idx, _mat4);

      _pos.set(lx, 0.54, lz);
      _scale.set(0.12, 0.76, 0.12);
      _mat4.compose(_pos, new THREE.Quaternion(), _scale);
      posts.setMatrixAt(idx, _mat4);
    });

    panels.instanceMatrix.needsUpdate = true;
    posts.instanceMatrix.needsUpdate = true;
    panels.computeBoundingSphere();
    posts.computeBoundingSphere();

    const activeSolarFactor = solarMW > 0.5 ? Math.min(1, solarMW / 160) * Math.max(0.25, daylightFactor) : 0;
    materials.solarSilicon.emissiveIntensity = activeSolarFactor * 0.48;
  }, [daylightFactor, solarMW, materials]);

  // Animate 12 wind turbine rotors, 4 cooling tower steam plumes & 4 BESS PCS rails
  useFrame((state, delta) => {
    const dt = reducedMotion ? 0 : Math.min(delta, 0.05);
    const omega = windMW > 0.5 ? 0.65 + windCapacityFactor * 4.0 : 0.16;
    for (let i = 0; i < rotorRefs.current.length; i++) {
      const r = rotorRefs.current[i];
      if (r && dt > 0) r.rotation.z -= dt * (omega + (i % 4) * 0.07);
    }

    const thermalRatio = Math.min(1, thermalMW / 250);
    materials.thermalAccentOrange.emissiveIntensity =
      thermalMW > 2
        ? 0.14 + thermalRatio * 0.36 + nightIlluminationFactor * (0.28 + thermalRatio * 0.42)
        : 0.02;

    const t = reducedMotion ? 0.35 : state.clock.getElapsedTime();
    for (let i = 0; i < steamRingRefs.current.length; i++) {
      const ring = steamRingRefs.current[i];
      if (ring) {
        ring.visible = thermalMW > 5;
        if (ring.visible) {
          const cycle = (t * 0.42 + i * 0.25) % 1;
          ring.position.y = 5.95 + cycle * 2.1;
          const s = (0.72 + cycle * 1.15) * (0.72 + thermalRatio * 0.45);
          ring.scale.set(s, s, s);
        }
      }
    }

    const absBess = Math.abs(bessNetMW);
    for (let i = 0; i < bessPulseRefs.current.length; i++) {
      const pulse = bessPulseRefs.current[i];
      if (!pulse) continue;
      if (absBess > 0.5) {
        pulse.visible = true;
        if (reducedMotion) {
          pulse.position.y = 1.05;
        } else {
          const speed = 0.6 + Math.min(1, absBess / 45) * 0.9;
          const phase = (t * speed + i * 0.25) % 1;
          const dirY = bessNetMW > 0 ? phase : 1 - phase;
          pulse.position.y = 0.48 + dirY * 1.25;
        }
      } else {
        pulse.visible = false;
      }
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

  const zoneBorderMat = (zone: CityZoneId, nominalMat: THREE.Material) =>
    selectedZone === zone
      ? materials.cobaltAccent
      : hoveredZone === zone
        ? materials.cyanAccent
        : nominalMat;

  const socRatio = Math.max(0.05, Math.min(1, bessSocPercent / 100));

  return (
    <group>
      {/* =================================================================== */}
      {/* 1. 220/33 kV CENTRAL SUBSTATION & MULTI-BAY HV SWITCHYARD (Origin)  */}
      {/* =================================================================== */}
      <group position={[0, 0, 0]} {...makeHoverProps('substation')}>
        <mesh position={[0, 0.16, -0.4]} receiveShadow geometry={sharedBox} scale={[21.0, 0.32, 13.2]} material={materials.alabasterPad} />
        <mesh
          position={[0, 0.33, 6.15]}
          geometry={sharedBox}
          scale={[21.0, 0.08, 0.18]}
          material={zoneBorderMat('substation', materials.cobaltAccent)}
        />

        {/* Crushed Granite High-Voltage Switchyard Compound */}
        <mesh position={[0, 0.34, -1.6]} receiveShadow geometry={sharedBox} scale={[19.2, 0.06, 9.4]} material={materials.switchyardGravel} />

        {/* 6 Heavy Step-Down Power Transformers with Fins, Conservators & Bushings */}
        {[-6.8, -4.1, -1.4, 1.4, 4.1, 6.8].map((tx) => (
          <group key={tx} position={[tx, 0.37, -1.2]}>
            <mesh position={[0, 0.78, 0]} castShadow receiveShadow geometry={sharedBox} scale={[1.48, 1.56, 1.9]} material={materials.plasterWhite} />
            <mesh position={[-0.84, 0.72, 0]} castShadow geometry={sharedBox} scale={[0.2, 1.15, 1.4]} material={materials.industrialSteel} />
            <mesh position={[0.84, 0.72, 0]} castShadow geometry={sharedBox} scale={[0.2, 1.15, 1.4]} material={materials.industrialSteel} />
            <mesh position={[0, 1.82, -0.4]} rotation={[0, 0, Math.PI / 2]} castShadow geometry={sharedCyl} scale={[0.22, 1.15, 0.22]} material={materials.brushedSteel} />
            {[-0.42, 0, 0.42].map((bx) => (
              <mesh key={bx} position={[bx, 1.9, 0.44]} castShadow geometry={sharedCyl} scale={[0.08, 0.68, 0.08]} material={materials.copperBusbar} />
            ))}
          </group>
        ))}

        {/* Twin 220 kV H-Frame Steel Switchyard Gantries & Overhead Copper Busbars */}
        {[-8.2, -4.1, 0, 4.1, 8.2].map((gx) => (
          <group key={gx}>
            <mesh position={[gx, 2.25, -4.8]} castShadow geometry={sharedBox} scale={[0.24, 3.8, 0.24]} material={materials.industrialSteel} />
            <mesh position={[gx, 4.45, -4.8]} geometry={sharedCyl} scale={[0.05, 0.85, 0.05]} material={materials.brushedSteel} />
          </group>
        ))}
        <mesh position={[0, 3.95, -4.8]} castShadow geometry={sharedBox} scale={[17.2, 0.22, 0.26]} material={materials.industrialSteel} />
        <mesh position={[0, 3.2, -4.8]} castShadow geometry={sharedBox} scale={[17.2, 0.14, 0.18]} material={materials.brushedSteel} />
        {[-6.8, -4.1, -1.4, 1.4, 4.1, 6.8].map((bx) => (
          <mesh
            key={bx}
            position={[bx, 3.55, -2.8]}
            rotation={[Math.PI / 2, 0, 0]}
            geometry={sharedCyl}
            scale={[0.06, 4.0, 0.06]}
            material={materials.copperBusbar}
          />
        ))}

        {/* 6 SF6 Circuit Breaker & Isolator Bays + Shunt Capacitor Rack */}
        {[-6.8, -4.1, -1.4, 1.4, 4.1, 6.8].map((cx) => (
          <group key={cx} position={[cx, 0.37, 1.6]}>
            <mesh position={[0, 0.55, 0]} castShadow geometry={sharedBox} scale={[0.92, 1.1, 0.68]} material={materials.latticeSteel} />
            <mesh position={[-0.28, 1.28, 0]} geometry={sharedCyl} scale={[0.06, 0.44, 0.06]} material={materials.cyanAccent} />
            <mesh position={[0.28, 1.28, 0]} geometry={sharedCyl} scale={[0.06, 0.44, 0.06]} material={materials.cyanAccent} />
          </group>
        ))}

        {/* 3-Story Glass-Fronted Regional SCADA & Relay Control Center */}
        <group position={[0, 0.32, 4.4]}>
          <mesh position={[0, 1.2, 0]} castShadow receiveShadow geometry={sharedBox} scale={[11.4, 2.4, 2.4]} material={materials.plasterWhite} />
          <mesh position={[0, 1.3, 1.24]} geometry={sharedBox} scale={[9.4, 1.35, 0.08]} material={materials.windowGlow} />
          <mesh
            position={[0, 2.48, 0]}
            geometry={sharedBox}
            scale={[11.5, 0.16, 2.5]}
            material={supplyShortage ? materials.alertCrimson : materials.cobaltAccent}
          />
          <mesh position={[4.2, 3.0, 0]} castShadow geometry={sharedCyl} scale={[0.08, 0.95, 0.08]} material={materials.brushedSteel} />
          <mesh position={[-4.2, 2.85, 0]} castShadow geometry={sharedCyl} scale={[0.45, 0.35, 0.45]} material={materials.cyanAccent} />
        </group>
      </group>

      {/* =================================================================== */}
      {/* 2. MEGA SOLAR PV PARK (96 Dual-Module Tracker Arrays + 4 Inverters) */}
      {/* =================================================================== */}
      <group position={[-34, 0, -28]} {...makeHoverProps('solar')}>
        <mesh position={[0, 0.12, 0]} receiveShadow geometry={sharedBox} scale={[32.0, 0.24, 23.0]} material={materials.alabasterPad} />
        <mesh
          position={[0, 0.25, 11.45]}
          geometry={sharedBox}
          scale={[32.0, 0.08, 0.18]}
          material={zoneBorderMat('solar', materials.emeraldAccent)}
        />

        <instancedMesh
          ref={pvPostInstRef}
          args={[sharedCyl, materials.brushedSteel, PV_ARRAY_COORDS.length]}
          castShadow={quality !== 'low'}
        />
        <instancedMesh
          ref={pvPanelInstRef}
          args={[sharedBox, materials.solarSilicon, PV_ARRAY_COORDS.length]}
          castShadow={quality !== 'low'}
          receiveShadow={quality !== 'low'}
        />

        {/* 4 Central Inverter & Step-Up Skid Stations */}
        {[-10.5, -3.5, 3.5, 10.5].map((ix, idx) => (
          <group key={idx} position={[ix, 0.24, 9.2]}>
            <mesh position={[0, 0.78, 0]} castShadow receiveShadow geometry={sharedBox} scale={[3.2, 1.56, 2.0]} material={materials.plasterWhite} />
            <mesh position={[0, 1.62, 0]} geometry={sharedBox} scale={[3.28, 0.14, 2.08]} material={materials.emeraldAccent} />
            <mesh position={[2.0, 0.54, 0]} castShadow geometry={sharedBox} scale={[0.72, 1.08, 0.95]} material={materials.industrialSteel} />
          </group>
        ))}

        {/* Irradiance & Weather Met Tower */}
        <mesh position={[14.2, 2.4, 9.2]} castShadow geometry={sharedCyl} scale={[0.09, 4.4, 0.09]} material={materials.brushedSteel} />
        <mesh position={[14.2, 4.5, 9.2]} geometry={sharedBox} scale={[0.6, 0.14, 0.6]} material={materials.cyanAccent} />
      </group>

      {/* =================================================================== */}
      {/* 3. ELEVATED WIND FARM ESCARPMENT (12 Staggered Turbines + Collector)*/}
      {/* =================================================================== */}
      <group position={[34, 0, -28]} {...makeHoverProps('wind')}>
        <mesh position={[0, 0.12, 0]} receiveShadow geometry={sharedBox} scale={[32.0, 0.24, 23.0]} material={materials.alabasterPad} />
        <mesh position={[0, 0.4, -1.6]} receiveShadow geometry={sharedBox} scale={[29.5, 0.32, 17.5]} material={materials.parkLawn} />
        <mesh position={[0, 0.66, -4.5]} receiveShadow geometry={sharedBox} scale={[26.5, 0.22, 9.5]} material={materials.parkLawn} />
        <mesh
          position={[0, 0.25, 11.45]}
          geometry={sharedBox}
          scale={[32.0, 0.08, 0.18]}
          material={zoneBorderMat('wind', materials.emeraldAccent)}
        />

        {WIND_TURBINES.map((wt, idx) => {
          const baseY = wt.z < -2.0 ? 0.77 : 0.56;
          return (
            <group key={idx} position={[wt.x, baseY, wt.z]} rotation={[0, -0.38, 0]}>
              <mesh position={[0, 0.18, 0]} castShadow receiveShadow geometry={sharedCyl} scale={[0.68, 0.36, 0.68]} material={materials.industrialSteel} />
              <mesh position={[0, wt.towerH / 2 + 0.18, 0]} castShadow>
                <cylinderGeometry args={[0.16, 0.34, wt.towerH, 16]} />
                <primitive object={materials.plasterWhite} attach="material" />
              </mesh>
              <mesh position={[0, wt.towerH * 0.72, 0]} geometry={sharedCyl} scale={[0.24, 0.34, 0.24]} material={materials.emeraldAccent} />
              <mesh position={[0, wt.towerH + 0.18, 0.2]} castShadow geometry={sharedBox} scale={[0.56, 0.56, 1.42]} material={materials.plasterWhite} />
              <mesh position={[0, wt.towerH + 0.54, -0.3]} geometry={sharedBox} scale={[0.16, 0.28, 0.44]} material={materials.emeraldAccent} />
              <mesh position={[0, wt.towerH + 0.74, -0.3]} geometry={sharedCyl} scale={[0.09, 0.12, 0.09]} material={materials.cyanAccent} />
              <group
                position={[0, wt.towerH + 0.18, 0.94]}
                ref={(el) => {
                  rotorRefs.current[idx] = el;
                }}
              >
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <coneGeometry args={[0.25, 0.52, 16]} />
                  <primitive object={materials.emeraldAccent} attach="material" />
                </mesh>
                {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle, bIdx) => (
                  <group key={bIdx} rotation={[0, 0, angle]}>
                    <mesh position={[0, wt.bladeLen * 0.5, 0]} castShadow geometry={sharedBox} scale={[0.17, wt.bladeLen, 0.06]} material={materials.plasterWhite} />
                  </group>
                ))}
              </group>
            </group>
          );
        })}

        {/* Wind Collector Substation Pad */}
        <mesh position={[-11.2, 0.85, 8.8]} castShadow receiveShadow geometry={sharedBox} scale={[3.4, 1.2, 2.0]} material={materials.plasterWhite} />
        <mesh position={[-11.2, 1.5, 8.8]} geometry={sharedBox} scale={[3.48, 0.12, 2.08]} material={materials.emeraldAccent} />
      </group>

      {/* =================================================================== */}
      {/* 4. ICONIC THERMAL POWER STATION (4 Hyperboloid Towers, 3 Stacks)    */}
      {/* =================================================================== */}
      <group position={[34, 0, 0]} {...makeHoverProps('thermal')}>
        <mesh position={[0, 0.14, 0]} receiveShadow geometry={sharedBox} scale={[24.0, 0.28, 15.6]} material={materials.alabasterPad} />
        <mesh
          position={[0, 0.29, 7.75]}
          geometry={sharedBox}
          scale={[24.0, 0.08, 0.18]}
          material={zoneBorderMat('thermal', materials.thermalAccentOrange)}
        />

        {/* Condenser Water Retention Basin */}
        <mesh position={[4.2, 0.31, 5.4]} geometry={sharedBox} scale={[11.2, 0.1, 2.4]} material={materials.waterPool} />

        {/* Twin Steam & Gas Turbine Generator Halls */}
        <mesh position={[-4.5, 2.0, -1.0]} castShadow receiveShadow geometry={sharedBox} scale={[8.8, 3.4, 6.8]} material={materials.industrialCladding} />
        <mesh position={[-4.5, 3.35, -1.0]} geometry={sharedBox} scale={[8.9, 0.42, 6.9]} material={materials.architecturalGlass} />
        <mesh position={[-4.5, 3.84, -1.0]} castShadow geometry={sharedBox} scale={[9.0, 0.3, 7.0]} material={materials.industrialSteel} />
        <mesh position={[-4.5, 4.06, -1.0]} geometry={sharedBox} scale={[9.06, 0.14, 7.06]} material={materials.thermalAccentOrange} />

        {/* HRSG Boiler Complex & Orange Insulated Steam Headers */}
        <mesh position={[-4.2, 1.65, 4.2]} castShadow receiveShadow geometry={sharedBox} scale={[5.6, 2.7, 2.4]} material={materials.industrialSteel} />
        <mesh
          position={[-4.2, 3.2, 2.5]}
          rotation={[Math.PI / 2, 0, 0]}
          geometry={sharedCyl}
          scale={[0.36, 3.2, 0.36]}
          material={materials.thermalAccentOrange}
        />

        {/* 3 Tall Aviation-Striped Flue Exhaust Stacks */}
        {[-7.4, -4.5, -1.6].map((sx, idx) => (
          <group key={idx} position={[sx, 0.28, -5.6]}>
            <mesh position={[0, 3.9, 0]} castShadow geometry={sharedCyl} scale={[0.46, 7.8, 0.46]} material={materials.plasterWhite} />
            <mesh position={[0, 6.9, 0]} geometry={sharedCyl} scale={[0.5, 0.85, 0.5]} material={materials.thermalAccentOrange} />
            <mesh position={[0, 5.2, 0]} geometry={sharedCyl} scale={[0.5, 0.55, 0.5]} material={materials.thermalAccentOrange} />
          </group>
        ))}

        {/* 4 Towering Hyperboloid Cooling Towers with Steam Plumes */}
        {[
          { x: 3.4, z: -4.2 },
          { x: 8.2, z: -4.2 },
          { x: 3.4, z: 0.8 },
          { x: 8.2, z: 0.8 },
        ].map((ct, idx) => (
          <group key={idx} position={[ct.x, 0.28, ct.z]}>
            <mesh geometry={coolingTowerGeo} material={materials.plasterWhite} castShadow={quality !== 'low'} receiveShadow={quality !== 'low'} />
            <mesh position={[0, 5.75, 0]} geometry={sharedCyl} scale={[1.02, 0.22, 1.02]} material={materials.thermalAccentOrange} />
            <mesh
              ref={(el) => {
                steamRingRefs.current[idx] = el;
              }}
              position={[0, 6.05, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              material={steamMaterial}
            >
              <torusGeometry args={[0.72, 0.16, quality === 'low' ? 6 : 10, quality === 'low' ? 12 : 24]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* =================================================================== */}
      {/* 5. GRID-SCALE LFP BESS CAMPUS (12 Containers + 4 PCS Stations)      */}
      {/* =================================================================== */}
      <group position={[-34, 0, 0]} {...makeHoverProps('bess')}>
        <mesh position={[0, 0.14, 0]} receiveShadow geometry={sharedBox} scale={[24.0, 0.28, 15.6]} material={materials.alabasterPad} />
        <mesh
          position={[0, 0.29, 7.75]}
          geometry={sharedBox}
          scale={[24.0, 0.08, 0.18]}
          material={zoneBorderMat('bess', materials.cyanAccent)}
        />

        {/* 4x3 Modular LFP Battery Container Grid (12 Units) */}
        {[-5.0, -1.8, 1.4, 4.6].map((bz) =>
          [-7.6, -2.8, 2.0].map((bx, colIdx) => (
            <group key={`${bz}-${colIdx}`} position={[bx, 0.28, bz]}>
              <mesh position={[0, 0.72, 0]} castShadow receiveShadow geometry={sharedBox} scale={[4.1, 1.44, 1.38]} material={materials.plasterWhite} />
              <mesh position={[0, 1.38, 0]} geometry={sharedBox} scale={[4.16, 0.14, 1.42]} material={bessNetMW >= 0 ? materials.emeraldAccent : materials.cyanAccent} />
              <mesh position={[0, 0.72, 0.71]} geometry={sharedBox} scale={[3.2, 0.14, 0.05]} material={bessNetMW >= 0 ? materials.emeraldAccent : materials.cyanAccent} />
              <mesh position={[-1.1, 1.58, 0]} castShadow geometry={sharedBox} scale={[0.8, 0.22, 0.75]} material={materials.industrialSteel} />
              <mesh position={[1.1, 1.58, 0]} castShadow geometry={sharedBox} scale={[0.8, 0.22, 0.75]} material={materials.industrialSteel} />
            </group>
          )),
        )}

        {/* 4 Bidirectional PCS Inverter Stations + Animated Rails */}
        {[-4.5, -1.5, 1.5, 4.5].map((pz, idx) => (
          <group key={idx} position={[7.8, 0.28, pz]}>
            <mesh position={[0, 0.85, 0]} castShadow receiveShadow geometry={sharedBox} scale={[2.1, 1.7, 2.2]} material={materials.warmPlaster} />
            <mesh position={[0, 1.76, 0]} geometry={sharedBox} scale={[2.18, 0.14, 2.28]} material={materials.cobaltAccent} />
            <mesh
              ref={(el) => {
                bessPulseRefs.current[idx] = el;
              }}
              position={[1.12, 1.0, 0]}
              geometry={sharedBox}
              scale={[0.12, 0.24, 1.9]}
              material={bessNetMW >= 0 ? materials.emeraldAccent : materials.cyanAccent}
            />
          </group>
        ))}

        {/* Live 3D State-of-Charge Telemetry Bar Gantry */}
        <mesh position={[-2.4, 1.4, 6.7]} geometry={sharedBox} scale={[14.8, 0.28, 0.14]} material={materials.industrialSteel} />
        <mesh
          position={[-9.8 + 7.4 * socRatio, 1.4, 6.78]}
          geometry={sharedBox}
          scale={[14.8 * socRatio, 0.24, 0.12]}
          material={bessNetMW >= 0 ? materials.emeraldAccent : materials.cyanAccent}
        />
      </group>
    </group>
  );
}
