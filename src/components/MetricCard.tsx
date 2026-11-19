import React from 'react';
import { StatusBadge } from './StatusBadge';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  statusTone?: 'nominal' | 'info' | 'warning' | 'deficit' | 'neutral';
  statusLabel?: string;
  accentColor?: 'primary' | 'secondary' | 'renewable' | 'neutral';
  loading?: boolean;
  action?: React.ReactNode;
}

const VALUE_ACCENT: Record<NonNullable<MetricCardProps['accentColor']>, string> = {
  primary: 'text-[#2563EB] dark:text-[#60A5FA]',
  secondary: 'text-[#06B6D4] dark:text-[#22D3EE]',
  renewable: 'text-[#10B981] dark:text-[#34D399]',
  neutral: 'text-[#0F172A] dark:text-[#F8FAFC]',
};

export function MetricCard({
  label,
  value,
  unit,
  detail,
  statusTone,
  statusLabel,
  accentColor = 'neutral',
  loading = false,
  action,
}: MetricCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-5 transition-colors duration-150 hover:border-slate-300 dark:border-[#334155] dark:bg-[#172033] dark:hover:border-[#475569]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-[#64748B] dark:text-[#94A3B8]">
          {label}
        </span>
        {statusTone && statusLabel ? (
          <StatusBadge tone={statusTone} label={statusLabel} />
        ) : action ? (
          action
        ) : null}
      </div>

      {loading ? (
        <div className="mt-3 h-8 w-28 animate-pulse rounded bg-slate-100 dark:bg-[#1E293B]" />
      ) : (
        <div className="mt-2.5 flex items-baseline gap-1.5">
          <span
            className={`font-mono-tabular text-2xl font-semibold tracking-tight ${VALUE_ACCENT[accentColor]}`}
          >
            {value}
          </span>
          {unit ? (
            <span className="font-mono-tabular text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
              {unit}
            </span>
          ) : null}
        </div>
      )}

      {detail ? (
        <p className="mt-2 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">{detail}</p>
      ) : null}
    </div>
  );
}
