import { cn } from "@/lib/utils";

export type VaccineStatus = "valid" | "expiring" | "expired";

const STATUS_META: Record<VaccineStatus, { dot: string; label: string }> = {
  valid: { dot: "bg-green-500", label: "Vaccines valid" },
  expiring: { dot: "bg-amber-500", label: "Expiring soon" },
  expired: { dot: "bg-red-500", label: "Expired" },
};

/** Status dot + text (never color-only) for vaccine state. */
export function VaccineBadge({
  status,
  label,
}: {
  status: VaccineStatus;
  label?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-cream px-2.5 py-1 text-xs font-semibold">
      <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", meta.dot)} />
      {label ?? meta.label}
    </span>
  );
}
