import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { RegressionObservation, RegressionResult } from '../../math/regression';

interface Regression3DProps {
  observations: RegressionObservation[];
  result: RegressionResult;
  selectedObsId: string | null;
  onSelectObs: (id: string) => void;
  precision: number;
}

export function Regression3D({
  observations,
  result,
  selectedObsId,
  onSelectObs,
  precision,
}: Regression3DProps) {
  const { predictorCount, coefficients, predictions, residuals } = result;

  const bounds = useMemo(() => {
    const x1s = observations.map((o) => o.x1);
    const x2s = observations.map((o) => o.x2 ?? 0);
    const ys = [...observations.map((o) => o.y), ...predictions];
    return {
      minX1: Math.min(...x1s),
      spanX1: Math.max(1e-6, Math.max(...x1s) - Math.min(...x1s)),
      minX2: Math.min(...x2s),
      spanX2: Math.max(1e-6, Math.max(...x2s) - Math.min(...x2s)),
      minY: Math.min(...ys),
      spanY: Math.max(1e-6, Math.max(...ys) - Math.min(...ys)),
    };
  }, [observations, predictions]);

  const toScene = (x1: number, x2: number, y: number): [number, number, number] => {
    const sx = ((x1 - bounds.minX1) / bounds.spanX1) * 7 - 3.5;
    const sy = ((y - bounds.minY) / bounds.spanY) * 4 + 0.6;
    const sz = predictorCount === 1 ? 0 : ((x2 - bounds.minX2) / bounds.spanX2) * 7 - 3.5;
    return [sx, sy, sz];
  };

  // Fitted 3D regression plane geometry for 2 predictors
  const planeGeometry = useMemo(() => {
    if (predictorCount !== 2 || coefficients.length < 3) return null;
    const [b0, b1, b2] = coefficients;
    const x1Min = bounds.minX1;
    const x1Max = bounds.minX1 + bounds.spanX1;
    const x2Min = bounds.minX2;
    const x2Max = bounds.minX2 + bounds.spanX2;

    const corners = [
      toScene(x1Min, x2Min, b0 + b1 * x1Min + b2 * x2Min),
      toScene(x1Max, x2Min, b0 + b1 * x1Max + b2 * x2Min),
      toScene(x1Max, x2Max, b0 + b1 * x1Max + b2 * x2Max),
      toScene(x1Min, x2Max, b0 + b1 * x1Min + b2 * x2Max),
    ];

    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      ...corners[0],
      ...corners[1],
      ...corners[2],
      ...corners[0],
      ...corners[2],
      ...corners[3],
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }, [predictorCount, coefficients, bounds]);

  // 1-predictor regression line endpoints on embedded plane (z = 0)
  const line1D = useMemo(() => {
    if (predictorCount !== 1 || coefficients.length < 2) return null;
    const [b0, b1] = coefficients;
    const xMin = bounds.minX1;
    const xMax = bounds.minX1 + bounds.spanX1;
    return [toScene(xMin, 0, b0 + b1 * xMin), toScene(xMax, 0, b0 + b1 * xMax)];
  }, [predictorCount, coefficients, bounds]);

  return (
    <group>
      <gridHelper args={[12, 12, '#CBD5E1', '#E2E8F0']} position={[0, 0, 0]} />

      {/* Embedded 2D Plane for 1-Predictor Mode */}
      {predictorCount === 1 ? (
        <group>
          <mesh position={[0, 2.6, -0.04]}>
            <planeGeometry args={[8.5, 5.2]} />
            <meshStandardMaterial color="#FFFFFF" transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
          {line1D ? <Line points={line1D} color="#2563EB" lineWidth={2.5} /> : null}
        </group>
      ) : null}

      {/* Fitted 3D Regression Plane for 2-Predictor Mode */}
      {predictorCount === 2 && planeGeometry ? (
        <mesh geometry={planeGeometry}>
          <meshStandardMaterial
            color="#2563EB"
            transparent
            opacity={0.28}
            roughness={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}

      {/* Observed Markers + Vertical Residual Line Segments */}
      {observations.map((obs, idx) => {
        const yHat = predictions[idx] ?? obs.y;
        const res = residuals[idx] ?? 0;
        const pObs = toScene(obs.x1, obs.x2 ?? 0, obs.y);
        const pFit = toScene(obs.x1, obs.x2 ?? 0, yHat);
        const isSelected = obs.id === selectedObsId;

        return (
          <group key={obs.id}>
            <Line
              points={[pObs, pFit]}
              color={Math.abs(res) > result.rmse ? '#D97706' : '#10B981'}
              lineWidth={isSelected ? 2.5 : 1.4}
            />
            <mesh
              position={pObs}
              onClick={(e) => {
                e.stopPropagation();
                onSelectObs(obs.id);
              }}
            >
              <sphereGeometry args={[isSelected ? 0.19 : 0.13, 16, 16]} />
              <meshStandardMaterial color={isSelected ? '#2563EB' : '#06B6D4'} roughness={0.25} />
            </mesh>
            {isSelected ? (
              <Html position={[pObs[0], pObs[1] + 0.35, pObs[2]]} center zIndexRange={[10, 0]}>
                <div className="rounded border border-[#2563EB] bg-[#2563EB] px-2 py-0.5 font-mono text-[10px] text-white whitespace-nowrap">
                  {obs.label}: y={obs.y.toFixed(1)}, e={res >= 0 ? '+' : ''}
                  {res.toFixed(precision)}
                </div>
              </Html>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}
