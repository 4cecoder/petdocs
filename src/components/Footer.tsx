import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export function Footer() {
  return (
    <footer className="border-t border-ink/10 bg-cream-dark/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-ink-soft md:flex-row">
        <p className="flex items-center gap-2">
          <span aria-hidden="true">🐾</span> petdocs — own your pet&apos;s docs
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
    </footer>
  );
}
