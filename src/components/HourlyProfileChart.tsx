import { useMemo } from 'react';
import type { DispatchResult } from '../types/grid';

interface HourlyProfileChartProps {
  dispatches: DispatchResult[];
  activeHour: number;
  onSelectHour: (hour: number) => void;
  height?: number;
}

export function HourlyProfileChart({
  dispatches,
  activeHour,
  onSelectHour,
  height = 220,
}: HourlyProfileChartProps) {
  const width = 760;
  const padLeft = 48;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const { maxY, demandPath, renewableArea, renewableLine, dispatchableLine, ticksY } =
    useMemo(() => {
      const peakVal = Math.max(
        500,
        ...dispatches.map((d) => Math.max(d.totalDemandMW, d.totalAvailableGenerationMW)),
      );
      const roundedMax = Math.ceil(peakVal / 100) * 100;

      const xFor = (hr: number) => padLeft + (hr / 23) * plotW;
      const yFor = (val: number) => padTop + plotH - (val / roundedMax) * plotH;

      const dPts = dispatches.map((d) => `${xFor(d.hour).toFixed(1)},${yFor(d.totalDemandMW).toFixed(1)}`);
      const rPts = dispatches.map(
        (d) => `${xFor(d.hour).toFixed(1)},${yFor(d.renewableGenerationMW).toFixed(1)}`,
      );
      const gPts = dispatches.map(
        (d) => `${xFor(d.hour).toFixed(1)},${yFor(d.totalDispatchedGenerationMW).toFixed(1)}`,
      );

      const area = `M ${xFor(0).toFixed(1)},${(padTop + plotH).toFixed(1)} L ${rPts.join(' L ')} L ${xFor(23).toFixed(1)},${(padTop + plotH).toFixed(1)} Z`;

      return {
        maxY: roundedMax,
        demandPath: `M ${dPts.join(' L ')}`,
        renewableArea: area,
        renewableLine: `M ${rPts.join(' L ')}`,
        dispatchableLine: `M ${gPts.join(' L ')}`,
        ticksY: [0, roundedMax * 0.25, roundedMax * 0.5, roundedMax * 0.75, roundedMax],
      };
    }, [dispatches, plotW, plotH]);

  const activePoint = dispatches[activeHour] ?? dispatches[0];
  const activeX = padLeft + (activeHour / 23) * plotW;
  const activeY = padTop + plotH - (activePoint.totalDemandMW / maxY) * plotH;

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-4 text-xs text-[#64748B]">
        <div className="flex flex-wrap items-center gap-5">
          <span className="inline-flex items-center gap-1.5 font-medium text-[#0F172A]">
            <span className="h-0.5 w-4 bg-[#2563EB]" />
            Demand (MW)
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[#0F172A]">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#10B981]/25 border border-[#10B981]" />
            Renewable Gen (MW)
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[#0F172A]">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-[#06B6D4]" />
            Total Dispatched (MW)
          </span>
        </div>
        <span className="font-mono-tabular text-[#0F172A]">
          Selected: {activePoint.timestampLabel} · {activePoint.totalDemandMW.toFixed(1)} MW demand ·{' '}
          {activePoint.renewableGenerationMW.toFixed(1)} MW RE
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full select-none overflow-visible"
        role="img"
        aria-label="24-hour demand and generation profile in MW"
      >
        {/* Horizontal grid lines */}
        {ticksY.map((tick) => {
          const y = padTop + plotH - (tick / maxY) * plotH;
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth={1}
              />
              <text
                x={padLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-[#64748B] font-mono text-[10px]"
              >
                {Math.round(tick)}
              </text>
            </g>
          );
        })}

        {/* Renewable area + curve */}
        <path d={renewableArea} fill="#10B981" fillOpacity={0.14} />
        <path d={renewableLine} fill="none" stroke="#10B981" strokeWidth={2} />

        {/* Total dispatched line */}
        <path
          d={dispatchableLine}
          fill="none"
          stroke="#06B6D4"
          strokeWidth={1.8}
          strokeDasharray="5 4"
        />

        {/* Demand curve */}
        <path d={demandPath} fill="none" stroke="#2563EB" strokeWidth={2.5} />

        {/* Active hour vertical cursor */}
        <line
          x1={activeX}
          y1={padTop}
          x2={activeX}
          y2={padTop + plotH}
          stroke="#2563EB"
          strokeWidth={1.25}
          strokeDasharray="3 3"
        />
        <circle cx={activeX} cy={activeY} r={4.5} fill="#2563EB" stroke="#FFFFFF" strokeWidth={2} />

        {/* Clickable & keyboard-accessible hour columns */}
        {dispatches.map((d) => {
          const colW = plotW / 24;
          const cx = padLeft + (d.hour / 23) * plotW - colW / 2;
          return (
            <rect
              key={d.hour}
              x={cx}
              y={padTop}
              width={colW}
              height={plotH}
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-pressed={d.hour === activeHour}
              aria-label={`Select ${d.timestampLabel}: Demand ${d.totalDemandMW.toFixed(1)} MW, Renewable ${d.renewableGenerationMW.toFixed(1)} MW`}
              className="cursor-pointer focus:outline-none"
              onClick={() => onSelectHour(d.hour)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectHour(d.hour);
                }
              }}
            >
              <title>
                {d.timestampLabel}: Demand {d.totalDemandMW} MW, RE {d.renewableGenerationMW} MW
              </title>
            </rect>
          );
        })}

        {/* X-axis hour ticks */}
        {[0, 3, 6, 9, 12, 15, 18, 21, 23].map((hr) => {
          const x = padLeft + (hr / 23) * plotW;
          return (
            <text
              key={hr}
              x={x}
              y={height - 8}
              textAnchor="middle"
              className="fill-[#64748B] font-mono text-[10px]"
            >
              {hr.toString().padStart(2, '0')}:00
            </text>
          );
        })}
      </svg>
    </div>
  );
}
