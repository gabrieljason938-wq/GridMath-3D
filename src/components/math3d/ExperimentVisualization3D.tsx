import { useEffect, useMemo, useState } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { ExperimentPlot3DData } from '../../experiments/scientificExperiments';

interface ExperimentVisualization3DProps {
  plot: ExperimentPlot3DData;
}

function CoordinateFrame({
  xLabel,
  yLabel,
  zLabel,
}: {
  xLabel: string;
  yLabel: string;
  zLabel: string;
}) {
  return (
    <group>
      {/* Clean Architectural Base Grid */}
      <gridHelper args={[12, 12, '#CBD5E1', '#E2E8F0']} position={[0, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]} receiveShadow>
        <planeGeometry args={[12.4, 8.6]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.95} metalness={0.0} />
      </mesh>

      {/* Primary Orthogonal Axes */}
      <Line
        points={[
          [-5.4, 0.02, 3.2],
          [5.6, 0.02, 3.2],
        ]}
        color="#2563EB"
        lineWidth={1.6}
      />
      <Line
        points={[
          [-5.4, 0.02, 3.2],
          [-5.4, 4.9, 3.2],
        ]}
        color="#0F172A"
        lineWidth={1.6}
      />
      <Line
        points={[
          [-5.4, 0.02, 3.2],
          [-5.4, 0.02, -3.2],
        ]}
        color="#06B6D4"
        lineWidth={1.6}
      />

      {/* Explicit Axis Labels with Engineering Units */}
      <Html position={[5.6, 0.25, 3.45]} center distanceFactor={14}>
        <div className="pointer-events-none rounded border border-[#E2E8F0] bg-[#FFFFFF]/95 px-2 py-0.5 text-[10px] font-semibold text-[#2563EB] whitespace-nowrap">
          X: {xLabel}
        </div>
      </Html>
      <Html position={[-5.4, 5.15, 3.2]} center distanceFactor={14}>
        <div className="pointer-events-none rounded border border-[#E2E8F0] bg-[#FFFFFF]/95 px-2 py-0.5 text-[10px] font-semibold text-[#0F172A] whitespace-nowrap">
          Y: {yLabel}
        </div>
      </Html>
      <Html position={[-5.4, 0.25, -3.45]} center distanceFactor={14}>
        <div className="pointer-events-none rounded border border-[#E2E8F0] bg-[#FFFFFF]/95 px-2 py-0.5 text-[10px] font-semibold text-[#0891B2] whitespace-nowrap">
          Z: {zLabel}
        </div>
      </Html>
    </group>
  );
}

function ResidualLandscapeScene({
  plot,
}: {
  plot: Extract<ExperimentPlot3DData, { kind: 'residual-landscape' }>;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const bounds = useMemo(() => {
    const temps = plot.points.map((p) => p.tempDegC);
    const maxAbsRes = Math.max(8, ...plot.points.map((p) => Math.abs(p.residualMW)));
    const minT = Math.floor(Math.min(18, ...temps) - 1);
    const maxT = Math.ceil(Math.max(36, ...temps) + 1);
    return {
      minT,
      spanT: Math.max(4, maxT - minT),
      maxAbsRes,
    };
  }, [plot.points]);

  const zeroY = 2.4;
  const toX = (hour: number) => (hour / 23) * 9.8 - 4.9;
  const toY = (resMW: number) => zeroY + (resMW / bounds.maxAbsRes) * 1.95;
  const toZ = (tempC: number) => ((tempC - bounds.minT) / bounds.spanT) * 5.2 - 2.6;

  return (
    <group>
      {/* Zero-Residual Reference Plane e = 0 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, zeroY, 0]}>
        <planeGeometry args={[10.4, 5.8]} />
        <meshStandardMaterial
          color="#DBEAFE"
          transparent
          opacity={0.38}
          roughness={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Html position={[5.2, zeroY + 0.12, -2.7]} center distanceFactor={15}>
        <div className="pointer-events-none rounded border border-[#2563EB]/30 bg-[#FFFFFF]/90 px-1.5 py-0.5 font-mono-tabular text-[9px] text-[#2563EB] whitespace-nowrap">
          e = 0 MW Plane
        </div>
      </Html>

      {plot.points.map((pt, idx) => {
        const x = toX(pt.hour);
        const y = toY(pt.residualMW);
        const z = toZ(pt.tempDegC);
        const absR = Math.abs(pt.residualMW);
        const color =
          absR <= 6 ? '#10B981' : absR <= 12 ? '#2563EB' : absR <= 18 ? '#D97706' : '#DC2626';
        const isHovered = hoveredIdx === idx;
        return (
          <group key={idx}>
            <Line
              points={[
                [x, zeroY, z],
                [x, y, z],
              ]}
              color={color}
              lineWidth={isHovered ? 2.6 : 1.5}
            />
            <mesh
              position={[x, y, z]}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredIdx(idx);
              }}
              onPointerOut={() => setHoveredIdx(null)}
            >
              <sphereGeometry args={[isHovered ? 0.14 : 0.095, 16, 16]} />
              <meshStandardMaterial color={color} roughness={0.35} />
            </mesh>
            {isHovered ? (
              <Html position={[x, y + 0.35, z]} center distanceFactor={13}>
                <div className="pointer-events-none rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-2 py-1 text-[10px] shadow-sm whitespace-nowrap">
                  <div className="font-semibold text-[#0F172A]">
                    Hour {pt.hour.toString().padStart(2, '0')}:00 · {pt.tempDegC.toFixed(1)}°C
                  </div>
                  <div className="font-mono-tabular text-[#2563EB]">
                    e = {pt.residualMW >= 0 ? '+' : ''}
                    {pt.residualMW.toFixed(2)} MW ({pt.actualMW.toFixed(1)} vs {pt.predMW.toFixed(1)})
                  </div>
                </div>
              </Html>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function ErrorSurfaceScene({
  plot,
}: {
  plot: Extract<ExperimentPlot3DData, { kind: 'error-surface' }>;
}) {
  const rows = plot.grid.length;
  const cols = plot.xCategories.length;

  const { minLog, maxLog } = useMemo(() => {
    const vals = plot.grid.flat().map((c) => c.log10Err);
    return {
      minLog: Math.min(...vals, -12),
      maxLog: Math.max(...vals, 0),
    };
  }, [plot.grid]);

  const spanLog = Math.max(1, maxLog - minLog);
  const toX = (cIdx: number) => (cols <= 1 ? 0 : (cIdx / (cols - 1)) * 8.6 - 4.3);
  const toZ = (rIdx: number) => (rows <= 1 ? 0 : (rIdx / (rows - 1)) * 3.6 - 1.8);
  const toY = (logVal: number) => ((logVal - minLog) / spanLog) * 3.8 + 0.35;

  const surfaceGeom = useMemo(() => {
    if (rows < 2 || cols < 2) return null;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const lowCol = new THREE.Color('#10B981');
    const midCol = new THREE.Color('#2563EB');
    const highCol = new THREE.Color('#DC2626');

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = plot.grid[r][c];
        const x = toX(c);
        const y = toY(cell.log10Err);
        const z = toZ(r);
        positions.push(x, y, z);

        const t = Math.max(0, Math.min(1, (cell.log10Err - minLog) / spanLog));
        const col = t < 0.5 ? lowCol.clone().lerp(midCol, t * 2) : midCol.clone().lerp(highCol, (t - 0.5) * 2);
        colors.push(col.r, col.g, col.b);
      }
    }

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = a + 1;
        const d = (r + 1) * cols + c;
        const e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [plot.grid, rows, cols, minLog, spanLog]);

  useEffect(() => {
    return () => {
      surfaceGeom?.dispose();
    };
  }, [surfaceGeom]);

  return (
    <group>
      {surfaceGeom ? (
        <mesh geometry={surfaceGeom}>
          <meshStandardMaterial
            vertexColors
            transparent
            opacity={0.55}
            roughness={0.55}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}

      {/* Columns & Value Nodes */}
      {plot.grid.map((row, rIdx) =>
        row.map((cell, cIdx) => {
          const x = toX(cIdx);
          const y = toY(cell.log10Err);
          const z = toZ(rIdx);
          const barColor = rIdx === 0 ? '#2563EB' : '#10B981';
          const barTint = cell.log10Err > -3 ? '#DC2626' : barColor;
          return (
            <group key={`${rIdx}-${cIdx}`}>
              <mesh position={[x, y / 2, z]}>
                <boxGeometry args={[0.38, Math.max(0.08, y), 0.38]} />
                <meshStandardMaterial color={barTint} roughness={0.4} metalness={0.05} />
              </mesh>
              <Html position={[x, y + 0.25, z]} center distanceFactor={16}>
                <div className="pointer-events-none rounded border border-[#E2E8F0] bg-[#FFFFFF]/95 px-1.5 py-0.5 font-mono-tabular text-[9px] text-[#0F172A] whitespace-nowrap">
                  {cell.rawErr < 1e-12 ? '0' : cell.rawErr.toExponential(1)}
                </div>
              </Html>
            </group>
          );
        }),
      )}

      {/* Category Labels */}
      {plot.xCategories.map((cat, idx) => (
        <Html key={cat} position={[toX(idx), 0.1, 2.75]} center distanceFactor={16}>
          <div className="pointer-events-none font-mono-tabular text-[10px] font-medium text-[#475569] whitespace-nowrap">
            {cat}
          </div>
        </Html>
      ))}
      {plot.zCategories.map((cat, idx) => (
        <Html key={cat} position={[-4.95, 0.2, toZ(idx)]} center distanceFactor={15}>
          <div className="pointer-events-none rounded border border-[#E2E8F0] bg-[#FFFFFF]/95 px-1.5 py-0.5 text-[10px] font-semibold text-[#0F172A] whitespace-nowrap">
            {cat}
          </div>
        </Html>
      ))}
    </group>
  );
}

function GenerationVsTimeScene({
  plot,
}: {
  plot: Extract<ExperimentPlot3DData, { kind: 'generation-vs-time' }>;
}) {
  const numStrat = plot.strategies.length;
  const maxMW = useMemo(() => {
    const all = [...plot.demandMW, ...plot.seriesMW.flat()];
    return Math.max(100, ...all) * 1.1;
  }, [plot]);

  const toX = (hour: number) => (hour / 23) * 9.6 - 4.8;
  const toY = (mw: number) => (mw / maxMW) * 4.1 + 0.15;
  const toZ = (sIdx: number) =>
    numStrat <= 1 ? 0 : (sIdx / (numStrat - 1)) * 4.4 - 2.2;

  const palette = ['#2563EB', '#10B981', '#D97706', '#DC2626'];

  return (
    <group>
      {plot.seriesMW.map((series, sIdx) => {
        const z = toZ(sIdx);
        const color = palette[sIdx % palette.length];
        const curvePts: [number, number, number][] = series.map((mw, h) => [
          toX(h),
          toY(mw),
          z,
        ]);
        const demandPts: [number, number, number][] = plot.demandMW.map((mw, h) => [
          toX(h),
          toY(mw),
          z,
        ]);
        return (
          <group key={plot.strategies[sIdx]}>
            <Line points={curvePts} color={color} lineWidth={2.5} />
            <Line points={demandPts} color="#64748B" lineWidth={1.1} dashed dashScale={4} />
            {series.map((mw, h) => (
              <mesh key={h} position={[toX(h), toY(mw) / 2, z]}>
                <boxGeometry args={[0.24, Math.max(0.05, toY(mw)), 0.34]} />
                <meshStandardMaterial color={color} transparent opacity={0.78} roughness={0.45} />
              </mesh>
            ))}
            <Html position={[-5.1, 0.25, z]} center distanceFactor={15}>
              <div className="pointer-events-none rounded border border-[#E2E8F0] bg-[#FFFFFF]/95 px-2 py-0.5 text-[10px] font-semibold text-[#0F172A] whitespace-nowrap">
                {plot.strategies[sIdx]}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function ParameterSurfaceScene({
  plot,
}: {
  plot: Extract<ExperimentPlot3DData, { kind: 'parameter-surface' }>;
}) {
  const rows = plot.zValues.length;
  const cols = plot.xValues.length;

  const { minY, maxY } = useMemo(() => {
    const flat = plot.yValues.flat();
    return {
      minY: Math.min(...flat) * 0.92,
      maxY: Math.max(...flat) * 1.05,
    };
  }, [plot.yValues]);

  const spanY = Math.max(0.2, maxY - minY);
  const toX = (c: number) => (cols <= 1 ? 0 : (c / (cols - 1)) * 8.4 - 4.2);
  const toZ = (r: number) => (rows <= 1 ? 0 : (r / (rows - 1)) * 4.4 - 2.2);
  const toY = (val: number) => ((val - minY) / spanY) * 3.6 + 0.45;

  const surfaceGeom = useMemo(() => {
    if (rows < 2 || cols < 2) return null;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const cLow = new THREE.Color('#10B981');
    const cMid = new THREE.Color('#2563EB');
    const cWarn = new THREE.Color('#DC2626');

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = plot.yValues[r][c];
        const shortage = plot.shortageFlags[r]?.[c] ?? false;
        positions.push(toX(c), toY(v), toZ(r));
        const t = Math.max(0, Math.min(1, (v - minY) / spanY));
        const col = shortage ? cWarn : cLow.clone().lerp(cMid, t);
        colors.push(col.r, col.g, col.b);
      }
    }

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = a + 1;
        const d = (r + 1) * cols + c;
        const e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [plot, rows, cols, minY, spanY]);

  useEffect(() => {
    return () => {
      surfaceGeom?.dispose();
    };
  }, [surfaceGeom]);

  return (
    <group>
      {surfaceGeom ? (
        <>
          <mesh geometry={surfaceGeom}>
            <meshStandardMaterial
              vertexColors
              transparent
              opacity={0.78}
              roughness={0.42}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh geometry={surfaceGeom} position={[0, 0.005, 0]}>
            <meshBasicMaterial color="#0F172A" wireframe transparent opacity={0.18} />
          </mesh>
        </>
      ) : null}

      {plot.yValues.map((row, r) =>
        row.map((val, c) => {
          const x = toX(c);
          const y = toY(val);
          const z = toZ(r);
          const isShortage = plot.shortageFlags[r]?.[c] ?? false;
          return (
            <group key={`${r}-${c}`}>
              <Line
                points={[
                  [x, 0.02, z],
                  [x, y, z],
                ]}
                color={isShortage ? '#DC2626' : '#94A3B8'}
                lineWidth={1}
              />
              <mesh position={[x, y, z]}>
                <sphereGeometry args={[isShortage ? 0.13 : 0.095, 16, 16]} />
                <meshStandardMaterial color={isShortage ? '#DC2626' : '#2563EB'} />
              </mesh>
              <Html position={[x, y + 0.24, z]} center distanceFactor={16}>
                <div
                  className={`pointer-events-none rounded border px-1.5 py-0.5 font-mono-tabular text-[9px] whitespace-nowrap ${
                    isShortage
                      ? 'border-rose-300 bg-rose-50 font-semibold text-rose-700'
                      : 'border-[#E2E8F0] bg-[#FFFFFF]/95 text-[#0F172A]'
                  }`}
                >
                  {val.toFixed(2)} {plot.valueUnit}
                </div>
              </Html>
            </group>
          );
        }),
      )}

      {plot.xValues.map((xv, c) => (
        <Html key={`x-${c}`} position={[toX(c), 0.1, 2.75]} center distanceFactor={16}>
          <div className="pointer-events-none font-mono-tabular text-[10px] font-medium text-[#475569]">
            {Math.round(xv * 100)}%
          </div>
        </Html>
      ))}
      {plot.zValues.map((zv, r) => (
        <Html key={`z-${r}`} position={[-4.8, 0.18, toZ(r)]} center distanceFactor={15}>
          <div className="pointer-events-none font-mono-tabular text-[10px] font-semibold text-[#0891B2] whitespace-nowrap">
            {zv}
          </div>
        </Html>
      ))}
    </group>
  );
}

export function ExperimentVisualization3D({ plot }: ExperimentVisualization3DProps) {
  return (
    <group>
      <CoordinateFrame xLabel={plot.xLabel} yLabel={plot.yLabel} zLabel={plot.zLabel} />
      {plot.kind === 'residual-landscape' ? <ResidualLandscapeScene plot={plot} /> : null}
      {plot.kind === 'error-surface' ? <ErrorSurfaceScene plot={plot} /> : null}
      {plot.kind === 'generation-vs-time' ? <GenerationVsTimeScene plot={plot} /> : null}
      {plot.kind === 'parameter-surface' ? <ParameterSurfaceScene plot={plot} /> : null}
    </group>
  );
}
