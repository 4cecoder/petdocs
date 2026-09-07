import Link from "next/link";
import { PetArt } from "@/components/art/PetArt";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-ink/10 bg-white px-8 py-10 shadow-sm">
        <PetArt name="lost" size={180} />
        <h1 className="font-display text-2xl font-bold">
          This trail went cold
        </h1>
        <p className="text-ink-soft">
          The page you&apos;re looking for doesn&apos;t exist, but your
          pet&apos;s docs are safe.
        </p>
        <p className="text-sm text-ink-soft">
          Even good pups get lost sometimes.
        </p>
        <Link
          href={ROUTES.home}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
