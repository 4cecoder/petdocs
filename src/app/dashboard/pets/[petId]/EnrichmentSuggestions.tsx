"use client";

import { Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@seridian/ui-kit";
import { petSubrouteHref } from "@/lib/routes";
import { useEnrichment } from "./enrichment-apply";

/**
 * One-click "Add to pet profile" chips fed by document extraction
 * (convex/docPipeline.ts metadata, read-only). Applied chips disappear;
 * renders nothing when there is nothing to suggest.
 */
export function EnrichmentSuggestions({ compact = false }: { compact?: boolean }) {
  const { suggestions, apply, isBusy, errorFor, petId } = useEnrichment();

  if (suggestions.length === 0) return null;

  return (
    <section
      aria-label="Suggestions from documents"
      className="rounded-2xl border border-brand-500/20 bg-linear-to-br from-brand-50/50 via-white to-cream p-4"
    >
      <div className="flex items-center gap-2">
        <Sparkles size={16} aria-hidden="true" className="shrink-0 text-amber-500" />
        <h2 className="text-sm font-bold text-ink">
          {compact ? "From your documents" : "Add to pet profile from your documents"}
        </h2>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        One tap files an extracted detail into the right tool. Review it there
        anytime.
      </p>

      <ul className="mt-3 flex list-none flex-wrap gap-2">
        {suggestions.map((s) => {
          const busy = isBusy(s.key);
          const error = errorFor(s.key);
          const manualRoute =
            s.kind === "medication" && !s.frequency
              ? { href: petSubrouteHref(petId, "medications"), label: "Open Medications to choose a frequency" }
              : s.kind === "visit" && s.visitedAt === undefined
                ? { href: petSubrouteHref(petId, "visits"), label: "Open Visits to enter the visit date" }
                : null;
          return (
            <li key={s.key} className="flex flex-col gap-1">
              {manualRoute ? (
                <Link
                  href={manualRoute.href}
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  {s.label} — {manualRoute.label}
                </Link>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  aria-label={s.label}
                  onClick={() => void apply(s)}
                  className="min-h-[44px] rounded-xl"
                >
                  {busy ? "Adding…" : s.label}
                </Button>
              )}
              {error ? (
                <p role="alert" className="flex items-center gap-1 text-xs text-red-600">
                  <TriangleAlert size={12} aria-hidden="true" />
                  {error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
