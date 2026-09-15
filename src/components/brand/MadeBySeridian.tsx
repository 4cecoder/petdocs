import { cn } from "@/lib/utils";

/**
 * "Made by seridian.dev" chip — the one intentional brand attribution on
 * user-facing surfaces (marketing footer, dashboard sidebar, auth pages).
 * Quiet by design: it should read as a signature, not a banner.
 */
export function MadeBySeridian({ className }: { className?: string }) {
  return (
    <a
      href="https://seridian.dev"
      target="_blank"
      rel="noopener"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-brand-600"
      />
      Made by{" "}
      <span className="font-semibold text-ink">seridian.dev</span>
    </a>
  );
}
