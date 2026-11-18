import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { DifferentiationResult } from '../../math/differentiation';

interface Differentiation3DProps {
  result: DifferentiationResult;
  precision: number;
}

export function Differentiation3D({ result, precision }: Differentiation3DProps) {
  const { sampledCurve, x0, h, fx0, fxPlus, fxMinus, method, selectedSlope, demandTrend } =
    result;

  const bounds = useMemo(() => {
    const xs = sampledCurve.map((p) => p.x);
    const ys = [...sampledCurve.map((p) => p.y), fx0, fxPlus, fxMinus];
    return {
      minX: Math.min(...xs),
      spanX: Math.max(1e-6, Math.max(...xs) - Math.min(...xs)),
      minY: Math.min(...ys) * 0.92,
      spanY: Math.max(1e-6, Math.max(...ys) * 1.08 - Math.min(...ys) * 0.92),
    };
  }, [sampledCurve, fx0, fxPlus, fxMinus]);

  const toScene = (x: number, y: number): [number, number, number] => {
    const sx = ((x - bounds.minX) / bounds.spanX) * 9.5 - 4.75;
    const sy = ((y - bounds.minY) / bounds.spanY) * 4.4 + 0.5;
    return [sx, sy, 0];
  };

  // Split curve into rising (emerald) vs falling (amber) segments
  const segments = useMemo(() => {
    const list: { pts: [number, number, number][]; color: string }[] = [];
    for (let i = 0; i < sampledCurve.length - 1; i++) {
      const a = sampledCurve[i];
      const b = sampledCurve[i + 1];
      const avgSlope = (a.slope + b.slope) / 2;
      const color = avgSlope >= 0.5 ? '#10B981' : avgSlope <= -0.5 ? '#D97706' : '#06B6D4';
      list.push({
        pts: [toScene(a.x, a.y), toScene(b.x, b.y)],
        color,
      });
    }
    return list;
  }, [sampledCurve, bounds]);

  const p0 = toScene(x0, fx0);
  const secantSecondX = method === 'backward' ? x0 - h : x0 + h;
  const secantSecondY = method === 'backward' ? fxMinus : fxPlus;
  const pSecant = toScene(secantSecondX, secantSecondY);
  const pLeft = method === 'central' ? toScene(x0 - h, fxMinus) : p0;
  const pRight = method === 'backward' ? p0 : toScene(x0 + h, fxPlus);

  // Tangent line through (x0, fx0) with slope selectedSlope
  const tanSpan = Math.max(1.5, h * 1.3);
  const tA = toScene(x0 - tanSpan, fx0 - selectedSlope * tanSpan);
  const tB = toScene(x0 + tanSpan, fx0 + selectedSlope * tanSpan);

  return (
    <group>
      <gridHelper args={[14, 14, '#CBD5E1', '#E2E8F0']} position={[0, 0, 0]} />

      {/* Floating Coordinate Plane */}
      <mesh position={[0, 2.75, -0.05]}>
        <planeGeometry args={[10.5, 5.4]} />
        <meshStandardMaterial color="#FFFFFF" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Rising (Emerald) vs Falling (Amber) Demand Curve Segments */}
      {segments.map((seg, idx) => (
        <Line key={idx} points={seg.pts} color={seg.color} lineWidth={3} />
      ))}

      {/* Secant Line */}
      <Line points={[pLeft, pRight]} color="#06B6D4" lineWidth={2} dashed dashSize={0.16} gapSize={0.08} />

      {/* Tangent / Derivative Line */}
      <Line points={[tA, tB]} color="#2563EB" lineWidth={2.5} />

      {/* Slope Triangle Indicator */}
      <Line
        points={[
          p0,
          [pSecant[0], p0[1], 0.03],
          [pSecant[0], pSecant[1], 0.03],
        ]}
        color="#64748B"
        lineWidth={1.2}
      />

      {/* Active Evaluation Point */}
      <mesh position={[p0[0], p0[1], 0.04]}>
        <sphereGeometry args={[0.17, 18, 18]} />
        <meshStandardMaterial color="#2563EB" />
      </mesh>
      <mesh position={[pSecant[0], pSecant[1], 0.04]}>
        <sphereGeometry args={[0.12, 14, 14]} />
        <meshStandardMaterial color="#06B6D4" />
      </mesh>

      <Html position={[p0[0], p0[1] + 0.45, 0.1]} center zIndexRange={[10, 0]}>
        <div className="rounded border border-[#2563EB] bg-[#2563EB] px-2 py-0.5 font-mono text-[10px] font-semibold text-white whitespace-nowrap shadow-xs">
          {demandTrend.toUpperCase()} · {selectedSlope >= 0 ? '+' : ''}
          {selectedSlope.toFixed(precision)} MW/h
        </div>
      </Html>
    </group>
  );
}
