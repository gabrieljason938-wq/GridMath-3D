import { useState } from 'react';
import { Leaf } from 'lucide-react';
import visionSmartGridImg from '../../assets/images/vision_smart_grid_1795098662084.jpg';

const VISION_PILLARS = [
  {
    title: 'Unified Analytical Pipeline',
    detail: 'Links demand forecasting, constrained optimization, and visual grid inspection in one environment.',
  },
  {
    title: 'Transparent Numerical Formulation',
    detail: 'Exposes underlying mathematical models and residual behavior alongside every operational schedule.',
  },
  {
    title: 'Sustainable Resource Coordination',
    detail: 'Evaluates how solar, wind, storage, and dispatchable generation adapt across changing conditions.',
  },
];

export function VisionSection() {
  const [imageError, setImageError] = useState(false);

  return (
    <section
      id="vision"
      aria-labelledby="vision-heading"
      className="scroll-mt-20 border-t border-[#E2E8F0] bg-[#FFFFFF] dark:border-[#334155] dark:bg-[#172033]/55"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#10B981] uppercase dark:text-[#34D399]">
              Our Vision
            </p>
            <h2
              id="vision-heading"
              className="mt-3 text-3xl font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[2.25rem] dark:text-[#F8FAFC]"
            >
              Engineering a Smarter Energy Future
            </h2>
            <p className="mt-5 max-w-[58ch] text-[15px] leading-relaxed text-[#64748B] sm:text-base dark:text-[#94A3B8]">
              GRIDMATH 3D brings numerical mathematics, smart grid forecasting, and intelligent energy allocation into a unified interactive platform. By combining mathematical computation with digital city visualization, it helps demonstrate how advanced numerical techniques can support efficient and sustainable energy decisions.
            </p>

            <div className="mt-8 divide-y divide-[#E2E8F0] border-t border-[#E2E8F0] dark:divide-[#334155] dark:border-[#334155]">
              {VISION_PILLARS.map((pillar) => (
                <div key={pillar.title} className="py-4 first:pt-5 last:pb-0">
                  <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {pillar.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                    {pillar.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6">
            <figure className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] shadow-[0_20px_50px_-28px_rgba(15,23,42,0.18)] dark:border-[#334155] dark:bg-[#0B1220] dark:shadow-[0_24px_56px_-28px_rgba(2,6,23,0.7)]">
              {imageError ? (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 bg-[#F1F5F9] px-6 text-center text-[#64748B] dark:bg-[#1E293B] dark:text-[#94A3B8]">
                  <Leaf className="h-9 w-9 text-[#10B981] dark:text-[#34D399]" aria-hidden="true" />
                  <span className="text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                    Sustainable Smart Grid Architecture
                  </span>
                </div>
              ) : (
                <img
                  src={visionSmartGridImg}
                  alt="Illustration of a sustainable smart energy city with solar rooftops, wind turbines, green corridors, and integrated grid pathways"
                  width={1200}
                  height={900}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="block aspect-[4/3] h-auto w-full object-cover"
                />
              )}
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
