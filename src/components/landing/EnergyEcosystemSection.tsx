import { useState } from 'react';
import { BatteryCharging, Flame, Sun, Wind, type LucideIcon } from 'lucide-react';
import solarImg from '../../assets/images/energy_solar_array_1795098676290.jpg';
import windImg from '../../assets/images/energy_wind_turbines_1795098682427.jpg';
import thermalImg from '../../assets/images/energy_thermal_plant_1795098666678.jpg';
import batteryImg from '../../assets/images/energy_battery_storage_1795098868078.jpg';

interface EnergySourceItem {
  name: string;
  role: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  icon: LucideIcon;
}

const ENERGY_SOURCES: EnergySourceItem[] = [
  {
    name: 'Solar Energy',
    role: 'Daytime Photovoltaic Generation',
    description:
      'Supplies clean daytime power that responds directly to modeled solar irradiance, cloud cover, and time-of-day curves across the city.',
    imageSrc: solarImg,
    imageAlt: 'Utility-scale photovoltaic solar panel rows arranged across green terrain under clear sky',
    icon: Sun,
  },
  {
    name: 'Wind Energy',
    role: 'Variable Aerodynamic Supply',
    description:
      'Contributes renewable electricity across both daytime and evening intervals, varying continuously with simulated wind speed conditions.',
    imageSrc: windImg,
    imageAlt: 'Modern white wind turbines positioned along sunlit rolling green hills under blue sky',
    icon: Wind,
  },
  {
    name: 'Thermal Generation',
    role: 'Dispatchable Firm Capacity',
    description:
      'Provides controllable reserve and baseload generation when renewable output dips, governed by operating cost and ramp-rate constraints.',
    imageSrc: thermalImg,
    imageAlt: 'Modern combined-cycle thermal power generation facility with architectural glass and substation infrastructure',
    icon: Flame,
  },
  {
    name: 'Battery Energy Storage',
    role: 'Bidirectional Grid Balancing',
    description:
      'Absorbs surplus renewable electricity during low-load periods and discharges stored energy during peak demand within state-of-charge bounds.',
    imageSrc: batteryImg,
    imageAlt: 'Grid-scale modular battery energy storage enclosures arranged neatly alongside transformers',
    icon: BatteryCharging,
  },
];

function EnergySourceCard({ source }: { source: EnergySourceItem }) {
  const [imageError, setImageError] = useState(false);
  const Icon = source.icon;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-[0_14px_34px_-26px_rgba(15,23,42,0.16)] transition-colors duration-150 hover:border-[#CBD5E1] dark:border-[#334155] dark:bg-[#172033] dark:shadow-[0_16px_36px_-26px_rgba(2,6,23,0.65)] dark:hover:border-[#475569]">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F1F5F9] dark:bg-[#0B1220]">
        {imageError ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-[#64748B] dark:text-[#94A3B8]">
            <Icon className="h-8 w-8 text-[#2563EB] dark:text-[#60A5FA]" aria-hidden="true" />
            <span className="text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC]">
              {source.name}
            </span>
          </div>
        ) : (
          <img
            src={source.imageSrc}
            alt={source.imageAlt}
            width={800}
            height={600}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="block h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#2563EB] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#60A5FA]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h3 className="text-base font-semibold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
            {source.name}
          </h3>
        </div>

        <p className="mt-2.5 text-xs font-medium text-[#10B981] dark:text-[#34D399]">
          {source.role}
        </p>

        <p className="mt-2.5 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
          {source.description}
        </p>
      </div>
    </article>
  );
}

export function EnergyEcosystemSection() {
  return (
    <section
      id="ecosystem"
      aria-labelledby="ecosystem-heading"
      className="scroll-mt-20 border-t border-[#E2E8F0] bg-[#FFFFFF] dark:border-[#334155] dark:bg-[#172033]/55"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#10B981] uppercase dark:text-[#34D399]">
              Sustainable Energy Ecosystem
            </p>
            <h2
              id="ecosystem-heading"
              className="mt-3 text-3xl font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[2.25rem] dark:text-[#F8FAFC]"
            >
              One City. Multiple Energy Sources.
            </h2>
          </div>

          <p className="max-w-md text-sm leading-relaxed text-[#64748B] sm:text-[15px] dark:text-[#94A3B8]">
            Each generation and storage resource plays a distinct operational role inside the multi-period dispatch model and 3D grid simulation.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ENERGY_SOURCES.map((source) => (
            <EnergySourceCard key={source.name} source={source} />
          ))}
        </div>
      </div>
    </section>
  );
}
