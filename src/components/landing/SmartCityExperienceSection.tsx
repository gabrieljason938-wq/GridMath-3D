import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Check,
} from 'lucide-react';

const CITY_CAPABILITIES = [
  'Day and night environments',
  'Weather-based energy scenarios',
  'Solar and wind generation',
  'Smart energy distribution',
  'Interactive infrastructure',
];

export function SmartCityExperienceSection() {
  const [imageError, setImageError] = useState(false);

  return (
    <section
      id="smart-city-experience"
      aria-labelledby="smart-city-experience-heading"
      className="scroll-mt-20 border-t border-[#E2E8F0] bg-[#FFFFFF] dark:border-[#334155] dark:bg-[#172033]/55"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#10B981] uppercase dark:text-[#34D399]">
              Smart City Digital Twin
            </p>
            <h2
              id="smart-city-experience-heading"
              className="mt-3 text-3xl font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[2.25rem] dark:text-[#F8FAFC]"
            >
              Experience Energy Intelligence in a Living City
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#64748B] sm:text-base dark:text-[#94A3B8]">
              Step inside the interactive smart city workspace to observe how hourly forecasts, dispatch schedules, and environmental shifts shape urban power networks in real time.
            </p>
          </div>

          <div className="shrink-0">
            <Link
              to="/smart-city"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2563EB] px-6 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.5)] transition-colors duration-150 hover:bg-blue-700 whitespace-nowrap"
            >
              <span>Explore the 3D City</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <figure className="mt-9 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] shadow-[0_24px_60px_-28px_rgba(15,23,42,0.22)] dark:border-[#334155] dark:bg-[#0B1220] dark:shadow-[0_24px_60px_-28px_rgba(2,6,23,0.75)]">
          {imageError ? (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-[#F1F5F9] px-6 text-center text-[#64748B] dark:bg-[#1E293B] dark:text-[#94A3B8]">
              <Building2 className="h-10 w-10 text-[#2563EB] dark:text-[#60A5FA]" aria-hidden="true" />
              <span className="text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                GRIDMATH 3D Interactive Smart City Environment
              </span>
            </div>
          ) : (
            <img
              src="/assets/aistudio/image_25e9d109.png"
              alt="Wide cinematic view of the GRIDMATH 3D smart city featuring solar installations, wind turbines, battery storage units, waterways, and urban energy distribution"
              width={1920}
              height={1080}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="block h-auto w-full"
            />
          )}
        </figure>

        <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CITY_CAPABILITIES.map((capability) => (
            <li
              key={capability}
              className="flex items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm font-medium text-[#0F172A] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC]"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#10B981]/12 text-[#10B981] dark:bg-[#34D399]/15 dark:text-[#34D399]">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span>{capability}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
