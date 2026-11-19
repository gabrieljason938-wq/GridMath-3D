import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';

const PLATFORM_LINKS = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: '3D Smart City', to: '/smart-city' },
  { label: 'Mathematics Lab', to: '/mathematics' },
  { label: 'Demand Forecasting', to: '/forecasting' },
  { label: 'Optimal Dispatch', to: '/dispatch' },
];

const SECTION_LINKS = [
  { label: 'Our Vision', targetId: 'vision' },
  { label: 'Core Technology', targetId: 'technology' },
  { label: 'Energy Ecosystem', targetId: 'ecosystem' },
  { label: 'How It Works', targetId: 'how-it-works' },
  { label: 'FAQ', targetId: 'faq' },
];

const CORE_TECHNOLOGIES = [
  'Numerical Intelligence',
  'Electricity Demand Forecasting',
  'Optimal Energy Dispatch',
  'Interactive 3D Smart City',
];

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  const handleSectionScroll = (targetId: string) => {
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <footer className="border-t border-[#E2E8F0] bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1220]">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6 lg:px-10 lg:py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Link
              to="/"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="inline-flex items-center gap-2.5 text-sm font-bold tracking-tight text-[#0F172A] whitespace-nowrap dark:text-[#F8FAFC]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2563EB]/20 bg-[#2563EB]/10 text-[#2563EB] dark:border-[#60A5FA]/30 dark:bg-[#60A5FA]/15 dark:text-[#60A5FA]">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>GRIDMATH 3D</span>
            </Link>

            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
              Smart grid intelligence platform uniting numerical mathematics, electricity demand forecasting, optimal energy dispatch, and interactive 3D city simulation.
            </p>
          </div>

          <div className="lg:col-span-3">
            <h3 className="text-xs font-semibold tracking-[0.14em] text-[#0F172A] uppercase dark:text-[#F8FAFC]">
              Application Modules
            </h3>
            <ul className="mt-4 space-y-2.5">
              {PLATFORM_LINKS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm text-[#64748B] transition-colors duration-150 hover:text-[#2563EB] dark:text-[#94A3B8] dark:hover:text-[#60A5FA]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h3 className="text-xs font-semibold tracking-[0.14em] text-[#0F172A] uppercase dark:text-[#F8FAFC]">
              Overview
            </h3>
            <ul className="mt-4 space-y-2.5">
              {SECTION_LINKS.map((item) => (
                <li key={item.targetId}>
                  <button
                    type="button"
                    onClick={() => handleSectionScroll(item.targetId)}
                    className="cursor-pointer text-sm text-[#64748B] transition-colors duration-150 hover:text-[#2563EB] dark:text-[#94A3B8] dark:hover:text-[#60A5FA]"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h3 className="text-xs font-semibold tracking-[0.14em] text-[#0F172A] uppercase dark:text-[#F8FAFC]">
              Core Technologies
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[#64748B] dark:text-[#94A3B8]">
              {CORE_TECHNOLOGIES.map((tech) => (
                <li key={tech}>{tech}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[#E2E8F0] pt-6 text-xs text-[#64748B] sm:flex-row dark:border-[#334155] dark:text-[#94A3B8]">
          <p>© {currentYear} GRIDMATH 3D. All rights reserved.</p>
          <p>Numerical Intelligence · Optimal Energy Dispatch · 3D Smart City</p>
        </div>
      </div>
    </footer>
  );
}
