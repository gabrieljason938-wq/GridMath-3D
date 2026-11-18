import { useEffect, useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import type { LPResult, LinearProgramSpec, SimplexStep } from '../../math/linearProgramming';

interface LinearProgramming3DProps {
  spec: LinearProgramSpec;
  result: LPResult;
  activeStepIndex: number;
  precision: number;
}

export function LinearProgramming3D({
  spec,
  result,
  activeStepIndex,
  precision,
}: LinearProgramming3DProps) {
  const dim = spec.objectiveCoeffs.length;
  const { feasibleVertices, steps, optimalPoint, optimalValue, feasible } = result;

  // Normalization scale so MW/decision values fit cleanly on the 8x8x6 coordinate stage
  const scale = useMemo(() => {
    const allCoords = [
      ...feasibleVertices.flat(),
      ...optimalPoint,
      ...steps.flatMap((s) => s.vertex),
    ];
    const maxCoord = Math.max(10, ...allCoords.map((v) => Math.abs(v)));
    return 6.5 / maxCoord;
  }, [feasibleVertices, optimalPoint, steps]);

  const toScene = (pt: number[]): [number, number, number] => {
    if (dim === 2) {
      const zObj = spec.objectiveCoeffs[0] * pt[0] + spec.objectiveCoeffs[1] * pt[1];
      const maxObj = Math.max(1, Math.abs(optimalValue) * 1.2);
      const y = (zObj / maxObj) * 3.8 + 0.15;
      return [pt[0] * scale - 2.5, y, pt[1] * scale - 2.5];
    }
    return [pt[0] * scale - 2.2, pt[2] * scale + 0.2, pt[1] * scale - 2.2];
  };

  // 2D Feasible Polygon Geometry on Base Plane (y = 0.05)
  const polygon2DGeo = useMemo(() => {
    if (dim !== 2 || feasibleVertices.length < 3) return null;
    const shape = new THREE.Shape();
    feasibleVertices.forEach((v, idx) => {
      const x = v[0] * scale - 2.5;
      const y = -(v[1] * scale - 2.5); // rotated onto XZ plane below
      if (idx === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [dim, feasibleVertices, scale]);

  // 3D Feasible Polyhedron Geometry via ConvexGeometry
  const polyhedron3DGeo = useMemo(() => {
    if (dim !== 3 || feasibleVertices.length < 4) return null;
    const vecs = feasibleVertices.map((v) => new THREE.Vector3(...toScene(v)));
    try {
      return new ConvexGeometry(vecs);
    } catch {
      return null;
    }
  }, [dim, feasibleVertices, scale]);

  useEffect(() => {
    return () => {
      polygon2DGeo?.dispose();
      polyhedron3DGeo?.dispose();
    };
  }, [polygon2DGeo, polyhedron3DGeo]);

  // Cost Objective Plane c^T x = optimalValue
  const objectivePlaneGeo = useMemo(() => {
    if (!feasible || dim !== 2) return null;
    const maxVal = Math.max(1, Math.abs(optimalValue) * 1.2);
    const h = (optimalValue / maxVal) * 3.8 + 0.15;
    const geo = new THREE.PlaneGeometry(7.2, 7.2);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0.5, h, 0.5);
    return geo;
  }, [feasible, dim, optimalValue]);

  useEffect(() => {
    return () => {
      objectivePlaneGeo?.dispose();
    };
  }, [objectivePlaneGeo]);

  const clampedStep = Math.min(Math.max(0, activeStepIndex), Math.max(0, steps.length - 1));
  const currentStep: SimplexStep | undefined = steps[clampedStep];

  const pathPoints = useMemo(() => {
    return steps.slice(0, clampedStep + 1).map((s) => toScene(s.vertex));
  }, [steps, clampedStep, scale, dim]);

  const activePos = currentStep ? toScene(currentStep.vertex) : [0, 0, 0] as [number, number, number];
  const optPos = toScene(optimalPoint);

  return (
    <group>
      <gridHelper args={[14, 14, '#CBD5E1', '#E2E8F0']} position={[0, 0, 0]} />

      {/* 2D Feasible Polygon on XZ Ground Plane */}
      {dim === 2 && polygon2DGeo ? (
        <group>
          <mesh geometry={polygon2DGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
            <meshStandardMaterial color="#06B6D4" transparent opacity={0.32} side={THREE.DoubleSide} />
          </mesh>
          <Line
            points={[
              ...feasibleVertices.map((v) => [v[0] * scale - 2.5, 0.06, v[1] * scale - 2.5] as [number, number, number]),
              [
                feasibleVertices[0][0] * scale - 2.5,
                0.06,
                feasibleVertices[0][1] * scale - 2.5,
              ],
            ]}
            color="#06B6D4"
            lineWidth={2}
          />
        </group>
      ) : null}

      {/* 2D Optimal Cost Objective Plane */}
      {dim === 2 && objectivePlaneGeo ? (
        <mesh geometry={objectivePlaneGeo}>
          <meshStandardMaterial color="#2563EB" transparent opacity={0.14} side={THREE.DoubleSide} />
        </mesh>
      ) : null}

      {/* 3D Feasible Polyhedron */}
      {dim === 3 && polyhedron3DGeo ? (
        <group>
          <mesh geometry={polyhedron3DGeo}>
            <meshStandardMaterial
              color="#06B6D4"
              transparent
              opacity={0.28}
              roughness={0.35}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh geometry={polyhedron3DGeo}>
            <meshBasicMaterial color="#06B6D4" wireframe transparent opacity={0.55} />
          </mesh>
        </group>
      ) : null}

      {/* Simplex Vertex Traversal Path */}
      {pathPoints.length > 1 ? <Line points={pathPoints} color="#2563EB" lineWidth={2.5} /> : null}

      {/* Current Simplex Vertex Marker */}
      {feasible && currentStep ? (
        <group position={activePos}>
          <mesh>
            <sphereGeometry args={[0.18, 18, 18]} />
            <meshStandardMaterial color="#2563EB" />
          </mesh>
          <Html position={[0, 0.42, 0]} center zIndexRange={[10, 0]}>
            <div className="rounded border border-[#2563EB] bg-[#FFFFFF] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#0F172A] shadow-xs whitespace-nowrap">
              Iter {currentStep.iteration}: ({currentStep.vertex.map((v) => v.toFixed(1)).join(', ')}) · Z={currentStep.objectiveValue.toFixed(precision)}
            </div>
          </Html>
        </group>
      ) : null}

      {/* Optimal Vertex Beacon */}
      {feasible ? (
        <mesh position={optPos}>
          <octahedronGeometry args={[0.21, 0]} />
          <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.25} />
        </mesh>
      ) : null}
    </group>
  );
}
