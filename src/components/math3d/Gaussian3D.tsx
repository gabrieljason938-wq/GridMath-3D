import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { EliminationStep } from '../../math/gaussianElimination';

interface Gaussian3DProps {
  step: EliminationStep;
  solution: number[];
  size: number;
  precision: number;
}

export function Gaussian3D({ step, solution, size, precision }: Gaussian3DProps) {
  const mat = step.matrixSnapshot;
  const cols = size + 1;
  const rowRefs = useRef<Array<THREE.Group | null>>([]);

  // Smoothly interpolate row Y/Z offsets when showing pivot swaps or active row operations
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    for (let r = 0; r < size; r++) {
      const grp = rowRefs.current[r];
      if (!grp) continue;
      const targetZ = (r - (size - 1) / 2) * 1.45;
      const targetLift =
        step.kind === 'pivot-swap' && (r === step.pivotRow || r === step.targetRow)
          ? 0.45
          : step.kind === 'eliminate' && r === step.targetRow
            ? 0.18
            : 0;

      grp.position.z = THREE.MathUtils.damp(grp.position.z, targetZ, 8, dt);
      grp.position.y = THREE.MathUtils.damp(grp.position.y, targetLift, 8, dt);
    }
  });

  const maxAbs = Math.max(
    1,
    ...mat.flatMap((row) => row.map((v) => Math.abs(v))),
  );

  return (
    <group>
      <gridHelper args={[14, 14, '#CBD5E1', '#E2E8F0']} position={[0, 0, 0]} />

      {/* Spatial Augmented Matrix [A | b] */}
      {mat.map((row, r) => (
        <group
          key={r}
          ref={(el) => {
            rowRefs.current[r] = el;
          }}
          position={[0, 0, (r - (size - 1) / 2) * 1.45]}
        >
          {row.map((val, c) => {
            const x = (c - (cols - 1) / 2) * 1.55 + (c === size ? 0.45 : 0);
            const normMag = Math.min(1, Math.abs(val) / maxAbs);
            const h = 0.25 + normMag * 1.65;

            const isPivot = r === step.pivotRow && c === step.pivotCol;
            const isTarget = r === step.targetRow;
            const isRhs = c === size;
            const isZeroed = Math.abs(val) < 1e-10;

            let color = '#CBD5E1';
            if (isPivot) color = '#2563EB';
            else if (isTarget && step.kind === 'eliminate') color = '#06B6D4';
            else if (isRhs) color = '#10B981';
            else if (!isZeroed) color = '#E2E8F0';

            return (
              <group key={c} position={[x, 0, 0]}>
                <mesh position={[0, h / 2, 0]} castShadow>
                  <boxGeometry args={[1.1, h, 1.0]} />
                  <meshStandardMaterial color={color} roughness={0.4} metalness={0.12} />
                </mesh>
                <Html position={[0, h + 0.25, 0]} center zIndexRange={[10, 0]}>
                  <div
                    className={`rounded border px-1.5 py-0.5 font-mono text-[10px] tabular-nums whitespace-nowrap ${
                      isPivot
                        ? 'border-[#2563EB] bg-[#2563EB] text-white font-semibold'
                        : 'border-[#E2E8F0] bg-[#FFFFFF]/95 text-[#0F172A]'
                    }`}
                  >
                    {val.toFixed(Math.min(2, precision))}
                  </div>
                </Html>
              </group>
            );
          })}
        </group>
      ))}

      {/* Geometric Solution Vector Arrow when 3D system is solved */}
      {size === 3 && solution.length === 3 && step.kind === 'complete' ? (
        <group position={[4.8, 0.2, 0]}>
          <Html position={[0, 2.3, 0]} center zIndexRange={[10, 0]}>
            <div className="rounded border border-[#10B981] bg-[#FFFFFF] px-2 py-1 font-mono text-[10px] font-semibold text-[#0F172A] whitespace-nowrap">
              x = [{solution.map((v) => v.toFixed(2)).join(', ')}]
            </div>
          </Html>
          <mesh position={[0, 1.0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 2.0, 12]} />
            <meshStandardMaterial color="#10B981" />
          </mesh>
          <mesh position={[0, 2.05, 0]}>
            <coneGeometry args={[0.16, 0.35, 16]} />
            <meshStandardMaterial color="#10B981" />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}
