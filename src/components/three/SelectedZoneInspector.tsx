import { useMemo } from 'react';
import { Crosshair, X } from 'lucide-react';
import { CITY_NODE_CATALOG } from '../../data/syntheticMicrogrid';
import type { CityZoneId, DispatchResult, HourlyDemand } from '../../types/grid';
import { StatusBadge } from '../StatusBadge';
import { computeGridVisualTelemetry } from './powerFlowMath';

interface SelectedZoneInspectorProps {
  zoneId: CityZoneId;
  dispatch: DispatchResult;
  hourlyDemand: HourlyDemand;
  onClose: () => void;
  onFocusCamera?: () => void;
  variant?: 'side-panel' | 'inline';
}

interface TelemetryCell {
  label: string;
  value: string;
  accent?: boolean;
}

export function SelectedZoneInspector({
  zoneId,
  dispatch,
  hourlyDemand,
  onClose,
  onFocusCamera,
  variant = 'side-panel',
}: SelectedZoneInspectorProps) {
  const node = CITY_NODE_CATALOG.find((n) => n.id === zoneId);
  const telemetry = useMemo(
    () => computeGridVisualTelemetry(dispatch, hourlyDemand),
    [dispatch, hourlyDemand],
  );

  if (!node) return null;

  const solarUnit = dispatch.generatorSetpoints.find((g) => g.technology === 'solar');
  const windUnit = dispatch.generatorSetpoints.find((g) => g.technology === 'wind');
  const thermalUnits = dispatch.generatorSetpoints.filter(
    (g) => g.technology === 'gas' || g.technology === 'coal',
  );
  const thermalMW = thermalUnits.reduce((acc, g) => acc + g.dispatchedMW, 0);
  const thermalCost = thermalUnits.reduce((acc, g) => acc + g.hourlyCostInr, 0);
  const thermalEmissions = thermalUnits.reduce((acc, g) => acc + g.hourlyEmissionsKgCO2e, 0);

  const cells: TelemetryCell[] = [];

  if (zoneId === 'solar' && solarUnit) {
    cells.push(
      { label: 'Solar Output', value: `${solarUnit.dispatchedMW.toFixed(1)} MW`, accent: true },
      { label: 'Irradiance', value: `${hourlyDemand.solarIrradianceWm2} W/m²` },
      {
        label: 'Available Cap',
        value: `${solarUnit.availableMaxMW.toFixed(1)} MW (160 MW Max)`,
      },
      { label: 'Utilization', value: `${solarUnit.utilizationPercent.toFixed(1)}%` },
    );
  } else if (zoneId === 'wind' && windUnit) {
    cells.push(
      { label: 'Wind Output', value: `${windUnit.dispatchedMW.toFixed(1)} MW`, accent: true },
      { label: 'Capacity Factor', value: `${(hourlyDemand.windCapacityFactor * 100).toFixed(0)}%` },
      {
        label: 'Available Cap',
        value: `${windUnit.availableMaxMW.toFixed(1)} MW (95 MW Max)`,
      },
      { label: 'Utilization', value: `${windUnit.utilizationPercent.toFixed(1)}%` },
    );
  } else if (zoneId === 'thermal') {
    cells.push(
      { label: 'Thermal Dispatch', value: `${thermalMW.toFixed(1)} MW`, accent: true },
      { label: 'Rated Capacity', value: '290 MW (4 Towers)' },
      { label: 'Hourly Fuel Cost', value: `₹${thermalCost.toLocaleString('en-IN')}` },
      { label: 'Carbon Rate', value: `${Math.round(thermalEmissions).toLocaleString('en-IN')} kgCO₂e` },
    );
  } else if (zoneId === 'bess') {
    const mode =
      dispatch.batteryNetPowerMW > 0.5
        ? 'Discharging'
        : dispatch.batteryNetPowerMW < -0.5
          ? 'Charging'
          : 'Standby';
    cells.push(
      {
        label: 'State of Charge',
        value: `${dispatch.batterySocMWh.toFixed(1)} MWh (${dispatch.batterySocPercent.toFixed(0)}%)`,
        accent: true,
      },
      {
        label: 'Net Power',
        value: `${dispatch.batteryNetPowerMW >= 0 ? '+' : ''}${dispatch.batteryNetPowerMW.toFixed(1)} MW`,
      },
      { label: 'Dispatch Mode', value: mode },
      { label: 'Bank Rating', value: '45 MW / 180 MWh' },
    );
  } else if (zoneId === 'commercial') {
    const share = (hourlyDemand.commercialMW / Math.max(1, hourlyDemand.totalMW)) * 100;
    cells.push(
      { label: 'District Demand', value: `${hourlyDemand.commercialMW.toFixed(1)} MW`, accent: true },
      { label: 'Share of City Load', value: `${share.toFixed(1)}%` },
      { label: 'Total Bus Load', value: `${hourlyDemand.totalMW.toFixed(1)} MW` },
      { label: 'Tariff Tier', value: `₹${hourlyDemand.tariffInrPerMWh.toLocaleString('en-IN')}/MWh` },
    );
  } else if (zoneId === 'residential') {
    const share = (hourlyDemand.residentialMW / Math.max(1, hourlyDemand.totalMW)) * 100;
    cells.push(
      { label: 'District Demand', value: `${hourlyDemand.residentialMW.toFixed(1)} MW`, accent: true },
      { label: 'Share of City Load', value: `${share.toFixed(1)}%` },
      { label: 'Ambient Temp', value: `${hourlyDemand.temperatureDegC.toFixed(1)}°C` },
      { label: 'Tariff Tier', value: `₹${hourlyDemand.tariffInrPerMWh.toLocaleString('en-IN')}/MWh` },
    );
  } else if (zoneId === 'industrial') {
    const share = (hourlyDemand.industrialMW / Math.max(1, hourlyDemand.totalMW)) * 100;
    cells.push(
      { label: 'District Demand', value: `${hourlyDemand.industrialMW.toFixed(1)} MW`, accent: true },
      { label: 'Share of City Load', value: `${share.toFixed(1)}%` },
      { label: 'Total Bus Load', value: `${hourlyDemand.totalMW.toFixed(1)} MW` },
      { label: 'Process Feeders', value: '33 kV Dedicated' },
    );
  } else {
    cells.push(
      { label: 'Bus Demand', value: `${dispatch.totalDemandMW.toFixed(1)} MW`, accent: true },
      { label: 'Reserve Margin', value: `${dispatch.reserveMarginMW.toFixed(1)} MW` },
      {
        label: 'Renewable Share',
        value: `${dispatch.renewableContributionPercent.toFixed(1)}%`,
      },
      {
        label: 'Unserved Energy',
        value: `${dispatch.unservedEnergyMW.toFixed(1)} MW`,
      },
    );
  }

  const shortage = dispatch.unservedEnergyMW > 0.5 || dispatch.balanceStatus === 'Deficit';
  const connectedCorridors = telemetry.corridors.filter(
    (c) => c.fromZone === zoneId || c.toZone === zoneId,
  );

  if (variant === 'inline') {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
              <span>{node.category}</span>
              <span aria-hidden="true">·</span>
              <StatusBadge
                tone={shortage ? 'deficit' : 'nominal'}
                label={shortage ? 'Supply Shortage' : 'Nominal Feed'}
              />
            </div>
            <h4 className="mt-1 text-sm font-semibold text-[#0F172A]">{node.label}</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close object inspector"
            className="rounded p-1 text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{node.description}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#E2E8F0] pt-3 text-xs sm:grid-cols-4">
          {cells.map((cell) => (
            <div key={cell.label}>
              <span className="text-[#64748B]">{cell.label}</span>
              <p
                className={`mt-0.5 font-mono-tabular font-semibold ${
                  cell.accent ? 'text-[#2563EB]' : 'text-[#0F172A]'
                }`}
              >
                {cell.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <aside
      aria-label={`${node.label} Telemetry Inspector`}
      className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.12)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
            <span>{node.category}</span>
            <span aria-hidden="true">·</span>
            <StatusBadge
              tone={shortage ? 'deficit' : 'nominal'}
              label={shortage ? 'Supply Shortage' : 'Nominal Feed'}
            />
          </div>
          <h4 className="mt-1 text-sm font-semibold leading-snug text-[#0F172A]">{node.label}</h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close object inspector"
          className="shrink-0 rounded-md p-1 text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-[#64748B]">{node.description}</p>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-[#E2E8F0] pt-3 text-xs">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0">
            <span className="block truncate text-[11px] text-[#64748B]">{cell.label}</span>
            <p
              className={`mt-0.5 truncate font-mono-tabular text-xs font-semibold ${
                cell.accent ? 'text-[#2563EB]' : 'text-[#0F172A]'
              }`}
            >
              {cell.value}
            </p>
          </div>
        ))}
      </div>

      {connectedCorridors.length > 0 ? (
        <div className="mt-3 border-t border-[#E2E8F0] pt-3">
          <div className="flex items-center justify-between text-[11px] font-medium text-[#64748B]">
            <span>Connected Power Corridors</span>
            <span>MW / Cap</span>
          </div>
          <div className="mt-2 space-y-2">
            {connectedCorridors.map((corridor) => {
              const pct = Math.min(100, Math.round(corridor.utilizationRatio * 100));
              return (
                <div key={corridor.id} className="text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-[#334155]">{corridor.label}</span>
                    <span className="shrink-0 font-mono-tabular text-[#0F172A]">
                      {corridor.flowMW.toFixed(1)} MW{' '}
                      <span className="text-[#94A3B8]">({pct}%)</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: corridor.colorHex,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-3.5 flex items-center justify-between border-t border-[#E2E8F0] pt-2.5">
        {onFocusCamera ? (
          <button
            type="button"
            onClick={onFocusCamera}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:underline"
          >
            <Crosshair className="h-3.5 w-3.5" />
            Focus Camera
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-[#64748B] hover:text-[#0F172A]"
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
