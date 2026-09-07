import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-6xl">🐾</p>
      <h1 className="font-display text-2xl font-bold">This trail went cold</h1>
      <p className="text-ink-soft">
        The page you&apos;re looking for doesn&apos;t exist — but your
        pet&apos;s docs are safe.
      </p>
      <Link
        href={ROUTES.home}
        className="rounded-2xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
      >
        Back home
      </Link>
    </main>
  );
}
