import {
  ArrowRight,
  Database,
  Globe2,
  Scale,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

interface WorkflowStep {
  step: string;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    step: '01',
    label: 'Step 1',
    title: 'Data Input',
    description:
      'Collect or load historical electricity demand and environmental information.',
    icon: Database,
  },
  {
    step: '02',
    label: 'Step 2',
    title: 'Numerical Forecasting',
    description:
      'Apply mathematical methods to predict future electricity demand.',
    icon: TrendingUp,
  },
  {
    step: '03',
    label: 'Step 3',
    title: 'Optimal Dispatch',
    description:
      'Determine a cost-efficient generation allocation under mathematical constraints.',
    icon: Scale,
  },
  {
    step: '04',
    label: 'Step 4',
    title: 'Digital Twin Visualization',
    description:
      'Display the resulting energy allocation through an interactive 3D smart city inside the application.',
    icon: Globe2,
  },
];

export function HowItWorksProcess() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-20 border-t border-[#E2E8F0] bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#0B1220]"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#2563EB] uppercase dark:text-[#60A5FA]">
            How GRIDMATH Works
          </p>
          <h2
            id="how-it-works-heading"
            className="mt-3 text-3xl font-bold leading-tight tracking-[-0.02em] text-[#0F172A] sm:text-[2.25rem] dark:text-[#F8FAFC]"
          >
            From Mathematical Intelligence to Smart Energy Decisions
          </h2>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
          {WORKFLOW_STEPS.map((stage, index) => {
            const Icon = stage.icon;
            const isLast = index === WORKFLOW_STEPS.length - 1;

            return (
              <li
                key={stage.step}
                className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.14)] dark:border-[#334155] dark:bg-[#172033] dark:shadow-[0_14px_32px_-24px_rgba(2,6,23,0.65)]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/10 text-[#2563EB] dark:border-[#60A5FA]/30 dark:bg-[#60A5FA]/15 dark:text-[#60A5FA]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>

                  <span className="font-mono-tabular text-xs font-semibold tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                    {stage.label}
                  </span>

                  {!isLast && (
                    <div
                      aria-hidden="true"
                      className="hidden flex-1 items-center pl-1 lg:flex"
                    >
                      <div className="h-px flex-1 bg-gradient-to-r from-[#CBD5E1] to-[#94A3B8]/70 dark:from-[#334155] dark:to-[#475569]" />
                      <ArrowRight className="ml-1 h-3.5 w-3.5 shrink-0 text-[#94A3B8] dark:text-[#64748B]" />
                    </div>
                  )}
                </div>

                <h3 className="mt-5 text-base font-semibold tracking-tight text-[#0F172A] sm:text-[1.0625rem] dark:text-[#F8FAFC]">
                  {stage.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                  {stage.description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
