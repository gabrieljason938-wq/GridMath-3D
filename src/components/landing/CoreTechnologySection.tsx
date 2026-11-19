import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Cpu,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';

interface TechnologyCard {
  title: string;
  subtitle: string;
  description: string;
  ctaLabel: string;
  to: string;
  icon: LucideIcon;
  accentClass: string;
}

const TECHNOLOGY_CARDS: TechnologyCard[] = [
  {
    title: 'Numerical Intelligence',
    subtitle: 'Applied Mathematical Core',
    description:
      'Applies polynomial and spline interpolation, least-squares regression, and matrix-based solvers to model hourly electricity demand. Numerical differentiation evaluates load ramp rates while numerical integration computes cumulative energy totals with verifiable precision.',
    ctaLabel: 'Open Mathematics Lab',
    to: '/mathematics',
    icon: Cpu,
    accentClass:
      'border-[#2563EB]/20 bg-[#2563EB]/10 text-[#2563EB] dark:border-[#60A5FA]/30 dark:bg-[#60A5FA]/15 dark:text-[#60A5FA]',
  },
  {
    title: 'Optimal Energy Dispatch',
    subtitle: 'Constrained Allocation Engine',
    description:
      'Solves multi-period mathematical optimization models to coordinate solar, wind, thermal generation, and battery storage across each hourly interval. Generation schedules balance operating cost against power balance, capacity limits, and storage state-of-charge constraints.',
    ctaLabel: 'Explore Energy Dispatch',
    to: '/dispatch',
    icon: SlidersHorizontal,
    accentClass:
      'border-[#10B981]/20 bg-[#10B981]/10 text-[#10B981] dark:border-[#34D399]/30 dark:bg-[#34D399]/15 dark:text-[#34D399]',
  },
  {
    title: 'Interactive 3D Smart City',
    subtitle: 'Spatial Digital Twin',
    description:
      'Translates demand forecasts and dispatch decisions into a live 3D city environment inside the application workspace. Users inspect urban districts, renewable generation assets, weather scenarios, and grid operations from any angle.',
    ctaLabel: 'Launch 3D Smart City',
    to: '/smart-city',
    icon: Building2,
    accentClass:
      'border-[#2563EB]/20 bg-[#2563EB]/10 text-[#2563EB] dark:border-[#60A5FA]/30 dark:bg-[#60A5FA]/15 dark:text-[#60A5FA]',
  },
];

export function CoreTechnologySection() {
  return (
    <section
      id="technology"
      aria-labelledby="technology-heading"
      className="scroll-mt-20 border-t border-[#E2E8F0] bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1220]"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#2563EB] uppercase dark:text-[#60A5FA]">
            Core Technology
          </p>
          <h2
            id="technology-heading"
            className="mt-3 text-3xl font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[2.25rem] dark:text-[#F8FAFC]"
          >
            The Intelligence Behind the Grid
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[#64748B] sm:text-base dark:text-[#94A3B8]">
            Three tightly integrated modules bridge foundational numerical analysis, optimal grid scheduling, and interactive city visualization.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {TECHNOLOGY_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.16)] transition-colors duration-150 hover:border-[#CBD5E1] sm:p-7 dark:border-[#334155] dark:bg-[#172033] dark:shadow-[0_16px_36px_-24px_rgba(2,6,23,0.65)] dark:hover:border-[#475569]"
              >
                <div>
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${card.accentClass}`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                        {card.subtitle}
                      </p>
                      <h3 className="text-lg font-semibold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                        {card.title}
                      </h3>
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-relaxed text-[#64748B] sm:text-[15px] dark:text-[#94A3B8]">
                    {card.description}
                  </p>
                </div>

                <div className="mt-7 border-t border-[#E2E8F0] pt-5 dark:border-[#334155]">
                  <Link
                    to={card.to}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB] transition-colors duration-150 hover:text-blue-700 whitespace-nowrap dark:text-[#60A5FA] dark:hover:text-blue-300"
                  >
                    <span>{card.ctaLabel}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
