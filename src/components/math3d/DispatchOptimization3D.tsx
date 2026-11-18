import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import type { DaySimulationSummary } from '../../types/grid';

interface DispatchAllocation3DProps {
  summary: DaySimulationSummary;
  activeHour: number;
  onSelectHour: (hour: number) => void;
}

const SOURCE_TRACKS = [
  { key: 'solar', label: 'Solar', color: '#10B981', z: -2.0 },
  { key: 'wind', label: 'Wind', color: '#06B6D4', z: -1.0 },
  { key: 'hydro', label: 'Hydro', color: '#0EA5E9', z: 0.0 },
  { key: 'gas', label: 'CCGT Gas', color: '#2563EB', z: 1.0 },
  { key: 'coal', label: 'Thermal Coal', color: '#64748B', z: 2.0 },
] as const;

/**
 * 3D Multi-Period Time x Source x Generation (MW) & Battery SoC (MWh) Trajectory Scene.
 * Explicitly visualizes all 24 hours without misrepresenting a 216-variable LP as a 3-variable polygon.
 */
export function DispatchAllocation3D({
  summary,
  activeHour,
  onSelectHour,
}: DispatchAllocation3DProps) {
  const maxMW = useMemo(() => {
    const peakGen = Math.max(
      180,
      ...summary.hourlyDispatches.flatMap((h) => [
        h.totalDemandMW,
        ...h.generatorSetpoints.map((g) => g.dispatchedMW),
      ]),
    );
    return Math.ceil(peakGen / 50) * 50;
  }, [summary]);

  const toX = (hour: number) => (hour / 23) * 10.4 - 5.2;
  const toY = (mw: number) => Math.max(0.04, (mw / maxMW) * 4.2);

  const socPoints = useMemo<[number, number, number][]>(() => {
    return summary.hourlyDispatches.map((h) => [
      toX(h.hour),
      0.3 + (h.batterySocPercent / 100) * 3.2,
      3.1,
    ]);
  }, [summary]);

  const demandPoints = useMemo<[number, number, number][]>(() => {
    return summary.hourlyDispatches.map((h) => [toX(h.hour), toY(h.totalDemandMW), -3.0]);
  }, [summary, maxMW]);

  const activeDispatch = summary.hourlyDispatches[activeHour] ?? summary.hourlyDispatches[0];

  return (
    <group>
      <gridHelper args={[13, 13, '#CBD5E1', '#E2E8F0']} position={[0, 0, 0]} />

      {/* Source Track Z-Axis Labels */}
      {SOURCE_TRACKS.map((track) => (
        <Html key={track.key} position={[-6.05, 0.15, track.z]} center zIndexRange={[8, 0]}>
          <span className="rounded bg-[#FFFFFF]/90 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#0F172A] whitespace-nowrap">
            {track.label}
          </span>
        </Html>
      ))}
      <Html position={[-6.05, 0.15, 3.1]} center zIndexRange={[8, 0]}>
        <span className="rounded bg-[#FFFFFF]/90 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#2563EB] whitespace-nowrap">
          BESS SoC (%)
        </span>
      </Html>
      <Html position={[-6.05, 0.15, -3.0]} center zIndexRange={[8, 0]}>
        <span className="rounded bg-[#FFFFFF]/90 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#0F172A] whitespace-nowrap">
          Demand (MW)
        </span>
      </Html>

      {/* Hourly Generation Bars Across 5 Source Tracks */}
      {summary.hourlyDispatches.map((h) => {
        const x = toX(h.hour);
        const isSelected = h.hour === activeHour;
        return (
          <group key={h.hour}>
            {SOURCE_TRACKS.map((track) => {
              const sp = h.generatorSetpoints.find((g) => g.technology === track.key);
              const mw = sp?.dispatchedMW ?? 0;
              const height = Math.max(0.04, (mw / maxMW) * 4.2);
              return (
                <mesh
                  key={track.key}
                  position={[x, height / 2, track.z]}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectHour(h.hour);
                  }}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    document.body.style.cursor = 'pointer';
                  }}
                  onPointerOut={() => {
                    document.body.style.cursor = 'default';
                  }}
                >
                  <boxGeometry args={[isSelected ? 0.34 : 0.28, height, 0.52]} />
                  <meshStandardMaterial
                    color={track.color}
                    emissive={isSelected ? track.color : '#000000'}
                    emissiveIntensity={isSelected ? 0.25 : 0}
                    roughness={0.35}
                  />
                </mesh>
              );
            })}

            {/* Unserved Shortage Pillar if Inadequate Capacity */}
            {h.unservedEnergyMW > 0.5 ? (
              <mesh position={[x, toY(h.unservedEnergyMW) / 2, -3.0]}>
                <boxGeometry args={[0.3, toY(h.unservedEnergyMW), 0.45]} />
                <meshStandardMaterial color="#DC2626" />
              </mesh>
            ) : null}
          </group>
        );
      })}

      {/* Demand Trajectory Curve */}
      {demandPoints.length > 1 ? (
        <Line points={demandPoints} color="#0F172A" lineWidth={2.2} />
      ) : null}

      {/* Battery State-of-Charge Trajectory Ribbon */}
      {socPoints.length > 1 ? (
        <Line points={socPoints} color="#2563EB" lineWidth={2.8} />
      ) : null}
      {summary.hourlyDispatches.map((h) => (
        <mesh
          key={`soc-${h.hour}`}
          position={[toX(h.hour), 0.3 + (h.batterySocPercent / 100) * 3.2, 3.1]}
          onClick={(e) => {
            e.stopPropagation();
            onSelectHour(h.hour);
          }}
        >
          <sphereGeometry args={[h.hour === activeHour ? 0.12 : 0.075, 12, 12]} />
          <meshStandardMaterial color={h.batteryNetPowerMW >= 0 ? '#06B6D4' : '#2563EB'} />
        </mesh>
      ))}

      {/* Active Hour Marker Plane */}
      <mesh position={[toX(activeHour), 2.1, 0]}>
        <boxGeometry args={[0.04, 4.2, 6.6]} />
        <meshBasicMaterial color="#2563EB" transparent opacity={0.12} />
      </mesh>

      {/* Active Hour Floating Readout */}
      {activeDispatch ? (
        <Html position={[toX(activeHour), 4.45, 0]} center zIndexRange={[12, 0]}>
          <div className="rounded-lg border border-[#2563EB] bg-[#FFFFFF] px-2.5 py-1 font-mono text-[10px] text-[#0F172A] shadow-xs whitespace-nowrap">
            {activeDispatch.timestampLabel} · Load {activeDispatch.totalDemandMW.toFixed(1)} MW · BESS SoC {activeDispatch.batterySocMWh.toFixed(1)} MWh ({activeDispatch.batterySocPercent.toFixed(0)}%)
          </div>
        </Html>
      ) : null}
    </group>
  );
}
