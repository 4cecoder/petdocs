"use client";

/**
 * Minimal toast system for petdocs (no ui-kit dep; follows the existing
 * hand-rolled component patterns: Tailwind tokens, lucide icons, 48px touch
 * targets, polite/assertive live regions).
 *
 * Usage: mount <ToastProvider /> once near the app root, then:
 *
 *   const toast = useToast();
 *   toast.show({ title: "Saved", variant: "success" });
 *   toast.show({ title: "Heads up", description: "…", variant: "warning" });
 *
 * Variants map to semantics: info/success announce politely (role="status"),
 * warning/error assertively (role="alert"). Toasts auto-dismiss; the close
 * button is keyboard reachable.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /**
   * Auto-dismiss after this many ms. Defaults to 6000 (10000 for
   * warning/error, which deserve a longer look).
   */
  duration?: number;
}

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastApi {
  show: (toast: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Access the toast queue. Must be called inside <ToastProvider>. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: typeof Info; iconClass: string; borderClass: string }
> = {
  info: {
    icon: Info,
    iconClass: "text-ink-soft",
    borderClass: "border-ink/15",
  },
  success: {
    icon: CheckCircle2,
    iconClass: "text-green-600",
    borderClass: "border-green-600/30",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-600",
    borderClass: "border-amber-500/40",
  },
  error: {
    icon: XCircle,
    iconClass: "text-red-600",
    borderClass: "border-red-500/40",
  },
};

function defaultDuration(variant: ToastVariant): number {
  return variant === "warning" || variant === "error" ? 10_000 : 6_000;
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const { icon: Icon, iconClass, borderClass } = VARIANT_STYLES[toast.variant];
  const assertive = toast.variant === "warning" || toast.variant === "error";

  useEffect(() => {
    const timer = window.setTimeout(
      () => onDismiss(toast.id),
      toast.duration,
    );
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-2xl border bg-white p-4 shadow-lg",
        borderClass,
      )}
    >
      <Icon size={20} aria-hidden="true" className={cn("mt-0.5 shrink-0", iconClass)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-ink">
          {toast.title}
        </p>
        {toast.description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
            {toast.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-m-1 flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-cream hover:text-ink"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions): number => {
    const id = nextId.current++;
    const variant = options.variant ?? "info";
    // Cap concurrent toasts: the oldest quietly leaves before a crowd forms.
    setToasts((current) => {
      const next = [
        ...current,
        {
          id,
          title: options.title,
          ...(options.description !== undefined
            ? { description: options.description }
            : {}),
          variant,
          duration: options.duration ?? defaultDuration(variant),
        },
      ];
      return next.length > 4 ? next.slice(next.length - 4) : next;
    });
    return id;
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Fixed, non-interactive shell: toasts opt back into pointer events. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
