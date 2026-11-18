import { useEffect, useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { NumericalIntegrationResult } from '../../math/integration';

interface Integration3DProps {
  result: NumericalIntegrationResult;
  activeStepIndex: number;
  precision: number;
}

export function Integration3D({ result, activeStepIndex, precision }: Integration3DProps) {
  const { slices, curvePoints, a, b } = result;

  const bounds = useMemo(() => {
    const ys = curvePoints.map((p) => p.powerMW);
    const maxY = Math.max(100, ...ys) * 1.08;
    return {
      minX: a,
      spanX: Math.max(1e-6, b - a),
      maxY,
    };
  }, [curvePoints, a, b]);

  const toX = (t: number) => ((t - bounds.minX) / bounds.spanX) * 9.5 - 4.75;
  const toY = (mw: number) => Math.max(0.05, (mw / bounds.maxY) * 4.5);

  const curveLine = useMemo<[number, number, number][]>(
    () => curvePoints.map((p) => [toX(p.t), toY(p.powerMW), 0.28]),
    [curvePoints, bounds],
  );

  // Extruded translucent trapezoidal slabs for subdivisions
  const sliceGeometries = useMemo(() => {
    return slices.map((s) => {
      const x0 = toX(s.xStart);
      const x1 = toX(s.xEnd);
      const y0 = toY(s.yStartMW);
      const y1 = toY(s.yEndMW);
      const ym = toY(s.yMidMW);

      const shape = new THREE.Shape();
      shape.moveTo(x0, 0);
      shape.lineTo(x0, y0);
      if (result.method === 'simpson') {
        const xm = (x0 + x1) * 0.5;
        shape.quadraticCurveTo(xm, 2 * ym - 0.5 * (y0 + y1), x1, y1);
      } else {
        shape.lineTo(x1, y1);
      }
      shape.lineTo(x1, 0);
      shape.closePath();

      return new THREE.ExtrudeGeometry(shape, {
        depth: 0.45,
        bevelEnabled: false,
      });
    });
  }, [slices, result.method, bounds]);

  useEffect(() => {
    return () => {
      sliceGeometries.forEach((g) => g.dispose());
    };
  }, [sliceGeometries]);

  const clampedIdx = Math.min(Math.max(0, activeStepIndex), Math.max(0, slices.length - 1));
  const activeSlice = slices[clampedIdx];

  return (
    <group>
      <gridHelper args={[14, 14, '#CBD5E1', '#E2E8F0']} position={[0, 0, 0]} />

      {/* Translucent Extruded Energy Subdivisions */}
      {sliceGeometries.map((geo, idx) => {
        const accumulated = idx <= clampedIdx;
        const isCurrent = idx === clampedIdx;
        const color = isCurrent ? '#2563EB' : accumulated ? '#06B6D4' : '#CBD5E1';
        const opacity = isCurrent ? 0.55 : accumulated ? 0.36 : 0.16;

        return (
          <mesh key={idx} geometry={geo} position={[0, 0, -0.22]}>
            <meshStandardMaterial color={color} transparent opacity={opacity} roughness={0.35} />
          </mesh>
        );
      })}

      {/* Demand Curve P(t) [MW] */}
      {curveLine.length > 1 ? <Line points={curveLine} color="#0F172A" lineWidth={2.5} /> : null}

      {/* Accumulated Energy Callout (Strictly in MWh) */}
      {activeSlice ? (
        <Html position={[toX(activeSlice.xEnd), toY(activeSlice.yEndMW) + 0.55, 0.25]} center zIndexRange={[10, 0]}>
          <div className="rounded border border-[#2563EB] bg-[#FFFFFF] px-2.5 py-1 font-mono text-[10px] font-semibold text-[#0F172A] shadow-xs whitespace-nowrap">
            ∫ P(t)dt = {activeSlice.cumulativeEnergyMWh.toFixed(precision)} MWh
          </div>
        </Html>
      ) : null}
    </group>
  );
}
