import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeStore, type UiThemePreference } from '../store/useThemeStore';

interface ThemeOption {
  id: UiThemePreference;
  label: string;
  ariaLabel: string;
  Icon: typeof Sun;
}

const THEME_OPTIONS: ThemeOption[] = [
  { id: 'light', label: 'Light', ariaLabel: 'Light theme', Icon: Sun },
  { id: 'dark', label: 'Dark', ariaLabel: 'Dark theme', Icon: Moon },
  { id: 'system', label: 'System', ariaLabel: 'System Default theme', Icon: Monitor },
];

interface ThemeSelectorProps {
  /** Compact mode displays icon buttons with accessible tooltips for dense toolbars */
  compact?: boolean;
  className?: string;
}

export function ThemeSelector({ compact = false, className = '' }: ThemeSelectorProps) {
  const uiTheme = useThemeStore((s) => s.uiTheme);
  const setUiTheme = useThemeStore((s) => s.setUiTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Interface Color Theme"
      className={`inline-flex items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 dark:border-[#334155] dark:bg-[#0B1220] ${className}`}
    >
      {THEME_OPTIONS.map(({ id, label, ariaLabel, Icon }) => {
        const active = uiTheme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={ariaLabel}
            title={id === 'system' ? 'System Default' : label}
            onClick={() => setUiTheme(id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
              compact ? 'h-7 w-7 px-0' : 'h-7 px-2.5 text-[11px]'
            } ${
              active
                ? 'bg-[#FFFFFF] text-[#2563EB] shadow-xs dark:bg-[#172033] dark:text-[#60A5FA]'
                : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {!compact ? <span>{label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
