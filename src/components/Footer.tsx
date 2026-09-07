import Link from "next/link";
import { PawPrint } from "lucide-react";
import { ROUTES } from "@/lib/routes";

export function Footer() {
  return (
    <footer className="border-t border-ink/10 bg-cream-dark/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-ink-soft md:flex-row">
        <p className="flex items-center gap-2">
          <PawPrint size={16} aria-hidden="true" /> petdocs: own your
          pet&apos;s docs
        </p>
        <nav className="flex gap-6">
          <Link href={ROUTES.howItWorks} className="hover:text-ink">
            How it works
          </Link>
          <Link href={ROUTES.pricing} className="hover:text-ink">
            Pricing
          </Link>
          <Link href={ROUTES.signIn} className="hover:text-ink">
            Sign in
          </Link>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-6">
        <nav
          aria-label="Legal"
          className="flex items-center justify-center gap-3 text-xs text-ink-soft md:justify-start"
        >
          <Link href={ROUTES.legal.terms} className="hover:text-ink">
            Terms
          </Link>
          <span aria-hidden="true">·</span>
          <Link href={ROUTES.legal.privacy} className="hover:text-ink">
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
          <Link href={ROUTES.legal.refunds} className="hover:text-ink">
            Refunds
          </Link>
        </nav>
      </div>
    </footer>
  );
}
