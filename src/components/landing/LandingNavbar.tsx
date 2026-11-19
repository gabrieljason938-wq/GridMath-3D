import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Menu, X } from 'lucide-react';
import { ThemeSelector } from '../ThemeSelector';

const NAV_LINKS = [
  { label: 'Vision', targetId: 'vision' },
  { label: 'Technology', targetId: 'technology' },
  { label: 'Ecosystem', targetId: 'ecosystem' },
  { label: 'How It Works', targetId: 'how-it-works' },
  { label: 'FAQ', targetId: 'faq' },
];

export function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSectionScroll = (targetId: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-[#FFFFFF]/92 backdrop-blur-md dark:border-[#334155] dark:bg-[#0B1220]/92">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
        <Link
          to="/"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="inline-flex items-center gap-2.5 text-sm font-bold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0 dark:text-[#F8FAFC]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2563EB]/20 bg-[#2563EB]/10 text-[#2563EB] dark:border-[#60A5FA]/30 dark:bg-[#60A5FA]/15 dark:text-[#60A5FA]">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>GRIDMATH 3D</span>
        </Link>

        <nav
          aria-label="Landing sections"
          className="hidden items-center gap-7 lg:flex"
        >
          {NAV_LINKS.map((item) => (
            <button
              key={item.targetId}
              type="button"
              onClick={() => handleSectionScroll(item.targetId)}
              className="cursor-pointer text-sm font-medium text-[#64748B] transition-colors duration-150 hover:text-[#0F172A] whitespace-nowrap shrink-0 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <ThemeSelector compact />

          <Link
            to="/dashboard"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 sm:px-4 text-xs font-semibold text-white transition-colors duration-150 hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            <span>Launch Application</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-mobile-nav"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A] transition-colors duration-150 hover:bg-[#F1F5F9] lg:hidden dark:border-[#334155] dark:bg-[#172033] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]"
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          id="landing-mobile-nav"
          aria-label="Mobile landing navigation"
          className="border-t border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3 lg:hidden dark:border-[#334155] dark:bg-[#0B1220]"
        >
          <div className="mx-auto flex max-w-[1400px] flex-col gap-1">
            {NAV_LINKS.map((item) => (
              <button
                key={item.targetId}
                type="button"
                onClick={() => handleSectionScroll(item.targetId)}
                className="flex h-10 w-full cursor-pointer items-center rounded-lg px-3 text-left text-sm font-medium text-[#0F172A] transition-colors duration-150 hover:bg-[#F1F5F9] dark:text-[#F8FAFC] dark:hover:bg-[#172033]"
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
