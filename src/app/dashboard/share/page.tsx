"use client";

import { useEffect, useState } from "react";
import { PetArt } from "@/components/art/PetArt";
import { ApartmentPacket } from "@/components/share/ApartmentPacket";
import { api, getOwnerId, type Pet, type ShareLink } from "@/lib/api";
import { passportHref } from "@/lib/routes";

function formatExpiry(expiresAt?: number): string {
  if (expiresAt == null) return "No expiry";
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return "No expiry";
  return `Expires ${d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })}`;
}

/** Owner manages active share links (grouped per pet) + apartment packet. */
export default function SharePage() {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [linksByPet, setLinksByPet] = useState<Record<string, ShareLink[]>>({});
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    const id = getOwnerId();
    setOwnerId(id);
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const owned = await api.pets.list(id);
        if (cancelled) return;
        setPets(owned);
        const entries = await Promise.all(
          owned.map(async (pet) => {
            try {
              const links = await api.share.listByPet(id, pet._id);
              return [pet._id, links.filter((l) => l.isActive)] as const;
            } catch {
              return [pet._id, []] as const;
            }
          }),
        );
        if (cancelled) return;
        setLinksByPet(Object.fromEntries(entries));
      } catch {
        if (!cancelled) setLinksByPet({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRevoke(linkId: string, petId: string) {
    if (!ownerId || revokingId) return;
    setRevokingId(linkId);
    try {
      await api.share.revoke(ownerId, linkId);
      setLinksByPet((prev) => ({
        ...prev,
        [petId]: (prev[petId] ?? []).filter((l) => l._id !== linkId),
      }));
    } catch {
      /* keep the link visible when revoke fails */
    } finally {
      setRevokingId(null);
    }
  }

  const petsWithLinks = pets.filter((p) => (linksByPet[p._id] ?? []).length > 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-4">
        <PetArt name="link" size={72} />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-2xl font-bold">Shared links</h1>
          <p className="text-sm font-semibold text-brand-700">
            Share the love, safely.
          </p>
          <p className="text-sm text-ink-soft">
            One link per recipient — revoke one without breaking the others.
          </p>
        </div>
      </header>

      <section
        aria-label="Active share links"
        className="rounded-2xl border border-ink/10 bg-white p-4"
      >
      {loading ? (
        <p aria-live="polite" className="text-sm text-ink-soft">
          Loading links… 🐾
        </p>
      ) : petsWithLinks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-8 text-center text-sm text-ink-soft">
          <PetArt name="sleepy" size={120} className="mx-auto" />
          <p className="mt-3">
            No active links yet. Create one from a pet&apos;s profile.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {petsWithLinks.map((pet) => (
            <section
              key={pet._id}
              aria-label={`${pet.name}'s links`}
              className="rounded-2xl border border-ink/10 bg-white p-4"
            >
              <h2 className="font-display font-bold">{pet.name}</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {(linksByPet[pet._id] ?? []).map((link) => (
                  <li
                    key={link._id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2.5"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-semibold">
                        {link.label || "Passport link"}
                      </p>
                      <p className="truncate text-xs text-ink-soft">
                        <a
                          href={passportHref(link.token)}
                          className="font-medium text-brand-700 underline"
                        >
                          /p/{link.token.slice(0, 8)}…
                        </a>{" "}
                        · {formatExpiry(link.expiresAt)} · {link.viewCount}{" "}
                        {link.viewCount === 1 ? "view" : "views"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(link._id, pet._id)}
                      disabled={revokingId === link._id}
                      className="min-h-[48px] shrink-0 rounded-xl border border-ink/15 bg-white px-4 text-sm font-semibold hover:bg-cream-dark disabled:opacity-60"
                    >
                      {revokingId === link._id ? "Revoking…" : "Revoke"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      </section>

      <section aria-label="Apartment packet" className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-bold">Apartment packet</h2>
        <p className="text-sm text-ink-soft">
          A printable pet resume for rental applications.
        </p>
        {/* TODO(convex): wire pets.get + vaccinations.listByPet, replace DEMO props below. */}
        <ApartmentPacket
          petName="Mochi"
          species="dog"
          breed="Shiba Inu"
          birthdate="2021-04-12"
          weightKg={9}
          microchipLast4="1234"
          spayNeuter={true}
          vaccines={[
            { name: "Rabies", status: "valid", administeredAt: "2025-06-01" },
            { name: "DHPP", status: "valid", administeredAt: "2025-06-01" },
            { name: "Bordetella", status: "expiring" },
          ]}
        />
      </section>
    </div>
  );
}
