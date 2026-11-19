import { useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'what-is-gridmath',
    question: 'What is GRIDMATH 3D?',
    answer:
      'GRIDMATH 3D is an interactive smart grid intelligence platform that unites numerical mathematics, electricity demand forecasting, constrained energy dispatch optimization, and a 3D smart city visualization workspace inside a single web application.',
  },
  {
    id: 'how-numerical-methods-used',
    question: 'How are numerical methods used?',
    answer:
      'The platform uses polynomial and spline interpolation, least-squares regression and QR decomposition, linear system solvers, numerical differentiation, and numerical integration to model hourly load curves, analyze demand ramp rates, evaluate solver accuracy, and calculate cumulative energy totals.',
  },
  {
    id: 'what-3d-city-simulates',
    question: 'What does the 3D smart city simulate?',
    answer:
      'Inside the application workspace, the interactive 3D smart city represents urban demand zones, solar arrays, wind turbines, thermal generation units, battery storage systems, and grid interconnections while responding to day/night cycles, weather scenarios, and hourly dispatch outputs.',
  },
  {
    id: 'how-optimal-dispatch-works',
    question: 'How does optimal energy dispatch work?',
    answer:
      'A multi-period mathematical optimization engine schedules hourly generation and battery charge or discharge across solar, wind, thermal, and storage assets to minimize operating cost while satisfying electricity demand, generator capacity limits, and battery state-of-charge constraints.',
  },
  {
    id: 'real-or-demo-data',
    question: 'Does the system use real or demonstration data?',
    answer:
      'GRIDMATH 3D ships with structured built-in demonstration scenarios and reference hourly demand and weather profiles so every module works immediately out of the box. Users can also upload custom CSV demand datasets in the forecasting workspace to run the pipeline on their own time-series data.',
  },
];

export function LandingFaqSection() {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0].id);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const total = FAQ_ITEMS.length;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowDown') {
      nextIndex = (index + 1) % total;
    } else if (event.key === 'ArrowUp') {
      nextIndex = (index - 1 + total) % total;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = total - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      buttonRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="scroll-mt-20 border-t border-[#E2E8F0] bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1220]"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#2563EB] uppercase dark:text-[#60A5FA]">
              Frequently Asked Questions
            </p>
            <h2
              id="faq-heading"
              className="mt-3 text-3xl font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[2.15rem] dark:text-[#F8FAFC]"
            >
              Technical Overview &amp; Platform Answers
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#64748B] sm:text-[15px] dark:text-[#94A3B8]">
              Key details on how GRIDMATH 3D combines numerical computation, multi-period dispatch optimization, and interactive 3D simulation.
            </p>
          </div>

          <div className="lg:col-span-8">
            <div className="divide-y divide-[#E2E8F0] overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] dark:divide-[#334155] dark:border-[#334155] dark:bg-[#172033]">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openId === item.id;
                const buttonId = `faq-trigger-${item.id}`;
                const panelId = `faq-panel-${item.id}`;

                return (
                  <div key={item.id}>
                    <h3>
                      <button
                        ref={(el) => {
                          buttonRefs.current[index] = el;
                        }}
                        id={buttonId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => toggleItem(item.id)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                        className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-5 text-left transition-colors duration-150 hover:bg-[#F8FAFC] sm:px-7 dark:hover:bg-[#1E293B]/60"
                      >
                        <span className="text-[15px] font-semibold text-[#0F172A] sm:text-base dark:text-[#F8FAFC]">
                          {item.question}
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className={`h-5 w-5 shrink-0 text-[#64748B] transition-transform duration-150 dark:text-[#94A3B8] ${
                            isOpen ? 'rotate-180 text-[#2563EB] dark:text-[#60A5FA]' : ''
                          }`}
                        />
                      </button>
                    </h3>

                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      hidden={!isOpen}
                      className="px-5 pb-5 sm:px-7 sm:pb-6"
                    >
                      <p className="max-w-[68ch] text-sm leading-relaxed text-[#64748B] sm:text-[15px] dark:text-[#94A3B8]">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
