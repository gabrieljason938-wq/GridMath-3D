import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';

export function ToastContainer() {
  const notifications = useSimulationStore((s) => s.notifications);
  const dismissNotification = useSimulationStore((s) => s.dismissNotification);

  if (notifications.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-5 bottom-5 z-50 flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {notifications.map((toast) => {
        const Icon =
          toast.tone === 'success'
            ? CheckCircle2
            : toast.tone === 'warning'
              ? AlertTriangle
              : Info;
        const iconColor =
          toast.tone === 'success'
            ? 'text-[#10B981]'
            : toast.tone === 'warning'
              ? 'text-amber-600'
              : 'text-[#2563EB]';

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 shadow-sm"
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#0F172A]">{toast.title}</p>
              <p className="mt-0.5 text-xs text-[#64748B]">{toast.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissNotification(toast.id)}
              aria-label="Dismiss notification"
              className="rounded p-1 text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
