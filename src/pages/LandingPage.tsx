import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { CoreTechnologySection } from '../components/landing/CoreTechnologySection';
import { EnergyEcosystemSection } from '../components/landing/EnergyEcosystemSection';
import { FinalCtaSection } from '../components/landing/FinalCtaSection';
import { HeroCityShowcase } from '../components/landing/HeroCityShowcase';
import { HowItWorksProcess } from '../components/landing/HowItWorksProcess';
import { LandingFaqSection } from '../components/landing/LandingFaqSection';
import { LandingFooter } from '../components/landing/LandingFooter';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { SmartCityExperienceSection } from '../components/landing/SmartCityExperienceSection';
import { VisionSection } from '../components/landing/VisionSection';

export function LandingPage() {
  const handleExploreTechnology = () => {
    const target = document.getElementById('technology');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0B1220] dark:text-[#F8FAFC]">
      <LandingNavbar />

      <main className="flex-1">
        <section className="relative overflow-x-clip bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.06),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(96,165,250,0.08),transparent_55%)]">
          <div className="mx-auto w-full max-w-[1400px] px-4 pt-10 pb-14 sm:px-6 sm:pt-14 sm:pb-18 lg:px-10 lg:pt-16 lg:pb-20">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12 xl:gap-14">
              <div className="lg:col-span-5">
                <p className="text-xs font-semibold tracking-[0.18em] text-[#2563EB] uppercase dark:text-[#60A5FA]">
                  GRIDMATH 3D · Smart Grid Intelligence
                </p>

                <h1 className="mt-3 text-[clamp(2.05rem,3.3vw,3.2rem)] font-bold leading-[1.09] tracking-[-0.025em] text-[#0F172A] dark:text-[#F8FAFC]">
                  Powering Smarter Cities Through Numerical Intelligence
                </h1>

                <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-[#64748B] sm:text-base dark:text-[#94A3B8]">
                  GRIDMATH 3D combines numerical mathematics, electricity demand forecasting, optimal energy dispatch, and interactive 3D smart city simulation in one engineering platform.
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link
                    to="/dashboard"
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2563EB] px-6 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.55)] transition-colors duration-150 hover:bg-blue-700 whitespace-nowrap shrink-0"
                  >
                    <span>Launch Application</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>

                  <button
                    type="button"
                    onClick={handleExploreTechnology}
                    className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] px-5 text-sm font-semibold text-[#0F172A] transition-colors duration-150 hover:border-[#94A3B8] hover:bg-[#F1F5F9] whitespace-nowrap shrink-0 dark:border-[#334155] dark:bg-[#172033] dark:text-[#F8FAFC] dark:hover:border-[#475569] dark:hover:bg-[#1E293B]"
                  >
                    <span>Explore Technology</span>
                    <ArrowDown className="h-4 w-4 text-[#64748B] dark:text-[#94A3B8]" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7">
                <HeroCityShowcase />
              </div>
            </div>
          </div>
        </section>

        <VisionSection />
        <CoreTechnologySection />
        <EnergyEcosystemSection />
        <HowItWorksProcess />
        <SmartCityExperienceSection />
        <LandingFaqSection />
        <FinalCtaSection />
      </main>

      <LandingFooter />
    </div>
  );
}
