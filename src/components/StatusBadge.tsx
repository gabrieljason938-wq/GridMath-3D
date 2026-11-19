interface StatusBadgeProps {
  tone: 'nominal' | 'info' | 'warning' | 'deficit' | 'neutral';
  label: string;
  className?: string;
}

const TONE_MAP: Record<StatusBadgeProps['tone'], { glyph: string; colorClass: string }> = {
  nominal: { glyph: '●', colorClass: 'text-[#10B981] dark:text-[#34D399]' },
  info: { glyph: '◆', colorClass: 'text-[#2563EB] dark:text-[#60A5FA]' },
  warning: { glyph: '▲', colorClass: 'text-amber-600 dark:text-amber-400' },
  deficit: { glyph: '✖', colorClass: 'text-rose-600 dark:text-rose-400' },
  neutral: { glyph: '○', colorClass: 'text-[#64748B] dark:text-[#94A3B8]' },
};

export function StatusBadge({ tone, label, className = '' }: StatusBadgeProps) {
  const cfg = TONE_MAP[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${cfg.colorClass} ${className}`}
    >
      <span aria-hidden="true" className="text-[10px] leading-none">
        {cfg.glyph}
      </span>
      <span>{label}</span>
    </span>
  );
}
