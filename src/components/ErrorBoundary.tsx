import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  fallbackDescription?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unexpected rendering error.',
    };
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-8 text-center dark:border-[#334155] dark:bg-[#172033]">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            {this.props.title ?? 'Component Recovery State'}
          </h3>
          <p className="mt-1.5 max-w-md text-sm text-[#64748B] dark:text-[#94A3B8]">
            {this.props.fallbackDescription ?? this.state.errorMessage}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] whitespace-nowrap shrink-0 dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry View
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
