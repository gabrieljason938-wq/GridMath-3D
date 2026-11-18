import { useEffect, useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { NewtonInterpolationResult } from '../../math/interpolation';

interface Interpolation3DProps {
  result: NewtonInterpolationResult;
  precision: number;
}

export function Interpolation3D({ result, precision }: Interpolation3DProps) {
  const { sortedPoints, curvePoints, queryX, interpolatedY } = result;

  const bounds = useMemo(() => {
    const xs = sortedPoints.map((p) => p.x);
    const ys = [...sortedPoints.map((p) => p.y), ...curvePoints.map((p) => p.y), interpolatedY];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      minX,
      spanX: Math.max(1e-6, maxX - minX),
      minY,
      spanY: Math.max(1e-6, maxY - minY),
    };
  }, [sortedPoints, curvePoints, interpolatedY]);

  // Map 2D mathematical coordinates (x, y) onto a floating upright 2D coordinate plane in 3D space
  const toScene = (x: number, y: number): [number, number, number] => {
    const nx = ((x - bounds.minX) / bounds.spanX) * 9 - 4.5;
    const ny = ((y - bounds.minY) / bounds.spanY) * 4.5 + 0.5;
    return [nx, ny, 0];
  };

  const curveTube = useMemo(() => {
    if (curvePoints.length < 2) return null;
    const pts = curvePoints.map((p) => new THREE.Vector3(...toScene(p.x, p.y)));
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 72, 0.055, 8, false);
  }, [curvePoints, bounds]);

  useEffect(() => {
    return () => {
      curveTube?.dispose();
    };
  }, [curveTube]);

  const queryPos = toScene(queryX, interpolatedY);

  return (
    <group>
      {/* Ground Base Grid */}
      <gridHelper args={[14, 14, '#CBD5E1', '#E2E8F0']} position={[0, 0, 0]} />

      {/* Floating 2D Coordinate Plane Slab */}
      <mesh position={[0, 2.75, -0.04]}>
        <planeGeometry args={[10.4, 5.6]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.9} transparent opacity={0.92} side={THREE.DoubleSide} />
      </mesh>
      <Line
        points={[
          [-5.2, 0, 0],
          [5.2, 0, 0],
          [5.2, 5.5, 0],
          [-5.2, 5.5, 0],
          [-5.2, 0, 0],
        ]}
        color="#CBD5E1"
        lineWidth={1.2}
      />

      {/* Explicit 2D Function Plane Label */}
      <Html position={[-4.9, 5.2, 0]} zIndexRange={[10, 0]}>
        <div className="rounded border border-[#E2E8F0] bg-[#FFFFFF]/95 px-2 py-0.5 text-[10px] font-medium text-[#64748B] whitespace-nowrap">
          2D Polynomial P(x) on Embedded Coordinate Plane
        </div>
      </Html>

      {/* Interpolated Polynomial Curve */}
      {curveTube ? (
        <mesh geometry={curveTube}>
          <meshStandardMaterial color="#2563EB" roughness={0.3} metalness={0.2} />
        </mesh>
      ) : null}

      {/* Observed Data Points */}
      {sortedPoints.map((pt, idx) => {
        const pos = toScene(pt.x, pt.y);
        return (
          <group key={idx} position={pos}>
            <mesh>
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshStandardMaterial color="#06B6D4" roughness={0.25} />
            </mesh>
            <Html position={[0, 0.35, 0]} center zIndexRange={[10, 0]}>
              <div className="rounded border border-[#E2E8F0] bg-[#FFFFFF]/95 px-1.5 py-0.5 font-mono text-[9px] text-[#0F172A] whitespace-nowrap">
                ({pt.x.toFixed(1)}, {pt.y.toFixed(1)})
              </div>
            </Html>
          </group>
        );
      })}

      {/* Highlighted Query Point */}
      <group position={queryPos}>
        <mesh>
          <sphereGeometry args={[0.19, 20, 20]} />
          <meshStandardMaterial color="#10B981" roughness={0.2} emissive="#10B981" emissiveIntensity={0.25} />
        </mesh>
        <Html position={[0, -0.45, 0.1]} center zIndexRange={[10, 0]}>
          <div className="rounded border border-[#10B981] bg-[#10B981] px-2 py-0.5 font-mono text-[10px] font-semibold text-white whitespace-nowrap shadow-xs">
            P({queryX.toFixed(2)}) = {interpolatedY.toFixed(precision)}
          </div>
        </Html>
      </group>

      {/* Projection Drop-Line to X-Axis */}
      <Line
        points={[
          [queryPos[0], 0, 0.02],
          [queryPos[0], queryPos[1], 0.02],
        ]}
        color="#10B981"
        lineWidth={1.5}
        dashed
        dashSize={0.18}
        gapSize={0.1}
      />
    </group>
  );
}
