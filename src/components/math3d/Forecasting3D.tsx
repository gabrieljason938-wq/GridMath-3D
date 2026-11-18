import { useEffect, useMemo, useState } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { NumericalForecastEngineResult } from '../../forecasting/numericalForecaster';

interface Forecasting3DProps {
  mode: 'forecast24' | 'holdout';
  result: NumericalForecastEngineResult;
  selectedHourIndex: number;
  onSelectHourIndex: (idx: number) => void;
  showSurface: boolean;
  showIntervalBand: boolean;
  showNaive: boolean;
  showResiduals: boolean;
}

export function Forecasting3D({
  mode,
  result,
  selectedHourIndex,
  onSelectHourIndex,
  showSurface,
  showIntervalBand,
  showNaive,
  showResiduals,
}: Forecasting3DProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const series = useMemo(() => {
    if (mode === 'holdout') {
      return result.holdoutComparison.map((row, idx) => ({
        idx,
        hour: row.hour,
        label: row.timestampLabel,
        tempC: row.temperatureDegC,
        primaryMW: row.fullModelMW,
        coreMW: row.coreModelMW,
        naiveMW: row.naiveBaselineMW,
        actualMW: row.actualMW as number | null,
        lowerMW: row.lower95MW,
        upperMW: row.upper95MW,
        residualMW: row.residualMW as number | null,
      }));
    }
    return result.next24h.map((row, idx) => ({
      idx,
      hour: row.hour,
      label: row.timestampLabel,
      tempC: row.temperatureDegC,
      primaryMW: row.fullModelMW,
      coreMW: row.coreModelMW,
      naiveMW: row.naiveBaselineMW,
      actualMW: null as number | null,
      lowerMW: row.lower95MW,
      upperMW: row.upper95MW,
      residualMW: null as number | null,
    }));
  }, [mode, result]);

  const bounds = useMemo(() => {
    const allMW = series.flatMap((s) =>
      [s.primaryMW, s.coreMW, s.naiveMW, s.upperMW, s.lowerMW, s.actualMW].filter(
        (v): v is number => v !== null,
      ),
    );
    const allT = series.map((s) => s.tempC);
    const minMW = Math.max(0, Math.floor((Math.min(100, ...allMW) - 20) / 25) * 25);
    const maxMW = Math.ceil((Math.max(400, ...allMW) + 25) / 25) * 25;
    const minT = Math.floor(Math.min(18, ...allT) - 2);
    const maxT = Math.ceil(Math.max(36, ...allT) + 2);
    return {
      count: Math.max(2, series.length),
      minMW,
      spanMW: Math.max(50, maxMW - minMW),
      maxMW,
      minT,
      spanT: Math.max(4, maxT - minT),
      maxT,
    };
  }, [series]);

  const toX = (idx: number) => (idx / Math.max(1, bounds.count - 1)) * 10.4 - 5.2;
  const toY = (mw: number) => ((mw - bounds.minMW) / bounds.spanMW) * 4.4 + 0.4;
  const toZ = (tempC: number) => ((tempC - bounds.minT) / bounds.spanT) * 5.2 - 2.6;

  // Translucent 3D OLS Regression Surface: D(h, T) = b0 + b1*T + b2*sin(2pi*h/24) + b3*cos(2pi*h/24)
  const surfaceGeometry = useMemo(() => {
    if (!showSurface || result.coreCoefficients.length < 4) return null;
    const [b0, b1, b2, b3] = result.coreCoefficients;
    const uSteps = 23; // 0..23 hours
    const vSteps = 10; // temperature slice steps
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const cool = new THREE.Color('#06B6D4');
    const mid = new THREE.Color('#2563EB');
    const hot = new THREE.Color('#F59E0B');

    for (let u = 0; u <= uSteps; u++) {
      const hour = (u / uSteps) * 23;
      const x = (u / uSteps) * 10.4 - 5.2;
      const sinH = Math.sin((2 * Math.PI * hour) / 24);
      const cosH = Math.cos((2 * Math.PI * hour) / 24);

      for (let v = 0; v <= vSteps; v++) {
        const tFrac = v / vSteps;
        const tempC = bounds.minT + tFrac * bounds.spanT;
        const z = toZ(tempC);
        const mw = Math.max(bounds.minMW, b0 + b1 * tempC + b2 * sinH + b3 * cosH);
        const y = toY(mw);
        positions.push(x, y, z);

        const c =
          tFrac < 0.5
            ? cool.clone().lerp(mid, tFrac * 2)
            : mid.clone().lerp(hot, (tFrac - 0.5) * 2);
        colors.push(c.r, c.g, c.b);
      }
    }

    const rowStride = vSteps + 1;
    for (let u = 0; u < uSteps; u++) {
      for (let v = 0; v < vSteps; v++) {
        const a = u * rowStride + v;
        const b = (u + 1) * rowStride + v;
        const c = (u + 1) * rowStride + (v + 1);
        const d = u * rowStride + (v + 1);
        indices.push(a, b, d, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [showSurface, result.coreCoefficients, bounds]);

  // 95% Statistically Justified Prediction Interval Ribbon
  const piRibbonGeometry = useMemo(() => {
    if (!showIntervalBand || series.length < 2) return null;
    const positions: number[] = [];
    const indices: number[] = [];

    series.forEach((pt, idx) => {
      const x = toX(idx);
      const z = toZ(pt.tempC);
      positions.push(x, toY(pt.lowerMW), z);
      positions.push(x, toY(pt.upperMW), z);
    });

    for (let i = 0; i < series.length - 1; i++) {
      const l0 = i * 2;
      const u0 = i * 2 + 1;
      const l1 = (i + 1) * 2;
      const u1 = (i + 1) * 2 + 1;
      indices.push(l0, l1, u0, u0, l1, u1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [showIntervalBand, series, bounds]);

  useEffect(() => {
    return () => {
      surfaceGeometry?.dispose();
      piRibbonGeometry?.dispose();
    };
  }, [surfaceGeometry, piRibbonGeometry]);

  const primaryLine = useMemo<[number, number, number][]>(
    () => series.map((s, i) => [toX(i), toY(s.primaryMW), toZ(s.tempC)]),
    [series, bounds],
  );
  const coreLine = useMemo<[number, number, number][]>(
    () => series.map((s, i) => [toX(i), toY(s.coreMW), toZ(s.tempC)]),
    [series, bounds],
  );
  const naiveLine = useMemo<[number, number, number][]>(
    () => series.map((s, i) => [toX(i), toY(s.naiveMW), toZ(s.tempC)]),
    [series, bounds],
  );
  const actualLine = useMemo<[number, number, number][]>(
    () =>
      series
        .filter((s) => s.actualMW !== null)
        .map((s) => [toX(s.idx), toY(s.actualMW!), toZ(s.tempC)]),
    [series, bounds],
  );

  const activeIdx = Math.min(Math.max(0, hoveredIdx ?? selectedHourIndex), series.length - 1);
  const activePt = series[activeIdx];

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    mw: Math.round(bounds.minMW + frac * bounds.spanMW),
    y: frac * 4.4 + 0.4,
  }));

  return (
    <group>
      {/* Coordinate Floor Grid */}
      <gridHelper args={[12, 12, '#CBD5E1', '#E2E8F0']} position={[0, 0, 0]} />

      {/* Explicit 3D Coordinate Axes: X (Time), Y (Demand MW), Z (Temp °C) */}
      <Line points={[[-5.4, 0.02, 2.9], [5.4, 0.02, 2.9]]} color="#64748B" lineWidth={1.5} />
      <Line points={[[-5.4, 0.02, -2.9], [-5.4, 5.0, -2.9]]} color="#64748B" lineWidth={1.5} />
      <Line points={[[-5.4, 0.02, -2.9], [-5.4, 0.02, 2.9]]} color="#64748B" lineWidth={1.5} />

      {/* Y-axis MW elevation ticks */}
      {yTicks.map((tick) => (
        <group key={tick.mw}>
          <Line
            points={[
              [-5.4, tick.y, -2.9],
              [5.4, tick.y, -2.9],
            ]}
            color="#E2E8F0"
            lineWidth={1}
          />
          <Html position={[-5.95, tick.y, -2.9]} center zIndexRange={[8, 0]}>
            <span className="font-mono text-[10px] text-[#64748B] whitespace-nowrap">
              {tick.mw} MW
            </span>
          </Html>
        </group>
      ))}

      {/* Axis Unit Labels */}
      <Html position={[0, 0.05, 3.4]} center zIndexRange={[8, 0]}>
        <span className="rounded bg-[#FFFFFF]/90 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#0F172A] whitespace-nowrap">
          Time Horizon (h)
        </span>
      </Html>
      <Html position={[-6.0, 2.6, 0]} center zIndexRange={[8, 0]}>
        <span className="rounded bg-[#FFFFFF]/90 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#0F172A] whitespace-nowrap">
          Temp ({bounds.minT}–{bounds.maxT} °C)
        </span>
      </Html>

      {/* 3D Thermal x Diurnal Regression Surface */}
      {surfaceGeometry ? (
        <mesh geometry={surfaceGeometry}>
          <meshStandardMaterial
            vertexColors
            transparent
            opacity={0.32}
            roughness={0.45}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}

      {/* 95% Prediction Interval Band */}
      {piRibbonGeometry ? (
        <mesh geometry={piRibbonGeometry}>
          <meshStandardMaterial
            color="#2563EB"
            transparent
            opacity={0.22}
            roughness={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}

      {/* Model Comparison Curves */}
      {primaryLine.length > 1 ? (
        <Line points={primaryLine} color="#2563EB" lineWidth={3} />
      ) : null}
      {coreLine.length > 1 ? (
        <Line points={coreLine} color="#10B981" lineWidth={1.8} />
      ) : null}
      {showNaive && naiveLine.length > 1 ? (
        <Line
          points={naiveLine}
          color="#D97706"
          lineWidth={1.6}
          dashed
          dashSize={0.18}
          gapSize={0.1}
        />
      ) : null}
      {mode === 'holdout' && actualLine.length > 1 ? (
        <Line points={actualLine} color="#0F172A" lineWidth={2.4} />
      ) : null}

      {/* Residual Bars (Holdout Mode) */}
      {mode === 'holdout' && showResiduals
        ? series.map((s) => {
            if (s.actualMW === null) return null;
            const x = toX(s.idx);
            const z = toZ(s.tempC);
            const isSmall = Math.abs(s.residualMW ?? 0) <= 12;
            return (
              <Line
                key={`res-${s.idx}`}
                points={[
                  [x, toY(s.actualMW), z],
                  [x, toY(s.primaryMW), z],
                ]}
                color={isSmall ? '#10B981' : '#E11D48'}
                lineWidth={2.2}
              />
            );
          })
        : null}

      {/* Interactive Hoverable & Selectable Hourly Points */}
      {series.map((s) => {
        const x = toX(s.idx);
        const y = toY(s.primaryMW);
        const z = toZ(s.tempC);
        const isSelected = s.idx === selectedHourIndex;
        const isHovered = s.idx === hoveredIdx;
        return (
          <group key={s.idx}>
            <mesh
              position={[x, y, z]}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
                setHoveredIdx(s.idx);
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'default';
                setHoveredIdx(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectHourIndex(s.idx);
              }}
            >
              <sphereGeometry args={[isSelected || isHovered ? 0.14 : 0.085, 14, 14]} />
              <meshStandardMaterial
                color={isSelected ? '#2563EB' : isHovered ? '#06B6D4' : '#1D4ED8'}
              />
            </mesh>
            {s.actualMW !== null ? (
              <mesh position={[x, toY(s.actualMW), z]}>
                <boxGeometry args={[0.1, 0.1, 0.1]} />
                <meshStandardMaterial color="#0F172A" />
              </mesh>
            ) : null}
          </group>
        );
      })}

      {/* Floating Inspection Readout for Selected / Hovered Hour */}
      {activePt ? (
        <Html
          position={[toX(activePt.idx), toY(activePt.primaryMW) + 0.45, toZ(activePt.tempC)]}
          center
          zIndexRange={[12, 0]}
        >
          <div className="rounded-lg border border-[#2563EB] bg-[#FFFFFF] px-2.5 py-1.5 font-mono text-[10px] text-[#0F172A] shadow-sm whitespace-nowrap">
            <div className="font-semibold text-[#2563EB]">
              {activePt.label} · {activePt.tempC.toFixed(1)} °C
            </div>
            <div>
              Forecast: <span className="font-semibold">{activePt.primaryMW.toFixed(1)} MW</span>
            </div>
            {activePt.actualMW !== null ? (
              <div>
                Actual: {activePt.actualMW.toFixed(1)} MW (e={activePt.residualMW?.toFixed(1)})
              </div>
            ) : (
              <div className="text-[#64748B]">
                95% PI: [{activePt.lowerMW.toFixed(0)}, {activePt.upperMW.toFixed(0)}] MW
              </div>
            )}
          </div>
        </Html>
      ) : null}
    </group>
  );
}
