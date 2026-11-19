import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function FinalCtaSection() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="border-t border-[#E2E8F0] bg-[#FFFFFF] dark:border-[#334155] dark:bg-[#172033]/55"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
        <div className="relative overflow-hidden rounded-3xl border border-[#2563EB]/20 bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#065F46] px-6 py-12 text-center shadow-[0_24px_64px_-28px_rgba(37,99,235,0.4)] sm:px-12 sm:py-16 dark:border-[#60A5FA]/25">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(96,165,250,0.22),transparent_48%),radial-gradient(circle_at_85%_80%,rgba(16,185,129,0.22),transparent_50%)]"
          />

          <div className="relative mx-auto max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#93C5FD] uppercase">
              GRIDMATH 3D Platform
            </p>
            <h2
              id="final-cta-heading"
              className="mt-3 text-3xl font-bold leading-tight tracking-[-0.02em] text-white sm:text-[2.35rem]"
            >
              Explore the Future of Smart Grid Intelligence
            </h2>
            <p className="mx-auto mt-4 max-w-[54ch] text-[15px] leading-relaxed text-slate-200 sm:text-base">
              Discover how numerical mathematics, energy optimization, and 3D visualization work together in one intelligent platform.
            </p>

            <div className="mt-8 flex justify-center">
              <Link
                to="/dashboard"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-sm font-semibold text-[#0F172A] shadow-sm transition-colors duration-150 hover:bg-slate-100 whitespace-nowrap"
              >
                <span>Launch GRIDMATH 3D</span>
                <ArrowRight className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
