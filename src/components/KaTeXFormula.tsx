import katex from 'katex';
import { useMemo } from 'react';

interface KaTeXFormulaProps {
  tex: string;
  displayMode?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function KaTeXFormula({
  tex,
  displayMode = false,
  className = '',
  ariaLabel,
}: KaTeXFormulaProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
        strict: 'ignore',
      });
    } catch {
      return tex;
    }
  }, [tex, displayMode]);

  return (
    <span
      role="math"
      aria-label={ariaLabel ?? tex}
      className={
        displayMode
          ? `block overflow-x-auto py-1 text-[#0F172A] dark:text-[#F8FAFC] ${className}`
          : `inline-block text-[#0F172A] dark:text-[#F8FAFC] ${className}`
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
