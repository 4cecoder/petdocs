"use client";

import Link from "next/link";
import { useState } from "react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: ROUTES.howItWorks, label: "How it works" },
  { href: ROUTES.pricing, label: "Pricing" },
  { href: ROUTES.signIn, label: "Sign in" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-ink/10 bg-cream/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href={ROUTES.home} className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-xl text-white"
          >
            🐾
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            petdocs
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-soft hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={ROUTES.onboarding}
            className="rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Get started
          </Link>
        </nav>

        <button
          type="button"
          className="min-h-[48px] min-w-[48px] rounded-xl px-3 text-xl md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>

      <div className={cn("border-t border-ink/10 px-6 py-4 md:hidden", !mobileOpen && "hidden")}>
        <nav className="flex flex-col gap-1">
          {[...navLinks, { href: ROUTES.onboarding, label: "Get started" }].map(
            (link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="min-h-[48px] rounded-xl px-3 py-3 font-medium hover:bg-cream-dark"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
